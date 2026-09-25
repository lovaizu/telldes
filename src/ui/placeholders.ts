// Stand-ins for results that later tasks build for real. Everything here is
// fake, kept only so the screen can be tried before the features exist; each
// section names the task that replaces it. Nothing here writes to Figma. The
// UI says once that results are placeholders, and each value from here names
// its task on hover.
import type { Finding } from "../core/findings";
import type { LayerEntry, WebPage } from "../core/screens";
import type { FileData, LayerData } from "../shared/data";
import { colorHex, counted } from "./format";

/** The task that replaces each placeholder, and the feature it builds, shown on hover over the fake value. */
export const TASK = {
  setup: { number: 4, feature: "Setup" },
  review: { number: 5, feature: "Review" },
  note: { number: 6, feature: "note" },
  exportSettings: { number: 7, feature: "Export settings" },
  export: { number: 7, feature: "Export" },
  assets: { number: 8, feature: "image and asset export" },
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
      return { [entry.layer.id]: "Underline on hover (sample note)" };
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
  return `Export would write telldes-export.zip: ${counted(webPageCount, "Web page")} (${counted(screenCount, "frame")}), and a README.md listing ${counted(droppedCount, "item")} not exported.`;
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
      message: "Dark support is on, but there is no Dark collection.",
      fix: "Run Setup to add a Dark collection, or turn off dark support.",
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
          ? `${color.hex}, the value of ${token.name}, is not linked to it in ${counted(color.layerIds.length, "place")}. They won't switch in Dark.`
          : `${color.hex}, the value of ${token.name}, is not linked to it in ${counted(color.layerIds.length, "place")}.`,
        fix: darkSupport ? `Link them to ${token.name}.` : `Link them to ${token.name}, or leave them if that is on purpose.`,
        layerIds: color.layerIds,
      });
    } else if (darkSupport) {
      // A light-only file reports nothing for raw values (docs/design.md).
      findings.push({
        severity: "error",
        // No token to connect to: the decision is about the value itself, however many places use it.
        owner: { kind: "value", value: color.hex },
        message: `${color.hex} is not linked to a variable, so it won't switch in Dark.`,
        fix: "Add a variable for this color in Light and Dark, and link it.",
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
        message: "This Web page has frames for other widths, but this frame has no “From width”.",
        fix: "Enter “From width” in this frame's Export settings.",
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
