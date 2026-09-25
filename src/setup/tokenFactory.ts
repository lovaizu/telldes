// Setup: the starter token set (design doc 4.3.4 / 4.3.9).
//
// The names are the shared vocabulary between the designer and CC; the values
// are placeholders that only need adjacent steps/roles to look different
// (4.3.4). The data below is kept apart from the Figma calls so it can be
// checked without a Figma file.

export type CollectionName = "Light" | "Dark" | "Base";

export interface VariableSpec {
  name: string;
  type: "COLOR" | "FLOAT" | "STRING";
  value: RGBA | number | string;
  scopes: VariableScope[];
}

export interface CollectionSpec {
  name: CollectionName;
  variables: VariableSpec[];
}

export interface TextStyleSpec {
  name: string;
  /** Base-collection STRING variable the style's font family is bound to. */
  fontVariable: string;
  fontStyle: string;
  fontSize: number;
  /** Line height in percent of the font size. */
  lineHeight: number;
}

export interface EffectStyleSpec {
  name: string;
  offset: { x: number; y: number };
  radius: number;
  spread: number;
}

function hex(value: string, a = 1): RGBA {
  const n = parseInt(value.slice(1), 16);
  return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255, a };
}

const FILL: VariableScope[] = ["FRAME_FILL", "SHAPE_FILL"];
const TEXT: VariableScope[] = ["TEXT_FILL"];

/** Color roles in panel order, with their Light-collection scopes (4.3.4). */
const COLOR_ROLES: { name: string; scopes: VariableScope[]; light: RGBA; dark: RGBA }[] = [
  { name: "bg", scopes: FILL, light: hex("#FFFFFF"), dark: hex("#121212") },
  { name: "surface", scopes: FILL, light: hex("#F2F2F2"), dark: hex("#1E1E1E") },
  { name: "border", scopes: ["STROKE_COLOR"], light: hex("#D0D0D0"), dark: hex("#3A3A3A") },
  { name: "fg/default", scopes: TEXT, light: hex("#1A1A1A"), dark: hex("#F2F2F2") },
  { name: "fg/muted", scopes: TEXT, light: hex("#6B6B6B"), dark: hex("#A0A0A0") },
  { name: "primary/default", scopes: FILL, light: hex("#2563EB"), dark: hex("#60A5FA") },
  { name: "primary/hover", scopes: FILL, light: hex("#1D4ED8"), dark: hex("#93C5FD") },
  { name: "primary/on", scopes: TEXT, light: hex("#FFFFFF"), dark: hex("#0B1220") },
  { name: "link", scopes: TEXT, light: hex("#0E7490"), dark: hex("#22D3EE") },
  { name: "code/bg", scopes: FILL, light: hex("#1E1E2E"), dark: hex("#0B0B12") },
  { name: "code/fg", scopes: TEXT, light: hex("#E4E4E7"), dark: hex("#E4E4E7") },
  { name: "notice/bg", scopes: FILL, light: hex("#FEF3C7"), dark: hex("#422006") },
  { name: "notice/fg", scopes: TEXT, light: hex("#B45309"), dark: hex("#FCD34D") },
  { name: "shadow", scopes: ["EFFECT_COLOR"], light: hex("#000000", 0.12), dark: hex("#000000", 0.5) },
];

const SPACING: [string, number][] = [
  ["xs", 4], ["sm", 8], ["md", 16], ["lg", 24], ["xl", 32], ["2xl", 48], ["3xl", 64], ["4xl", 96],
];

const RADIUS: [string, number][] = [["sm", 4], ["md", 8], ["lg", 16], ["xl", 24], ["full", 9999]];

const FONTS: [string, string][] = [
  ["heading", "Inter"], ["body", "Noto Sans JP"], ["mono", "Roboto Mono"],
];

export const COLLECTIONS: CollectionSpec[] = [
  {
    name: "Light",
    variables: COLOR_ROLES.map((c) => ({ name: c.name, type: "COLOR", value: c.light, scopes: c.scopes })),
  },
  {
    // Hidden from every picker: the designer binds Light, and telldes swaps in
    // the same-named Dark variable (4.3.9).
    name: "Dark",
    variables: COLOR_ROLES.map((c) => ({ name: c.name, type: "COLOR", value: c.dark, scopes: [] })),
  },
  {
    name: "Base",
    variables: [
      ...SPACING.map(([k, v]): VariableSpec => ({ name: `spacing/${k}`, type: "FLOAT", value: v, scopes: ["GAP"] })),
      ...RADIUS.map(([k, v]): VariableSpec => ({ name: `radius/${k}`, type: "FLOAT", value: v, scopes: ["CORNER_RADIUS"] })),
      // FONT_FAMILY without ALL_SCOPES is what marks these as font tokens (4.3.4).
      ...FONTS.map(([k, v]): VariableSpec => ({ name: `font/${k}`, type: "STRING", value: v, scopes: ["FONT_FAMILY"] })),
    ],
  },
];

