// Layer paths and the filenames slugged from them, from one place (4.4.2/4.3.8).

/** Build a `parent > child` layer path (design doc 4.5.2 `path`). */
export function buildLayerPath(parentPath: string, name: string): string {
  return parentPath ? `${parentPath} > ${name}` : name;
}

/**
 * A node's path from the page root down, each ancestor named by `segmentOf`.
 * Callers spell a segment differently: the export README disambiguates
 * same-named siblings, the Notes tab quotes the raw Figma name (4.7.3).
 */
export function layerPathOf(
  node: SceneNode,
  segmentOf: (node: BaseNode) => string,
): string {
  const names: string[] = [];
  let current: BaseNode | null = node;
  while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    names.unshift(segmentOf(current));
    current = current.parent;
  }
  return names.reduce((path, name) => buildLayerPath(path, name), "");
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
