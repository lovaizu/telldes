// Selection gateway: points the canvas at a layer. It changes only the selection
// and the viewport, never the file.
export async function selectLayer(layerId: string): Promise<{ found: boolean }> {
  const node = await figma.getNodeByIdAsync(layerId);
  if (!node || !isOnCurrentPage(node)) return { found: false };
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
  return { found: true };
}

function isOnCurrentPage(node: BaseNode): node is SceneNode {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === "PAGE") return parent.id === figma.currentPage.id;
  }
  return false;
}
