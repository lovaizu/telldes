// One export's scope: the page-root nodes it writes as zip folders (4.7.4)
// and what every page-root node is called inside it (4.5.2).

/** Filenames the zip root already holds, which no folder may take (4.5.2). */
const RESERVED_ROOT_NAMES = ["README.md", "prompt.md", "steering.md", "tokens.json"];

/** The page-root nodes the export turns into zip folders (design doc 4.7.4). */
export function isExportedFrame(node: SceneNode): boolean {
  return node.type === "FRAME" || node.type === "SECTION";
}

function baseSegment(raw: string): string {
  const cleaned = raw.replace(/[/\\]/g, "-").trim();
  // Dots alone are path navigation, not a name: `..` escapes the export root.
  if (cleaned === "" || /^\.+$/.test(cleaned)) return "frame";
  return cleaned;
}

// Matched case-insensitively, spelled as Figma spells it: macOS and Windows
// resolve `Home` and `home` to one path, the second overwriting it (4.5.2).
function claimUnique(base: string, used: Set<string>): string {
  let name = base;
  let i = 2;
  while (used.has(name.toLowerCase())) name = `${base}-${i++}`;
  used.add(name.toLowerCase());
  return name;
}

function resolvePageRootNames(nodes: readonly SceneNode[]): Map<string, string> {
  const used = new Set(RESERVED_ROOT_NAMES.map((name) => name.toLowerCase()));
  const byNodeId = new Map<string, string>();
  const claim = (node: SceneNode) =>
    byNodeId.set(node.id, claimUnique(baseSegment(node.name), used));
  // Frames go first: the one owning the zip folder keeps the unsuffixed name.
  for (const node of nodes) if (isExportedFrame(node)) claim(node);
  for (const node of nodes) if (!isExportedFrame(node)) claim(node);
  return byNodeId;
}

export interface ExportScope {
  /** Readonly: a frame pushed in later would have no `rootNames` entry (4.5.2). */
  frames: readonly SceneNode[];
  /** Segment per page-root node id; a frame's is its zip folder name (4.5.2). */
  rootNames: ReadonlyMap<string, string>;
  /** Frames and not: the exclusion scan reports on bare Components too (4.7.2). */
  pageRootNodes: readonly SceneNode[];
}

/** Frames and names from one pass, so zip and README cannot disagree (4.7.2). */
export function resolveExportScope(pageRootNodes: readonly SceneNode[]): ExportScope {
  return {
    frames: pageRootNodes.filter(isExportedFrame),
    rootNames: resolvePageRootNames(pageRootNodes),
    pageRootNodes,
  };
}

/** The zip folder name of one of `scope.frames` (design doc 4.5.2). */
export function folderNameOf(scope: ExportScope, frame: SceneNode): string {
  const folderName = scope.rootNames.get(frame.id);
  // A miss is a broken scope, not a frame to name otherwise, and
  // `root.folder(undefined)` is the export root itself (design doc 4.3.4).
  if (folderName === undefined) {
    throw new Error(`no folder name for frame ${frame.id}`);
  }
  return folderName;
}
