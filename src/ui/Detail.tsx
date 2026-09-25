// The detail of the object opened in a list: its attributes, what Review says
// about it, and what can be done to it.
import type { JSX } from "@solidjs/web";
import { createSignal, For, Match, Show, Switch } from "solid-js";
import type { LayerEntry } from "../core/screens";
import type { LayerData, VariableData } from "../shared/data";
import { colorCss, colorHex, dropReasonText, round, size, tokenDropText, variableValue } from "./format";
import { Findings, Swatch, Tentative } from "./parts";
import * as placeholder from "./placeholders";
import { useWorkspace, type Selection } from "./workspace";

export function Detail() {
  const ws = useWorkspace();
  const selected = () => ws.state.selected;
  const as = <K extends Selection["kind"]>(kind: K) => {
    const s = selected();
    return s.kind === kind ? (s as Extract<Selection, { kind: K }>) : undefined;
  };
  return (
    <div class="detail">
      <Switch>
        <Match when={as("file")}>
          <FileDetail />
        </Match>
        {/* Keyed, so opening another object builds its detail afresh instead of patching the last one. */}
        <Match when={as("token")?.id} keyed>
          {(id) => <TokenDetail id={id} />}
        </Match>
        <Match when={as("value")?.value} keyed>
          {(value) => <ValueDetail value={value} />}
        </Match>
        <Match when={ws.webPages().find((w) => w.id === as("webPage")?.id)?.id} keyed>
          {(id) => <WebPageDetail id={id} />}
        </Match>
        <Match when={ws.index.get(as("layer")?.id ?? "")} keyed>
          {(entry) => <LayerDetail entry={entry} />}
        </Match>
      </Switch>
    </div>
  );
}

function Facts(props: { children: JSX.Element }) {
  return <dl class="facts">{props.children}</dl>;
}

function Fact(props: { label: string; children: JSX.Element }) {
  return (
    <>
      <dt>{props.label}</dt>
      <dd>{props.children}</dd>
    </>
  );
}

// ---- File ----

function FileDetail() {
  const ws = useWorkspace();
  return (
    <>
      <p class="kind">ファイル</p>
      <h2>{ws.file.fileName}</h2>
      <Facts>
        <Fact label="Figma のページ">{ws.file.page.name}</Fact>
        <Fact label="テーマ">
          {ws.state.theme === "dark" ? "Dark" : "Light"} <Tentative task="theme" />
        </Fact>
        <Fact label="渡す Web ページ">{ws.webPages().length}</Fact>
        <Fact label="渡す画面">{ws.screens.length}</Fact>
        <Fact label="渡らないもの">{ws.dropped.length}</Fact>
        <Fact label="変数">{ws.file.tokens.variables.length}</Fact>
        <Fact label="スタイル">
          Text {ws.file.tokens.textStyles.length} / Effect {ws.file.tokens.effectStyles.length} / Color {ws.file.tokens.paintStyles.length}
        </Fact>
      </Facts>

      <section class="block">
        <h3>
          Export 設定 <Tentative task="exportSettings" />
        </h3>
        <label class="check">
          <input
            type="checkbox"
            checked={ws.state.settings.file.darkSupport}
            onChange={(e) => ws.setFileSettings({ darkSupport: e.currentTarget.checked })}
          />
          ダーク対応
        </label>
        <p class="help">ON にすると、変数につないでいない色が error になり、Export に Dark の画像も入ります。OFF の間は Dark に切り替えられません</p>
        <label class="field">
          <span>共通ルール</span>
          <textarea
            rows={5}
            placeholder="すべての Web ページに効くことを文章で（例: 見出しは Noto Sans JP を読み込む）"
            value={ws.state.settings.file.commonRules}
            onInput={(e) => ws.setFileSettings({ commonRules: e.currentTarget.value })}
          />
        </label>
        <p class="help">変えるとすぐ Review し直します。ファイルにはまだ保存しません</p>
      </section>
      <Findings findings={ws.findingsOf({ kind: "file" })} />
    </>
  );
}

// ---- Tokens ----

