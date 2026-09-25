// The screen's state and the operations on it, shared through context. Results
// of features that are not built yet come from placeholders.ts and stay in
// memory: nothing here writes to the Figma file. The one call to Figma is
// selecting a layer, which changes only the selection and the viewport.
import { createContext, createMemo, createStore, flush, useContext } from "solid-js";
import { ownerKey, type Finding, type FindingOwner } from "../core/findings";
import { droppedLayers, groupWebPages, indexLayers, screensOf } from "../core/screens";
import { tokenGroups } from "../core/tokens";
import type { FileData } from "../shared/data";
import { request } from "./bridge";
import * as placeholder from "./placeholders";

export type Selection =
  | { kind: "file" }
  | { kind: "token"; id: string }
  | { kind: "value"; value: string }
  | { kind: "webPage"; id: string }
  | { kind: "layer"; id: string };

export type Tab = "tokens" | "screens";

export interface Status {
  text: string;
  /** The task that makes this result real, when the result is a placeholder. */
  task?: placeholder.TaskKey;
  error?: boolean;
}

interface State {
  tab: Tab;
  selected: Selection;
  /** Row key → whether its children are shown in the list. Layers use their id, Web pages `webPageKey`. */
  expanded: Record<string, boolean>;
  status: Status | null;
  theme: placeholder.Theme;
  settings: placeholder.Settings;
  notes: Record<string, string>;
  planned: placeholder.PlannedToken[];
  findings: Finding[];
}

/** The expanded-state key of a Web page row, apart from the screen whose id it shares. */
export const webPageKey = (id: string) => `webPage:${id}`;

/** Where each owner kind is shown, for telling the designer where the errors are. */
const PLACE_OF_OWNER: Record<FindingOwner["kind"], string> = {
  file: "ファイル（上部）",
  token: "トークンのタブ",
  value: "トークンのタブ",
  screen: "画面のタブ",
  layer: "画面のタブ",
};

