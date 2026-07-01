import type { CheckResult } from "./types";
import { colorToHex } from "../util/color";

// Recommended semantic token taxonomy (design doc 4.3.4). Suggestions steer
// naming toward these categories; telldes does NOT guess which slot a given
// value maps to (avoids false positives) — the designer picks the slot.
const NAMING = {
  color:
    "この色をVariableに登録しませんか？（命名は color 体系: brand / neutral / status から）",
  spacing:
    "この間隔をVariableに登録しませんか？（命名は spacing スケール: xs〜2xl から）",
  fontSize:
    "このフォントサイズを Text Style にまとめませんか？（命名は typography スケール: display〜label から）",
  radius:
    "この角丸をVariableに登録しませんか？（命名は radius スケール: sm / md / lg / full から）",
  shadow:
    "この影を Effect Style にまとめませんか？（命名は elevation スケール: shadow-sm / md / lg から）",
} as const;

function boundVariablesOf(node: SceneNode): Record<string, unknown> | undefined {
  if (!("boundVariables" in node)) return undefined;
  return (node as SceneNodeMixin).boundVariables as
    | Record<string, unknown>
    | undefined;
}

function hasBoundVariable(node: SceneNode, field: string): boolean {
  const bound = boundVariablesOf(node);
  return Boolean(bound && bound[field]);
}

// boundVariables.fills is an array aligned by paint index — a fill is bound
// only if ITS index has a binding (not if any sibling fill is bound).
function isFillBound(node: SceneNode, index: number): boolean {
  const raw = boundVariablesOf(node)?.["fills"];
  if (!raw) return false;
  const binding = Array.isArray(raw) ? raw[index] : raw;
  return Boolean(binding && (binding as { id?: string }).id);
}

function extractColors(node: SceneNode): { color: string; nodeId: string; nodeName: string }[] {
  const entries: { color: string; nodeId: string; nodeName: string }[] = [];
  if (!("fills" in node)) return entries;

  const fills = node.fills;
  if (!Array.isArray(fills)) return entries;

  fills.forEach((fill, i) => {
    if (isFillBound(node, i)) return; // already a Variable — don't suggest it
    if (fill.type === "SOLID" && fill.visible !== false) {
      const hex = colorToHex(
        { ...fill.color, a: fill.opacity ?? 1 },
        { alpha: true, uppercase: false },
      );
      entries.push({ color: hex, nodeId: node.id, nodeName: node.name });
    }
  });
  return entries;
}

export function checkRepeatedColors(nodes: SceneNode[]): CheckResult[] {
  const colorMap = new Map<string, { nodeId: string; nodeName: string }[]>();

  for (const node of nodes) {
    const seen = new Set<string>();
    for (const entry of extractColors(node)) {
      if (seen.has(entry.color)) continue;
      seen.add(entry.color);
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
          suggestion: NAMING.color,
        });
      }
    }
  }
  return results;
}

function extractSpacing(node: SceneNode): number[] {
  if (!("paddingTop" in node)) return [];
  const n = node as FrameNode;
  const values: number[] = [];
  // Each padding side and itemSpacing binds independently — count a value only
  // if its own field is NOT already bound to a variable.
  if (n.paddingTop > 0 && !hasBoundVariable(node, "paddingTop")) values.push(n.paddingTop);
  if (n.paddingRight > 0 && !hasBoundVariable(node, "paddingRight")) values.push(n.paddingRight);
  if (n.paddingBottom > 0 && !hasBoundVariable(node, "paddingBottom")) values.push(n.paddingBottom);
  if (n.paddingLeft > 0 && !hasBoundVariable(node, "paddingLeft")) values.push(n.paddingLeft);
  if ("itemSpacing" in n && n.itemSpacing > 0 && !hasBoundVariable(node, "itemSpacing")) {
    values.push(n.itemSpacing);
  }
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
          suggestion: NAMING.spacing,
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
    // Resolve a mixed font size to the first character's size, mirroring
    // specBuilder, so multi-size text is still counted (not silently dropped).
    let fontSize: number;
    if (typeof textNode.fontSize === "number") {
      fontSize = textNode.fontSize;
    } else if (textNode.characters.length > 0) {
      const ranged = textNode.getRangeFontSize(0, 1);
      if (typeof ranged !== "number") continue;
      fontSize = ranged;
    } else {
      continue;
    }

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
          suggestion: NAMING.fontSize,
        });
      }
    }
  }
  return results;
}

