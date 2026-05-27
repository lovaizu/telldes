interface TokenValue {
  $type: string;
  $value: string | number;
}

type TokenGroup = { [key: string]: TokenGroup | TokenValue };

function colorToHex(color: RGB | RGBA): string {
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`.toUpperCase();
}

function resolveType(variable: Variable): string {
  return variable.resolvedType === "COLOR" ? "color" : "number";
}

function resolveValue(variable: Variable): string | number {
  const values = variable.valuesByMode;
  const modeIds = Object.keys(values);
  if (modeIds.length === 0) return 0;

  const val = values[modeIds[0]];

  if (typeof val === "number") return val;
  if (typeof val === "object" && val !== null && "r" in val) {
    return colorToHex(val as RGBA);
  }
  return String(val);
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
