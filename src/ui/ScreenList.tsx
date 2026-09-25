// The Web pages that Export hands over, each with its screens (one per width)
// and their layers, and what does not get handed over. The list is the manifest
// of the zip, so Export sits on it.
import { For, Show } from "solid-js";
import type { LayerEntry, WebPage } from "../core/screens";
import { dropReasonText, size } from "./format";
import { ariaBool, RowMarks } from "./parts";
import { useWorkspace, webPageKey } from "./workspace";

export function ScreenList() {
  const ws = useWorkspace();
  return (
    <div class="list">
      <div class="list-head">
        <h3>
          渡す Web ページ {ws.webPages().length}・画面 {ws.screens.length}
        </h3>
        <button class="primary" disabled={ws.screens.length === 0} onClick={() => ws.runExport()}>
          Export
        </button>
      </div>
      <Show when={ws.errorCount() > 0}>
        <p class="hint">error が {ws.errorCount()} 件あります。Export は Review し直し、残っていれば止めます</p>
      </Show>
      <ul class="tree">
        <For each={ws.webPages()} fallback={<li class="empty">Figma のページの直下に、表示中のフレームがありません</li>}>
          {(webPage) => <WebPageNode webPage={webPage} />}
        </For>
      </ul>

      <Show when={ws.dropped.length}>
        <h3>渡らないもの {ws.dropped.length}</h3>
        <ul>
          <For each={ws.dropped}>
            {(item) => {
              const id = item.entry.layer.id;
              return (
                <li>
                  <button
                    class="row dropped"
                    aria-current={ws.isOpen({ kind: "layer", id }) && "true"}
                    onClick={() => ws.openLayer(id)}
                    title={item.entry.path.join(" / ")}
                  >
                    <span class="name">{item.entry.path.join(" / ")}</span>
                    <span class="tag">{dropReasonText(item.reason, item.entry.layer)}</span>
                    <RowMarks findings={ws.findingsOf({ kind: "layer", id })} note={!!ws.state.notes[id]} />
                  </button>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>
    </div>
  );
}

function WebPageNode(props: { webPage: WebPage }) {
  const ws = useWorkspace();
  const key = () => webPageKey(props.webPage.id);
  const expanded = () => !!ws.state.expanded[key()];
  return (
    <li>
      <div class="tree-row">
        <Chevron expanded={expanded()} onToggle={() => ws.toggle(key())} />
        <button
          class="row web-page"
          aria-current={ws.isOpen({ kind: "webPage", id: props.webPage.id }) && "true"}
          onClick={() => ws.open({ kind: "webPage", id: props.webPage.id })}
        >
          <span class="name">{ws.webPageName(props.webPage.id)}</span>
          <span class="sub">画面 {props.webPage.screenIds.length}</span>
          <RowMarks findings={[]} below={!expanded() && ws.hasFindingsBelow(key())} />
        </button>
      </div>
      <Show when={expanded()}>
        <ul>
          <For each={props.webPage.screenIds}>{(id) => <LayerNode entry={ws.index.get(id)!} depth={1} />}</For>
        </ul>
      </Show>
    </li>
  );
}

function Chevron(props: { expanded: boolean; onToggle: () => void }) {
  return (
    <button class="chevron" aria-expanded={ariaBool(props.expanded)} aria-label={props.expanded ? "たたむ" : "ひらく"} onClick={() => props.onToggle()}>
      {props.expanded ? "▾" : "▸"}
    </button>
  );
}

function LayerNode(props: { entry: LayerEntry; depth: number }) {
  const ws = useWorkspace();
  const id = () => props.entry.layer.id;
  const isScreen = () => props.entry.screenId === id();
  const children = () => props.entry.layer.children ?? [];
  const expanded = () => !!ws.state.expanded[id()];

  return (
    <li>
      <div class={["tree-row", { dropped: !!props.entry.dropped }]} style={{ "padding-left": `${props.depth * 12}px` }}>
        <Show when={children().length} fallback={<span class="chevron-space" />}>
          <Chevron expanded={expanded()} onToggle={() => ws.toggle(id())} />
        </Show>
        <button class="row" aria-current={ws.isOpen({ kind: "layer", id: id() }) && "true"} onClick={() => ws.openLayer(id())}>
          <span class="name">{props.entry.layer.name}</span>
          <Show when={isScreen()}>
            <span class="sub">{size(props.entry.layer)}</span>
          </Show>
          <Show when={props.entry.dropped}>
            <span class="tag">非表示</span>
          </Show>
          <RowMarks
            findings={ws.findingsOf({ kind: isScreen() ? "screen" : "layer", id: id() })}
            note={!!ws.state.notes[id()]}
            below={!expanded() && ws.hasFindingsBelow(id())}
          />
        </button>
      </div>
      <Show when={expanded()}>
        <ul>
          <For each={children()}>{(child) => <LayerNode entry={ws.index.get(child.id)!} depth={props.depth + 1} />}</For>
        </ul>
      </Show>
    </li>
  );
}
