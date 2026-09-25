// The screen's state and the operations on it, shared through context. Results
// of features that are not built yet come from placeholders.ts and stay in
// memory: nothing here writes to the Figma file. The one call to Figma is
// selecting a layer, which changes only the selection and the viewport.
import { createContext, createMemo, createStore, useContext } from "solid-js";
import { ownerKey, type Finding, type FindingOwner } from "../core/findings";
import { droppedLayers, indexLayers, screensOf } from "../core/screens";
import { tokenGroups } from "../core/tokens";
import type { FileData } from "../shared/data";
import { request } from "./bridge";
import * as placeholder from "./placeholders";

export type Selection = { kind: "file" } | { kind: "token"; id: string } | { kind: "value"; value: string } | { kind: "layer"; id: string };

export type Tab = "tokens" | "screens";

export interface Status {
  text: string;
  /** The task that makes this result real, when the result is a placeholder. */
  task?: number;
  error?: boolean;
}

interface State {
  tab: Tab;
  selected: Selection;
  /** Layer id → whether its children are shown in the list. */
  expanded: Record<string, boolean>;
  status: Status | null;
  theme: placeholder.Theme;
  fileSettings: placeholder.FileSettings;
  screenSettings: Record<string, placeholder.ScreenSettings>;
  notes: Record<string, string>;
  planned: placeholder.PlannedToken[];
  findings: Finding[];
}

export function createWorkspace(file: FileData) {
  const index = indexLayers(file.page);
  const screens = screensOf(file.page);
  const dropped = droppedLayers(index);
  const groups = tokenGroups(file.tokens);

  const [state, setState] = createStore<State>({
    tab: "screens",
    selected: { kind: "file" },
    expanded: {},
    status: null,
    theme: placeholder.initialTheme,
    fileSettings: { ...placeholder.initialFileSettings },
    screenSettings: Object.fromEntries(screens.map((s) => [s.id, { ...placeholder.emptyScreenSettings }])),
    notes: placeholder.initialNotes(index),
    planned: [],
    // Review runs when the plugin opens, so the error count is there from the start.
    findings: placeholder.review(file, index, placeholder.initialFileSettings, {}),
  });

  const byOwner = createMemo(() => {
    const map = new Map<string, Finding[]>();
    for (const finding of state.findings) {
      const key = ownerKey(finding.owner);
      map.set(key, [...(map.get(key) ?? []), finding]);
    }
    return map;
  });

  /** Layers that own a finding somewhere below them, so a collapsed row can hint at it. */
  const findingsBelow = createMemo(() => {
    const ids = new Set<string>();
    for (const finding of state.findings) {
      if (finding.owner.kind !== "layer" && finding.owner.kind !== "screen") continue;
      for (let id = index.get(finding.owner.id)?.parentId; id; id = index.get(id)?.parentId) ids.add(id);
    }
    return ids;
  });

  const errorCount = createMemo(() => state.findings.filter((f) => f.severity === "error").length);
  const noticeCount = createMemo(() => state.findings.filter((f) => f.severity === "notice").length);

  const say = (status: Status) => setState((s) => void (s.status = status));

  /** Runs Review and returns its error count. */
  const review = () => {
    const findings = placeholder.review(file, index, state.fileSettings, state.screenSettings);
    setState((s) => void (s.findings = findings));
    return findings.filter((f) => f.severity === "error").length;
  };

  /** Point Figma at the layer. It changes the selection and viewport, not the file. */
  const selectInFigma = async (layerId: string) => {
    try {
      const { found } = await request("select", { layerId });
      if (!found) say({ text: "このレイヤーは Figma で見つかりません。消されたか、別のページに移された可能性があります", error: true });
    } catch (error) {
      say({ text: `レイヤーを選べませんでした: ${(error as Error).message}`, error: true });
    }
  };

  return {
    file,
    index,
    screens,
    dropped,
    groups,
    state,
    errorCount,
    noticeCount,
    findingsOf: (owner: FindingOwner) => byOwner().get(ownerKey(owner)) ?? [],
    hasFindingsBelow: (layerId: string) => findingsBelow().has(layerId),

    open(selection: Selection) {
      setState((s) => void (s.selected = selection));
    },
    setTab(tab: Tab) {
      setState((s) => void (s.tab = tab));
    },
    toggle(layerId: string) {
      setState((s) => void (s.expanded[layerId] = !s.expanded[layerId]));
    },
    selectInFigma,
    /** Open the layer, show it in the list, and select it in Figma. */
    openLayer(layerId: string) {
      setState((s) => {
        s.selected = { kind: "layer", id: layerId };
        s.tab = "screens";
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
        task: placeholder.TASK.setup,
      });
    },
    runReview() {
      const errors = review();
      say({ text: `Review: error ${errors} 件。各行と詳細に出ています`, task: placeholder.TASK.review });
    },
    setTheme(theme: placeholder.Theme) {
      if (theme === state.theme) return;
      setState((s) => void (s.theme = theme));
      say({ text: `${theme === "dark" ? "Dark" : "Light"} に切り替えます。ページの変数のつながりを付け替えます`, task: placeholder.TASK.theme });
    },
    runExport() {
      // Export runs Review first, so it never hands over what Review has not seen.
      const errors = review();
      if (errors > 0) {
        say({ text: `Export を止めました。error が ${errors} 件あります`, task: placeholder.TASK.review, error: true });
        return;
      }
      say({ text: `Export: ${placeholder.exportResult(screens.length, dropped.length)}`, task: placeholder.TASK.export });
    },
    saveNote(layerId: string, text: string) {
      setState((s) => {
        if (text.trim()) s.notes[layerId] = text;
        else delete s.notes[layerId];
      });
      say({ text: "note を保存します。レイヤーの行に ✎ が付きます", task: placeholder.TASK.note });
    },
    setFileSettings(patch: Partial<placeholder.FileSettings>) {
      setState((s) => void Object.assign(s.fileSettings, patch));
    },
    setScreenSettings(screenId: string, patch: Partial<placeholder.ScreenSettings>) {
      setState((s) => void Object.assign(s.screenSettings[screenId]!, patch));
    },
  };
}

export type Workspace = ReturnType<typeof createWorkspace>;

export const WorkspaceContext = createContext<Workspace>();

export const useWorkspace = () => useContext(WorkspaceContext);
