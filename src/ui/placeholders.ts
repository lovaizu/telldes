// Stand-ins for results that later tasks build for real. Everything here is
// fake, kept only so the screen can be tried before the features exist; each
// section names the task that replaces it. Nothing here writes to Figma, and
// the UI marks every value that comes from here with 仮 and the task number.
import type { Finding } from "../core/findings";
import type { LayerEntry, WebPage } from "../core/screens";
import type { FileData, LayerData } from "../shared/data";
import { colorHex } from "./format";

/** The task that replaces each placeholder, and the feature it builds, shown next to the fake value. */
export const TASK = {
  setup: { number: 4, feature: "Setup" },
  review: { number: 5, feature: "Review" },
  note: { number: 6, feature: "note" },
  exportSettings: { number: 7, feature: "Export 設定" },
  export: { number: 7, feature: "Export" },
  assets: { number: 8, feature: "画像・アセットの書き出し" },
  theme: { number: 9, feature: "Light / Dark" },
} as const;

export type TaskKey = keyof typeof TASK;

// ---- #4 Setup: what Setup would create ----

/** The recommended set from README, by the collection or style kind it goes in. */
const RECOMMENDED: Record<string, string[]> = (() => {
  const colors = ["bg", "surface", "border", "fg/default", "fg/muted", "primary/default", "primary/hover", "primary/on", "link", "code/bg", "code/fg", "notice/bg", "notice/fg", "shadow"];
  return {
    Light: colors,
    Dark: colors,
    Base: [
      ...["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"].map((s) => `spacing/${s}`),
      ...["sm", "md", "lg", "xl", "full"].map((s) => `radius/${s}`),
      ...["heading", "body", "mono"].map((s) => `font/${s}`),
    ],
    "Text Style": ["display", "heading-lg", "heading-md", "heading-sm", "lead", "body", "label", "caption", "code"],
    "Effect Style": ["shadow-sm", "shadow-md"],
  };
})();

export interface PlannedToken {
  group: string;
  name: string;
}

/** Fake Setup: the recommended names missing from the group of the same name. */
export function setupPlan(file: FileData): PlannedToken[] {
  const t = file.tokens;
  const existing = (group: string): string[] => {
    if (group === "Text Style") return t.textStyles.map((s) => s.name);
    if (group === "Effect Style") return t.effectStyles.map((s) => s.name);
    const ids = new Set(t.collections.filter((c) => c.name === group).flatMap((c) => c.variableIds));
    return t.variables.filter((v) => ids.has(v.id)).map((v) => v.name);
  };
  return Object.entries(RECOMMENDED).flatMap(([group, names]) => {
    const have = new Set(existing(group));
    return names.filter((name) => !have.has(name)).map((name) => ({ group, name }));
  });
}

// ---- #6 note: notes kept in memory only ----

/** Fake notes: one sample on the first text layer of the first screen. */
export function initialNotes(index: Map<string, LayerEntry>): Record<string, string> {
  for (const entry of index.values()) {
    if (entry.screenId && !entry.dropped && entry.layer.type === "TEXT") {
      return { [entry.layer.id]: "ホバーで下線を出す（仮の note）" };
    }
  }
  return {};
}

// ---- #7 Export settings: kept in memory only ----

export interface FileSettings {
  darkSupport: boolean;
  commonRules: string;
}

export interface WebPageSettings {
  /** The folder name in the zip. */
  name: string;
  title: string;
}

export interface ScreenSettings {
  /** The Web page this screen is one width of (a WebPage id). */
  webPageId: string;
  /** The viewport width from which this screen's layout is used. */
  fromWidth: string;
  contentWidth: string;
}

export interface Settings {
  file: FileSettings;
  /** By WebPage id. Every screen starts as a Web page of its own, named after its frame. */
  webPages: Record<string, WebPageSettings>;
  screens: Record<string, ScreenSettings>;
}

export function initialSettings(screens: LayerData[]): Settings {
  return {
    file: { darkSupport: true, commonRules: "" },
    webPages: Object.fromEntries(screens.map((s) => [s.id, { name: s.name, title: "" }])),
    screens: Object.fromEntries(screens.map((s) => [s.id, { webPageId: s.id, fromWidth: "", contentWidth: "" }])),
  };
}

// ---- #7 Export: what Export would write ----

export function exportResult(webPageCount: number, screenCount: number, droppedCount: number): string {
  return `telldes-export.zip に Web ページ ${webPageCount} つ（画面 ${screenCount} つ）をフォルダごとに書き出し、渡らないもの ${droppedCount} 件を README.md に記録する予定です`;
}

// ---- #8 Images and assets: what Export would hand over as files ----

export interface AssetCount {
  images: number;
  icons: number;
}

