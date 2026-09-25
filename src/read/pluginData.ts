import type { ExportSettings, OtherFrame, Theme } from "../readData";

// What telldes keeps in the file itself, by plugin data key. These are the
// keys the writers (the Export settings UI, the theme switch) must use; the
// existing note code writes the same "note" literal.

/** On a node: the designer's note, plain text (4.3.7). */
export const NOTE_KEY = "note";
/**
 * On `figma.root`: the Export settings as JSON of `ExportSettings`. On the
 * document, not a node, because they are for the whole file — one site
 * (4.7.4.3). Absent until the designer first saves them.
 */
export const SETTINGS_KEY = "settings";
/**
 * On `figma.root`: "light" or "dark", the theme the file shows now (4.3.9,
 * 4.7.4.3). Absent means "light": a file telldes never switched is as drawn.
 */
export const THEME_KEY = "theme";

export function readSettings(): ExportSettings | null {
  const raw = figma.root.getPluginData(SETTINGS_KEY);
  if (raw === "") return null;
  try {
    return JSON.parse(raw) as ExportSettings;
  } catch {
    // Reported rather than read as "no settings": that would silently drop
    // what the designer entered (4.7.4.3).
    throw new Error("the saved Export settings are not valid JSON");
  }
}

export function readTheme(): Theme {
  const raw = figma.root.getPluginData(THEME_KEY);
  if (raw === "" || raw === "light") return "light";
  if (raw === "dark") return "dark";
  // Guessing either way would point the theme swap the wrong way (4.3.9).
  throw new Error(`the saved theme is "${raw}", not "light" or "dark"`);
}

/**
 * Every frame the settings point at — favicon, OG image, each responsive
 * row's frame — that is not on the current page (`nodes` has those). The
 * favicon / OG image frames live on another page by rule (4.7.4); a
 * responsive row lands here when its frame was moved off this page. What
 * the frame's page and visibility mean is for ② to decide.
 */
export async function readOtherFrames(
  settings: ExportSettings | null,
  page: PageNode,
): Promise<OtherFrame[]> {
  const ids = [
    settings?.site?.faviconFrameId,
    settings?.site?.ogImageFrameId,
    ...(settings?.responsive ?? []).map((row) => row.frameId),
  ].filter((id): id is string => id !== undefined);
  const frames: OtherFrame[] = [];
  for (const id of new Set(ids)) {
    const node = await figma.getNodeByIdAsync(id);
    if (node === null || node.removed) {
      frames.push({ id, found: false });
      continue;
    }
    const nodePage = pageOf(node);
    // By id: Figma does not promise the same wrapper object twice.
    if (nodePage?.id === page.id) continue;
    frames.push({
      id,
      found: true,
      name: node.name,
      type: node.type,
      ...("visible" in node ? { visible: node.visible } : {}),
      pageId: nodePage ? nodePage.id : null,
      pageName: nodePage ? nodePage.name : null,
    });
  }
  return frames;
}

function pageOf(node: BaseNode): PageNode | null {
  let current: BaseNode | null = node;
  while (current && current.type !== "PAGE") current = current.parent;
  return current as PageNode | null;
}
