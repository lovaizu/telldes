import type { CheckResult } from "./types";

const DEFAULT_NAME_PATTERN =
  /^(?:(?:Frame|Group|Rectangle|Ellipse|Line|Polygon|Star|Vector|Text|Section|Component|Instance|Slice|Stamp|Highlight|Sticky|Connector|Shape with text|Widget)\s+\d+|Vector|Image)$/;

// Layer names that signal "this child is a background", matched as a whole
// word so the design doc's own examples (`bg-image`, `overlay`) are caught.
const BACKGROUND_NAME_PATTERN =
  /(^|[-_ ])(bg|background|背景|overlay|オーバーレイ)([-_ ]|$)/i;

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
    // FRAME-derived containers carry a real layoutMode. INSTANCE is excluded:
    // its layout is inherited from the main component (would be a false positive).
    const isFrameLikeContainer =
      node.type === "FRAME" ||
      node.type === "COMPONENT" ||
      node.type === "COMPONENT_SET";
    if (
      isFrameLikeContainer &&
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
    const children = (node as ChildrenMixin).children;
    if (children.length === 0) continue;

    // Background intent is signalled by the layer NAME (design doc 4.3.5
    // examples: bg-image, overlay), not geometry. Flag every matching child
    // so layered backgrounds (image + overlay) are each reported.
    for (const child of children) {
      if (BACKGROUND_NAME_PATTERN.test(child.name)) {
        results.push(
          result(
            child,
            "背景を子レイヤーとして配置",
            "フレームのfillに設定してください",
          ),
        );
      }
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
