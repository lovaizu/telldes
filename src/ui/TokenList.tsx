// Tokens as the designer made them, plus raw values that Review asks to decide on.
import { createMemo, For, Show } from "solid-js";
import type { TokenRef } from "../core/tokens";
import { firstValue } from "./format";
import { RowMarks, Swatch, Tentative } from "./parts";
import { useWorkspace } from "./workspace";

export function TokenList() {
  const ws = useWorkspace();

  /** Real groups first; groups that only Setup would create come after. */
  const groups = createMemo(() => {
    const names = [...ws.groups.map((g) => g.name), ...ws.state.planned.map((p) => p.group)];
    return [...new Set(names)].map((name) => ({
      name,
      tokens: ws.groups.find((g) => g.name === name)?.tokens ?? [],
      planned: ws.state.planned.filter((p) => p.group === name),
    }));
  });

  const values = createMemo(() =>
    ws.state.findings.flatMap((f) => (f.owner.kind === "value" ? [f.owner.value] : [])).filter((v, i, all) => all.indexOf(v) === i),
  );

  return (
    <div class="list">
      <Show when={values().length}>
        <section>
          <h3>
            トークンにしていない値 <Tentative task={5} />
          </h3>
          <ul>
            <For each={values()}>
              {(value) => (
                <li>
                  <button
                    class="row"
                    aria-current={ws.state.selected.kind === "value" && ws.state.selected.value === value && "true"}
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

      <For each={groups()} fallback={<p class="empty">変数もスタイルもありません。Setup で推奨の一式を作れます</p>}>
        {(group) => (
          <section>
            <h3>
              {group.name}
              <Show when={group.planned.length}>
                {" "}
                <Tentative task={4} />
              </Show>
            </h3>
            <ul>
              <For each={group.tokens}>{(token) => <li><TokenRow token={token} /></li>}</For>
              <For each={group.planned}>
                {(planned) => (
                  <li class="row planned">
                    <span class="name">{planned.name}</span>
                    <span class="tag">Setup</span>
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
      aria-current={ws.state.selected.kind === "token" && ws.state.selected.id === props.token.id && "true"}
      onClick={() => ws.open({ kind: "token", id: props.token.id })}
    >
      <Swatch color={swatch()} />
      <span class="name">{props.token.name}</span>
      <Show when={props.token.dropped}>
        <span class="tag">渡らない</span>
      </Show>
      <RowMarks findings={ws.findingsOf({ kind: "token", id: props.token.id })} />
    </button>
  );
}
