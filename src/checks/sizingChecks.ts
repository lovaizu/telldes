import type { CheckResult } from "./types";

function isValidSizing(mode: string): boolean {
  return mode === "HUG" || mode === "FILL" || mode === "FIXED";
}

export function checkSizing(nodes: SceneNode[]): CheckResult[] {
  const results: CheckResult[] = [];
  for (const node of nodes) {
    if (!("layoutSizingHorizontal" in node)) continue;
    const n = node as FrameNode;

    if (!isValidSizing(n.layoutSizingHorizontal)) {
      results.push({
        level: "error",
        nodeId: node.id,
        nodeName: node.name,
        message: `横方向のサイジングが不明確（${n.layoutSizingHorizontal}）`,
        suggestion: "Hug/Fill/Fixedのいずれかに設定してください",
      });
    }

    if (!isValidSizing(n.layoutSizingVertical)) {
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
