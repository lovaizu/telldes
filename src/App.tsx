import { createSignal, type Component } from "solid-js";

type Tab = "check" | "note" | "export";

const App: Component = () => {
  const [activeTab, setActiveTab] = createSignal<Tab>("check");

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
            <p class="placeholder">Review (not implemented)</p>
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
      `}</style>
    </div>
  );
};

export default App;
