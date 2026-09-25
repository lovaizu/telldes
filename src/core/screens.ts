// Judgment side: works only on the read data, never on the Figma API.
import type { LayerData, PageData } from "../shared/data";

/** Every frame directly under the page is a screen (docs/design.md). */
export function screensOf(page: PageData): LayerData[] {
  return page.children.filter((node) => node.type === "FRAME");
}

/** The layer and all its descendants. */
export function countLayers(layer: LayerData): number {
  return 1 + (layer.children ?? []).reduce((sum, child) => sum + countLayers(child), 0);
}
