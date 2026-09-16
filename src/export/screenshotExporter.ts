import {
  buildLayerPath,
  layerPathToSlug,
  determineType,
  uniqueChildName,
} from "./layerPath";

export interface ScreenshotEntry {
  path: string;
  data: Uint8Array;
}

async function exportNode(
  node: SceneNode,
  parentPath: string,
  depth: number,
  results: ScreenshotEntry[],
  segment: string = node.name,
): Promise<void> {
  const path = buildLayerPath(parentPath, segment);
  const type = determineType(node, depth);

  if (type === "section" || type === "block") {
    let data: Uint8Array;
    try {
      data = await (node as ExportMixin).exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: 2 },
      });
    } catch (err) {
      // Surface which node failed (e.g. exceeds Figma's 4096px raster limit)
      // instead of an opaque whole-export failure.
      throw new Error(`Failed to export screenshot "${path}": ${err}`);
    }
    results.push({
      path: `screenshots/${layerPathToSlug(path)}.png`,
      data,
    });
  }

  if ("children" in node) {
    const children = (node as ChildrenMixin).children as SceneNode[];
    for (let i = 0; i < children.length; i++) {
      await exportNode(children[i], path, depth + 1, results, uniqueChildName(children, i));
    }
  }
}

export async function exportScreenshots(
  pageFrame: SceneNode,
): Promise<ScreenshotEntry[]> {
  const results: ScreenshotEntry[] = [];
  if (!("children" in pageFrame)) return results;

  const children = (pageFrame as ChildrenMixin).children as SceneNode[];
  for (let i = 0; i < children.length; i++) {
    await exportNode(children[i], "", 1, results, uniqueChildName(children, i));
  }
  return results;
}