// Distinct corner-radius values on one node. A uniform radius binds via
// topLeftRadius (there is no "cornerRadius" bindable field — see specBuilder);
// mixed corners bind per side. Skip any corner already bound to a Variable.
function extractRadii(node: SceneNode): number[] {
  if (!("cornerRadius" in node)) return [];
  const cr = (node as CornerMixin).cornerRadius;
  if (typeof cr === "number") {
    return cr > 0 && !hasBoundVariable(node, "topLeftRadius") ? [cr] : [];
  }
  if (!("topLeftRadius" in node)) return [];
  const c = node as RectangleCornerMixin;
  const corners: [number, string][] = [
    [c.topLeftRadius, "topLeftRadius"],
    [c.topRightRadius, "topRightRadius"],
    [c.bottomRightRadius, "bottomRightRadius"],
    [c.bottomLeftRadius, "bottomLeftRadius"],
  ];
  const values: number[] = [];
  for (const [v, field] of corners) {
    if (typeof v === "number" && v > 0 && !hasBoundVariable(node, field)) {
      values.push(v);
    }
  }
  return values;
}

export function checkRepeatedRadius(nodes: SceneNode[]): CheckResult[] {
  const radiusMap = new Map<number, { nodeId: string; nodeName: string }[]>();

  for (const node of nodes) {
    const seen = new Set<number>();
    for (const val of extractRadii(node)) {
      if (seen.has(val)) continue;
      seen.add(val);
      if (!radiusMap.has(val)) radiusMap.set(val, []);
      radiusMap.get(val)!.push({ nodeId: node.id, nodeName: node.name });
    }
  }

  const results: CheckResult[] = [];
  for (const [val, usages] of radiusMap) {
    if (usages.length >= 2) {
      for (const usage of usages) {
        results.push({
          level: "suggestion",
          nodeId: usage.nodeId,
          nodeName: usage.nodeName,
          message: `corner radius ${val}px が${usages.length}箇所で使用されています`,
          suggestion: NAMING.radius,
        });
      }
    }
  }
  return results;
}

interface ShadowEntry {
  key: string;
  label: string;
}

// Visible drop shadows on one node, canonicalized for dedup. A node whose
// shadows come from an applied Effect Style is already tokenized — skip it.
function extractShadows(node: SceneNode): ShadowEntry[] {
  if (!("effects" in node)) return [];
  const styleId = (node as BlendMixin).effectStyleId;
  if (typeof styleId === "string" && styleId !== "") return [];

  const effects = (node as BlendMixin).effects;
  if (!Array.isArray(effects)) return [];

  const entries: ShadowEntry[] = [];
  for (const effect of effects) {
    if (effect.type !== "DROP_SHADOW") continue;
    if (effect.visible === false) continue;
    const ds = effect as DropShadowEffect;
    const hex = colorToHex(ds.color, { alpha: true, uppercase: false });
    const spread = ds.spread ?? 0;
    entries.push({
      key: `${ds.offset.x},${ds.offset.y},${ds.radius},${spread},${hex}`,
      label: `offset ${ds.offset.x},${ds.offset.y} / blur ${ds.radius} / spread ${spread} / ${hex}`,
    });
  }
  return entries;
}

export function checkRepeatedShadow(nodes: SceneNode[]): CheckResult[] {
  const shadowMap = new Map<
    string,
    { label: string; usages: { nodeId: string; nodeName: string }[] }
  >();

  for (const node of nodes) {
    const seen = new Set<string>();
    for (const entry of extractShadows(node)) {
      if (seen.has(entry.key)) continue;
      seen.add(entry.key);
      if (!shadowMap.has(entry.key)) {
        shadowMap.set(entry.key, { label: entry.label, usages: [] });
      }
      shadowMap.get(entry.key)!.usages.push({ nodeId: node.id, nodeName: node.name });
    }
  }

  const results: CheckResult[] = [];
  for (const { label, usages } of shadowMap.values()) {
    if (usages.length >= 2) {
      for (const usage of usages) {
        results.push({
          level: "suggestion",
          nodeId: usage.nodeId,
          nodeName: usage.nodeName,
          message: `drop shadow (${label}) が${usages.length}箇所で使用されています`,
          suggestion: NAMING.shadow,
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
    ...checkRepeatedRadius(nodes),
    ...checkRepeatedShadow(nodes),
  ];
}
