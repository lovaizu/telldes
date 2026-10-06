// Tokens as the designer made them, plus raw values that Review asks to decide on.
import { createMemo, For, Show } from "solid-js";
import type { TokenRef } from "../core/tokens";
import { counted, firstValue } from "./format";
import { RowMarks, Swatch, Tentative } from "./parts";
import { useWorkspace } from "./workspace";

export function TokenList() {
  const ws = useWorkspace();

  /** Real groups first; groups that only Setup would create come after. */
  const groups = createMemo(() => {
    const names = [...ws.groups.map((g) => g.name), ...ws.state.planned.map((p) => p.group)];
    // Planned tokens own no findings, so the filter hides them with every unmarked token.
    return [...new Set(names)]
      .map((name) => ({
        name,
        tokens: (ws.groups.find((g) => g.name === name)?.tokens ?? []).filter((t) => ws.passesFilter({ kind: "token", id: t.id })),
        planned: ws.state.filter ? [] : ws.state.planned.filter((p) => p.group === name),
      }))
      .filter((group) => !ws.state.filter || group.tokens.length > 0);
  });

  const droppedCount = () => ws.groups.reduce((n, g) => n + g.tokens.filter((t) => t.dropped).length, 0);

  /** Values that match no token and still own a finding; a value equal to a token is on that token's row. */
  const values = createMemo(() =>
    ws.state.findings
      .flatMap((f) => (f.owner.kind === "value" ? [f.owner.value] : []))
      .filter((v, i, all) => all.indexOf(v) === i && ws.passesFilter({ kind: "value", value: v })),
  );

  return (
    <div class="list">
      <div class="list-head">
        <h3 title="What Export writes">
          {ws.handedTokenCount} to export
          <Show when={droppedCount()}> · {droppedCount()} not exported</Show>
        </h3>
        {/* Loud only while it would add something: it is pressed once when the file is new, then rarely again. */}
        <span class="setup">
          <Show when={ws.missingTokenCount}>
            <span class="hint">{counted(ws.missingTokenCount, "token")} missing</span>
          </Show>
          <button
            class={{ primary: ws.missingTokenCount > 0 }}
            title="Add the recommended tokens this file is missing"
            onClick={() => ws.runSetup()}
          >
            Setup
          </button>
        </span>
      </div>
      <Show when={values().length}>
        <section>
          <h3>
            <Tentative task="review">Values without a token</Tentative>
          </h3>
          <ul>
            <For each={values()}>
              {(value) => (
                <li>
                  <button
                    class="row"
                    aria-current={ws.isOpen({ kind: "value", value }) && "true"}
                    onClick={() => ws.open({ kind: "value", value })}
                  >
                    <Swatch color={value} />
                    <span class="name">{value}</span>
                    <RowMarks findings={ws.findingsOf({ kind: "value", value })} />
                  </button>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>

      <For
        each={groups()}
        fallback={
          <Show when={!values().length}>
            <p class="empty">{ws.state.filter ? `No rows with ${ws.state.filter}s here` : "No variables or styles. Setup can add the recommended set."}</p>
          </Show>
        }
      >
        {(group) => (
          <section>
            <h3>{group.name}</h3>
            <ul>
              <For each={group.tokens}>{(token) => <li><TokenRow token={token} /></li>}</For>
              <For each={group.planned}>
                {(planned) => (
                  <li class="row planned">
                    <span class="name">{planned.name}</span>
                    <Tentative task="setup">
                      <span class="tag">Setup</span>
                    </Tentative>
                  </li>
                )}
              </For>
            </ul>
          </section>
        )}
      </For>
    </div>
  );
}

function TokenRow(props: { token: TokenRef }) {
  const ws = useWorkspace();
  const swatch = () => {
    const variable = ws.file.tokens.variables.find((v) => v.id === props.token.id);
    return variable ? firstValue(variable, ws.file.tokens.variables).swatch : undefined;
  };
  return (
    <button
      class={["row", { dropped: !!props.token.dropped }]}
      aria-current={ws.isOpen({ kind: "token", id: props.token.id }) && "true"}
      onClick={() => ws.open({ kind: "token", id: props.token.id })}
    >
      <Swatch color={swatch()} />
      <span class="name">{props.token.name}</span>
      <Show when={props.token.dropped}>
        <span class="tag">Not exported</span>
      </Show>
      <RowMarks findings={ws.findingsOf({ kind: "token", id: props.token.id })} />
    </button>
  );
}
