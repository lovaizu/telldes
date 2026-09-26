// The detail of the object opened in a list: its attributes, what Review says
// about it, and what can be done to it.
import type { JSX } from "@solidjs/web";
import { createSignal, For, Match, Show, Switch } from "solid-js";
import type { LayerEntry } from "../core/screens";
import type { LayerData, VariableData } from "../shared/data";
import { colorCss, colorHex, counted, dropReasonText, round, size, tokenDropText, variableValue } from "./format";
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
        <Match when={ws.webPages().find((w) => w.id === as("webPage")?.id)} keyed>
          {/* A Web page left with one frame is shown as that frame, as in the list. */}
          {(webPage) =>
            webPage.screenIds.length > 1 ? <WebPageDetail id={webPage.id} /> : <LayerDetail entry={ws.index.get(webPage.screenIds[0]!)!} />
          }
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

function Fact(props: { label: string; title?: string; children: JSX.Element }) {
  return (
    <>
      <dt title={props.title}>{props.label}</dt>
      <dd>{props.children}</dd>
    </>
  );
}

// ---- File ----

function FileDetail() {
  const ws = useWorkspace();
  return (
    <>
      <p class="kind">File</p>
      <h2>{ws.file.fileName}</h2>
      <Facts>
        <Fact label="Figma page">{ws.file.page.name}</Fact>
        <Fact label="Theme">
          <Tentative task="theme">{ws.state.theme === "dark" ? "Dark" : "Light"}</Tentative>
        </Fact>
        <Fact label="Frames">{ws.screens.length}</Fact>
        <Show when={ws.webPages().some((w) => w.screenIds.length > 1)}>
          <Fact label="Web pages">{ws.webPages().length}</Fact>
        </Show>
        <Fact label="Not exported">{ws.dropped.length}</Fact>
        <Fact label="Variables">{ws.file.tokens.variables.length}</Fact>
        <Fact label="Styles">
          Text {ws.file.tokens.textStyles.length} · Effect {ws.file.tokens.effectStyles.length} · Color {ws.file.tokens.paintStyles.length}
        </Fact>
      </Facts>

      <section class="block">
        <SettingsHeading />
        <label
          class="check"
          title="When on, colors not linked to a variable are errors, and Export adds Dark images. When off, there is no Dark."
        >
          <input
            type="checkbox"
            checked={ws.state.settings.file.darkSupport}
            onChange={(e) => ws.setFileSettings({ darkSupport: e.currentTarget.checked })}
          />
          Dark support
        </label>
        <label class="field">
          <span>Rules for every page</span>
          <textarea
            rows={4}
            placeholder="In plain words, e.g. load Noto Sans JP for headings"
            value={ws.state.settings.file.commonRules}
            onInput={(e) => ws.setFileSettings({ commonRules: e.currentTarget.value })}
          />
        </label>
      </section>
      <Findings findings={ws.findingsOf({ kind: "file" })} />
    </>
  );
}