/** Fake count: image fills become PNGs, vector layers SVGs. Not the real rule. */
export function assetCount(index: Map<string, LayerEntry>, screenId: string): AssetCount {
  const count = { images: 0, icons: 0 };
  for (const entry of index.values()) {
    if (entry.screenId !== screenId || entry.dropped) continue;
    const fills = entry.layer.fills;
    if (Array.isArray(fills) && fills.some((paint) => paint.type === "IMAGE")) count.images++;
    if (entry.layer.type === "VECTOR" || entry.layer.type === "BOOLEAN_OPERATION") count.icons++;
  }
  return count;
}

// ---- #9 Light / Dark ----

export type Theme = "light" | "dark";

export const initialTheme: Theme = "light";

// ---- #5 Review: findings on real objects ----

/**
 * Fake Review. It looks at real layers and tokens so the findings land on
 * real rows and follow the one-owner rule, but the rules are not the real ones.
 */
export function review(file: FileData, index: Map<string, LayerEntry>, webPages: WebPage[], settings: Settings): Finding[] {
  const findings: Finding[] = [];
  const { darkSupport } = settings.file;

  if (darkSupport && !file.tokens.collections.some((c) => c.name === "Dark")) {
    findings.push({
      severity: "error",
      owner: { kind: "file" },
      message: "ダーク対応が ON なのに、Dark のコレクションがありません",
      fix: "Setup で Dark のコレクションを作るか、ダーク対応を OFF にする",
      layerIds: [],
    });
  }

  const tokenOf = colorTokens(file);
  for (const color of unboundColors(index)) {
    const token = tokenOf.get(color.hex);
    if (token) {
      // Equal to a token: the one decision is "connect these to the token", so the token owns it.
      findings.push({
        severity: darkSupport ? "error" : "notice",
        owner: { kind: "token", id: token.id },
        message: darkSupport
          ? `${token.name} と同じ色 ${color.hex} が ${color.layerIds.length} か所で変数につながっていません。Dark に付け替わりません`
          : `${token.name} と同じ色 ${color.hex} なのに、つないでいない所が ${color.layerIds.length} か所あります`,
        fix: darkSupport ? `${token.name} につなぐ` : `${token.name} につなぐ。意図してつないでいないなら、そのままでよい`,
        layerIds: color.layerIds,
      });
    } else if (darkSupport) {
      // A light-only file reports nothing for raw values (docs/design.md).
      findings.push({
        severity: "error",
        owner: color.layerIds.length > 1 ? { kind: "value", value: color.hex } : { kind: "layer", id: color.layerIds[0]! },
        message: `色 ${color.hex} が変数につながっていません。Dark に付け替わりません`,
        fix: "この色の変数を Light と Dark に作ってつなぐ",
        layerIds: color.layerIds,
      });
    }
  }

  for (const webPage of webPages) {
    if (webPage.screenIds.length < 2) continue;
    for (const screenId of webPage.screenIds) {
      if (settings.screens[screenId]?.fromWidth) continue;
      findings.push({
        severity: "notice",
        owner: { kind: "screen", id: screenId },
        message: "この画面に切り替える幅が決まっていません。同じ Web ページに幅違いの画面があります",
        fix: "画面の Export 設定で「切り替える幅」を入れる",
        layerIds: [],
      });
    }
  }
  return findings;
}

interface ColorUse {
  hex: string;
  layerIds: string[];
}

/** Solid fills not bound to a variable, grouped by color, most used first. */
function unboundColors(index: Map<string, LayerEntry>): ColorUse[] {
  const byHex = new Map<string, string[]>();
  for (const entry of index.values()) {
    if (!entry.screenId || entry.dropped) continue;
    for (const hex of unboundSolidFills(entry.layer)) {
      const ids = byHex.get(hex) ?? [];
      if (!ids.includes(entry.layer.id)) ids.push(entry.layer.id);
      byHex.set(hex, ids);
    }
  }
  return [...byHex].map(([hex, layerIds]) => ({ hex, layerIds })).sort((a, b) => b.layerIds.length - a.layerIds.length);
}

function unboundSolidFills(layer: LayerData): string[] {
  if (!Array.isArray(layer.fills)) return [];
  const bound = layer.boundVariables["fills"];
  return layer.fills.flatMap((paint, i) =>
    paint.type === "SOLID" && paint.visible !== false && !(Array.isArray(bound) && bound[i])
      ? [colorHex(paint.color, paint.opacity ?? 1)]
      : [],
  );
}

/** Hex → the color variable with that value in its first mode, skipping Dark so a light value meets its light token. */
function colorTokens(file: FileData): Map<string, { id: string; name: string }> {
  const dark = new Set(file.tokens.collections.filter((c) => c.name === "Dark").map((c) => c.id));
  const byHex = new Map<string, { id: string; name: string }>();
  for (const variable of file.tokens.variables) {
    if (variable.resolvedType !== "COLOR" || dark.has(variable.variableCollectionId)) continue;
    const value = Object.values(variable.valuesByMode)[0];
    if (!value || typeof value !== "object" || !("r" in value)) continue;
    const hex = colorHex(value, "a" in value ? value.a : 1);
    if (!byHex.has(hex)) byHex.set(hex, { id: variable.id, name: variable.name });
  }
  return byHex;
}
