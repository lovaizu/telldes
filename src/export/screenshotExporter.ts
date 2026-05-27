export interface ScreenshotEntry {
  path: string;
  data: Uint8Array;
}

function layerPathToFileName(layerPath: string): string {
  return layerPath.replace(/ > /g, "--") + ".png";
}

function determineType(
  node: SceneNode,
  depth: number,
): "section" | "block" | "element" {
  if (depth === 1) return "section";
  if ("children" in node && (node as any).children.length > 0) return "block";
  return "element";
}

async function exportNode(
  node: SceneNode,
  parentPath: string,
  depth: number,
  results: ScreenshotEntry[],
): Promise<void> {
  const path = parentPath ? `${parentPath} > ${node.name}` : node.name;
  const type = determineType(node, depth);

  if (type === "section" || type === "block") {
    const data = await (node as ExportMixin).exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: 2 },
    });
    results.push({
      path: `screenshots/${layerPathToFileName(path)}`,
      data,
    });
  }

  if ("children" in node) {
    for (const child of (node as any).children as SceneNode[]) {
      await exportNode(child, path, depth + 1, results);
    }
  }
}

export async function exportScreenshots(
  pageFrame: SceneNode,
): Promise<ScreenshotEntry[]> {
  const results: ScreenshotEntry[] = [];
  if (!("children" in pageFrame)) return results;

  for (const child of (pageFrame as any).children as SceneNode[]) {
    await exportNode(child, "", 1, results);
  }
  return results;
}
