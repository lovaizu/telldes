import { resolvePageRootSegmentNames } from "./layerPath";

/** The page-root nodes the export turns into zip folders (design doc 4.7.4). */
export function isExportedFrame(node: SceneNode): boolean {
  return node.type === "FRAME" || node.type === "SECTION";
}

/** Segment per page-root node id; a frame's is its zip folder name (4.5.2). */
export function resolvePageRootNames(
  pageRootNodes: readonly SceneNode[],
): Map<string, string> {
  return resolvePageRootSegmentNames(pageRootNodes, isExportedFrame);
}
