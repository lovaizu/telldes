// Stand-ins for results that later tasks build for real. Everything here is
// fake, kept only so the screen can be tried before the features exist; each
// section names the task that replaces it. Nothing here writes to Figma, and
// the UI marks every value that comes from here with 仮 and the task number.
import type { Finding } from "../core/findings";
import type { LayerEntry } from "../core/screens";
import type { FileData, LayerData } from "../shared/data";
import { colorHex } from "./format";

/** The task that replaces each placeholder, shown next to the fake value. */
export const TASK = {
  setup: 4,
  review: 5,
  note: 6,
  exportSettings: 7,
  export: 7,
  theme: 9,
} as const;

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

export interface ScreenSettings {
  /** The viewport width from which this screen's layout is used. */
  fromWidth: string;
  contentWidth: string;
  title: string;
}

export const initialFileSettings: FileSettings = { darkSupport: true, commonRules: "" };

export const emptyScreenSettings: ScreenSettings = { fromWidth: "", contentWidth: "", title: "" };

// ---- #7 Export: what Export would write ----

export function exportResult(screenCount: number, droppedCount: number): string {
  return `telldes-export.zip に画面 ${screenCount} つを書き出し、渡らないもの ${droppedCount} 件を README.md に記録する予定です`;
}

// ---- #9 Light / Dark ----

export type Theme = "light" | "dark";

export const initialTheme: Theme = "light";

// ---- #5 Review: findings on real objects ----

/**
 * Fake Review. It picks a few real layers so the findings land on real rows,
 * but the rules are not the real ones.
 */
export function review(
  file: FileData,
  index: Map<string, LayerEntry>,
  settings: FileSettings,
  screenSettings: Record<string, ScreenSettings>,
): Finding[] {
  const findings: Finding[] = [];
  const colors = unboundColors(index);

  if (settings.darkSupport) {
    const [shared, single] = [colors.filter((c) => c.layerIds.length > 1), colors.filter((c) => c.layerIds.length === 1)];
    for (const color of shared.slice(0, 2)) {
      findings.push({
        severity: "error",
        owner: { kind: "value", value: color.hex },
        message: `色 ${color.hex} が変数につながっていません。Dark に付け替わりません`,
        fix: "この色に当たる Light の色変数につなぐ",
        layerIds: color.layerIds,
      });
    }
    for (const color of single.slice(0, 1)) {
      findings.push({
        severity: "error",
        owner: { kind: "layer", id: color.layerIds[0]! },
        message: `色 ${color.hex} が変数につながっていません。Dark に付け替わりません`,
        fix: "Light の色変数につなぐ",
        layerIds: color.layerIds,
      });
    }
  }

  const sameValue = colorVariableWithUnboundUses(file, colors);
  if (sameValue) {
    findings.push({
      severity: "notice",
      owner: { kind: "token", id: sameValue.variableId },
      message: `このトークンと同じ色なのに、つないでいない所が ${sameValue.layerIds.length} か所あります`,
      fix: "意図してつないでいないなら、そのままでよい",
      layerIds: sameValue.layerIds,
    });
  }

  const screens = [...index.values()].filter((e) => e.screenId === e.layer.id && !e.dropped);
  if (screens.length > 1) {
    for (const screen of screens) {
      if (screenSettings[screen.layer.id]?.fromWidth) continue;
      findings.push({
        severity: "notice",
        owner: { kind: "screen", id: screen.layer.id },
        message: "この画面に切り替える幅が決まっていません",
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

function colorVariableWithUnboundUses(file: FileData, colors: ColorUse[]): { variableId: string; layerIds: string[] } | null {
  for (const variable of file.tokens.variables) {
    if (variable.resolvedType !== "COLOR") continue;
    const value = Object.values(variable.valuesByMode)[0];
    if (!value || typeof value !== "object" || !("r" in value)) continue;
    const use = colors.find((c) => c.hex === colorHex(value, "a" in value ? value.a : 1));
    if (use) return { variableId: variable.id, layerIds: use.layerIds };
  }
  return null;
}
