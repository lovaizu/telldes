// The screens that Export hands over, with their layers, and what does not get
// handed over. The list is the manifest of the zip, so Export sits on it.
import { For, Show } from "solid-js";
import type { LayerEntry } from "../core/screens";
import { dropReasonText, size } from "./format";
import { ariaBool, RowMarks, Tentative } from "./parts";
import { useWorkspace } from "./workspace";

export function ScreenList() {
  const ws = useWorkspace();
  return (
    <div class="list">
      <div class="list-head">
        <h3>渡す画面 {ws.screens.length}</h3>
        <button class="primary" disabled={ws.errorCount() > 0 || ws.screens.length === 0} onClick={() => ws.runExport()}>
          Export
        </button>
      </div>
      <Show when={ws.errorCount() > 0}>
        <p class="hint">
          error が {ws.errorCount()} 件あるので Export できません <Tentative task={5} />
        </p>
      </Show>
      <ul class="tree">
        <For each={ws.screens} fallback={<li class="empty">ページ直下に表示中のフレームがありません</li>}>
          {(screen) => <LayerNode entry={ws.index.get(screen.id)!} depth={0} />}
        </For>
      </ul>

      <Show when={ws.dropped.length}>
        <h3>渡らないもの {ws.dropped.length}</h3>
        <ul>
          <For each={ws.dropped}>
            {(item) => (
              <li>
                <button
                  class="row dropped"
                  aria-current={isOpen(item.entry.layer.id) && "true"}
                  onClick={() => ws.openLayer(item.entry.layer.id)}
                  title={item.entry.path.join(" / ")}
                >
                  <span class="name">{item.entry.path.join(" / ")}</span>
                  <span class="tag">{dropReasonText(item.reason, item.entry.layer)}</span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );

  function isOpen(layerId: string) {
    return ws.state.selected.kind === "layer" && ws.state.selected.id === layerId;
  }
}

function LayerNode(props: { entry: LayerEntry; depth: number }) {
  const ws = useWorkspace();
  const id = () => props.entry.layer.id;
  const children = () => props.entry.layer.children ?? [];
  const expanded = () => !!ws.state.expanded[id()];
  const open = () => ws.state.selected.kind === "layer" && ws.state.selected.id === id();

  return (
    <li>
      <div class={["tree-row", { dropped: !!props.entry.dropped }]} style={{ "padding-left": `${props.depth * 12}px` }}>
        <Show when={children().length} fallback={<span class="chevron-space" />}>
          <button class="chevron" aria-expanded={ariaBool(expanded())} aria-label={expanded() ? "たたむ" : "ひらく"} onClick={() => ws.toggle(id())}>
            {expanded() ? "▾" : "▸"}
          </button>
        </Show>
        <button class="row" aria-current={open() && "true"} onClick={() => ws.openLayer(id())}>
          <span class="name">{props.entry.layer.name}</span>
          <Show when={props.depth === 0}>
            <span class="sub">{size(props.entry.layer)}</span>
          </Show>
          <Show when={props.entry.dropped}>
            <span class="tag">非表示</span>
          </Show>
          <RowMarks
            findings={ws.findingsOf({ kind: props.depth === 0 ? "screen" : "layer", id: id() })}
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