export function createWorkspace(file: FileData) {
  const index = indexLayers(file.page);
  const screens = screensOf(file.page);
  const dropped = droppedLayers(index);
  const groups = tokenGroups(file.tokens);
  const initialSettings = placeholder.initialSettings(screens);
  const initialWebPages = groupWebPages(screens, {});

  const [state, setState] = createStore<State>({
    tab: "screens",
    selected: { kind: "file" },
    expanded: Object.fromEntries(initialWebPages.map((w) => [webPageKey(w.id), true])),
    status: null,
    theme: placeholder.initialTheme,
    settings: initialSettings,
    notes: placeholder.initialNotes(index),
    planned: [],
    // Review runs when the plugin opens, so the error count is there from the start.
    findings: placeholder.review(file, index, initialWebPages, initialSettings),
  });

  const webPages = createMemo(() =>
    groupWebPages(screens, Object.fromEntries(screens.map((s) => [s.id, state.settings.screens[s.id]?.webPageId]))),
  );
  const webPageOf = (screenId: string) => webPages().find((w) => w.screenIds.includes(screenId));

  const byOwner = createMemo(() => {
    const map = new Map<string, Finding[]>();
    for (const finding of state.findings) {
      const key = ownerKey(finding.owner);
      map.set(key, [...(map.get(key) ?? []), finding]);
    }
    return map;
  });

  /** Rows with a finding somewhere below them (layers by id, Web pages by `webPageKey`), so a collapsed row can hint at it. */
  const findingsBelow = createMemo(() => {
    const keys = new Set<string>();
    for (const finding of state.findings) {
      if (finding.owner.kind !== "layer" && finding.owner.kind !== "screen") continue;
      const owner = index.get(finding.owner.id);
      for (let id = owner?.parentId; id; id = index.get(id)?.parentId) keys.add(id);
      const webPage = owner?.screenId ? webPageOf(owner.screenId) : undefined;
      if (webPage) keys.add(webPageKey(webPage.id));
    }
    return keys;
  });

  const errors = createMemo(() => state.findings.filter((f) => f.severity === "error"));
  const noticeCount = createMemo(() => state.findings.filter((f) => f.severity === "notice").length);

  const say = (status: Status | null) => setState((s) => void (s.status = status));

  /** Runs Review on the current settings and returns its errors. */
  const review = () => {
    const findings = placeholder.review(file, index, webPages(), state.settings);
    setState((s) => void (s.findings = findings));
    return findings.filter((f) => f.severity === "error");
  };

  /**
   * Settings change what Review reports, so every change runs it again and the counts stay current.
   * A shown Review or Export result was about the old settings, so it gives way to the new Review result.
   */
  const changeSettings = (change: (settings: placeholder.Settings) => void) => {
    setState((s) => void change(s.settings));
    flush(); // Writes are seen only after a flush; Review must read the new settings.
    const found = review();
    const shown = state.status;
    if (shown && (shown.task === "review" || shown.task === "export")) {
      say({ text: `設定が変わったので Review し直しました: error ${found.length} 件`, task: "review", error: found.length > 0 });
    }
  };

  /** Point Figma at the layer. It changes the selection and viewport, not the file. */
  const selectInFigma = async (layerId: string) => {
    try {
      const { found } = await request("select", { layerId });
      if (!found) say({ text: "このレイヤーは Figma で見つかりません。消されたか、別の Figma のページに移された可能性があります", error: true });
      else if (state.status?.error) say(null);
    } catch (error) {
      say({ text: `レイヤーを選べませんでした: ${(error as Error).message}`, error: true });
    }
  };

  /** Opening another object drops the last result, which was about something else. */
  const open = (selection: Selection) =>
    setState((s) => {
      s.selected = selection;
      s.status = null;
    });

  return {
    file,
    index,
    screens,
    dropped,
    groups,
    handedTokenCount: groups.reduce((n, g) => n + g.tokens.filter((t) => !t.dropped).length, 0),
    state,
    webPages,
    webPageOf,
    errorCount: () => errors().length,
    noticeCount,
    findingsOf: (owner: FindingOwner) => byOwner().get(ownerKey(owner)) ?? [],
    hasFindingsBelow: (key: string) => findingsBelow().has(key),
    /** Whether the object is the one open in the detail. */
    isOpen: (selection: Selection) => selectionKey(selection) === selectionKey(state.selected),
    webPageName: (id: string) => state.settings.webPages[id]?.name || "（名前なし）",

    open,
    setTab(tab: Tab) {
      setState((s) => void (s.tab = tab));
    },
    toggle(key: string) {
      setState((s) => void (s.expanded[key] = !s.expanded[key]));
    },
    selectInFigma,
    /** Open the layer, show it in the list, and select it in Figma. */
    openLayer(layerId: string) {
      const webPage = webPageOf(index.get(layerId)?.screenId ?? "");
      open({ kind: "layer", id: layerId });
      setState((s) => {
        s.tab = "screens";
        if (webPage) s.expanded[webPageKey(webPage.id)] = true;
        for (let id = index.get(layerId)?.parentId; id; id = index.get(id)?.parentId) s.expanded[id] = true;
      });
      void selectInFigma(layerId);
    },

    runSetup() {
      const planned = placeholder.setupPlan(file);
      setState((s) => {
        s.planned = planned;
        s.tab = "tokens";
      });
      say({
        text: planned.length ? `Setup: ${planned.length} 個を作ります。トークンの一覧に「Setup」の印で出ます` : "Setup: 足りないものはありません。何も作りません",
        task: "setup",
      });
    },
    runReview() {
      say({ text: `Review: error ${review().length} 件。持ち主の行と詳細に出ています`, task: "review" });
    },
    setTheme(theme: placeholder.Theme) {
      if (theme === state.theme) return;
      if (theme === "dark" && !state.settings.file.darkSupport) {
        say({ text: "ダーク対応が OFF なので Dark はありません。ファイルの Export 設定で ON にできます" });
        return;
      }
      setState((s) => void (s.theme = theme));
      say({ text: `${theme === "dark" ? "Dark" : "Light"} に切り替えます。Figma のページの変数のつながりを付け替えます`, task: "theme" });
    },
    runExport() {
      // Export runs Review first, so it never hands over what Review has not seen.
      const found = review();
      if (found.length > 0) {
        const places = new Map<string, number>();
        for (const f of found) places.set(PLACE_OF_OWNER[f.owner.kind], (places.get(PLACE_OF_OWNER[f.owner.kind]) ?? 0) + 1);
        const where = [...places].map(([place, n]) => `${place} ${n} 件`).join("・");
        say({ text: `Export を止めました。error が ${found.length} 件残っています。● の付いた行とその詳細に出ています（${where}）`, task: "review", error: true });
        return;
      }
      say({ text: `Export: ${placeholder.exportResult(webPages().length, screens.length, dropped.length)}`, task: "export" });
    },
    saveNote(layerId: string, text: string) {
      setState((s) => {
        if (text.trim()) s.notes[layerId] = text;
        else delete s.notes[layerId];
      });
      say({ text: "note を保存します。レイヤーの行に ✎ が付きます", task: "note" });
    },
    setFileSettings(patch: Partial<placeholder.FileSettings>) {
      changeSettings((settings) => void Object.assign(settings.file, patch));
      // A light-only file has no Dark to show.
      if (patch.darkSupport === false && state.theme === "dark") {
        setState((s) => void (s.theme = "light"));
        say({ text: "ダーク対応を OFF にしたので Light に戻します", task: "theme" });
      }
    },
    setWebPageSettings(webPageId: string, patch: Partial<placeholder.WebPageSettings>) {
      changeSettings((settings) => void Object.assign(settings.webPages[webPageId]!, patch));
    },
    setScreenSettings(screenId: string, patch: Partial<placeholder.ScreenSettings>) {
      changeSettings((settings) => void Object.assign(settings.screens[screenId]!, patch));
      if (patch.webPageId) setState((s) => void (s.expanded[webPageKey(patch.webPageId!)] = true));
    },
  };
}

function selectionKey(selection: Selection): string {
  switch (selection.kind) {
    case "file":
      return "file";
    case "value":
      return `value:${selection.value}`;
    default:
      return `${selection.kind}:${selection.id}`;
  }
}

export type Workspace = ReturnType<typeof createWorkspace>;

export const WorkspaceContext = createContext<Workspace>();

export const useWorkspace = () => useContext(WorkspaceContext);
