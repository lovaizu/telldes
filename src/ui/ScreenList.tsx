// The Web pages that Export hands over, each with its screens (one per width)
// and their layers, and what does not get handed over. The list is the manifest
// of the zip.
import { For, Show } from "solid-js";
import type { LayerEntry, WebPage } from "../core/screens";
import { counted, dropReasonText, size } from "./format";
import { ariaBool, RowMarks } from "./parts";
import { useWorkspace, webPageKey } from "./workspace";

export function ScreenList() {
  const ws = useWorkspace();
  const webPages = () => ws.webPages().filter((w) => ws.passesFilter(null, webPageKey(w.id)));
  const dropped = () => ws.dropped.filter((item) => ws.passesFilter({ kind: "layer", id: item.entry.layer.id }, item.entry.layer.id));
  return (
    <div class="list">
      <h3 title="What Export writes">
        {counted(ws.webPages().length, "Web page")} · {counted(ws.screens.length, "screen")}
      </h3>
      <ul class="tree">
        <For each={webPages()} fallback={<li class="empty">{ws.state.filter ? `No rows with ${ws.state.filter}s here` : "No visible frames on this Figma page"}</li>}>
          {(webPage) => <WebPageNode webPage={webPage} />}
        </For>
      </ul>

      <Show when={dropped().length}>
        <h3 title="Hidden layers and things that are not frames">Not exported {ws.dropped.length}</h3>
        <ul>
          <For each={dropped()}>
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
  const screenIds = () => props.webPage.screenIds.filter((id) => ws.passesFilter({ kind: "screen", id }, id));
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
          <span class="sub">{counted(props.webPage.screenIds.length, "screen")}</span>
          <RowMarks findings={[]} below={!expanded() && ws.hasFindingsBelow(key())} />
        </button>
      </div>
      <Show when={expanded()}>
        <ul>
          <For each={screenIds()}>{(id) => <LayerNode entry={ws.index.get(id)!} depth={1} />}</For>
        </ul>
      </Show>
    </li>
  );
}

function Chevron(props: { expanded: boolean; onToggle: () => void }) {
  return (
    <button class="chevron" aria-expanded={ariaBool(props.expanded)} aria-label={props.expanded ? "Collapse" : "Expand"} onClick={() => props.onToggle()}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6.5 5l3 3-3 3" fill="none" stroke="currentColor" />
      </svg>
    </button>
  );
}

function LayerNode(props: { entry: LayerEntry; depth: number }) {
  const ws = useWorkspace();
  const id = () => props.entry.layer.id;
  const isScreen = () => props.entry.screenId === id();
  const children = () => (props.entry.layer.children ?? []).filter((child) => ws.passesFilter({ kind: "layer", id: child.id }, child.id));
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
            <span class="tag">Hidden</span>
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
