import type { ExportSettings, OtherFrame, Theme } from "../readData";

// What telldes keeps in the file itself, by plugin data key. The writers
// (the note UI, the Export settings, the theme switch) use the same keys.

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
 * The favicon / OG image frames live on another page by rule (4.7.4), so
 * `nodes` does not have them; their names come from here instead.
 */
export async function readOtherFrames(
  settings: ExportSettings | null,
  page: PageNode,
): Promise<OtherFrame[]> {
  const ids = [settings?.site?.faviconFrameId, settings?.site?.ogImageFrameId].filter(
    (id): id is string => id !== undefined,
  );
  const frames: OtherFrame[] = [];
  for (const id of new Set(ids)) {
    const node = await figma.getNodeByIdAsync(id);
    if (node === null || node.removed) {
      frames.push({ id, found: false });
      continue;
    }
    // By id: Figma does not promise the same wrapper object twice.
    if (pageIdOf(node) === page.id) continue;
    frames.push({ id, found: true, name: node.name });
  }
  return frames;
}

function pageIdOf(node: BaseNode): string | null {
  let current: BaseNode | null = node;
  while (current && current.type !== "PAGE") current = current.parent;
  return current ? current.id : null;
}
