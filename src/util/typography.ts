// Shared typography helpers used by both spec.json (per-node metrics, values
// omitted when they equal Figma's default) and tokens.json (Text Style
// composite tokens, values always present — design doc 4.5.1 / 4.5.2.1).

// Top-level tokens.json group name for Text Style tokens, and the prefix
// specBuilder.ts uses when building the matching spec.json typographyToken
// reference (e.g. "typography/heading-md") — centralized so both stay in
// sync (design doc 4.5.1 / 4.5.2.1).
export const TYPOGRAPHY_TOKEN_PREFIX = "typography";

const FONT_WEIGHT_MAP: Record<string, number> = {
  Thin: 100, Hairline: 100,
  ExtraLight: 200, UltraLight: 200,
  Light: 300,
  Regular: 400, Normal: 400,
  Medium: 500,
  SemiBold: 600, DemiBold: 600,
  Bold: 700,
  ExtraBold: 800, UltraBold: 800,
  Black: 900, Heavy: 900,
};

export function parseFontWeight(style: string): number {
  // Drop spaces ("Extra Bold" → "ExtraBold") and test longest keys first so a
  // substring like "Bold" can't shadow "ExtraBold"/"UltraBold".
  const s = style.replace(/\s+/g, "");
  const keys = Object.keys(FONT_WEIGHT_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (s.includes(key)) return FONT_WEIGHT_MAP[key];
  }
  return 400;
}

// Core unit-based formatting, shared by both the sparse (per-node) and
// composite (token) callers below. Returns undefined for AUTO, which has no
// numeric PIXELS/PERCENT representation in Figma's LineHeight type.
function formatLineHeightValue(lh: LineHeight): string | undefined {
  if (lh.unit === "PIXELS") return `${lh.value}px`;
  if (lh.unit === "PERCENT") return `${lh.value}%`;
  return undefined;
}

// Core unit-based formatting for letter-spacing. Does NOT special-case 0 —
// callers layer their own zero policy on top (sparse: omit, composite: "0em").
function formatLetterSpacingValue(ls: LetterSpacing): string {
  // PERCENT letter-spacing is a fraction of the font size → em.
  if (ls.unit === "PERCENT") return `${ls.value / 100}em`;
  return `${ls.value}px`;
}

// Per-node (spec.json text.*) policy: AUTO line-height and 0 letter-spacing
// are Figma's defaults, so omit them (design doc 4.5.2.1).
export function lineHeightToSparseCss(lh: LineHeight): string | undefined {
  return formatLineHeightValue(lh);
}

export function letterSpacingToSparseCss(ls: LetterSpacing): string | undefined {
  if (ls.value === 0) return undefined;
  return formatLetterSpacingValue(ls);
}

// Composite (tokens.json typography.$value) policy: always resolve to a
// concrete value, never omit (design doc 4.5.1). AUTO becomes the CSS
// keyword "normal"; zero letter-spacing becomes the literal "0em".
export function lineHeightToTokenValue(lh: LineHeight): string {
  return formatLineHeightValue(lh) ?? "normal";
}

export function letterSpacingToTokenValue(ls: LetterSpacing): string {
  if (ls.value === 0) return "0em";
  return formatLetterSpacingValue(ls);
}
