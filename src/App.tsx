import { createSignal, For, Show, type Component } from "solid-js";
import promptTemplate from "./templates/prompt.md?raw";
import steeringTemplate from "./templates/steering.md?raw";
import type { CheckLevel, CheckResult } from "./checks/types";
import type {
  CheckErrorMessage,
  CheckResultsMessage,
  ExportDataMessage,
  PluginMessage,
  SelectionNote,
} from "./messages";
import { buildExportZip } from "./export/zipBuilder";

type Tab = "check" | "note" | "export";

/** What the Review tab shows after one run, whether it finished or failed. */
interface ReviewOutcome {
  results: CheckResult[];
  hasRun: boolean;
  error: string;
}

/**
 * The Review tab shows one run's outcome, so a failure replaces the previous
 * results instead of stacking a banner on top of them (design doc 4.7.2
 * 「実行失敗の扱い」). A plain function, because nothing else in App.tsx can be
 * asserted without a DOM.
 */
export function reviewOutcome(
  msg: CheckResultsMessage | CheckErrorMessage,
): ReviewOutcome {
  return msg.type === "check-error"
    ? { results: [], hasRun: false, error: msg.message }
    : { results: msg.results, hasRun: true, error: "" };
}

/** The Review signals, as the message handler writes them. */
interface ReviewSetters {
  setResults: (results: CheckResult[]) => void;
  setHasRun: (hasRun: boolean) => void;
  setCheckError: (message: string) => void;
  setRunning: (running: boolean) => void;
}

/**
 * The Review half of `window.onmessage`, extracted whole: inline, neither the
 * messages it answers nor the signals it writes could be asserted, so dropping
 * the `check-error` branch (the tab pinned on "Running...", no reason shown)
 * or any one setter was invisible.
 */
export function applyReviewOutcome(msg: PluginMessage, setters: ReviewSetters): void {
  if (msg.type !== "check-results" && msg.type !== "check-error") return;
  const outcome = reviewOutcome(msg);
  setters.setResults(outcome.results);
  setters.setHasRun(outcome.hasRun);
  setters.setCheckError(outcome.error);
  // Both paths clear "Running...", or the tab stays pinned on it forever.
  setters.setRunning(false);
}

/** The signals `window.onmessage` writes, plus the one reading it needs. */
interface MessageHandlers extends ReviewSetters {
  setSelectionNote: (note: SelectionNote | null) => void;
  setNoteText: (text: string) => void;
  setNoteSaved: (saved: boolean) => void;
  setExportError: (message: string) => void;
  setExporting: (exporting: boolean) => void;
  /** The layer the Notes tab is on, so a stale `note-saved` can be ignored. */
  selectedNodeId: () => string | undefined;
  startExport: (msg: ExportDataMessage) => void;
}

/**
 * Everything `window.onmessage` does, one step above the signals: the branch
 * per message type. The component keeps only the wiring, so a branch dropped
 * here — the export tab left on "Exporting...", the Review tab on
 * "Running..." — is a failing test rather than a plugin that hangs.
 */
export function handlePluginMessage(
  msg: PluginMessage,
  handlers: MessageHandlers,
): void {
  applyReviewOutcome(msg, handlers);
  if (msg.type === "selection-note") {
    handlers.setSelectionNote(msg.data);
    handlers.setNoteText(msg.data?.note ?? "");
    handlers.setNoteSaved(false);
  }
  if (msg.type === "note-saved" && msg.nodeId === handlers.selectedNodeId()) {
    // Ignore a late ack for a node the user has already navigated away from.
    handlers.setNoteSaved(true);
  }
  if (msg.type === "export-error") {
    handlers.setExportError(msg.message);
    handlers.setExporting(false);
  }
  // The zip build is async and clears "Exporting..." itself.
  if (msg.type === "export-data") handlers.startExport(msg);
}

/** One heading per level, its results beneath it, groups in first-seen order. */
export function groupResultsByLevel(
  results: CheckResult[],
): { level: CheckLevel; items: CheckResult[] }[] {
  const groups = new Map<CheckLevel, CheckResult[]>();
  for (const result of results) {
    const items = groups.get(result.level);
    if (items) items.push(result);
    else groups.set(result.level, [result]);
  }
  return [...groups].map(([level, items]) => ({ level, items }));
}