/** One heading for the settings of each owner; they stay in memory until the task the hover names. */
function SettingsHeading() {
  return (
    <h3>
      <Tentative task="exportSettings">Export settings</Tentative>
    </h3>
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
                  <Fact label="Font">
                    {s().fontName.family} {s().fontName.style}
                  </Fact>
                  <Fact label="Size">{round(s().fontSize)}px</Fact>
                  <Fact label="Line height">{unitValue(s().lineHeight)}</Fact>
                  <Fact label="Letter spacing">{unitValue(s().letterSpacing)}</Fact>
                </>
              )}
            </Show>
            <Show when={effectStyle()}>
              {(s) => (
                <Fact label="Effects">
                  <For each={s().effects}>{(effect) => <div>{effect.type}</div>}</For>
                </Fact>
              )}
            </Show>
            <Show when={paintStyle()}>
              {(s) => (
                <Fact label="Fill">
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

const KIND_LABEL = { variable: "Variable", textStyle: "Text Style", effectStyle: "Effect Style", paintStyle: "Color Style" } as const;

function VariableFacts(props: { variable: VariableData }) {
  const ws = useWorkspace();
  const collection = () => ws.file.tokens.collections.find((c) => c.id === props.variable.variableCollectionId);
  return (
    <>
      <Fact label="Collection">{collection()?.name}</Fact>
      <Fact label="Type">{props.variable.resolvedType}</Fact>
      <For each={collection()?.modes ?? []}>
        {(mode) => {
          const shown = () => {
            const value = props.variable.valuesByMode[mode.modeId];
            return value === undefined ? { text: "" } : variableValue(value, ws.file.tokens.variables);
          };
          return (
            <Fact label={`Value (${mode.name})`}>
              <Swatch color={shown().swatch} /> {shown().text}
            </Fact>
          );
        }}
      </For>
      <Fact label="CSS name">{props.variable.codeSyntax.WEB ?? "(none)"}</Fact>
      <Fact label="Scopes">{props.variable.scopes.join(", ") || "(none)"}</Fact>
      <Show when={props.variable.description}>
        <Fact label="Description">{props.variable.description}</Fact>
      </Show>
    </>
  );
}

function unitValue(value: { unit: string; value?: number }): string {
  if (value.unit === "AUTO" || value.value === undefined) return "Auto";
  return value.unit === "PERCENT" ? `${round(value.value)}%` : `${round(value.value)}px`;
}

function ValueDetail(props: { value: string }) {
  const ws = useWorkspace();
  return (
    <>
      <p class="kind">Value without a token</p>
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
      <p class="kind">Web page</p>
      <h2>{ws.webPageName(props.id)}</h2>
      <Facts>
        <Fact label="Folder in zip">{ws.webPageName(props.id)}/</Fact>
        <Fact label="Frames" title="One per width. To add a frame, set “Same page as” in that frame's Export settings.">
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
        <SettingsHeading />
        <label class="field" title="The folder name in the zip">
          <span>Name</span>
          <input type="text" value={settings()?.name ?? ""} onInput={(e) => ws.setWebPageSettings(props.id, { name: e.currentTarget.value })} />
        </label>
        <TitleField webPageId={props.id} />
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
      <p class="kind">{isScreen() ? "Frame" : "Layer"}</p>
      <h2>{layer().name}</h2>
      <Show when={props.entry.path.length > 1}>
        <p class="path">{props.entry.path.join(" / ")}</p>
      </Show>
      <Show when={props.entry.dropped}>{(reason) => <p class="dropped-note">Not exported: {dropReasonText(reason(), layer())}</p>}</Show>
      <p>
        <button onClick={() => void ws.selectInFigma(layer().id)}>Select in Figma</button>
      </p>
      <Facts>
        <Fact label="Type">{layer().type}</Fact>
        <Show when={size(layer())}>
          <Fact label="Size">{size(layer())}</Fact>
        </Show>
        {/* A Web page of this frame alone is not shown apart from the frame, so there is nothing to link to. */}
        <Show when={isScreen() && ws.webPageOf(layer().id)?.screenIds.length !== 1 && ws.webPageOf(layer().id)}>
          {(webPage) => (
            <Fact label="Web page">
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
    if (!Array.isArray(fills)) return [{ text: "Mixed" }];
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
        <Fact label="Resizing">
          W {props.layer.layoutSizingHorizontal} · H {props.layer.layoutSizingVertical}
        </Fact>
      </Show>
      <Show when={autoLayout()?.layoutMode !== "NONE" && autoLayout()}>
        {(a) => (
          <Fact label="Auto Layout">
            {a().layoutMode} · gap {round(a().itemSpacing)} · padding {round(a().paddingTop)} {round(a().paddingRight)} {round(a().paddingBottom)}{" "}
            {round(a().paddingLeft)}
          </Fact>
        )}
      </Show>
      <Show when={fills().length}>
        <Fact label="Fill">
          <For each={fills()}>
            {(fill) => (
              <div>
                <Swatch color={fill.swatch} /> {fill.text}
              </div>
            )}
          </For>
        </Fact>
      </Show>
      <Show when={props.layer.text}>{(text) => <Fact label="Text">{text().characters}</Fact>}</Show>
      <Show when={props.layer.component}>{(c) => <Fact label="Main component">{c().mainComponentName ?? "(missing)"}</Fact>}</Show>
      <Show when={props.layer.children}>{(children) => <Fact label="Children">{children().length}</Fact>}</Show>
    </>
  );
}

function AssetFacts(props: { screenId: string }) {
  const ws = useWorkspace();
  const count = placeholder.assetCount(ws.index, props.screenId);
  return (
    <Fact label="Images">
      <Tentative task="assets">
        {counted(count.images, "photo")} · {counted(count.icons, "icon")}
      </Tentative>
    </Fact>
  );
}

function ScreenSettings(props: { screenId: string }) {
  const ws = useWorkspace();
  const settings = () => ws.state.settings.screens[props.screenId];
  const webPage = () => ws.webPageOf(props.screenId);
  /** A Web page of this frame alone has its settings here, since it is shown as this frame. */
  const alone = () => (webPage()?.screenIds.length ?? 0) < 2;
  const others = () => ws.webPages().filter((w) => w.screenIds.length > 1 || w.id !== webPage()?.id);
  const optionName = (w: { id: string; screenIds: string[] }) =>
    w.screenIds.length > 1 ? `${ws.webPageName(w.id)} (${counted(w.screenIds.length, "frame")})` : ws.index.get(w.screenIds[0]!)?.layer.name;
  const field = (key: "fromWidth" | "contentWidth", label: string, help: string, empty: string) => (
    <label class="field" title={help}>
      <span>{label}</span>
      <input
        type="number"
        min={0}
        placeholder={empty}
        value={settings()?.[key] ?? ""}
        onInput={(e) => ws.setScreenSettings(props.screenId, { [key]: e.currentTarget.value })}
      />
    </label>
  );
  return (
    <section class="block">
      <SettingsHeading />
      <label class="field" title="Frames of one page at different widths, e.g. desktop and mobile. Export writes them as one responsive page.">
        <span>Same page as</span>
        <select onChange={(e) => ws.setSamePageAs(props.screenId, e.currentTarget.value || null)}>
          <option value="" selected={alone()}>
            None (its own page)
          </option>
          <For each={others()}>
            {(w) => (
              <option value={w.id} selected={w.id === webPage()?.id}>
                {optionName(w)}
              </option>
            )}
          </For>
        </select>
      </label>
      <Show when={alone() && webPage()}>
        {(w) => <TitleField webPageId={w().id} />}
      </Show>
      <div class="field-row">
        {field("fromWidth", "From width (px)", "This frame is used when the browser is at least this wide.", "")}
        {field("contentWidth", "Content width (px)", "The widest the content gets. Empty: the full width.", "Full width")}
      </div>
    </section>
  );
}

function TitleField(props: { webPageId: string }) {
  const ws = useWorkspace();
  return (
    <label class="field" title="Shown in the browser tab. The same at every width, so it belongs to the page, not to one frame.">
      <span>Page title</span>
      <input
        type="text"
        placeholder="Shown in the browser tab"
        value={ws.state.settings.webPages[props.webPageId]?.title ?? ""}
        onInput={(e) => ws.setWebPageSettings(props.webPageId, { title: e.currentTarget.value })}
      />
    </label>
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
        <Tentative task="note">note</Tentative>
      </h3>
      <textarea
        rows={3}
        aria-label="note"
        placeholder="What Figma can't show: motion, links, intent…"
        value={draft()}
        onInput={(e) => setDraft(e.currentTarget.value)}
      />
      <div class="actions">
        <Show when={draft() !== saved()}>
          <span class="help">Not saved</span>
        </Show>
        <button disabled={draft() === saved()} onClick={() => ws.saveNote(props.layerId, draft())}>
          Save
        </button>
      </div>
    </section>
  );
}
