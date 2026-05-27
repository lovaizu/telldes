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
