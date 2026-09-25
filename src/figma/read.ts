// Read gateway: turns the open file into plain data. It copies what Figma holds
// and decides nothing; every judgment is made from the returned data elsewhere.
import {
  MIXED,
  type AutoLayoutData,
  type ComponentRef,
  type FileData,
  type LayerData,
  type Mixed,
  type TextData,
  type TokenData,
} from "../shared/data";

export async function readFile(): Promise<FileData> {
  const page = figma.currentPage;
  const [tokens, children] = await Promise.all([
    readTokens(),
    Promise.all(page.children.map((node) => readLayer(node, null))),
  ]);
  return {
    fileName: figma.root.name,
    page: { id: page.id, name: page.name, children },
    tokens,
  };
}

async function readTokens(): Promise<TokenData> {
  const [collections, variables, textStyles, effectStyles, paintStyles] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.variables.getLocalVariablesAsync(),
    figma.getLocalTextStylesAsync(),
    figma.getLocalEffectStylesAsync(),
    figma.getLocalPaintStylesAsync(),
  ]);
  return {
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
      defaultModeId: c.defaultModeId,
      variableIds: c.variableIds,
    })),
    variables: variables.map((v) => ({
      id: v.id,
      name: v.name,
      description: v.description,
      resolvedType: v.resolvedType,
      variableCollectionId: v.variableCollectionId,
      valuesByMode: v.valuesByMode,
      scopes: v.scopes,
      codeSyntax: v.codeSyntax,
    })),
    textStyles: textStyles.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      fontName: s.fontName,
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      textCase: s.textCase,
      textDecoration: s.textDecoration,
      paragraphSpacing: s.paragraphSpacing,
      paragraphIndent: s.paragraphIndent,
      leadingTrim: s.leadingTrim,
      boundVariables: s.boundVariables ?? {},
    })),
    effectStyles: effectStyles.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      effects: s.effects,
      boundVariables: s.boundVariables ?? {},
    })),
    paintStyles: paintStyles.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      paints: s.paints,
      boundVariables: s.boundVariables ?? {},
    })),
  };
}

async function readLayer(node: SceneNode, parent: SceneNode | null): Promise<LayerData> {
  const layer: LayerData = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
    pluginData: readPluginData(node),
    boundVariables: node.boundVariables ?? {},
  };

  if ("width" in node) {
    layer.x = node.x;
    layer.y = node.y;
    layer.width = node.width;
    layer.height = node.height;
    layer.minWidth = node.minWidth;
    layer.maxWidth = node.maxWidth;
    layer.minHeight = node.minHeight;
    layer.maxHeight = node.maxHeight;
  }
  if ("layoutSizingHorizontal" in node) {
    layer.rotation = node.rotation;
    layer.layoutSizingHorizontal = node.layoutSizingHorizontal;
    layer.layoutSizingVertical = node.layoutSizingVertical;
  }
  if ("layoutAlign" in node) {
    layer.layoutAlign = node.layoutAlign;
    layer.layoutGrow = node.layoutGrow;
    layer.layoutPositioning = node.layoutPositioning;
  }
  if ("gridRowSpan" in node && parent && "layoutMode" in parent && parent.layoutMode === "GRID") {
    layer.gridChild = {
      gridRowAnchorIndex: node.gridRowAnchorIndex,
      gridColumnAnchorIndex: node.gridColumnAnchorIndex,
      gridRowSpan: node.gridRowSpan,
      gridColumnSpan: node.gridColumnSpan,
      gridChildHorizontalAlign: node.gridChildHorizontalAlign,
      gridChildVerticalAlign: node.gridChildVerticalAlign,
    };
  }

  if ("opacity" in node) {
    layer.opacity = node.opacity;
    layer.blendMode = node.blendMode;
  }
  if ("effects" in node) {
    layer.isMask = node.isMask;
    layer.effects = node.effects;
    layer.effectStyleId = node.effectStyleId;
  }

  if ("fills" in node) {
    layer.fills = unmix(node.fills);
    layer.fillStyleId = unmix(node.fillStyleId);
  }
  if ("strokes" in node) {
    layer.strokes = node.strokes;
    layer.strokeStyleId = node.strokeStyleId;
    layer.strokeWeight = unmix(node.strokeWeight);
    layer.strokeAlign = node.strokeAlign;
    layer.dashPattern = node.dashPattern;
  }
  if ("strokeTopWeight" in node) {
    layer.strokeTopWeight = node.strokeTopWeight;
    layer.strokeRightWeight = node.strokeRightWeight;
    layer.strokeBottomWeight = node.strokeBottomWeight;
    layer.strokeLeftWeight = node.strokeLeftWeight;
  }

  if ("cornerRadius" in node) layer.cornerRadius = unmix(node.cornerRadius);
  if ("cornerSmoothing" in node) layer.cornerSmoothing = node.cornerSmoothing;
  if ("topLeftRadius" in node) {
    layer.topLeftRadius = node.topLeftRadius;
    layer.topRightRadius = node.topRightRadius;
    layer.bottomRightRadius = node.bottomRightRadius;
    layer.bottomLeftRadius = node.bottomLeftRadius;
  }

  if ("clipsContent" in node) layer.clipsContent = node.clipsContent;
  if ("layoutMode" in node) layer.autoLayout = readAutoLayout(node);
  if (node.type === "TEXT") layer.text = readText(node);
  if (node.type === "INSTANCE") layer.component = await readComponentRef(node);

  if ("children" in node) {
    layer.children = await Promise.all(node.children.map((child) => readLayer(child, node)));
  }
  return layer;
}

