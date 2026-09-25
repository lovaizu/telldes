// Small pieces shared by the lists and the details.
import { For, Show } from "solid-js";
import type { Finding } from "../core/findings";
import { TASK, type TaskKey } from "./placeholders";
import { useWorkspace } from "./workspace";

/** ARIA states want the strings "true" / "false", not a boolean. */
export const ariaBool = (value: boolean) => (value ? "true" : "false");

/** Marks a value as a placeholder that the given task replaces. */
export function Tentative(props: { task: TaskKey }) {
  const task = () => TASK[props.task];
  return (
    <span class="tentative" title={`仮の結果です。#${task().number} ${task().feature} で本物に差し替えます`}>
      仮 #{task().number}
    </span>
  );
}

export function Swatch(props: { color: string | undefined }) {
  return (
    <Show when={props.color}>
      <span class="swatch" style={{ background: props.color }} aria-hidden="true" />
    </Show>
  );
}

/** The marks at the end of a row: its own errors and notices, and a note. */
export function RowMarks(props: { findings: Finding[]; note?: boolean; below?: boolean }) {
  const count = (severity: Finding["severity"]) => props.findings.filter((f) => f.severity === severity).length;
  return (
    <span class="marks">
      <Show when={props.note}>
        <span class="mark note" title="note あり">✎</span>
      </Show>
      <Show when={count("error")}>
        <span class="mark error" title="error">● {count("error")}</span>
      </Show>
      <Show when={count("notice")}>
        <span class="mark notice" title="知らせ">○ {count("notice")}</span>
      </Show>
      <Show when={props.below}>
        <span class="mark below" title="中のレイヤーに error か知らせがあります">…</span>
      </Show>
    </span>
  );
}

/** Findings owned by the object in the detail, with the layers where each occurs. */
export function Findings(props: { findings: Finding[] }) {
  const ws = useWorkspace();
  return (
    <Show when={props.findings.length}>
      <section class="block">
        <h3>
          error と知らせ <Tentative task="review" />
        </h3>
        <ul class="findings">
          <For each={props.findings}>
            {(finding) => (
              <li class={["finding", finding.severity]}>
                <p>
                  <span class="severity">{finding.severity === "error" ? "error" : "知らせ"}</span> {finding.message}
                </p>
                <p class="fix">直し方: {finding.fix}</p>
                <Show when={finding.layerIds.length}>
                  <p class="where">使っている所（押すと Figma で選びます）</p>
                  <ul class="places">
                    <For each={finding.layerIds}>
                      {(id) => (
                        <li>
                          <button class="link" onClick={() => void ws.selectInFigma(id)}>
                            {ws.index.get(id)?.path.join(" / ") ?? id}
                          </button>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
}