function TokenDetail(props: { id: string }) {
  const ws = useWorkspace();
  const t = ws.file.tokens;
  const ref = () => ws.groups.flatMap((g) => g.tokens).find((token) => token.id === props.id);
  const variable = () => t.variables.find((v) => v.id === props.id);
  const textStyle = () => t.textStyles.find((s) => s.id === props.id);
  const effectStyle = () => t.effectStyles.find((s) => s.id === props.id);
  const paintStyle = () => t.paintStyles.find((s) => s.id === props.id);

  return (
    <Show when={ref()}>
      {(token) => (
        <>
          <p class="kind">{KIND_LABEL[token().kind]}</p>
          <h2>{token().name}</h2>
          <Show when={token().dropped}>{(reason) => <p class="dropped-note">{tokenDropText(reason())}</p>}</Show>
          <Facts>
            <Show when={variable()}>{(v) => <VariableFacts variable={v()} />}</Show>
            <Show when={textStyle()}>
              {(s) => (
                <>
                  <Fact label="書体">
                    {s().fontName.family} {s().fontName.style}
                  </Fact>
                  <Fact label="大きさ">{round(s().fontSize)}px</Fact>
                  <Fact label="行の高さ">{unitValue(s().lineHeight)}</Fact>
                  <Fact label="字間">{unitValue(s().letterSpacing)}</Fact>
                </>
              )}
            </Show>
            <Show when={effectStyle()}>
              {(s) => (
                <Fact label="効果">
                  <For each={s().effects}>{(effect) => <div>{effect.type}</div>}</For>
                </Fact>
              )}
            </Show>
            <Show when={paintStyle()}>
              {(s) => (
                <Fact label="塗り">
                  <For each={s().paints}>
                    {(paint) => (
                      <div>
                        {paint.type === "SOLID" ? (
                          <>
                            <Swatch color={colorCss(paint.color, paint.opacity ?? 1)} /> {colorHex(paint.color, paint.opacity ?? 1)}
                          </>
                        ) : (
                          paint.type
                        )}
                      </div>
                    )}
                  </For>
                </Fact>
              )}
            </Show>
          </Facts>
          <Findings findings={ws.findingsOf({ kind: "token", id: props.id })} />
        </>
      )}
    </Show>
  );
}

const KIND_LABEL = { variable: "変数", textStyle: "Text Style", effectStyle: "Effect Style", paintStyle: "Color Style" } as const;

function VariableFacts(props: { variable: VariableData }) {
  const ws = useWorkspace();
  const collection = () => ws.file.tokens.collections.find((c) => c.id === props.variable.variableCollectionId);
  return (
    <>
      <Fact label="コレクション">{collection()?.name}</Fact>
      <Fact label="種類">{props.variable.resolvedType}</Fact>
      <For each={collection()?.modes ?? []}>
        {(mode) => {
          const shown = () => {
            const value = props.variable.valuesByMode[mode.modeId];
            return value === undefined ? { text: "" } : variableValue(value, ws.file.tokens.variables);
          };
          return (
            <Fact label={`値（${mode.name}）`}>
              <Swatch color={shown().swatch} /> {shown().text}
            </Fact>
          );
        }}
      </For>
      <Fact label="CSS 変数名">{props.variable.codeSyntax.WEB ?? "（なし）"}</Fact>
      <Fact label="使える欄">{props.variable.scopes.join(", ") || "（なし）"}</Fact>
      <Show when={props.variable.description}>
        <Fact label="説明">{props.variable.description}</Fact>
      </Show>
    </>
  );
}

function unitValue(value: { unit: string; value?: number }): string {
  if (value.unit === "AUTO" || value.value === undefined) return "自動";
  return value.unit === "PERCENT" ? `${round(value.value)}%` : `${round(value.value)}px`;
}

function ValueDetail(props: { value: string }) {
  const ws = useWorkspace();
  return (
    <>
      <p class="kind">トークンにしていない値</p>
      <h2>
        <Swatch color={props.value} /> {props.value}
      </h2>
      <Findings findings={ws.findingsOf({ kind: "value", value: props.value })} />
    </>
  );
}

// ---- Web pages, screens and layers ----

