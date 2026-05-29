import { buildLayerPath, layerPathToSlug, uniqueChildName } from "./layerPath";

export interface AssetEntry {
  path: string;
  data: Uint8Array;
}

function isVectorNode(node: SceneNode): boolean {
  return (
    node.type === "VECTOR" ||
    node.type === "STAR" ||
    node.type === "POLYGON" ||
    node.type === "ELLIPSE" ||
    node.type === "LINE" ||
    node.type === "BOOLEAN_OPERATION"
  );
}

function isContainer(node: SceneNode): boolean {
  return "children" in node && (node as ChildrenMixin).children.length > 0;
}

function firstVisibleImageFill(node: SceneNode): ImagePaint | undefined {
  if (!("fills" in node)) return undefined;
  const fills = (node as GeometryMixin).fills;
  if (!Array.isArray(fills)) return undefined;
  return fills.find(
    (f): f is ImagePaint => f.type === "IMAGE" && f.visible !== false,
  );
}

async function processNode(
  node: SceneNode,
  parentPath: string,
  results: AssetEntry[],
  segment: string = node.name,
): Promise<void> {
  const path = buildLayerPath(parentPath, segment);
  const fileName = layerPathToSlug(path);
  const imageFill = firstVisibleImageFill(node);

  try {
    if (imageFill && !isContainer(node)) {
      // Leaf image element → render at 2x (design doc 4.3.8).
      const data = await (node as ExportMixin).exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: 2 },
      });
      results.push({ path: `assets/images/${fileName}.png`, data });
    } else if (imageFill && imageFill.imageHash) {
      // Container with a background image (design doc 4.3.5): export the fill's
      // source bytes by hash — exportAsync would bake in the child content.
      const image = figma.getImageByHash(imageFill.imageHash);
      if (image) {
        const data = await image.getBytesAsync();
        results.push({ path: `assets/images/${fileName}.png`, data });
      }
    } else if (isVectorNode(node)) {
      const svg = await (node as ExportMixin).exportAsync({ format: "SVG_STRING" });
      results.push({
        path: `assets/icons/${fileName}.svg`,
        data: new TextEncoder().encode(svg),
      });
    }
  } catch (err) {
    throw new Error(`Failed to export asset "${path}": ${err}`);
  }

  if ("children" in node) {
    const children = (node as ChildrenMixin).children as SceneNode[];
    for (let i = 0; i < children.length; i++) {
      await processNode(children[i], path, results, uniqueChildName(children, i));
    }
  }
}

export async function exportAssets(
  pageFrame: SceneNode,
): Promise<AssetEntry[]> {
  const results: AssetEntry[] = [];
  if (!("children" in pageFrame)) return results;

  const children = (pageFrame as ChildrenMixin).children as SceneNode[];
  for (let i = 0; i < children.length; i++) {
    await processNode(children[i], "", results, uniqueChildName(children, i));
  }
  return results;
}
