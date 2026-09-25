import { createSignal, Match, Show, Switch } from "solid-js";
import type { FindingOwner } from "../core/findings";
import type { FileData } from "../shared/data";
import { request } from "./bridge";
import { Detail } from "./Detail";
import { ariaBool, RowMarks, Tentative } from "./parts";
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
        <p class="message">読み込み中…</p>
      </Match>
      <Match when={narrow(state(), "failed")}>{(failed) => <p class="message error">読み込めませんでした: {failed().message}</p>}</Match>
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
      <nav class="pane-list" aria-label="一覧">
        <div class="tabs" role="tablist">
          {/* Both counts are of what is handed over; what is not is listed, and counted, inside each tab. */}
          <button role="tab" aria-selected={ariaBool(ws.state.tab === "screens")} onClick={() => ws.setTab("screens")} title="渡す画面の数">
            画面 {ws.screens.length}
            <TabMarks kinds={["screen", "layer"]} />
          </button>
          <button role="tab" aria-selected={ariaBool(ws.state.tab === "tokens")} onClick={() => ws.setTab("tokens")} title="渡すトークンの数">
            トークン {ws.handedTokenCount}
            <TabMarks kinds={["token", "value"]} />
          </button>
        </div>
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
      <footer class={["status", { error: !!ws.state.status?.error }]} role="status">
        {ws.state.status?.text ?? "行を選ぶと詳細が出て、Figma でもそのレイヤーが選ばれます"}
        <Show when={ws.state.status?.task}>
          {(task) => (
            <>
              {" "}
              <Tentative task={task()} /> Figma には書き込んでいません
            </>
          )}
        </Show>
      </footer>
    </div>
  );
}

/** The errors and notices owned by the objects in a tab, so none hide behind the other tab. */
function TabMarks(props: { kinds: FindingOwner["kind"][] }) {
  const ws = useWorkspace();
  return <RowMarks findings={ws.state.findings.filter((f) => props.kinds.includes(f.owner.kind))} />;
}
