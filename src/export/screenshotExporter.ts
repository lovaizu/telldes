import { buildLayerPath, layerPathToSlug, determineType } from "./layerPath";

export interface ScreenshotEntry {
  path: string;
  data: Uint8Array;
}

async function exportNode(
  node: SceneNode,
  parentPath: string,
  depth: number,
  results: ScreenshotEntry[],
): Promise<void> {
  const path = buildLayerPath(parentPath, node.name);
  const type = determineType(node, depth);

  if (type === "section" || type === "block") {
    const data = await (node as ExportMixin).exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: 2 },
    });
    results.push({
      path: `screenshots/${layerPathToSlug(path)}.png`,
      data,
    });
  }

  if ("children" in node) {
    for (const child of (node as ChildrenMixin).children as SceneNode[]) {
      await exportNode(child, path, depth + 1, results);
    }
  }
}

export async function exportScreenshots(
  pageFrame: SceneNode,
): Promise<ScreenshotEntry[]> {
  const results: ScreenshotEntry[] = [];
  if (!("children" in pageFrame)) return results;

  for (const child of (pageFrame as ChildrenMixin).children as SceneNode[]) {
    await exportNode(child, "", 1, results);
  }
  return results;
}
