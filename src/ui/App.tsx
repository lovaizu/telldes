import { createSignal, For, Match, Switch } from "solid-js";
import { countLayers, screensOf } from "../core/screens";
import type { FileData } from "../shared/data";
import { request } from "./bridge";

type ReadState =
  | { status: "reading" }
  | { status: "done"; data: FileData }
  | { status: "failed"; message: string };

export function App() {
  const [state, setState] = createSignal<ReadState>({ status: "reading" });

  request("read", {}).then(
    (data) => setState({ status: "done", data }),
    (error: Error) => setState({ status: "failed", message: error.message }),
  );

  return (
    <main>
      <Switch>
        <Match when={state().status === "reading"}>
          <p>読み込み中…</p>
        </Match>
        <Match when={narrow(state(), "failed")}>
          {(failed) => <p class="error">読み込めませんでした: {failed().message}</p>}
        </Match>
        <Match when={narrow(state(), "done")}>{(done) => <FileSummary file={done().data} />}</Match>
      </Switch>
    </main>
  );
}

/** The state if it has the given status, so `Match` can hand the narrowed state to its children. */
function narrow<S extends ReadState["status"]>(state: ReadState, status: S): Extract<ReadState, { status: S }> | undefined {
  return state.status === status ? (state as Extract<ReadState, { status: S }>) : undefined;
}

function FileSummary(props: { file: FileData }) {
  const tokens = () => props.file.tokens;
  const screens = () => screensOf(props.file.page);

  return (
    <>
      <p>
        {props.file.fileName} / {props.file.page.name}
      </p>

      <h2>トークン</h2>
      <ul>
        <Row label="変数コレクション" count={tokens().collections.length} />
        <Row label="変数" count={tokens().variables.length} />
        <Row label="Text Style" count={tokens().textStyles.length} />
        <Row label="Effect Style" count={tokens().effectStyles.length} />
        <Row label="Color Style" count={tokens().paintStyles.length} />
      </ul>

      <h2>画面（{screens().length}）とレイヤー数</h2>
      <ul>
        <For each={screens()} fallback={<li>ページ直下にフレームがありません</li>}>
          {(screen) => (
            <Row label={`${screen.name}  ${screen.width}×${screen.height}`} count={countLayers(screen)} />
          )}
        </For>
      </ul>
    </>
  );
}

function Row(props: { label: string; count: number }) {
  return (
    <li>
      <span>{props.label}</span>
      <span class="count">{props.count}</span>
    </li>
  );
}