function WebPageDetail(props: { id: string }) {
  const ws = useWorkspace();
  const webPage = () => ws.webPages().find((w) => w.id === props.id);
  const settings = () => ws.state.settings.webPages[props.id];
  return (
    <>
      <p class="kind">Web ページ</p>
      <h2>{ws.webPageName(props.id)}</h2>
      <Facts>
        <Fact label="zip の中">{ws.webPageName(props.id)}/</Fact>
        <Fact label="画面（幅ごと）">
          <For each={webPage()?.screenIds ?? []}>
            {(id) => (
              <div>
                <button class="link" onClick={() => ws.openLayer(id)}>
                  {ws.index.get(id)?.layer.name}
                </button>{" "}
                <span class="help">{size(ws.index.get(id)!.layer)}</span>
              </div>
            )}
          </For>
        </Fact>
      </Facts>
      <section class="block">
        <h3>
          Export 設定 <Tentative task="exportSettings" />
        </h3>
        <label class="field">
          <span>名前</span>
          <input type="text" value={settings()?.name ?? ""} onInput={(e) => ws.setWebPageSettings(props.id, { name: e.currentTarget.value })} />
          <small class="help">zip の中のフォルダ名</small>
        </label>
        <label class="field">
          <span>題名</span>
          <input type="text" value={settings()?.title ?? ""} onInput={(e) => ws.setWebPageSettings(props.id, { title: e.currentTarget.value })} />
          <small class="help">ブラウザのタブに出る題名。幅が変わっても同じなので、画面ではなく Web ページに付けます</small>
        </label>
        <p class="help">どの画面がこの Web ページに入るかは、各画面の Export 設定で選びます。ファイルにはまだ保存しません</p>
      </section>
    </>
  );
}

function LayerDetail(props: { entry: LayerEntry }) {
  const ws = useWorkspace();
  const layer = () => props.entry.layer;
  const isScreen = () => props.entry.screenId === layer().id;
  return (
    <>
      <p class="kind">{isScreen() ? "画面" : "レイヤー"}</p>
      <h2>{layer().name}</h2>
      <Show when={props.entry.path.length > 1}>
        <p class="path">{props.entry.path.join(" / ")}</p>
      </Show>
      <Show when={props.entry.dropped}>{(reason) => <p class="dropped-note">渡らない: {dropReasonText(reason(), layer())}</p>}</Show>
      <p>
        <button onClick={() => void ws.selectInFigma(layer().id)}>Figma で選ぶ</button>
      </p>
      <Facts>
        <Fact label="種類">{layer().type}</Fact>
        <Show when={size(layer())}>
          <Fact label="大きさ">{size(layer())}</Fact>
        </Show>
        <Show when={isScreen() && ws.webPageOf(layer().id)}>
          {(webPage) => (
            <Fact label="Web ページ">
              <button class="link" onClick={() => ws.open({ kind: "webPage", id: webPage().id })}>
                {ws.webPageName(webPage().id)}
              </button>
            </Fact>
          )}
        </Show>
        <Show when={isScreen()}>
          <AssetFacts screenId={layer().id} />
        </Show>
        <LayerFacts layer={layer()} />
      </Facts>

      <Show when={isScreen()}>
        <ScreenSettings screenId={layer().id} />
      </Show>
      <Findings findings={ws.findingsOf({ kind: isScreen() ? "screen" : "layer", id: layer().id })} />
      <NoteEditor layerId={layer().id} />
    </>
  );
}

