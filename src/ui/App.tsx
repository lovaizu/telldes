import { createSignal, For, onCleanup, Show } from "solid-js";
import { countLayers, screensOf } from "../core/screens";
import type { FileData } from "../shared/data";
import { onMainMessage, postToMain } from "./bridge";

type ReadState =
  | { status: "reading" }
  | { status: "done"; data: FileData }
  | { status: "failed"; message: string };

export function App() {
  const [state, setState] = createSignal<ReadState>({ status: "reading" });

  onCleanup(
    onMainMessage((message) => {
      switch (message.type) {
        case "read-done":
          setState({ status: "done", data: message.data });
          return;
        case "read-failed":
          setState({ status: "failed", message: message.message });
          return;
      }
    }),
  );
  postToMain({ type: "read" });

  const data = () => {
    const s = state();
    return s.status === "done" ? s.data : undefined;
  };
  const failure = () => {
    const s = state();
    return s.status === "failed" ? s.message : undefined;
  };

  return (
    <main>
      <Show when={state().status === "reading"}>
        <p>読み込み中…</p>
      </Show>
      <Show when={failure()}>
        {(message) => <p class="error">読み込めませんでした: {message()}</p>}
      </Show>
      <Show when={data()}>{(file) => <FileSummary file={file()} />}</Show>
    </main>
  );
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
