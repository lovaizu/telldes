import type { CheckResult } from "./types";
import { isInsideInstance } from "./traversal";

function isValidSizing(mode: string): boolean {
  return mode === "HUG" || mode === "FILL" || mode === "FIXED";
}

export function checkSizing(nodes: SceneNode[]): CheckResult[] {
  const results: CheckResult[] = [];
  for (const node of nodes) {
    if (isInsideInstance(node)) continue;
    if (!("layoutSizingHorizontal" in node)) continue;
    const n = node as FrameNode;

    // "INHERIT" means the node is outside an Auto Layout context, where these
    // sizing properties are not authoritative — skip to avoid false positives
    // on legitimately fixed/absolute elements.
    if (
      n.layoutSizingHorizontal !== "INHERIT" &&
      !isValidSizing(n.layoutSizingHorizontal)
    ) {
      results.push({
        level: "error",
        nodeId: node.id,
        nodeName: node.name,
        message: `横方向のサイジングが不明確（${n.layoutSizingHorizontal}）`,
        suggestion: "Hug/Fill/Fixedのいずれかに設定してください",
      });
    }

    if (
      n.layoutSizingVertical !== "INHERIT" &&
      !isValidSizing(n.layoutSizingVertical)
    ) {
      results.push({
        level: "error",
        nodeId: node.id,
        nodeName: node.name,
        message: `縦方向のサイジングが不明確（${n.layoutSizingVertical}）`,
        suggestion: "Hug/Fill/Fixedのいずれかに設定してください",
      });
    }
  }
  return results;
}
