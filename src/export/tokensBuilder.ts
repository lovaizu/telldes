import { colorToHex } from "../util/color";
import {
  parseFontWeight,
  lineHeightToTokenValue,
  letterSpacingToTokenValue,
} from "../util/typography";

interface TypographyValue {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: string;
  letterSpacing: string;
}

interface TokenValue {
  $type: string;
  $value: string | number | TypographyValue;
}

type TokenGroup = { [key: string]: TokenGroup | TokenValue };

function resolveType(variable: Variable): string {
  return variable.resolvedType === "COLOR" ? "color" : "number";
}

function isAlias(val: VariableValue): val is VariableAlias {
  return (
    typeof val === "object" &&
    val !== null &&
    "type" in val &&
    (val as VariableAlias).type === "VARIABLE_ALIAS"
  );
}

// Resolve a per-mode value to a concrete primitive, following VARIABLE_ALIAS
// references (e.g. semantic → primitive tokens) with cycle protection so the
// emitted $value is always a resolved value (design doc 4.5.1).
function resolveModeValue(val: VariableValue, seen: Set<string>): string | number {
  if (typeof val === "number") return val;
  if (isAlias(val)) {
    if (seen.has(val.id)) return 0;
    seen.add(val.id);
    const referenced = figma.variables.getVariableById(val.id);
    if (!referenced) return 0;
    const refModeIds = Object.keys(referenced.valuesByMode);
    if (refModeIds.length === 0) return 0;
    return resolveModeValue(referenced.valuesByMode[refModeIds[0]], seen);
  }
  if (typeof val === "object" && val !== null && "r" in val) {
    // #RRGGBB, or #RRGGBBAA when alpha < 1 (design doc 4.5.1).
    return colorToHex(val as RGBA, { alpha: true });
  }
  return String(val);
}

function resolveValue(variable: Variable): string | number {
  const modeIds = Object.keys(variable.valuesByMode);
  if (modeIds.length === 0) return 0;
  return resolveModeValue(variable.valuesByMode[modeIds[0]], new Set([variable.id]));
}

function isLeaf(node: TokenGroup | TokenValue | undefined): node is TokenValue {
  return !!node && "$type" in node;
}

// A variable name can be both a leaf and a group prefix (e.g. "color" and
// "color/primary"). Preserve BOTH (zero omission) by storing a leaf that
// collides with a group under the reserved "$base" key.
function setNested(obj: TokenGroup, path: string[], value: TokenValue): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const existing = current[path[i]];
    if (!existing) {
      current[path[i]] = {};
    } else if (isLeaf(existing)) {
      // existing leaf must become a group: demote it to "$base"
      current[path[i]] = { $base: existing } as unknown as TokenGroup;
    }
    current = current[path[i]] as TokenGroup;
  }
  const last = path[path.length - 1];
  const existing = current[last];
  if (existing && !isLeaf(existing)) {
    // a group already occupies this name: keep the leaf under "$base"
    (existing as TokenGroup).$base = value;
  } else {
    current[last] = value;
  }
}

// A Text Style is single-valued (never figma.mixed), unlike TextNode-level
// extraction, so no mixed-handling is needed here. $value is the Text
// Style's canonical definition — always all 5 keys, never sparse (design doc
// 4.5.1), which is why this uses the *ToTokenValue formatters (AUTO →
// "normal", 0 → "0em") rather than the sparse per-node ones.
function resolveTypographyValue(style: TextStyle): TypographyValue {
  return {
    fontFamily: style.fontName.family,
    fontSize: style.fontSize,
    fontWeight: parseFontWeight(style.fontName.style),
    lineHeight: lineHeightToTokenValue(style.lineHeight),
    letterSpacing: letterSpacingToTokenValue(style.letterSpacing),
  };
}

export function buildTokens(
  variables: Variable[],
  textStyles: TextStyle[] = [],
): TokenGroup | null {
  // The documented token schema (4.5.1) covers only color and number. Drop
  // STRING/BOOLEAN variables rather than emit a wrong $type with a stringified
  // value (e.g. { $type: "number", $value: "Inter" }).
  const supported = variables.filter(
    (v) => v.resolvedType === "COLOR" || v.resolvedType === "FLOAT",
  );
  if (supported.length === 0 && textStyles.length === 0) return null;

  const tokens: TokenGroup = {};

  for (const variable of supported) {
    const parts = variable.name.split("/");
    const tokenValue: TokenValue = {
      $type: resolveType(variable),
      $value: resolveValue(variable),
    };
    setNested(tokens, parts, tokenValue);
  }

  // Text Styles aren't designer-named with a "typography/" prefix the way
  // Variables are self-grouping by "/" — inject the top-level group here.
  for (const style of textStyles) {
    const parts = ["typography", ...style.name.split("/")];
    const tokenValue: TokenValue = {
      $type: "typography",
      $value: resolveTypographyValue(style),
    };
    setNested(tokens, parts, tokenValue);
  }

  return tokens;
}
