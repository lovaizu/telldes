import type { CheckResult } from "./types";

const DEFAULT_NAME_PATTERN =
  /^(Frame|Group|Rectangle|Ellipse|Line|Polygon|Star|Vector|Text|Section|Component|Instance|Slice|Stamp|Highlight|Sticky|Connector|Shape with text|Widget)\s+\d+$/;

function result(
  node: SceneNode,
  message: string,
  suggestion: string,
): CheckResult {
  return {
    level: "error",
    nodeId: node.id,
    nodeName: node.name,
    message,
    suggestion,
  };
}

export function checkAutoLayout(nodes: SceneNode[]): CheckResult[] {
  const results: CheckResult[] = [];
  for (const node of nodes) {
    if (
      node.type === "FRAME" &&
      (node as FrameNode).layoutMode === "NONE" &&
      (node as FrameNode).children.length > 0
    ) {
      results.push(
        result(node, "Auto Layout未適用のフレーム", "Auto Layoutを適用してください"),
      );
    }
  }
  return results;
}

export function checkDefaultNames(nodes: SceneNode[]): CheckResult[] {
  const results: CheckResult[] = [];
  for (const node of nodes) {
    if (DEFAULT_NAME_PATTERN.test(node.name)) {
      results.push(
        result(node, "Figmaデフォルト名のレイヤー", "意味のある名前を付けてください"),
      );
    }
  }
  return results;
}

export function checkDuplicateNames(nodes: SceneNode[]): CheckResult[] {
  const results: CheckResult[] = [];
  const parentGroups = new Map<string, SceneNode[]>();

  for (const node of nodes) {
    if (!node.parent) continue;
    const parentId = node.parent.id;
    if (!parentGroups.has(parentId)) {
      parentGroups.set(parentId, []);
    }
    parentGroups.get(parentId)!.push(node);
  }

  for (const siblings of parentGroups.values()) {
    const seen = new Map<string, SceneNode[]>();
    for (const node of siblings) {
      if (!seen.has(node.name)) {
        seen.set(node.name, []);
      }
      seen.get(node.name)!.push(node);
    }
    for (const [, dupes] of seen) {
      if (dupes.length > 1) {
        const allInstances = dupes.every((n) => n.type === "INSTANCE");
        if (allInstances) continue;
        for (const node of dupes) {
          results.push(
            result(node, "同一親内での重複レイヤー名", "名前を変更して区別してください"),
          );
        }
      }
    }
  }
  return results;
}

export function checkBackgroundAsChild(nodes: SceneNode[]): CheckResult[] {
  const results: CheckResult[] = [];
  for (const node of nodes) {
    if (!("children" in node)) continue;
    const frame = node as FrameNode;
    if (frame.children.length === 0) continue;

    const firstChild = frame.children[0];
    const isFullSize =
      "width" in firstChild &&
      "height" in firstChild &&
      Math.abs(firstChild.width - frame.width) < 1 &&
      Math.abs(firstChild.height - frame.height) < 1;

    const isFillLike =
      firstChild.type === "RECTANGLE" &&
      firstChild.name.toLowerCase().match(/^(bg|background|背景)$/);

    if (isFullSize && isFillLike) {
      results.push(
        result(
          firstChild,
          "背景を子レイヤーとして配置",
          "フレームのfillに設定してください",
        ),
      );
    }
  }
  return results;
}

export function runStructureChecks(nodes: SceneNode[]): CheckResult[] {
  return [
    ...checkAutoLayout(nodes),
    ...checkDefaultNames(nodes),
    ...checkDuplicateNames(nodes),
    ...checkBackgroundAsChild(nodes),
  ];
}
