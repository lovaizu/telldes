export function traverseNodes(
  node: BaseNode,
  callback: (node: SceneNode) => void,
): void {
  if ("children" in node) {
    for (const child of node.children) {
      callback(child);
      traverseNodes(child, callback);
    }
  }
}

export function collectAllNodes(root: BaseNode): SceneNode[] {
  const nodes: SceneNode[] = [];
  traverseNodes(root, (node) => nodes.push(node));
  return nodes;
}

/**
 * True if the node lives inside a component instance. Authoring checks skip
 * such nodes: their names/layout are governed by the main component, so the
 * designer cannot fix a violation on the instance itself.
 */
export function isInsideInstance(node: SceneNode): boolean {
  let p: BaseNode | null = node.parent;
  while (p) {
    if (p.type === "INSTANCE") return true;
    p = p.parent;
  }
  return false;
}
