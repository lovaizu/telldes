// Layer paths and the filenames slugged from them, from one place (4.4.2/4.3.8).

/** Build a `parent > child` layer path (design doc 4.5.2 `path`). */
export function buildLayerPath(parentPath: string, name: string): string {
  return parentPath ? `${parentPath} > ${name}` : name;
}

/** A child's segment, later duplicates suffixed `-N` (design doc 4.3.6). */
export function uniqueChildName(
  siblings: readonly { name: string }[],
  index: number,
): string {
  const used = new Set<string>();
  let result = "";
  // Replayed from 0, not counted: a generated `-N` must not land on a real
  // sibling (`["item","item","item-2"]` → `item`, `item-2`, `item-2-2`).
  for (let i = 0; i <= index; i++) {
    const base = siblings[i].name;
    let name = base;
    let n = 2;
    while (used.has(name)) name = `${base}-${n++}`;
    used.add(name);
    result = name;
  }
  return result;
}

/** Slug a layer path into a filename stem (design doc 4.4.2 `--` convention). */
export function layerPathToSlug(path: string): string {
  return path.replace(/ > /g, "--").replace(/[/\\]/g, "-");
}

/** Classify a node by depth: top-level = section, has children = block, else element. */
export function determineType(
  node: SceneNode,
  depth: number,
): "section" | "block" | "element" {
  if (depth === 1) return "section";
  if ("children" in node && (node as ChildrenMixin).children.length > 0)
    return "block";
  return "element";
}

const RESERVED_ROOT_NAMES = ["README.md", "prompt.md", "steering.md", "tokens.json"];

function baseSegment(raw: string): string {
  const cleaned = raw.replace(/[/\\]/g, "-").trim();
  // Dots alone are path navigation, not a name: `..` escapes the export root.
  if (cleaned === "" || /^\.+$/.test(cleaned)) return "frame";
  return cleaned;
}

function claimUnique(base: string, used: Set<string>): string {
  let name = base;
  let i = 2;
  while (used.has(name)) name = `${base}-${i++}`;
  used.add(name);
  return name;
}

/** Every page-root sibling named in one pass over one `used` set (4.5.2/4.7.2). */
export function resolvePageRootSegmentNames(
  nodes: readonly SceneNode[],
  /** Frames go first: the one owning the zip folder keeps the unsuffixed name. */
  ownsZipFolder: (node: SceneNode) => boolean,
): Map<string, string> {
  // Seeded with the zip root's own filenames, so a frame named `README.md`
  // takes `-N` rather than standing a folder beside the file of that name.
  const used = new Set<string>(RESERVED_ROOT_NAMES);
  const byNodeId = new Map<string, string>();
  const claim = (node: SceneNode) =>
    byNodeId.set(node.id, claimUnique(baseSegment(node.name), used));
  for (const node of nodes) if (ownsZipFolder(node)) claim(node);
  for (const node of nodes) if (!ownsZipFolder(node)) claim(node);
  return byNodeId;
}
