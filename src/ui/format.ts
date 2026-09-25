// Turns read values into short text for the screen. Display only; no judgment.
import type { DropReason } from "../core/screens";
import type { TokenDrop } from "../core/tokens";
import type { LayerData, VariableData } from "../shared/data";

type Rgb = { r: number; g: number; b: number };

export function colorHex(color: Rgb, alpha = 1): string {
  const byte = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${byte(color.r)}${byte(color.g)}${byte(color.b)}${alpha < 1 ? byte(alpha) : ""}`;
}

/** CSS color for a swatch. */
export function colorCss(color: Rgb, alpha = 1): string {
  const c = (n: number) => Math.round(n * 255);
  return `rgb(${c(color.r)} ${c(color.g)} ${c(color.b)} / ${alpha})`;
}

export interface ShownValue {
  text: string;
  /** Set for colors, to draw a swatch. */
  swatch?: string;
}

export function variableValue(value: VariableData["valuesByMode"][string], variables: VariableData[]): ShownValue {
  if (typeof value === "object" && value !== null) {
    if ("type" in value && value.type === "VARIABLE_ALIAS") {
      const target = variables.find((v) => v.id === value.id);
      return { text: `→ ${target?.name ?? "（見つからない変数）"}` };
    }
    if ("r" in value) {
      const alpha = "a" in value ? value.a : 1;
      return { text: colorHex(value, alpha), swatch: colorCss(value, alpha) };
    }
  }
  return { text: String(value) };
}

/** The value of the variable in its collection's first mode, to show on its row. */
export function firstValue(variable: VariableData, variables: VariableData[]): ShownValue {
  const value = Object.values(variable.valuesByMode)[0];
  return value === undefined ? { text: "" } : variableValue(value, variables);
}

export function dropReasonText(reason: DropReason, layer: LayerData): string {
  switch (reason) {
    case "not-screen":
      return `画面でない（${layer.type}）`;
    case "hidden":
      return "非表示";
  }
}

export function tokenDropText(reason: TokenDrop): string {
  switch (reason) {
    case "color-style":
      return "Color Style は渡らない。色は変数から渡す";
    case "not-color-or-number":
      return "色・数値以外の変数は渡らない";
  }
}

export function size(layer: LayerData): string {
  return layer.width === undefined ? "" : `${round(layer.width)} × ${round(layer.height ?? 0)}`;
}

export function round(n: number): string {
  return String(Math.round(n * 100) / 100);
}
