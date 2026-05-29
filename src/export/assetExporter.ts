import { buildLayerPath, layerPathToSlug } from "./layerPath";

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

function isRasterImage(node: SceneNode): boolean {
  // An IMAGE fill on a container frame is a background (design doc 4.3.5), not a
  // standalone asset — only leaf nodes with an image fill are real image elements.
  if ("children" in node && (node as ChildrenMixin).children.length > 0) return false;
  if (!("fills" in node)) return false;
  const fills = (node as GeometryMixin).fills;
  if (!Array.isArray(fills)) return false;
  return fills.some((f) => f.type === "IMAGE" && f.visible !== false);
}

async function processNode(
  node: SceneNode,
  parentPath: string,
  results: AssetEntry[],
): Promise<void> {
  const path = buildLayerPath(parentPath, node.name);
  const fileName = layerPathToSlug(path);

  if (isRasterImage(node)) {
    const data = await (node as ExportMixin).exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: 2 },
    });
    results.push({ path: `assets/images/${fileName}.png`, data });
  } else if (isVectorNode(node)) {
    const data = await (node as ExportMixin).exportAsync({ format: "SVG_STRING" });
    results.push({
      path: `assets/icons/${fileName}.svg`,
      data: new TextEncoder().encode(data),
    });
  }

  if ("children" in node) {
    for (const child of (node as ChildrenMixin).children as SceneNode[]) {
      await processNode(child, path, results);
    }
  }
}

export async function exportAssets(
  pageFrame: SceneNode,
): Promise<AssetEntry[]> {
  const results: AssetEntry[] = [];
  if (!("children" in pageFrame)) return results;

  for (const child of (pageFrame as ChildrenMixin).children as SceneNode[]) {
    await processNode(child, "", results);
  }
  return results;
}