function readAutoLayout(node: SceneNode & AutoLayoutMixin & GridLayoutMixin): AutoLayoutData {
  const data: AutoLayoutData = {
    layoutMode: node.layoutMode,
    layoutWrap: node.layoutWrap,
    primaryAxisSizingMode: node.primaryAxisSizingMode,
    counterAxisSizingMode: node.counterAxisSizingMode,
    primaryAxisAlignItems: node.primaryAxisAlignItems,
    counterAxisAlignItems: node.counterAxisAlignItems,
    counterAxisAlignContent: node.counterAxisAlignContent,
    itemSpacing: node.itemSpacing,
    counterAxisSpacing: node.counterAxisSpacing,
    paddingTop: node.paddingTop,
    paddingRight: node.paddingRight,
    paddingBottom: node.paddingBottom,
    paddingLeft: node.paddingLeft,
    itemReverseZIndex: node.itemReverseZIndex,
    strokesIncludedInLayout: node.strokesIncludedInLayout,
  };
  if (node.layoutMode === "GRID") {
    data.grid = {
      gridRowCount: node.gridRowCount,
      gridColumnCount: node.gridColumnCount,
      gridRowGap: node.gridRowGap,
      gridColumnGap: node.gridColumnGap,
      gridRowSizes: node.gridRowSizes,
      gridColumnSizes: node.gridColumnSizes,
    };
  }
  return data;
}

function readText(node: TextNode): TextData {
  const segments = node.getStyledTextSegments([
    "fontName",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "textCase",
    "textDecoration",
    "paragraphSpacing",
    "paragraphIndent",
    "listOptions",
    "indentation",
    "hyperlink",
    "fills",
    "fillStyleId",
    "textStyleId",
    "boundVariables",
  ]);
  return {
    characters: node.characters,
    textAlignHorizontal: node.textAlignHorizontal,
    textAlignVertical: node.textAlignVertical,
    textAutoResize: node.textAutoResize,
    textTruncation: node.textTruncation,
    maxLines: node.maxLines,
    segments: segments.map((s) => ({ ...s, boundVariables: s.boundVariables ?? {} })),
  };
}

async function readComponentRef(node: InstanceNode): Promise<ComponentRef> {
  const main = await node.getMainComponentAsync();
  return {
    mainComponentId: main?.id ?? null,
    mainComponentName: main?.name ?? null,
    remote: main?.remote ?? false,
  };
}

function readPluginData(node: SceneNode): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of node.getPluginDataKeys()) data[key] = node.getPluginData(key);
  return data;
}

function unmix<T>(value: T | PluginAPI["mixed"]): T | Mixed {
  return value === figma.mixed ? MIXED : (value as T);
}
