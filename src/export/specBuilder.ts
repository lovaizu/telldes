import { colorToHex } from "../util/color";
import { buildLayerPath, layerPathToSlug, determineType } from "./layerPath";

interface SpecSizing {
  width: string;
  height: string;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

interface SpecLayout {
  direction: string;
  wrap?: string;
  primaryAxisAlign?: string;
  counterAxisAlign?: string;
  padding?: { top: number; right: number; bottom: number; left: number };
  gap?: number;
  sizing?: SpecSizing;
  [key: string]: unknown;
}

interface SpecText {
  characters: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fill?: string;
  fillOpacity?: number;
  [key: string]: unknown;
}

interface SpecFill {
  type: string;
  color?: string;
  colorToken?: string;
  opacity?: number;
  scaleMode?: string;
  gradientStops?: { position: number; color: string }[];
  [key: string]: unknown;
}

type SpecCornerRadius =
  | number
  | { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };

interface SpecNode {
  name: string;
  type: "section" | "block" | "element";
  path: string;
  nodeType?: string;
  screenshot?: string;
  note?: string;
  layout?: SpecLayout;
  text?: SpecText;
  fills?: SpecFill[];
  cornerRadius?: SpecCornerRadius;
  children?: SpecNode[];
  [key: string]: unknown;
}

interface SpecJson {
  page: string;
  viewport: { width: number };
  children: SpecNode[];
}

function getTokenName(
  node: SceneNode,
  field: string,
  index = 0,
): string | undefined {
  if (!("boundVariables" in node)) return undefined;
  const bound = (node as SceneNodeMixin).boundVariables as
    | Record<string, VariableAlias | VariableAlias[] | undefined>
    | undefined;
  const raw = bound?.[field];
  if (!raw) return undefined;

  // Array-valued bindings (e.g. fills) align by index with the source array.
  const binding = Array.isArray(raw) ? raw[index] : raw;
  if (!binding?.id) return undefined;

  try {
    const variable = figma.variables.getVariableById(binding.id);
    return variable?.name ?? undefined;
  } catch {
    return undefined;
  }
}

function buildLayout(node: FrameNode): SpecLayout | undefined {
  if (node.layoutMode === "NONE") return undefined;

  const layout: SpecLayout = {
    direction: node.layoutMode,
  };

  if (node.layoutWrap === "WRAP") {
    layout.wrap = "WRAP";
    if (node.counterAxisAlignContent && node.counterAxisAlignContent !== "AUTO") {
      layout.counterAxisAlignContent = node.counterAxisAlignContent;
    }
  }

  if (node.primaryAxisAlignItems) {
    layout.primaryAxisAlign = node.primaryAxisAlignItems;
  }
  if (node.counterAxisAlignItems) {
    layout.counterAxisAlign = node.counterAxisAlignItems;
  }

  const padding = {
    top: node.paddingTop,
    right: node.paddingRight,
    bottom: node.paddingBottom,
    left: node.paddingLeft,
  };
  if (padding.top || padding.right || padding.bottom || padding.left) {
    layout.padding = padding;

    const padFields = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const;
    for (const f of padFields) {
      const token = getTokenName(node, f);
      if (token) {
        layout[`${f}Token`] = token;
      }
    }
  }

  if (node.itemSpacing > 0) {
    layout.gap = node.itemSpacing;
    const gapToken = getTokenName(node, "itemSpacing");
    if (gapToken) layout.gapToken = gapToken;
  }

  const sizing: SpecSizing = {
    width: node.layoutSizingHorizontal,
    height: node.layoutSizingVertical,
  };
  // min/max constraints are authoring-allowed (design doc 4.3.3) and null when unset.
  if (node.minWidth != null) sizing.minWidth = node.minWidth;
  if (node.maxWidth != null) sizing.maxWidth = node.maxWidth;
  if (node.minHeight != null) sizing.minHeight = node.minHeight;
  if (node.maxHeight != null) sizing.maxHeight = node.maxHeight;
  layout.sizing = sizing;

  return layout;
}

function buildTextProps(node: TextNode): SpecText | undefined {
  const characters = node.characters;
  // When the text has mixed font sizes, node.fontSize is figma.mixed; fall back
  // to the first character's resolved size rather than emitting 0 (design doc
  // 4.5.2: values are always resolved).
  let fontSize = 0;
  if (typeof node.fontSize === "number") {
    fontSize = node.fontSize;
  } else if (characters.length > 0) {
    const ranged = node.getRangeFontSize(0, 1);
    if (typeof ranged === "number") fontSize = ranged;
  }
  const fontName = node.fontName as FontName | typeof figma.mixed;
  const fontFamily = typeof fontName === "object" && "family" in fontName ? fontName.family : "";
  const fontWeight = typeof fontName === "object" && "style" in fontName
    ? parseFontWeight(fontName.style)
    : 400;

  const text: SpecText = { characters, fontSize, fontFamily, fontWeight };

  const fontSizeToken = getTokenName(node, "fontSize");
  if (fontSizeToken) text.fontSizeToken = fontSizeToken;

  const fills = node.fills;
  if (Array.isArray(fills) && fills.length > 0 && fills[0].type === "SOLID") {
    const solid = fills[0];
    text.fill = colorToHex(solid.color);
    const fillToken = getTokenName(node, "fills");
    if (fillToken) text.fillToken = fillToken;
    if (solid.opacity !== undefined && solid.opacity < 1) {
      text.fillOpacity = solid.opacity;
    }
  }

  return text;
}

function parseFontWeight(style: string): number {
  const map: Record<string, number> = {
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
  for (const [key, val] of Object.entries(map)) {
    if (style.includes(key)) return val;
  }
  return 400;
}

function buildFills(node: SceneNode): SpecFill[] | undefined {
  if (!("fills" in node)) return undefined;
  const fills = (node as GeometryMixin).fills;
  if (!Array.isArray(fills) || fills.length === 0) return undefined;

  const result: SpecFill[] = [];
  // Iterate by index so each fill's bound variable (boundVariables.fills[i])
  // stays aligned with its own paint.
  for (let i = 0; i < fills.length; i++) {
    const fill = fills[i];
    if (fill.visible === false) continue;

    let entry: SpecFill | undefined;
    if (fill.type === "SOLID") {
      entry = { type: "SOLID", color: colorToHex(fill.color) };
      const token = getTokenName(node, "fills", i);
      if (token) entry.colorToken = token;
    } else if (fill.type === "IMAGE") {
      entry = { type: "IMAGE" };
      if (fill.scaleMode) entry.scaleMode = fill.scaleMode;
    } else if (
      fill.type === "GRADIENT_LINEAR" ||
      fill.type === "GRADIENT_RADIAL" ||
      fill.type === "GRADIENT_ANGULAR" ||
      fill.type === "GRADIENT_DIAMOND"
    ) {
      entry = {
        type: fill.type,
        gradientStops: fill.gradientStops.map((stop) => ({
          position: stop.position,
          color: colorToHex(stop.color),
        })),
      };
    }

    if (entry) {
      if (fill.opacity !== undefined && fill.opacity < 1) {
        entry.opacity = fill.opacity;
      }
      result.push(entry);
    }
  }
  return result.length > 0 ? result : undefined;
}

function screenshotPath(layerPath: string): string {
  return `screenshots/${layerPathToSlug(layerPath)}.png`;
}

function buildNode(
  node: SceneNode,
  parentPath: string,
  depth: number,
): SpecNode {
  const path = buildLayerPath(parentPath, node.name);
  const type = determineType(node, depth);

  const spec: SpecNode = {
    name: node.name,
    type,
    path,
  };

  if (node.type === "TEXT") {
    spec.nodeType = "TEXT";
  }

  if (type === "section" || type === "block") {
    spec.screenshot = screenshotPath(path);
  }

  const note = node.getPluginData("note");
  if (note) {
    spec.note = note;
  }

  if ("layoutMode" in node && (node as FrameNode).layoutMode !== "NONE") {
    spec.layout = buildLayout(node as FrameNode);
  }

  if (node.type === "TEXT") {
    spec.text = buildTextProps(node as TextNode);
  }

  if (node.type !== "TEXT") {
    const fills = buildFills(node);
    if (fills) spec.fills = fills;
  }

  if ("layoutAlign" in node && (node as LayoutMixin).layoutAlign === "STRETCH") {
    spec.layoutAlign = "STRETCH";
  }
  if ("layoutGrow" in node && (node as LayoutMixin).layoutGrow === 1) {
    spec.layoutGrow = 1;
  }

  if ("cornerRadius" in node) {
    const cr = (node as CornerMixin).cornerRadius;
    if (typeof cr === "number") {
      if (cr > 0) {
        spec.cornerRadius = cr;
        // Corner-radius variables bind via topLeftRadius (there is no
        // "cornerRadius" bindable field in the Figma API).
        const crToken = getTokenName(node, "topLeftRadius");
        if (crToken) spec.cornerRadiusToken = crToken;
      }
    } else if ("topLeftRadius" in node) {
      // figma.mixed: corners differ — emit the per-corner object (design doc 4.5.2.1).
      const c = node as RectangleCornerMixin;
      const corners = {
        topLeft: c.topLeftRadius,
        topRight: c.topRightRadius,
        bottomRight: c.bottomRightRadius,
        bottomLeft: c.bottomLeftRadius,
      };
      if (Object.values(corners).some((v) => typeof v === "number" && v > 0)) {
        spec.cornerRadius = corners;
      }
    }
  }

  if ("children" in node) {
    const children = (node as ChildrenMixin).children as SceneNode[];
    if (children.length > 0) {
      spec.children = children.map((child) =>
        buildNode(child, path, depth + 1),
      );
    }
  }

  return spec;
}

export function buildSpec(page: PageNode): SpecJson {
  const topFrames = page.children.filter(
    (n) => n.type === "FRAME" || n.type === "SECTION",
  );

  const rootFrame = topFrames[0];
  const viewportWidth = rootFrame ? rootFrame.width : 1440;

  const children: SpecNode[] = [];
  for (const frame of topFrames) {
    if ("children" in frame) {
      for (const child of frame.children) {
        children.push(buildNode(child, "", 1));
      }
    }
  }

  return {
    page: page.name,
    viewport: { width: viewportWidth },
    children,
  };
}
