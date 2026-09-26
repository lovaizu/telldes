// Judgment side: works only on the read data, never on the Figma API.
// Which layers are handed over. Review and Export must share this, so the
// designer never has to fix something that would not be handed over anyway.
import type { LayerData, PageData } from "../shared/data";

/** Why a layer is not handed over. */
export type DropReason =
  /** Directly under the page but not a frame: only frames are screens (docs/design.md). */
  | "not-screen"
  /** Hidden layers are not drawn, so they are not handed over. */
  | "hidden";

export interface LayerEntry {
  layer: LayerData;
  /** Names from the node directly under the page down to this layer. */
  path: string[];
  parentId: string | null;
  /** The screen this layer belongs to, or null for nodes outside every screen. */
  screenId: string | null;
  /** Set when this layer is not handed over, by itself or through an ancestor. */
  dropped: DropReason | null;
}

/** A layer that is not handed over while its parent is (the topmost one of a dropped subtree). */
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

/** Every layer on the page by id, with where it sits and whether it is handed over. */
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
 * order. Which frames belong together cannot be read from the file, so it is
 * never guessed from names: an undeclared screen is a Web page of its own.
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