// CheckLevel is error-only today, so there is exactly one group. Grouping
// rather than filtering is the guard: if a non-blocking level ever returns
// (design doc 4.7.2), its results still get a heading and are still counted by
// what is listed under it, instead of vanishing or inflating the error count.
const LEVEL_HEADINGS: Partial<Record<CheckLevel, string>> = { error: "Errors" };

const App: Component = () => {
  const [activeTab, setActiveTab] = createSignal<Tab>("note");
  const [results, setResults] = createSignal<CheckResult[]>([]);
  const [hasRun, setHasRun] = createSignal(false);
  const [running, setRunning] = createSignal(false);
  const [checkError, setCheckError] = createSignal("");
  const [selectionNote, setSelectionNote] = createSignal<SelectionNote | null>(null);
  const [noteText, setNoteText] = createSignal("");
  const [noteSaved, setNoteSaved] = createSignal(false);
  const [exporting, setExporting] = createSignal(false);
  const [exportError, setExportError] = createSignal("");
  const [exportDone, setExportDone] = createSignal(false);

  window.onmessage = (event: MessageEvent) => {
    const msg = event.data.pluginMessage;
    if (!msg) return;
    handlePluginMessage(msg, {
      setResults,
      setHasRun,
      setCheckError,
      setRunning,
      setSelectionNote,
      setNoteText,
      setNoteSaved,
      setExportError,
      setExporting,
      selectedNodeId: () => selectionNote()?.nodeId,
      startExport: handleExportData,
    });
  };

  const handleExportData = async (msg: ExportDataMessage) => {
    try {
      // Zip assembly lives in export/zipBuilder.ts so it can be tested without
      // a DOM; this component only turns the result into a download.
      const zip = await buildExportZip({
        data: msg,
        promptTemplate,
        steeringTemplate,
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "telldes-export.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Defer revocation so the async download isn't cancelled (Chromium race).
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setExportDone(true);
      setExporting(false);
    } catch (err) {
      setExportError(`Zip generation failed: ${err}`);
      setExporting(false);
    }
  };

  const runChecks = () => {
    setRunning(true);
    setCheckError("");
    parent.postMessage({ pluginMessage: { type: "run-checks" } }, "*");
  };

  const selectNode = (nodeId: string) => {
    parent.postMessage({ pluginMessage: { type: "select-node", nodeId } }, "*");
  };

  const runExport = () => {
    setExporting(true);
    setExportError("");
    setExportDone(false);
    parent.postMessage({ pluginMessage: { type: "run-export" } }, "*");
  };

  const saveNote = () => {
    const sel = selectionNote();
    if (!sel) return;
    parent.postMessage(
      { pluginMessage: { type: "save-note", nodeId: sel.nodeId, note: noteText() } },
      "*",
    );
  };

  return (
    <div class="container">
      <nav class="tabs">
        <button
          class="tab"
          classList={{ active: activeTab() === "note" }}
          onClick={() => setActiveTab("note")}
        >
          Notes
        </button>
        <button
          class="tab"
          classList={{ active: activeTab() === "check" }}
          onClick={() => setActiveTab("check")}
        >
          Review
        </button>
        <button
          class="tab"
          classList={{ active: activeTab() === "export" }}
          onClick={() => setActiveTab("export")}
        >
          Export
        </button>
      </nav>

      <main class="content">
        {activeTab() === "check" && (
          <div class="panel">
            <button class="run-btn" onClick={runChecks} disabled={running()}>
              {running() ? "Running..." : "Run Review"}
            </button>

            <Show when={checkError()}>
              <div class="export-error">{checkError()}</div>
            </Show>

            <Show when={hasRun()}>
              <Show
                when={results().length > 0}
                fallback={<div class="pass">All checks passed</div>}
              >
                <For each={groupResultsByLevel(results())}>
                  {(group) => (
                    <>
                      <div
                        class="section-label"
                        classList={{ "error-label": group.level === "error" }}
                      >
                        {LEVEL_HEADINGS[group.level] ?? group.level} (
                        {group.items.length})
                      </div>
                      <ul class="result-list">
                        <For each={group.items}>
                          {(item) => (
                            <li
                              class="result-item"
                              classList={{ "error-item": group.level === "error" }}
                              onClick={() => selectNode(item.nodeId)}
                            >
                              <div class="result-node">{item.nodeName}</div>
                              <div class="result-message">{item.message}</div>
                              <div class="result-suggestion">{item.suggestion}</div>
                            </li>
                          )}
                        </For>
                      </ul>
                    </>
                  )}
                </For>
              </Show>
            </Show>
          </div>
        )}
        {activeTab() === "note" && (
          <div class="panel">
            <Show
              when={selectionNote()}
              fallback={
                <p class="placeholder">Select a single layer to edit its note</p>
              }
            >
              {(sel) => (
                <>
                  <div class="note-header">{sel().nodeName}</div>
                  <textarea
                    class="note-textarea"
                    value={noteText()}
                    onInput={(e) => {
                      setNoteText(e.currentTarget.value);
                      setNoteSaved(false);
                    }}
                    placeholder="Add a note for this layer..."
                  />
                  <div class="note-actions">
                    <button class="run-btn" onClick={saveNote}>
                      Save
                    </button>
                    <Show when={noteSaved()}>
                      <span class="note-saved">Saved</span>
                    </Show>
                  </div>
                </>
              )}
            </Show>
          </div>
        )}
        {activeTab() === "export" && (
          <div class="panel">
            <button class="run-btn" onClick={runExport} disabled={exporting()}>
              {exporting() ? "Exporting..." : "Export Zip"}
            </button>
            <Show when={exportError()}>
              <div class="export-error">{exportError()}</div>
            </Show>
            <Show when={exportDone()}>
              <div class="pass">Export complete — zip downloaded</div>
            </Show>
          </div>
        )}
      </main>

      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: Inter, "Noto Sans JP", sans-serif;
          font-size: 12px;
          color: #333;
          background: #fff;
        }
        .container {
          display: flex;
          flex-direction: column;
          height: 100vh;
        }
        .tabs {
          display: flex;
          border-bottom: 1px solid #e5e5e5;
        }
        .tab {
          flex: 1;
          padding: 10px 0;
          border: none;
          background: none;
          font-size: 12px;
          font-weight: 500;
          color: #999;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: color 0.15s, border-color 0.15s;
        }
        .tab:hover {
          color: #333;
        }
        .tab.active {
          color: #18a0fb;
          border-bottom-color: #18a0fb;
        }
        .content {
          flex: 1;
          overflow-y: auto;
        }
        .panel {
          padding: 16px;
        }
        .placeholder {
          color: #999;
          text-align: center;
          padding: 40px 0;
        }
        .run-btn {
          width: 100%;
          padding: 8px 0;
          border: none;
          border-radius: 6px;
          background: #18a0fb;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .run-btn:hover:not(:disabled) {
          background: #0d8de5;
        }
        .run-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .pass {
          text-align: center;
          padding: 24px 0;
          color: #1bc47d;
          font-weight: 600;
          font-size: 13px;
        }
        .section-label {
          margin-top: 12px;
          margin-bottom: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .error-label {
          color: #f24822;
        }
        .result-list {
          list-style: none;
        }
        .result-item {
          padding: 8px 10px;
          margin-bottom: 4px;
          border-radius: 4px;
          cursor: pointer;
          border-left: 3px solid transparent;
          transition: background 0.1s;
        }
        .result-item:hover {
          background: #f5f5f5;
        }
        .error-item {
          border-left-color: #f24822;
        }
        .result-node {
          font-weight: 600;
          font-size: 12px;
          margin-bottom: 2px;
        }
        .result-message {
          font-size: 11px;
          color: #666;
        }
        .result-suggestion {
          font-size: 11px;
          color: #999;
          margin-top: 2px;
        }
        .note-header {
          font-weight: 600;
          font-size: 12px;
          margin-bottom: 8px;
          color: #333;
        }
        .note-textarea {
          width: 100%;
          min-height: 120px;
          padding: 8px;
          border: 1px solid #e5e5e5;
          border-radius: 4px;
          font-family: inherit;
          font-size: 12px;
          color: #333;
          resize: vertical;
          outline: none;
          transition: border-color 0.15s;
        }
        .note-textarea:focus {
          border-color: #18a0fb;
        }
        .note-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
        }
        .note-actions .run-btn {
          width: auto;
          padding: 6px 20px;
        }
        .note-saved {
          color: #1bc47d;
          font-size: 11px;
          font-weight: 600;
        }
        .export-error {
          margin-top: 12px;
          padding: 8px 10px;
          border-radius: 4px;
          background: #fef2f2;
          color: #f24822;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
};

export default App;
