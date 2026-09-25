import { createSignal, Match, Show, Switch } from "solid-js";
import type { FindingOwner } from "../core/findings";
import type { FileData } from "../shared/data";
import { request } from "./bridge";
import { Detail } from "./Detail";
import { ariaBool, placeholderTitle, RowMarks } from "./parts";
import { TASK } from "./placeholders";
import { ScreenList } from "./ScreenList";
import { TokenList } from "./TokenList";
import { TopBar } from "./TopBar";
import { createWorkspace, useWorkspace, WorkspaceContext } from "./workspace";

type ReadState = { status: "reading" } | { status: "done"; data: FileData } | { status: "failed"; message: string };

export function App() {
  const [state, setState] = createSignal<ReadState>({ status: "reading" });

  request("read", {}).then(
    (data) => setState({ status: "done", data }),
    (error: Error) => setState({ status: "failed", message: error.message }),
  );

  return (
    <Switch>
      <Match when={state().status === "reading"}>
        <p class="message">Reading the file…</p>
      </Match>
      <Match when={narrow(state(), "failed")}>{(failed) => <p class="message error">Couldn't read the file: {failed().message}</p>}</Match>
      <Match when={narrow(state(), "done")} keyed>
        {(done) => (
          <WorkspaceContext value={createWorkspace(done.data)}>
            <Layout />
          </WorkspaceContext>
        )}
      </Match>
    </Switch>
  );
}

/** The state if it has the given status, so `Match` can hand the narrowed state to its children. */
function narrow<S extends ReadState["status"]>(state: ReadState, status: S): Extract<ReadState, { status: S }> | undefined {
  return state.status === status ? (state as Extract<ReadState, { status: S }>) : undefined;
}

function Layout() {
  const ws = useWorkspace();
  return (
    <div class="layout">
      <TopBar />
      <nav class="pane-list" aria-label="Lists">
        <div class="tabs" role="tablist">
          {/* Both counts are of what is handed over; what is not is listed, and counted, inside each tab. */}
          <button role="tab" aria-selected={ariaBool(ws.state.tab === "screens")} onClick={() => ws.setTab("screens")} title="Frames to export">
            Frames {ws.screens.length}
            <TabMarks kinds={["screen", "layer"]} />
          </button>
          <button role="tab" aria-selected={ariaBool(ws.state.tab === "tokens")} onClick={() => ws.setTab("tokens")} title="Tokens to export">
            Tokens {ws.handedTokenCount}
            <TabMarks kinds={["token", "value"]} />
          </button>
        </div>
        <Show when={ws.state.filter}>
          {(severity) => (
            <div class="filter-bar">
              <span>Only rows with {severity()}s</span>
              <button class="link" onClick={() => ws.setFilter(null)}>
                Show all
              </button>
            </div>
          )}
        </Show>
        <Switch>
          <Match when={ws.state.tab === "screens"}>
            <ScreenList />
          </Match>
          <Match when={ws.state.tab === "tokens"}>
            <TokenList />
          </Match>
        </Switch>
      </nav>
      <main class="pane-detail">
        <Detail />
      </main>
      <footer class="status">
        <span
          class={["status-text", { error: !!ws.state.status?.error }]}
          role="status"
          title={ws.state.status?.task ? placeholderTitle(ws.state.status.task) : undefined}
        >
          {ws.state.status?.text ?? "Select a row to see its details. The layer is selected in Figma too."}
        </span>
        <span class="prototype" title={PROTOTYPE_TITLE}>
          Prototype — results are placeholders
        </span>
      </footer>
    </div>
  );
}

/** The one place the screen says it is a prototype; which task replaces what is on hover. */
const PROTOTYPE_TITLE = [
  "Nothing is written to the Figma file. Tasks that replace the placeholders:",
  ...Object.values(TASK).map((task) => `#${task.number} ${task.feature}`),
].join("\n");

/** The errors and notices owned by the objects in a tab, so none hide behind the other tab. */
function TabMarks(props: { kinds: FindingOwner["kind"][] }) {
  const ws = useWorkspace();
  return <RowMarks findings={ws.state.findings.filter((f) => props.kinds.includes(f.owner.kind))} />;
}