export const TEXT_STYLES: TextStyleSpec[] = [
  { name: "display", fontVariable: "font/heading", fontStyle: "Bold", fontSize: 64, lineHeight: 120 },
  { name: "heading-lg", fontVariable: "font/heading", fontStyle: "Bold", fontSize: 40, lineHeight: 125 },
  { name: "heading-md", fontVariable: "font/heading", fontStyle: "Bold", fontSize: 32, lineHeight: 130 },
  { name: "heading-sm", fontVariable: "font/heading", fontStyle: "Bold", fontSize: 24, lineHeight: 135 },
  { name: "lead", fontVariable: "font/body", fontStyle: "Regular", fontSize: 20, lineHeight: 160 },
  { name: "body", fontVariable: "font/body", fontStyle: "Regular", fontSize: 16, lineHeight: 170 },
  { name: "label", fontVariable: "font/body", fontStyle: "Bold", fontSize: 14, lineHeight: 140 },
  { name: "caption", fontVariable: "font/body", fontStyle: "Regular", fontSize: 12, lineHeight: 150 },
  { name: "code", fontVariable: "font/mono", fontStyle: "Regular", fontSize: 14, lineHeight: 170 },
];

/** Their color is bound to the Light collection's `shadow` (4.3.4). */
export const EFFECT_STYLES: EffectStyleSpec[] = [
  { name: "shadow-sm", offset: { x: 0, y: 2 }, radius: 4, spread: 0 },
  { name: "shadow-md", offset: { x: 0, y: 8 }, radius: 24, spread: -4 },
];

/** `fg/default` → `var(--fg-default)`: the CSS variable name CC writes. */
export function webCodeSyntax(name: string): string {
  return `var(--${name.replace(/\//g, "-")})`;
}

export interface SetupResult {
  createdVariables: number;
  createdStyles: number;
}

/**
 * Adds whatever of the starter set the file lacks. Anything already there by
 * the same name is left exactly as the designer has it — Setup is the place
 * the set comes from, not a reset of the designer's edits.
 */
export async function createTokens(): Promise<SetupResult> {
  let createdVariables = 0;
  let createdStyles = 0;

  const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const byCollection = new Map<CollectionName, Map<string, Variable>>();

  for (const spec of COLLECTIONS) {
    const collection =
      localCollections.find((c) => c.name === spec.name) ??
      figma.variables.createVariableCollection(spec.name);
    // Free plan collections have exactly one mode.
    const modeId = collection.modes[0].modeId;

    const existing = new Map<string, Variable>();
    for (const id of collection.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) existing.set(variable.name, variable);
    }

    for (const v of spec.variables) {
      if (existing.has(v.name)) continue;
      const variable = figma.variables.createVariable(v.name, collection, v.type);
      variable.setValueForMode(modeId, v.value);
      variable.scopes = v.scopes;
      variable.setVariableCodeSyntax("WEB", webCodeSyntax(v.name));
      existing.set(v.name, variable);
      createdVariables++;
    }
    byCollection.set(spec.name, existing);
  }

  const base = byCollection.get("Base")!;
  const shadow = byCollection.get("Light")!.get("shadow")!;

  const textStyleNames = new Set((await figma.getLocalTextStylesAsync()).map((s) => s.name));
  for (const spec of TEXT_STYLES) {
    if (textStyleNames.has(spec.name)) continue;
    const fontVar = base.get(spec.fontVariable)!;
    const fontName: FontName = { family: fontFamilyOf(fontVar), style: spec.fontStyle };
    // Loaded before the style exists, so a missing font leaves no half-built
    // style behind; the next run retries it.
    try {
      await figma.loadFontAsync(fontName);
    } catch (err) {
      throw new Error(`Could not load font "${fontName.family}" ${fontName.style}: ${err}`);
    }
    const style = figma.createTextStyle();
    style.name = spec.name;
    style.fontName = fontName;
    style.fontSize = spec.fontSize;
    style.lineHeight = { unit: "PERCENT", value: spec.lineHeight };
    style.letterSpacing = { unit: "PERCENT", value: 0 };
    style.setBoundVariable("fontFamily", fontVar);
    createdStyles++;
  }

  const effectStyleNames = new Set((await figma.getLocalEffectStylesAsync()).map((s) => s.name));
  for (const spec of EFFECT_STYLES) {
    if (effectStyleNames.has(spec.name)) continue;
    const style = figma.createEffectStyle();
    style.name = spec.name;
    const effect: DropShadowEffect = {
      type: "DROP_SHADOW",
      color: colorOf(shadow),
      offset: spec.offset,
      radius: spec.radius,
      spread: spec.spread,
      visible: true,
      blendMode: "NORMAL",
    };
    style.effects = [figma.variables.setBoundVariableForEffect(effect, "color", shadow)];
    createdStyles++;
  }

  return { createdVariables, createdStyles };
}

function firstModeValue(variable: Variable): VariableValue {
  return Object.values(variable.valuesByMode)[0];
}

// A variable the designer already had may hold something other than a plain
// value (an alias, another type). Setup does not guess what it means; it says
// which variable is in the way.
function fontFamilyOf(variable: Variable): string {
  const value = firstModeValue(variable);
  if (typeof value !== "string") {
    throw new Error(`Variable "${variable.name}" must hold a font family name to bind text styles to it`);
  }
  return value;
}

function colorOf(variable: Variable): RGBA {
  const value = firstModeValue(variable);
  if (typeof value !== "object" || value === null || !("r" in value)) {
    throw new Error(`Variable "${variable.name}" must hold a color to bind effect styles to it`);
  }
  return { r: value.r, g: value.g, b: value.b, a: "a" in value ? value.a : 1 };
}
