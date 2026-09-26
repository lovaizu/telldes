// Small pieces shared by the lists and the details.
import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";
import type { Finding } from "../core/findings";
import { TASK, type TaskKey } from "./placeholders";
import { useWorkspace } from "./workspace";

/** ARIA states want the strings "true" / "false", not a boolean. */
export const ariaBool = (value: boolean) => (value ? "true" : "false");

/** Hover text naming the task that replaces a placeholder. */
export function placeholderTitle(key: TaskKey): string {
  const task = TASK[key];
  return `Placeholder. Task #${task.number} (${task.feature}) replaces it.`;
}

/**
 * Wraps a placeholder value. The screen says once, in the status line, that
 * results are placeholders; here only the hover text names the task, so the
 * marks do not crowd the screen.
 */
export function Tentative(props: { task: TaskKey; children: JSX.Element }) {
  return (
    <span class="tentative" title={placeholderTitle(props.task)}>
      {props.children}
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
        <span class="mark note" title="Has a note">✎</span>
      </Show>
      <Show when={count("error")}>
        <span class="mark error" title="Errors">● {count("error")}</span>
      </Show>
      <Show when={count("notice")}>
        <span class="mark notice" title="Notices">○ {count("notice")}</span>
      </Show>
      <Show when={props.below}>
        <span class="mark below" title="Errors or notices inside">…</span>
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
          <Tentative task="review">Errors and notices</Tentative>
        </h3>
        <ul class="findings">
          <For each={props.findings}>
            {(finding) => (
              <li class={["finding", finding.severity]}>
                <p>
                  <span class="severity">{finding.severity === "error" ? "Error" : "Notice"}</span> {finding.message}
                </p>
                <p class="fix">Fix: {finding.fix}</p>
                <Show when={finding.layerIds.length}>
                  <p class="where">Used in</p>
                  <ul class="places">
                    <For each={finding.layerIds}>
                      {(id) => (
                        <li>
                          <button class="link" title="Select in Figma" onClick={() => void ws.selectInFigma(id)}>
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
