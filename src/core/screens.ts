// Judgment side: works only on the read data, never on the Figma API.
// Which layers Export hands over. Review and Export must share this, so that
// the designer never has to fix something that Export wouldn't hand over anyway.
import type { LayerData, PageData } from "../shared/data";

/** Why Export doesn't hand a layer over. */
export type DropReason =
  /** Directly under the page but not a frame: only frames are screens (docs/design.md). */
  | "not-screen"
  /** Figma doesn't draw hidden layers, so Export doesn't hand them over. */
  | "hidden";

export interface LayerEntry {
  layer: LayerData;
  /** Names from the node directly under the page down to this layer. */
  path: string[];
  parentId: string | null;
  /** The screen this layer belongs to, or null for nodes outside every screen. */
  screenId: string | null;
  /** Set when Export doesn't hand this layer over, for the layer itself or for an ancestor. */
  dropped: DropReason | null;
}

/** A layer that Export doesn't hand over while it hands over its parent: the topmost layer of a dropped subtree. */
export interface DroppedLayer {
  entry: LayerEntry;
  reason: DropReason;
}

/** Every visible frame directly under the page is a screen. */
export function screensOf(page: PageData): LayerData[] {
  return page.children.filter((node) => topLevelDrop(node) === null);
}

function topLevelDrop(node: LayerData): DropReason | null {
  if (node.type !== "FRAME") return "not-screen";
  return node.visible ? null : "hidden";
}

/** Every layer on the page by id, with where it sits and whether Export hands it over. */
export function indexLayers(page: PageData): Map<string, LayerEntry> {
  const index = new Map<string, LayerEntry>();
  const visit = (layer: LayerData, parent: LayerEntry | null, screenId: string | null, inherited: DropReason | null) => {
    const own = parent ? (layer.visible ? null : "hidden") : topLevelDrop(layer);
    const entry: LayerEntry = {
      layer,
      path: [...(parent?.path ?? []), layer.name],
      parentId: parent?.layer.id ?? null,
      screenId,
      dropped: inherited ?? own,
    };
    index.set(layer.id, entry);
    for (const child of layer.children ?? []) visit(child, entry, screenId, entry.dropped);
  };
  for (const node of page.children) visit(node, null, topLevelDrop(node) === null ? node.id : null, null);
  return index;
}

/** The roots of every dropped subtree, in page order: what the designer would lose. */
export function droppedLayers(index: Map<string, LayerEntry>): DroppedLayer[] {
  const roots: DroppedLayer[] = [];
  for (const entry of index.values()) {
    if (!entry.dropped) continue;
    const parent = entry.parentId === null ? null : index.get(entry.parentId);
    if (!parent?.dropped) roots.push({ entry, reason: entry.dropped });
  }
  return roots;
}

/** Screens that make up one output Web page, one per width (docs/design.md). */
export interface WebPage {
  /** The id of the screen that first made this Web page; stable while screens move between Web pages. */
  id: string;
  screenIds: string[];
}

/**
 * Screens grouped by the Web page the designer declared for each, in canvas
 * order. The file doesn't say which frames belong together, so this never
 * guesses it from names: an undeclared screen is a Web page of its own.
 */
export function groupWebPages(screens: LayerData[], declared: Record<string, string | undefined>): WebPage[] {
  const pages = new Map<string, WebPage>();
  for (const screen of screens) {
    const id = declared[screen.id] ?? screen.id;
    const page = pages.get(id) ?? { id, screenIds: [] };
    page.screenIds.push(screen.id);
    pages.set(id, page);
  }
  return [...pages.values()];
}
