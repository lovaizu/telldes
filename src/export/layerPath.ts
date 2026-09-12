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

/**
 * Sanitize one page-root node name into a path/folder segment (design doc
 * 4.5.2 「path / ファイル名の一意性」): path separators are neutralized so a
 * name can never spawn nested zip folders, surrounding whitespace is trimmed
 * because a folder named `" Home "` is indistinguishable from `"Home"` to a
 * reader, and an empty result falls back to a fixed stem so the segment is
 * never the empty string.
 */
function baseSegment(raw: string): string {
  return raw.replace(/[/\\]/g, "-").trim() || "frame";
}

/** Claim `base`, appending `-N` until it is unused (design doc 4.5.2). */
function claimUnique(base: string, used: Set<string>): string {
  let name = base;
  let i = 2;
  while (used.has(name)) name = `${base}-${i++}`;
  used.add(name);
  return name;
}

/**
 * Zip folder name per exported top-level frame (design doc 4.5.2
 * 「トップレベルフレーム名が重複する場合も、フォルダ名に同じ規則で接尾辞を付ける」).
 *
 * Path separators inside a frame name are neutralized so they cannot spawn
 * nested zip folders, and duplicates get a `-N` suffix so two frames sharing a
 * name (e.g. responsive desktop/mobile copies) don't clobber each other.
 *
 * Single source of truth: the exported README names the root of every layer
 * path with this same function (exclusions.ts), because 4.7.2 requires README
 * entries to be reconcilable against the zip the reader is holding. A second
 * implementation would drift — `Desktop / Home` would land in folder
 * `Desktop - Home/` while the README pointed at `Desktop / Home > Title`.
 */
export function resolveFrameFolderNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((raw) => claimUnique(baseSegment(raw), used));
}

/**
 * Segment name for *every* page-root sibling, frames and non-frames alike, in
 * one pass over one `used` set (design doc 4.5.2 / 4.7.2).
 *
 * Two naming schemes over two separate sets used to run here, and they
 * collided: page children `[COMPONENT "Home", FRAME "Home"]` produced a zip
 * folder `Home/` *and* a README line saying `Home` was not exported at all,
 * while `[FRAME "A/B", COMPONENT "A-B"]` spelled two different nodes `A-B`.
 * Both contradict the one thing 4.7.2 demands of these paths: that the reader
 * can reconcile them against the zip in front of them.
 *
 * Frames are named first, so an exported frame keeps the unsuffixed name — it
 * owns the zip folder, and the names it takes here are byte-identical to
 * `resolveFrameFolderNames(frames.map(f => f.name))`, which is what zipBuilder
 * writes. A non-frame sharing a name is the side that yields and takes `-N`.
 */
export function resolvePageRootSegmentNames(
  nodes: readonly SceneNode[],
  ownsZipFolder: (node: SceneNode) => boolean,
): Map<string, string> {
  const used = new Set<string>();
  const byNodeId = new Map<string, string>();
  const claim = (node: SceneNode) =>
    byNodeId.set(node.id, claimUnique(baseSegment(node.name), used));
  for (const node of nodes) if (ownsZipFolder(node)) claim(node);
  for (const node of nodes) if (!ownsZipFolder(node)) claim(node);
  return byNodeId;
}
