import type { CheckResult } from "./types";

function colorToHex(r: number, g: number, b: number, a: number): string {
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return a < 1
    ? `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`
    : `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hasBoundVariable(node: SceneNode, field: string): boolean {
  if (!("boundVariables" in node)) return false;
  const bound = (node as any).boundVariables;
  return bound && bound[field];
}

function extractColors(node: SceneNode): { color: string; nodeId: string; nodeName: string }[] {
  const entries: { color: string; nodeId: string; nodeName: string }[] = [];
  if (!("fills" in node)) return entries;
  if (hasBoundVariable(node, "fills")) return entries;

  const fills = node.fills;
  if (!Array.isArray(fills)) return entries;

  for (const fill of fills) {
    if (fill.type === "SOLID" && fill.visible !== false) {
      const hex = colorToHex(fill.color.r, fill.color.g, fill.color.b, fill.opacity ?? 1);
      entries.push({ color: hex, nodeId: node.id, nodeName: node.name });
    }
  }
  return entries;
}

export function checkRepeatedColors(nodes: SceneNode[]): CheckResult[] {
  const colorMap = new Map<string, { nodeId: string; nodeName: string }[]>();

  for (const node of nodes) {
    for (const entry of extractColors(node)) {
      if (!colorMap.has(entry.color)) {
        colorMap.set(entry.color, []);
      }
      colorMap.get(entry.color)!.push({ nodeId: entry.nodeId, nodeName: entry.nodeName });
    }
  }

  const results: CheckResult[] = [];
  for (const [color, usages] of colorMap) {
    if (usages.length >= 3) {
      for (const usage of usages) {
        results.push({
          level: "suggestion",
          nodeId: usage.nodeId,
          nodeName: usage.nodeName,
          message: `色 ${color} が${usages.length}箇所で使用されています`,
          suggestion: "この色をVariableに登録しませんか？",
        });
      }
    }
  }
  return results;
}

function extractSpacing(node: SceneNode): number[] {
  if (!("paddingTop" in node)) return [];
  if (hasBoundVariable(node, "paddingTop") || hasBoundVariable(node, "itemSpacing")) return [];
  const n = node as FrameNode;
  const values: number[] = [];
  if (n.paddingTop > 0) values.push(n.paddingTop);
  if (n.paddingRight > 0) values.push(n.paddingRight);
  if (n.paddingBottom > 0) values.push(n.paddingBottom);
  if (n.paddingLeft > 0) values.push(n.paddingLeft);
  if ("itemSpacing" in n && n.itemSpacing > 0) values.push(n.itemSpacing);
  return values;
}

export function checkRepeatedSpacing(nodes: SceneNode[]): CheckResult[] {
  const spacingMap = new Map<number, { nodeId: string; nodeName: string }[]>();

  for (const node of nodes) {
    const spacings = extractSpacing(node);
    const seen = new Set<number>();
    for (const val of spacings) {
      if (seen.has(val)) continue;
      seen.add(val);
      if (!spacingMap.has(val)) {
        spacingMap.set(val, []);
      }
      spacingMap.get(val)!.push({ nodeId: node.id, nodeName: node.name });
    }
  }

  const results: CheckResult[] = [];
  for (const [val, usages] of spacingMap) {
    if (usages.length >= 2) {
      for (const usage of usages) {
        results.push({
          level: "suggestion",
          nodeId: usage.nodeId,
          nodeName: usage.nodeName,
          message: `spacing/padding ${val}px が${usages.length}箇所で使用されています`,
          suggestion: "この間隔をVariableに登録しませんか？",
        });
      }
    }
  }
  return results;
}

export function checkRepeatedFontSize(nodes: SceneNode[]): CheckResult[] {
  const fontSizeMap = new Map<number, { nodeId: string; nodeName: string }[]>();

  for (const node of nodes) {
    if (node.type !== "TEXT") continue;
    if (hasBoundVariable(node, "fontSize")) continue;
    const textNode = node as TextNode;
    const fontSize = textNode.fontSize;
    if (typeof fontSize !== "number") continue;

    if (!fontSizeMap.has(fontSize)) {
      fontSizeMap.set(fontSize, []);
    }
    fontSizeMap.get(fontSize)!.push({ nodeId: node.id, nodeName: node.name });
  }

  const results: CheckResult[] = [];
  for (const [size, usages] of fontSizeMap) {
    if (usages.length >= 2) {
      for (const usage of usages) {
        results.push({
          level: "suggestion",
          nodeId: usage.nodeId,
          nodeName: usage.nodeName,
          message: `font-size ${size}px が${usages.length}箇所で使用されています`,
          suggestion: "このフォントサイズをVariableに登録しませんか？",
        });
      }
    }
  }
  return results;
}

export function runVariableChecks(nodes: SceneNode[]): CheckResult[] {
  return [
    ...checkRepeatedColors(nodes),
    ...checkRepeatedSpacing(nodes),
    ...checkRepeatedFontSize(nodes),
  ];
}
