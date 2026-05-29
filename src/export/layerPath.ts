/**
 * Shared layer-path helpers. spec.json screenshot references and the actual
 * screenshot/asset filenames MUST be produced by the same logic so the
 * spec.json ↔ file linkage resolves (design doc 4.4.2 / 4.3.8).
 */

/** Build a `parent > child` layer path (design doc 4.5.2 `path`). */
export function buildLayerPath(parentPath: string, name: string): string {
  return parentPath ? `${parentPath} > ${name}` : name;
}

/**
 * Disambiguate a child's path segment among its siblings by appending `-N` to
 * later duplicates (design doc 4.3.6: same-name instances are distinguished by
 * layer order). Keeps spec.json paths and exported filenames unique and in
 * agreement. The first occurrence keeps the original name.
 */
export function uniqueChildName(
  siblings: readonly { name: string }[],
  index: number,
): string {
  // Replay the assignment from index 0, tracking already-emitted names, so a
  // generated `name-N` can never collide with a sibling literally named that
  // (e.g. siblings ["item","item","item-2"] → "item","item-2","item-2-2").
  // Deterministic and stateless → all exporters agree on the same tree.
  const used = new Set<string>();
  let result = "";
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

/**
 * Slug a layer path into a filename stem: ` > ` becomes `--`, and any path
 * separators inside a layer name are neutralized so they cannot spawn
 * unintended zip subfolders (design doc 4.4.2 `--` convention).
 */
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
