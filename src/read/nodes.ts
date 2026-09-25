import type { ReadNode, ReadText } from "../readData";
import { NOTE_KEY } from "./pluginData";

// The node fields copied straight across (old design doc 4.7.6 node table).
// Each is copied only when the node type has it, so a missing field in the
// read data means "this type cannot have it", never "left out".
const COPIED_FIELDS = [
  "width",
  "height",
  "x",
  "y",
  "layoutPositioning",
  "relativeTransform",
  "rotation",
  "constraints",
  "absoluteBoundingBox",
  "absoluteRenderBounds",
  "clipsContent",
  "blendMode",
  "opacity",
  "layoutMode",
  "layoutWrap",
  "primaryAxisAlignItems",
  "counterAxisAlignItems",
  "counterAxisAlignContent",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "itemSpacing",
  "counterAxisSpacing",
  "layoutSizingHorizontal",
  "layoutSizingVertical",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "fills",
  "fillStyleId",
  "strokes",
  "strokeStyleId",
  // Both the combined and the per-side / per-corner fields, always: when the
  // combined one is "mixed" the per-side ones are the only values there are.
  "strokeWeight",
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
  "strokeAlign",
  "dashPattern",
  "strokesIncludedInLayout",
  "effects",
  "effectStyleId",
  "cornerRadius",
  "topLeftRadius",
  "topRightRadius",
  "bottomRightRadius",
  "bottomLeftRadius",
] as const satisfies readonly (keyof ReadNode)[];

/** The page's children and everything under them, instance internals included. */
export function readNodes(page: PageNode): Promise<ReadNode[]> {
  return Promise.all(page.children.map(readNode));
}

async function readNode(node: SceneNode): Promise<ReadNode> {
  const out: ReadNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
    boundVariables: node.boundVariables ?? {},
    note: node.getPluginData(NOTE_KEY),
  };

  // Figma nodes are not plain objects: their fields are getters that vary by
  // type, so the copy goes by name rather than through the typed union.
  const source = node as unknown as Record<string, unknown>;
  const target = out as unknown as Record<string, unknown>;
  for (const field of COPIED_FIELDS) {
    if (!(field in node)) continue;
    const value = source[field];
    // `figma.mixed` is a symbol and would vanish from JSON (4.7.6).
    target[field] = value === figma.mixed ? "mixed" : value;
  }

  if ("componentPropertyReferences" in node) {
    const refs = node.componentPropertyReferences;
    out.componentPropertyReferences =
      refs === null ? null : refs.visible === undefined ? {} : { visible: refs.visible };
  }

  if (node.type === "INSTANCE") {
    // Figma has no field for the part's name; 4.7.2 names hidden layers by it.
    const main = await node.getMainComponentAsync();
    out.mainComponentId = main ? main.id : null;
    out.mainComponentName = main
      ? main.parent?.type === "COMPONENT_SET"
        ? main.parent.name
        : main.name
      : null;
  }

  if (node.type === "TEXT") out.text = readText(node);

  // Last, so a saved sample reads each node's own fields before its subtree.
  if ("children" in node) out.children = await Promise.all(node.children.map(readNode));

  return out;
}

// Per styled segment rather than per node: any of these can differ within one
// text layer, where the node-level field would only say `figma.mixed`.
function readText(node: TextNode): ReadText {
  const segments = node.getStyledTextSegments([
    "fontSize",
    "fontName",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "textCase",
    "textDecoration",
    "fills",
    "fillStyleId",
    "textStyleId",
    "hyperlink",
    "boundVariables",
  ]);
  return {
    textAlignHorizontal: node.textAlignHorizontal,
    textAutoResize: node.textAutoResize,
    segments: segments.map((segment) => ({
      ...segment,
      boundVariables: segment.boundVariables ?? {},
    })),
  };
}
