import { createSignal, For, Show, type Component } from "solid-js";
import promptTemplate from "./templates/prompt.md?raw";
import steeringTemplate from "./templates/steering.md?raw";
import type { CheckResult } from "./checks/types";

type Tab = "check" | "note" | "export";

interface SelectionNote {
  nodeId: string;
  nodeName: string;
  note: string;
}

interface ExportFile {
  path: string;
  data: Uint8Array;
}

interface ExportFrame {
  name: string;
  spec: { children?: { name: string }[]; viewport?: { width: number } };
  screenshots: ExportFile[];
  assets: ExportFile[];
}

interface ExportData {
  frames: ExportFrame[];
  tokens: unknown;
}

const App: Component = () => {
  const [activeTab, setActiveTab] = createSignal<Tab>("check");
  const [results, setResults] = createSignal<CheckResult[]>([]);
  const [hasRun, setHasRun] = createSignal(false);
  const [running, setRunning] = createSignal(false);
  const [selectionNote, setSelectionNote] = createSignal<SelectionNote | null>(null);
  const [noteText, setNoteText] = createSignal("");
  const [noteSaved, setNoteSaved] = createSignal(false);
  const [exporting, setExporting] = createSignal(false);
  const [exportError, setExportError] = createSignal("");
  const [exportDone, setExportDone] = createSignal(false);

  window.onmessage = (event: MessageEvent) => {
    const msg = event.data.pluginMessage;
    if (!msg) return;
    if (msg.type === "check-results") {
      setResults(msg.results);
      setHasRun(true);
      setRunning(false);
    }
    if (msg.type === "selection-note") {
      setSelectionNote(msg.data);
      setNoteText(msg.data?.note ?? "");
      setNoteSaved(false);
    }
    if (msg.type === "note-saved" && msg.nodeId === selectionNote()?.nodeId) {
      // Ignore a late ack for a node the user has already navigated away from.
      setNoteSaved(true);
    }
    if (msg.type === "export-error") {
      setExportError(msg.message);
      setExporting(false);
    }
    if (msg.type === "export-data") {
      handleExportData(msg);
    }
  };

  const generateSectionTasks = (sections: { name: string }[]) =>
    sections
      .map((s) => `- [ ] Code section: **${s.name}**\n  - [ ] Layout and structure\n  - [ ] Visual styles\n  - [ ] Assets and images\n  - [ ] Notes and interactions\n  - [ ] Compare with screenshot`)
      .join("\n") || "- [ ] (no sections found)";

  const addFilesToFolder = (
    folder: { file: (path: string, data: Uint8Array) => void },
    screenshots: ExportFile[],
    assets: ExportFile[],
  ) => {
    for (const ss of screenshots) {
      folder.file(ss.path, ss.data);
    }
    for (const asset of assets) {
      folder.file(asset.path, asset.data);
    }
  };

  // Top-level frame names become zip folder names. Neutralize path separators
  // (so they can't spawn nested folders) and suffix duplicates so two frames
  // sharing a name (e.g. responsive desktop/mobile copies) don't clobber.
  const resolveFrameFolderNames = (names: string[]): string[] => {
    const used = new Set<string>();
    return names.map((raw) => {
      const base = raw.replace(/[/\\]/g, "-").trim() || "frame";
      let name = base;
      let i = 2;
      while (used.has(name)) name = `${base}-${i++}`;
      used.add(name);
      return name;
    });
  };

  const handleExportData = async (msg: ExportData) => {
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const root = zip.folder("telldes-export")!;

      if (msg.tokens) {
        root.file("tokens.json", JSON.stringify(msg.tokens, null, 2));
      }

      const allSections: { name: string }[] = [];
      // Primary viewport = the first frame's width (not whichever frame is last).
      const primaryWidth = msg.frames[0]?.spec?.viewport?.width ?? 1440;
      const frameNames = resolveFrameFolderNames(msg.frames.map((f) => f.name));

      msg.frames.forEach((frame, idx) => {
        const folder = root.folder(frameNames[idx])!;
        folder.file("spec.json", JSON.stringify(frame.spec, null, 2));
        addFilesToFolder(folder, frame.screenshots, frame.assets);
        allSections.push(...(frame.spec?.children ?? []));
      });

      const sectionTasks = generateSectionTasks(allSections);
      root.file("prompt.md", promptTemplate.replace(/\{\{VIEWPORT_WIDTH\}\}/g, String(primaryWidth)));
      root.file("steering.md", steeringTemplate
        .replace(/\{\{VIEWPORT_WIDTH\}\}/g, String(primaryWidth))
        .replace(/\{\{SECTION_TASKS\}\}/g, sectionTasks));
      const readmeContent = [
        "# Telldes Export",
        "",
        "This zip was exported by the Telldes Figma plugin.",
        "",
        "## Contents",
        "",
        "- `prompt.md` — Coding instructions for Claude Code",
        "- `steering.md` — Pre-coding checklist, tasks, and rules",
        msg.tokens ? "- `tokens.json` — Design tokens (W3C DTCG format)" : null,
        ...frameNames.map((n: string) => `- \`${n}/\` — spec.json, screenshots, and assets for frame "${n}"`),
      ].filter(Boolean).join("\n");
      root.file("README.md", readmeContent);

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
    parent.postMessage({ pluginMessage: { type: "run-checks" } }, "*");
  };

  const selectNode = (nodeId: string) => {
    parent.postMessage({ pluginMessage: { type: "select-node", nodeId } }, "*");
  };

  const errors = () => results().filter((r) => r.level === "error");
  const suggestions = () => results().filter((r) => r.level === "suggestion");

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
          classList={{ active: activeTab() === "check" }}
          onClick={() => setActiveTab("check")}
        >
          Review
        </button>
        <button
          class="tab"
          classList={{ active: activeTab() === "note" }}
          onClick={() => setActiveTab("note")}
        >
          Notes
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

            <Show when={hasRun()}>
              <Show
                when={results().length > 0}
                fallback={<div class="pass">All checks passed</div>}
              >
                <Show when={errors().length > 0}>
                  <div class="section-label error-label">
                    Errors ({errors().length})
                  </div>
                  <ul class="result-list">
                    <For each={errors()}>
                      {(item) => (
                        <li
                          class="result-item error-item"
                          onClick={() => selectNode(item.nodeId)}
                        >
                          <div class="result-node">{item.nodeName}</div>
                          <div class="result-message">{item.message}</div>
                          <div class="result-suggestion">{item.suggestion}</div>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>

                <Show when={suggestions().length > 0}>
                  <div class="section-label suggestion-label">
                    Suggestions ({suggestions().length})
                  </div>
                  <ul class="result-list">
                    <For each={suggestions()}>
                      {(item) => (
                        <li
                          class="result-item suggestion-item"
                          onClick={() => selectNode(item.nodeId)}
                        >
                          <div class="result-node">{item.nodeName}</div>
                          <div class="result-message">{item.message}</div>
                          <div class="result-suggestion">{item.suggestion}</div>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
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
        .suggestion-label {
          color: #7b61ff;
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
        .suggestion-item {
          border-left-color: #7b61ff;
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
