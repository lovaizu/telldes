import { colorToHex } from "../util/color";
import {
  parseFontWeight,
  lineHeightToSparseCss,
  letterSpacingToSparseCss,
} from "../util/typography";
import {
  buildLayerPath,
  layerPathToSlug,
  determineType,
  uniqueChildName,
} from "./layerPath";

interface SpecSizing {
  width: string;
  height: string;
  widthPx?: number;
  heightPx?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

interface SpecLayout {
  // `direction` is absent for non-container nodes whose layout carries only sizing.
  direction?: string;
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
  // Typography metrics that change rendered layout — CSS equivalents.
  lineHeight?: string; // "24px" | "150%"
  letterSpacing?: string; // "0.5px" | "0.02em"
  textAlign?: string; // center | right | justify (LEFT omitted as default)
  textCase?: string; // uppercase | lowercase | capitalize | small-caps
  textDecoration?: string; // underline | line-through
  // Text Style applied to this node, e.g. "typography/heading-md" — only when
  // textStyleId resolves to a single, non-mixed style (design doc 4.5.2.1).
  typographyToken?: string;
  [key: string]: unknown;
}

interface SpecEffect {
  type: string; // DROP_SHADOW | INNER_SHADOW | LAYER_BLUR | BACKGROUND_BLUR
  color?: string; // shadows only (#RRGGBB or #RRGGBBAA)
  offsetX?: number; // shadows only
  offsetY?: number; // shadows only
  blur: number; // Figma effect.radius → CSS blur radius
  spread?: number; // shadows only, when non-zero
  inset?: boolean; // true for INNER_SHADOW → CSS `inset`
}

interface SpecFill {
  type: string;
  color?: string;
  colorToken?: string;
  opacity?: number;
  scaleMode?: string;
  gradientStops?: { position: number; color: string }[];
  gradientTransform?: number[][];
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
  effects?: SpecEffect[];
  opacity?: number;
  children?: SpecNode[];
  [key: string]: unknown;
}

interface SpecJson {
  page: string;
  viewport: { width: number };
  background?: SpecFill[];
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

// Sizing applies to any Auto Layout participant (a container OR a child of an
// Auto Layout frame), independent of the node's own layoutMode — so a fixed
// leaf inside an AL frame still reports its dimensions.
function buildSizing(node: SceneNode): SpecSizing | undefined {
  if (!("layoutSizingHorizontal" in node)) return undefined;
  const n = node as FrameNode;
  const sizing: SpecSizing = {
    width: n.layoutSizingHorizontal,
    height: n.layoutSizingVertical,
  };
  // "FIXED" means the rendered width/height IS the fixed value.
  if (n.layoutSizingHorizontal === "FIXED") sizing.widthPx = n.width;
  if (n.layoutSizingVertical === "FIXED") sizing.heightPx = n.height;
  // min/max constraints are authoring-allowed (design doc 4.3.3) and null when unset.
  if (n.minWidth != null) sizing.minWidth = n.minWidth;
  if (n.maxWidth != null) sizing.maxWidth = n.maxWidth;
  if (n.minHeight != null) sizing.minHeight = n.minHeight;
  if (n.maxHeight != null) sizing.maxHeight = n.maxHeight;
  return sizing;
}

function buildLayout(node: FrameNode): SpecLayout {
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

  const sizing = buildSizing(node);
  if (sizing) layout.sizing = sizing;

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
  // Mirror the fontSize fallback: when fontName is figma.mixed, sample the first
  // character so the real family/weight is emitted instead of ""/400.
  let fontFamily = "";
  let fontWeight = 400;
  let resolvedFont: FontName | undefined;
  if (typeof node.fontName === "object" && "family" in node.fontName) {
    resolvedFont = node.fontName;
  } else if (characters.length > 0) {
    const ranged = node.getRangeFontName(0, 1);
    if (typeof ranged === "object" && "family" in ranged) resolvedFont = ranged;
  }
  if (resolvedFont) {
    fontFamily = resolvedFont.family;
    fontWeight = parseFontWeight(resolvedFont.style);
  }

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

  // Metrics below can be figma.mixed; sample the first character to mirror the
  // fontSize/fontName fallback rather than dropping the value.
  const lineHeight = resolveMixed(node, node.lineHeight, (n) => n.getRangeLineHeight(0, 1));
  const lhCss = lineHeight && lineHeightToSparseCss(lineHeight);
  if (lhCss) text.lineHeight = lhCss;

  const letterSpacing = resolveMixed(node, node.letterSpacing, (n) => n.getRangeLetterSpacing(0, 1));
  const lsCss = letterSpacing && letterSpacingToSparseCss(letterSpacing);
  if (lsCss) text.letterSpacing = lsCss;

  const align = textAlignToCss(node.textAlignHorizontal);
  if (align) text.textAlign = align;

  const textCase = resolveMixed(node, node.textCase, (n) => n.getRangeTextCase(0, 1));
  const caseCss = textCase && textCaseToCss(textCase);
  if (caseCss) text.textCase = caseCss;

  const decoration = resolveMixed(node, node.textDecoration, (n) => n.getRangeTextDecoration(0, 1));
  const decoCss = decoration && textDecorationToCss(decoration);
  if (decoCss) text.textDecoration = decoCss;

  const typographyToken = getTypographyToken(node);
  if (typographyToken) text.typographyToken = typographyToken;

  return text;
}

// Resolve the applied Text Style to a token name matching tokens.json's
// typography group (design doc 4.5.2.1). Unlike other mixed fields, there is
// no first-character fallback here — a single token name cannot represent a
// mix of styles, so figma.mixed and "no style applied" both omit the field.
function getTypographyToken(node: TextNode): string | undefined {
  const styleId = node.textStyleId;
  if (typeof styleId !== "string" || styleId === "") return undefined;
  try {
    const style = figma.getStyleById(styleId);
    if (!style) return undefined;
    return `typography/${style.name}`;
  } catch {
    return undefined;
  }
}

// Return the direct value unless it is figma.mixed (a symbol), in which case
// sample the first character. Undefined when unresolvable (e.g. empty text).
function resolveMixed<T>(
  node: TextNode,
  direct: T | symbol,
  sample: (n: TextNode) => T | symbol,
): T | undefined {
  if (typeof direct !== "symbol") return direct;
  if (node.characters.length === 0) return undefined;
  const ranged = sample(node);
  return typeof ranged === "symbol" ? undefined : ranged;
}

function textAlignToCss(align: TextNode["textAlignHorizontal"]): string | undefined {
  const map: Record<string, string> = {
    CENTER: "center",
    RIGHT: "right",
    JUSTIFIED: "justify",
  };
  return map[align]; // LEFT → undefined (CSS default)
}

function textCaseToCss(tc: TextCase): string | undefined {
  const map: Record<string, string> = {
    UPPER: "uppercase",
    LOWER: "lowercase",
    TITLE: "capitalize",
    SMALL_CAPS: "small-caps",
    SMALL_CAPS_FORCED: "small-caps",
  };
  return map[tc]; // ORIGINAL → undefined
}

function textDecorationToCss(td: TextDecoration): string | undefined {
  const map: Record<string, string> = {
    UNDERLINE: "underline",
    STRIKETHROUGH: "line-through",
  };
  return map[td]; // NONE → undefined
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
        // Per-stop alpha is meaningful (fade-to-transparent overlays, 4.3.5):
        // emit #RRGGBBAA when a stop's alpha < 1.
        gradientStops: fill.gradientStops.map((stop) => ({
          position: stop.position,
          color: colorToHex(stop.color, { alpha: true }),
        })),
        // 2x3 matrix encoding the gradient's angle/center/scale — without it
        // every gradient direction would serialize identically.
        gradientTransform: fill.gradientTransform.map((row) => [...row]),
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
  segment: string = node.name,
): SpecNode {
  const path = buildLayerPath(parentPath, segment);
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
  } else {
    // Non-container node: still carry sizing if it participates in Auto Layout.
    const sizing = buildSizing(node);
    if (sizing) spec.layout = { sizing };
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

  const effects = buildEffects(node);
  if (effects) spec.effects = effects;

  // Node-level opacity < 1 changes rendering (fades, ghost states) — emit it
  // rather than dropping it silently.
  if ("opacity" in node) {
    const op = (node as SceneNodeMixin & { opacity: number }).opacity;
    if (typeof op === "number" && op < 1) spec.opacity = op;
  }

  if ("children" in node) {
    const children = (node as ChildrenMixin).children as SceneNode[];
    if (children.length > 0) {
      spec.children = children.map((child, i) =>
        buildNode(child, path, depth + 1, uniqueChildName(children, i)),
      );
    }
  }

  return spec;
}

// Visible effects → CSS box-shadow / filter. Resolved values (accuracy first);
// Effect Style naming is a separate follow-up (like Text Style tokens).
function buildEffects(node: SceneNode): SpecEffect[] | undefined {
  if (!("effects" in node)) return undefined;
  const effects = (node as BlendMixin).effects;
  if (!Array.isArray(effects) || effects.length === 0) return undefined;

  const result: SpecEffect[] = [];
  for (const effect of effects) {
    if (effect.visible === false) continue;
    if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
      const ds = effect as DropShadowEffect | InnerShadowEffect;
      const entry: SpecEffect = {
        type: ds.type,
        color: colorToHex(ds.color, { alpha: true }),
        offsetX: ds.offset.x,
        offsetY: ds.offset.y,
        blur: ds.radius,
      };
      if (ds.spread) entry.spread = ds.spread;
      if (ds.type === "INNER_SHADOW") entry.inset = true;
      result.push(entry);
    } else if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
      result.push({ type: effect.type, blur: (effect as BlurEffect).radius });
    }
  }
  return result.length > 0 ? result : undefined;
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
      frame.children.forEach((child, i) =>
        children.push(buildNode(child, "", 1, uniqueChildName(frame.children, i))),
      );
    }
  }

  // The top-level frame's own fill is the page background (design doc 4.3.5);
  // it is never a child node, so capture it here.
  const background = rootFrame ? buildFills(rootFrame) : undefined;

  return {
    page: page.name,
    viewport: { width: viewportWidth },
    ...(background && background.length ? { background } : {}),
    children,
  };
}
