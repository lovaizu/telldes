interface ColorInput {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface ColorOptions {
  /** Emit an 8-digit #RRGGBBAA when alpha < 1. Default: false (always #RRGGBB). */
  alpha?: boolean;
  /** Uppercase the hex output. Default: true. */
  uppercase?: boolean;
}

/**
 * Canonical RGB(A) → hex converter shared across export builders and checks.
 * Export output (spec.json / tokens.json) uses the documented #RRGGBB uppercase
 * form (design doc 4.5.1 / 4.5.2); the repeated-color check opts into alpha.
 */
export function colorToHex(color: ColorInput, options: ColorOptions = {}): string {
  const { alpha = false, uppercase = true } = options;
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  const a = color.a ?? 1;
  const hex =
    alpha && a < 1
      ? `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}${toHex(a)}`
      : `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  return uppercase ? hex.toUpperCase() : hex;
}
