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
import { counted } from "./format";
import * as placeholder from "./placeholders";

export type Selection =
  | { kind: "file" }
  | { kind: "token"; id: string }
  | { kind: "value"; value: string }
  | { kind: "webPage"; id: string }
  | { kind: "layer"; id: string };

export type Tab = "tokens" | "screens";

type Severity = Finding["severity"];

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
  /** Set while the lists show only the rows that carry findings of this severity. */
  filter: Severity | null;
}

/** The expanded-state key of a Web page row, apart from the screen whose id it shares. */
export const webPageKey = (id: string) => `webPage:${id}`;

/** The list tab each owner kind is shown in; the file is on the top bar, in no tab. */
const TAB_OF_OWNER: Record<FindingOwner["kind"], Tab | null> = {
  file: null,
  token: "tokens",
  value: "tokens",
  screen: "screens",
  layer: "screens",
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
    filter: null,
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

  /** The rows above a layer's finding (its ancestors by id, its Web page by `webPageKey`). */
  const rowsAbove = (finding: Finding): string[] => {
    if (finding.owner.kind !== "layer" && finding.owner.kind !== "screen") return [];
    const owner = index.get(finding.owner.id);
    const keys: string[] = [];
    for (let id = owner?.parentId; id; id = index.get(id)?.parentId) keys.push(id);
    const webPage = owner?.screenId ? webPageOf(owner.screenId) : undefined;
    if (webPage) keys.push(webPageKey(webPage.id));
    return keys;
  };

  /** Rows with a finding somewhere below them, by severity, so a collapsed row can hint at it and the filter can keep it. */
  const findingsBelow = createMemo(() => {
    const keys: Record<Severity, Set<string>> = { error: new Set(), notice: new Set() };
    for (const finding of state.findings) for (const key of rowsAbove(finding)) keys[finding.severity].add(key);
    return keys;
  });

  const errors = createMemo(() => state.findings.filter((f) => f.severity === "error"));
  const noticeCount = createMemo(() => state.findings.filter((f) => f.severity === "notice").length);

  const say = (status: Status | null) => setState((s) => void (s.status = status));

  /** Runs Review on the current settings and returns its findings (the store shows them only after a flush). */
  const review = () => {
    const findings = placeholder.review(file, index, webPages(), state.settings);
    setState((s) => {
      s.findings = findings;
      // A filter with nothing left to show would only hide every row.
      if (s.filter && !findings.some((f) => f.severity === s.filter)) s.filter = null;
    });
    return findings;
  };
  const count = (findings: Finding[], severity: Severity) => findings.filter((f) => f.severity === severity).length;

  /**
   * Show only the rows that carry findings of the severity, or every row again with null.
   * The rows leading to each match are opened, so no match stays hidden in a collapsed row;
   * if the current tab has no match, the tab that has one is shown.
   */
  const setFilter = (severity: Severity | null) => {
    const matched = severity ? state.findings.filter((f) => f.severity === severity) : [];
    const tabs = new Set(matched.map((f) => TAB_OF_OWNER[f.owner.kind]));
    setState((s) => {
      s.filter = severity;
      for (const finding of matched) for (const key of rowsAbove(finding)) s.expanded[key] = true;
      const other: Tab = s.tab === "screens" ? "tokens" : "screens";
      if (severity && !tabs.has(s.tab) && tabs.has(other)) s.tab = other;
    });
  };

  /**
   * Settings change what Review reports, so every change runs it again and the counts stay current.
   * A shown Review or Export result was about the old settings, so it gives way to the new Review result.
   */
  const changeSettings = (change: (settings: placeholder.Settings) => void) => {
    setState((s) => void change(s.settings));
    flush(); // Writes are seen only after a flush; Review must read the new settings.
    const errors = count(review(), "error");
    const shown = state.status;
    if (shown && (shown.task === "review" || shown.task === "export")) {
      say({ text: `Settings changed, so Review ran again: ${counted(errors, "error")}`, task: "review", error: errors > 0 });
    }
  };

  /** Point Figma at the layer. It changes the selection and viewport, not the file. */
  const selectInFigma = async (layerId: string) => {
    try {
      const { found } = await request("select", { layerId });
      if (!found) say({ text: "This layer is no longer in Figma. It may have been deleted or moved to another page.", error: true });
      else if (state.status?.error) say(null);
    } catch (error) {
      say({ text: `Couldn't select the layer: ${(error as Error).message}`, error: true });
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
    /** How many tokens Setup would add; the file is read once, so this does not change. */
    missingTokenCount: placeholder.setupPlan(file).length,
    handedTokenCount: groups.reduce((n, g) => n + g.tokens.filter((t) => !t.dropped).length, 0),
    state,
    webPages,
    webPageOf,
    errorCount: () => errors().length,
    noticeCount,
    findingsOf: (owner: FindingOwner) => byOwner().get(ownerKey(owner)) ?? [],
    hasFindingsBelow: (key: string, severity?: Severity) =>
      severity ? findingsBelow()[severity].has(key) : findingsBelow().error.has(key) || findingsBelow().notice.has(key),
    /** Whether the filter keeps the row of the owner (or, with `below`, the row above other owners). */
    passesFilter(owner: FindingOwner | null, below?: string) {
      const severity = state.filter;
      if (!severity) return true;
      if (owner && (byOwner().get(ownerKey(owner)) ?? []).some((f) => f.severity === severity)) return true;
      return below !== undefined && findingsBelow()[severity].has(below);
    },
    /** Whether the object is the one open in the detail. */
    isOpen: (selection: Selection) => selectionKey(selection) === selectionKey(state.selected),
    webPageName: (id: string) => state.settings.webPages[id]?.name || "(no name)",

    open,
    setTab(tab: Tab) {
      setState((s) => void (s.tab = tab));
    },
    toggle(key: string) {
      setState((s) => void (s.expanded[key] = !s.expanded[key]));
    },
    setFilter,
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
        text: planned.length
          ? `Setup would add ${counted(planned.length, "token")}, marked “Setup” in the Tokens list.`
          : "Setup: nothing is missing, so nothing would be added.",
        task: "setup",
      });
    },
    runReview() {
      const found = review();
      say({
        text: `Review: ${counted(count(found, "error"), "error")} and ${counted(count(found, "notice"), "notice")}, shown on their rows.`,
        task: "review",
      });
    },
    setTheme(theme: placeholder.Theme) {
      if (theme === state.theme) return;
      if (theme === "dark" && !state.settings.file.darkSupport) {
        say({ text: "Dark support is off, so there is no Dark. Turn it on in the file's Export settings." });
        return;
      }
      setState((s) => void (s.theme = theme));
      const name = theme === "dark" ? "Dark" : "Light";
      say({ text: `Switched to ${name}. The variables on this Figma page would switch to their ${name} values.`, task: "theme" });
    },
    runExport() {
      // Export runs Review first, so it never hands over what Review has not seen.
      const errors = count(review(), "error");
      if (errors > 0) {
        // Show where they are right away, instead of telling the designer where to look.
        flush(); // The filter reads the new findings.
        setFilter("error");
        say({ text: `Export stopped: ${counted(errors, "error")} left. The lists now show only rows with errors.`, task: "review", error: true });
        return;
      }
      say({ text: `Export: ${placeholder.exportResult(webPages().length, screens.length, dropped.length)}`, task: "export" });
    },
    saveNote(layerId: string, text: string) {
      setState((s) => {
        if (text.trim()) s.notes[layerId] = text;
        else delete s.notes[layerId];
      });
      say({ text: "Note saved. The layer's row shows ✎.", task: "note" });
    },
    setFileSettings(patch: Partial<placeholder.FileSettings>) {
      changeSettings((settings) => void Object.assign(settings.file, patch));
      // A light-only file has no Dark to show.
      if (patch.darkSupport === false && state.theme === "dark") {
        setState((s) => void (s.theme = "light"));
        say({ text: "Dark support is off, so the theme is back to Light.", task: "theme" });
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
