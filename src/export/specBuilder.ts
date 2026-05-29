import { colorToHex } from "../util/color";
import { buildLayerPath, layerPathToSlug, determineType } from "./layerPath";

interface SpecLayout {
  direction: string;
  wrap?: string;
  primaryAxisAlign?: string;
  counterAxisAlign?: string;
  padding?: { top: number; right: number; bottom: number; left: number };
  gap?: number;
  sizing?: { width: string; height: string };
  [key: string]: unknown;
}

interface SpecText {
  characters: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fill?: string;
  [key: string]: unknown;
}

interface SpecFill {
  type: string;
  color: string;
  [key: string]: unknown;
}

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
  cornerRadius?: number;
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

  layout.sizing = {
    width: node.layoutSizingHorizontal,
    height: node.layoutSizingVertical,
  };

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
    text.fill = colorToHex(fills[0].color);
    const fillToken = getTokenName(node, "fills");
    if (fillToken) text.fillToken = fillToken;
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
    if (fill.type === "SOLID" && fill.visible !== false) {
      const entry: SpecFill = {
        type: "SOLID",
        color: colorToHex(fill.color),
      };
      const token = getTokenName(node, "fills", i);
      if (token) entry.colorToken = token;
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
    // When corners differ, cornerRadius is figma.mixed; fall back to the
    // top-left corner so a real resolved value is still emitted (design doc
    // 4.5.2 documents a single scalar cornerRadius).
    let radius: number | undefined;
    if (typeof cr === "number") {
      radius = cr;
    } else if ("topLeftRadius" in node) {
      const tl = (node as RectangleCornerMixin).topLeftRadius;
      if (typeof tl === "number") radius = tl;
    }
    if (radius !== undefined && radius > 0) {
      spec.cornerRadius = radius;
      // Corner-radius variables bind via topLeftRadius (there is no
      // "cornerRadius" bindable field in the Figma API).
      const crToken = getTokenName(node, "topLeftRadius");
      if (crToken) spec.cornerRadiusToken = crToken;
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
