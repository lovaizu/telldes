export interface AssetEntry {
  path: string;
  data: Uint8Array;
}

function layerPathToFileName(layerPath: string): string {
  return layerPath.replace(/ > /g, "--");
}

function isVectorNode(node: SceneNode): boolean {
  return (
    node.type === "VECTOR" ||
    node.type === "STAR" ||
    node.type === "POLYGON" ||
    node.type === "LINE" ||
    node.type === "BOOLEAN_OPERATION"
  );
}

function isRasterImage(node: SceneNode): boolean {
  if (!("fills" in node)) return false;
  const fills = (node as GeometryMixin).fills;
  if (!Array.isArray(fills)) return false;
  return fills.some((f) => f.type === "IMAGE");
}

async function processNode(
  node: SceneNode,
  parentPath: string,
  results: AssetEntry[],
): Promise<void> {
  const path = parentPath ? `${parentPath} > ${node.name}` : node.name;
  const fileName = layerPathToFileName(path);

  if (isRasterImage(node)) {
    const data = await (node as ExportMixin).exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: 2 },
    });
    results.push({ path: `assets/images/${fileName}.png`, data });
  } else if (isVectorNode(node)) {
    const data = await (node as ExportMixin).exportAsync({ format: "SVG" });
    results.push({ path: `assets/icons/${fileName}.svg`, data });
  }

  if ("children" in node) {
    for (const child of (node as any).children as SceneNode[]) {
      await processNode(child, path, results);
    }
  }
}

export async function exportAssets(
  pageFrame: SceneNode,
): Promise<AssetEntry[]> {
  const results: AssetEntry[] = [];
  if (!("children" in pageFrame)) return results;

  for (const child of (pageFrame as any).children as SceneNode[]) {
    await processNode(child, "", results);
  }
  return results;
}
