import { colorToHex } from "../util/color";

interface TokenValue {
  $type: string;
  $value: string | number;
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
    return colorToHex(val as RGBA);
  }
  return String(val);
}

function resolveValue(variable: Variable): string | number {
  const modeIds = Object.keys(variable.valuesByMode);
  if (modeIds.length === 0) return 0;
  return resolveModeValue(variable.valuesByMode[modeIds[0]], new Set([variable.id]));
}

function setNested(obj: TokenGroup, path: string[], value: TokenValue): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (!current[path[i]] || "$type" in (current[path[i]] as TokenValue)) {
      current[path[i]] = {};
    }
    current = current[path[i]] as TokenGroup;
  }
  current[path[path.length - 1]] = value;
}

export function buildTokens(variables: Variable[]): TokenGroup | null {
  if (variables.length === 0) return null;

  const tokens: TokenGroup = {};

  for (const variable of variables) {
    const parts = variable.name.split("/");
    const tokenValue: TokenValue = {
      $type: resolveType(variable),
      $value: resolveValue(variable),
    };
    setNested(tokens, parts, tokenValue);
  }

  return tokens;
}
