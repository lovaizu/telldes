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
