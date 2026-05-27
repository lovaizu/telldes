import { createSignal, For, Show, type Component } from "solid-js";

type Tab = "check" | "note" | "export";
type CheckLevel = "error" | "suggestion";

interface CheckResult {
  level: CheckLevel;
  nodeId: string;
  nodeName: string;
  message: string;
  suggestion: string;
}

const App: Component = () => {
  const [activeTab, setActiveTab] = createSignal<Tab>("check");
  const [results, setResults] = createSignal<CheckResult[]>([]);
  const [hasRun, setHasRun] = createSignal(false);
  const [running, setRunning] = createSignal(false);

  window.onmessage = (event: MessageEvent) => {
    const msg = event.data.pluginMessage;
    if (!msg) return;
    if (msg.type === "check-results") {
      setResults(msg.results);
      setHasRun(true);
      setRunning(false);
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
            <p class="placeholder">Notes (not implemented)</p>
          </div>
        )}
        {activeTab() === "export" && (
          <div class="panel">
            <p class="placeholder">Export (not implemented)</p>
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
      `}</style>
    </div>
  );
};

export default App;
