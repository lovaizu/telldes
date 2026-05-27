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

function colorToHex(color: RGB): string {
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`.toUpperCase();
}

function getTokenName(
  node: SceneNode,
  field: string,
): string | undefined {
  if (!("boundVariables" in node)) return undefined;
  const bound = (node as any).boundVariables;
  if (!bound || !bound[field]) return undefined;

  const binding = Array.isArray(bound[field]) ? bound[field][0] : bound[field];
  if (!binding?.id) return undefined;

  try {
    const variable = figma.variables.getVariableById(binding.id);
    return variable?.name;
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
        const key = f.replace("padding", "padding") + "Token";
        layout[key] = token;
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
  const fontSize = typeof node.fontSize === "number" ? node.fontSize : 0;
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
  for (const fill of fills) {
    if (fill.type === "SOLID" && fill.visible !== false) {
      const entry: SpecFill = {
        type: "SOLID",
        color: colorToHex(fill.color),
      };
      const token = getTokenName(node, "fills");
      if (token) entry.colorToken = token;
      result.push(entry);
    }
  }
  return result.length > 0 ? result : undefined;
}

function screenshotPath(layerPath: string): string {
  return `screenshots/${layerPath.replace(/ > /g, "--")}.png`;
}

function determineType(
  node: SceneNode,
  depth: number,
): "section" | "block" | "element" {
  if (depth === 1) return "section";
  if ("children" in node && (node as any).children.length > 0) return "block";
  return "element";
}

function buildNode(
  node: SceneNode,
  parentPath: string,
  depth: number,
): SpecNode {
  const path = parentPath ? `${parentPath} > ${node.name}` : node.name;
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

  if ("cornerRadius" in node) {
    const cr = (node as any).cornerRadius;
    if (typeof cr === "number" && cr > 0) {
      spec.cornerRadius = cr;
      const crToken = getTokenName(node, "cornerRadius");
      if (crToken) spec.cornerRadiusToken = crToken;
    }
  }

  if ("children" in node) {
    const children = (node as any).children as SceneNode[];
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