function LayerFacts(props: { layer: LayerData }) {
  const ws = useWorkspace();
  const variableName = (id: string) => ws.file.tokens.variables.find((v) => v.id === id)?.name ?? id;
  const fills = () => {
    const fills = props.layer.fills;
    if (fills === undefined) return [];
    if (!Array.isArray(fills)) return [{ text: "（文字ごとに違う）" }];
    const bound = props.layer.boundVariables["fills"];
    return fills.map((paint, i) => {
      const alias = Array.isArray(bound) ? bound[i] : undefined;
      if (alias) return { text: variableName(alias.id), swatch: paint.type === "SOLID" ? colorCss(paint.color, paint.opacity ?? 1) : undefined };
      if (paint.type === "SOLID") return { text: colorHex(paint.color, paint.opacity ?? 1), swatch: colorCss(paint.color, paint.opacity ?? 1) };
      return { text: paint.type };
    });
  };
  const autoLayout = () => props.layer.autoLayout;
  return (
    <>
      <Show when={props.layer.layoutSizingHorizontal}>
        <Fact label="サイズの決め方">
          横 {props.layer.layoutSizingHorizontal} / 縦 {props.layer.layoutSizingVertical}
        </Fact>
      </Show>
      <Show when={autoLayout()?.layoutMode !== "NONE" && autoLayout()}>
        {(a) => (
          <Fact label="Auto Layout">
            {a().layoutMode} / 間隔 {round(a().itemSpacing)} / 余白 {round(a().paddingTop)} {round(a().paddingRight)} {round(a().paddingBottom)}{" "}
            {round(a().paddingLeft)}
          </Fact>
        )}
      </Show>
      <Show when={fills().length}>
        <Fact label="塗り">
          <For each={fills()}>
            {(fill) => (
              <div>
                <Swatch color={fill.swatch} /> {fill.text}
              </div>
            )}
          </For>
        </Fact>
      </Show>
      <Show when={props.layer.text}>{(text) => <Fact label="文字">{text().characters}</Fact>}</Show>
      <Show when={props.layer.component}>{(c) => <Fact label="元のコンポーネント">{c().mainComponentName ?? "（見つからない）"}</Fact>}</Show>
      <Show when={props.layer.children}>{(children) => <Fact label="子">{children().length}</Fact>}</Show>
    </>
  );
}

function AssetFacts(props: { screenId: string }) {
  const ws = useWorkspace();
  const count = placeholder.assetCount(ws.index, props.screenId);
  return (
    <Fact label="渡す画像">
      写真 {count.images}・アイコン {count.icons} <Tentative task="assets" />
    </Fact>
  );
}

function ScreenSettings(props: { screenId: string }) {
  const ws = useWorkspace();
  const settings = () => ws.state.settings.screens[props.screenId];
  const current = () => ws.webPageOf(props.screenId)?.id;
  /** A screen that joined another Web page can go back to one of its own. */
  const ownIsFree = () => !ws.webPages().some((w) => w.id === props.screenId);
  const field = (key: "fromWidth" | "contentWidth", label: string, help: string) => (
    <label class="field">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        value={settings()?.[key] ?? ""}
        onInput={(e) => ws.setScreenSettings(props.screenId, { [key]: e.currentTarget.value })}
      />
      <small class="help">{help}</small>
    </label>
  );
  return (
    <section class="block">
      <h3>
        Export 設定 <Tentative task="exportSettings" />
      </h3>
      <label class="field">
        <span>Web ページ</span>
        <select onChange={(e) => ws.setScreenSettings(props.screenId, { webPageId: e.currentTarget.value })}>
          <For each={ws.webPages()}>
            {(webPage) => (
              <option value={webPage.id} selected={webPage.id === current()}>
                {ws.webPageName(webPage.id)}（画面 {webPage.screenIds.length}）
              </option>
            )}
          </For>
          <Show when={ownIsFree()}>
            <option value={props.screenId}>この画面だけの Web ページにする</option>
          </Show>
        </select>
        <small class="help">同じ Web ページの幅違いの画面なら、同じものを選ぶ。名前からは推し量りません</small>
      </label>
      {field("fromWidth", "切り替える幅（px）", "画面の幅がこれ以上のとき、この画面の見た目に切り替える")}
      {field("contentWidth", "コンテンツ幅（px）", "中身が広がる最大の幅。空なら画面いっぱい")}
      <p class="help">変えるとすぐ Review し直します。ファイルにはまだ保存しません</p>
    </section>
  );
}

/** Built per layer (the detail is keyed), so a draft never carries over to another layer. */
function NoteEditor(props: { layerId: string }) {
  const ws = useWorkspace();
  const [draft, setDraft] = createSignal(ws.state.notes[props.layerId] ?? "");
  const saved = () => ws.state.notes[props.layerId] ?? "";
  return (
    <section class="block">
      <h3>
        note <Tentative task="note" />
      </h3>
      <textarea
        rows={4}
        aria-label="note"
        placeholder="Figma のプロパティでは伝わらないこと（動き、リンク先、意図など）"
        value={draft()}
        onInput={(e) => setDraft(e.currentTarget.value)}
      />
      <div class="actions">
        <Show when={draft() !== saved()}>
          <span class="help">未保存</span>
        </Show>
        <button disabled={draft() === saved()} onClick={() => ws.saveNote(props.layerId, draft())}>
          保存
        </button>
      </div>
    </section>
  );
}
