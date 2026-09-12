import { TYPOGRAPHY_TOKEN_PREFIX } from "../util/typography";
import { buildLayerPath, resolveFrameFolderNames, uniqueChildName } from "./layerPath";
import { collectAllNodes } from "../checks/traversal";

// Design doc 4.7.2 「書き出し時の除外物告知（README出力）」: what this export
// leaves out. Nothing here is a Review finding — it never blocks Export — but
// 4.3.4 forbids silently dropping anything, so the record ships in the
// exported README.md (readmeBuilder.ts).

/** How many layer paths one grouped entry carries as examples. */
const MAX_EXAMPLE_PATHS = 3;

/** Name shown for a text node whose characters use more than one Color Style. */
export const MIXED_COLOR_STYLE_NAME = "(multiple Color Styles on one text node)";

/**
 * One Color Style in use, with examples of where. Grouped by the *style*, not
 * by the layer: a library component placed 40 times would otherwise produce 40
 * near-identical README lines, which is what previously motivated skipping
 * instance internals entirely — and that skip hid the single most common Figma
 * setup (main components on a library page, instances on the screen page) from
 * the report altogether (4.7.2 走査範囲).
 */
export interface ColorStyleUsage {
  /** Color Style name, or the raw style id when it cannot be resolved. */
  styleName: string;
  /** Up to `MAX_EXAMPLE_PATHS` layer paths, so the designer can find one. */
  examplePaths: string[];
  /** Total layers using it — may exceed `examplePaths.length`. */
  layerCount: number;
}

/** One STRING/BOOLEAN Variable in use, grouped the same way as Color Styles. */
export interface StringBooleanVariableUsage {
  variableName: string;
  /** Up to `MAX_EXAMPLE_PATHS` ` > `-joined layer paths, rooted at the zip folder. */
  examplePaths: string[];
  /** Total layers binding it — may exceed `examplePaths.length`. */
  layerCount: number;
}

/** A Variable whose tokens.json slot is overwritten by a same-named Text Style. */
export interface TokenNameCollision {
  variableName: string;
  textStyleName: string;
}

/**
 * What this export leaves out, per category. Item lists are render-ready
 * enough to name the affected layer (or, for collisions, the token names) and
 * empty lists let the README omit a category entirely. Deliberately structured
 * rather than pre-formatted strings so the README wording lives in one place
 * (readmeBuilder.ts), and independent of CheckResult, which is error-only.
 */
export interface ExclusionReport {
  /** One entry per distinct Color Style used inside the exported frames. */
  colorStyles: ColorStyleUsage[];
  /** One entry per distinct STRING/BOOLEAN Variable bound inside them. */
  stringBooleanVariables: StringBooleanVariableUsage[];
  /** Layer names (page-root) of bare Component/Component Set definitions. */
  bareRootComponents: string[];
  tokenNameCollisions: TokenNameCollision[];
}

/** An export with nothing excluded. */
export function emptyExclusionReport(): ExclusionReport {
  return {
    colorStyles: [],
    stringBooleanVariables: [],
    bareRootComponents: [],
    tokenNameCollisions: [],
  };
}

/**
 * The page-root nodes this export turns into zip folders (design doc 4.7.4
 * 「書き出し範囲の方針」). Exported from here so code.ts, which builds the
 * folders, and collectExclusions, which decides what counts as "inside the
 * export", cannot disagree about the scope.
 */
export function isExportedFrame(node: SceneNode): boolean {
  return node.type === "FRAME" || node.type === "SECTION";
}

/**
 * Root path segment per page-root node: exported frames are named by their zip
 * folder name, everything else by sibling-disambiguated layer name.
 *
 * 4.7.2 requires README entries to be reconcilable against the zip, so the
 * root of a layer path must be spelled exactly like the folder the reader will
 * open — `resolveFrameFolderNames` is the one function that decides that.
 */
function resolveRootSegmentNames(
  pageRootNodes: readonly SceneNode[],
): Map<string, string> {
  const frames = pageRootNodes.filter(isExportedFrame);
  const folderNames = resolveFrameFolderNames(frames.map((f) => f.name));
  const byNodeId = new Map<string, string>();
  frames.forEach((frame, i) => byNodeId.set(frame.id, folderNames[i]));
  return byNodeId;
}

/**
 * Name of `node` as a path segment. Page-root exported frames take their zip
 * folder name from `rootNames`; every other node is disambiguated against its
 * siblings the same way spec.json paths and exported filenames are (design doc
 * 4.5.2 「path / ファイル名の一意性」). Without the latter, two same-named
 * sibling INSTANCEs — deliberately exempt from the duplicate-name error —
 * would render as two byte-identical README lines pointing at different layers.
 */
function segmentName(node: BaseNode, rootNames: Map<string, string>): string {
  const fromRoot = rootNames.get(node.id);
  if (fromRoot !== undefined) return fromRoot;
  const parent = node.parent;
  if (parent && "children" in parent) {
    const siblings = (parent as ChildrenMixin).children;
    const index = siblings.indexOf(node as SceneNode);
    // index < 0 when the node is not among its parent's children (a detached
    // or mid-mutation tree) — fall back to the raw name rather than emitting
    // an empty segment, which would render as "Home > " and name no layer.
    if (index >= 0) return uniqueChildName(siblings, index);
  }
  return node.name;
}

/**
 * Layer path from the page down to `node`, e.g. `Home > Header > Title`.
 *
 * NOT the spec.json `path` of design doc 4.5.2: spec.json paths start *below*
 * the top-level frame (specBuilder.ts seeds `parentPath: ""`), while this one
 * includes the frame name — spelled as the zip folder name, so the reader can
 * open that folder. The page name itself is not part of the path because it is
 * not a layer.
 */
function layerPathOf(node: SceneNode, rootNames: Map<string, string>): string {
  const names: string[] = [];
  let current: BaseNode | null = node;
  while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    names.unshift(segmentName(current, rootNames));
    current = current.parent;
  }
  return names.reduce((path, name) => buildLayerPath(path, name), "");
}

/**
 * Accumulate layer paths per excluded thing (a Color Style, a Variable),
 * keeping insertion order, deduping repeat paths, and capping the examples.
 */
class UsageGrouper<T extends { examplePaths: string[]; layerCount: number }> {
  private readonly entries = new Map<string, T>();
  private readonly seen = new Map<string, Set<string>>();

  constructor(private readonly make: (key: string) => T) {}

  add(key: string, path: string): void {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = this.make(key);
      this.entries.set(key, entry);
      this.seen.set(key, new Set());
    }
    const paths = this.seen.get(key)!;
    // One node can reach the scan twice (a frame listed twice, a Variable
    // bound on two fields of the same layer) — count each layer once.
    if (paths.has(path)) return;
    paths.add(path);
    entry.layerCount += 1;
    if (entry.examplePaths.length < MAX_EXAMPLE_PATHS) entry.examplePaths.push(path);
  }

  result(): T[] {
    return [...this.entries.values()];
  }
}

// figma.getStyleById is synchronous and may throw or return null for a style
// id that no longer resolves (deleted, or a library style this file can't
// reach) — same defensive shape as the getVariableById call below. Falling
// back to the raw id keeps the README line truthful rather than dropping the
// usage entirely.
function colorStyleName(styleId: string): string {
  try {
    const style = figma.getStyleById(styleId);
    if (style && style.name) return style.name;
  } catch {
    // Styles API unavailable or the id no longer resolves.
  }
  return styleId;
}

// Color Styles (fillStyleId) and Variables (boundVariables.fills) are
// mutually-exclusive binding mechanisms in the Figma API — a fill bound to a
// Style never also sets boundVariables, so this can't double-count a
// Variable-bound fill. Color is sourced from Variables only (4.3.4), so a
// Color Style never becomes a token.
export function findColorStyleUsage(
  nodes: readonly SceneNode[],
  rootNames: Map<string, string> = new Map(),
): ColorStyleUsage[] {
  const grouper = new UsageGrouper<ColorStyleUsage>((key) => ({
    styleName: key === MIXED_COLOR_STYLE_NAME ? key : colorStyleName(key),
    examplePaths: [],
    layerCount: 0,
  }));
  for (const node of nodes) {
    if (!("fillStyleId" in node)) continue;
    const styleId = (node as MinimalFillsMixin).fillStyleId;
    // TextNodes can report fillStyleId === figma.mixed when some characters
    // are styled via a Color Style and others aren't (@figma/plugin-typings)
    // — that's still Color Style usage on part of the node, and there is no
    // single id to group by, so those share one bucket whose name says so.
    if (styleId === figma.mixed) {
      grouper.add(MIXED_COLOR_STYLE_NAME, layerPathOf(node, rootNames));
    } else if (typeof styleId === "string" && styleId !== "") {
      grouper.add(styleId, layerPathOf(node, rootNames));
    }
  }
  return grouper.result();
}

// boundVariables values are either a single VariableAlias (scalar-bound
// fields like width) or an array of them (list-bound fields like fills) —
// collect every referenced Variable id, regardless of which field it's on.
function collectBoundVariableIds(node: SceneNode): string[] {
  if (!("boundVariables" in node)) return [];
  const bound = (node as SceneNodeMixin).boundVariables as
    | Record<string, VariableAlias | VariableAlias[]>
    | undefined;
  if (!bound) return [];
  const ids: string[] = [];
  for (const value of Object.values(bound)) {
    if (Array.isArray(value)) {
      for (const alias of value) {
        if (alias && typeof alias === "object" && "id" in alias) ids.push(alias.id);
      }
    } else if (value && typeof value === "object" && "id" in value) {
      ids.push(value.id);
    }
  }
  return ids;
}

// tokensBuilder.ts only emits COLOR/FLOAT Variables (the documented
// tokens.json schema, 4.5.1) — STRING/BOOLEAN Variables are silently dropped
// there (same resolvedType check as tokensBuilder's `supported` filter).
// Record them so the designer knows they didn't make it into tokens.json.
export function findStringBooleanVariableUsage(
  nodes: readonly SceneNode[],
  rootNames: Map<string, string> = new Map(),
): StringBooleanVariableUsage[] {
  const names = new Map<string, string>();
  const grouper = new UsageGrouper<StringBooleanVariableUsage>((key) => ({
    variableName: names.get(key) ?? key,
    examplePaths: [],
    layerCount: 0,
  }));
  for (const node of nodes) {
    const ids = collectBoundVariableIds(node);
    if (ids.length === 0) continue;
    // One node can bind the same Variable on several fields (e.g. characters
    // and fills); the grouper dedupes by path, so resolving each id once per
    // node is enough.
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      let variable: Variable | null = null;
      try {
        variable = figma.variables.getVariableById(id);
      } catch {
        continue;
      }
      // A binding can outlive the Variable it points at — getVariableById
      // returns null for a deleted Variable rather than throwing.
      if (!variable) continue;
      if (variable.resolvedType === "STRING" || variable.resolvedType === "BOOLEAN") {
        names.set(id, variable.name);
        grouper.add(id, layerPathOf(node, rootNames));
      }
    }
  }
  return grouper.result();
}

// Design doc 4.7.4: export units are page-root FRAME/SECTION only; reusable
// parts get expanded from instances placed inside them. A Component /
// Component Set placed bare at page root (not wrapped as an instance inside
// a screen frame) is therefore never reached by the exporter — record it
// rather than silently skip it. This one scans page-root nodes, not the
// exported subtrees: the category exists precisely to report what lies
// outside them.
export function findBareRootComponents(
  nodes: readonly SceneNode[],
  rootNames: Map<string, string> = new Map(),
): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") continue;
    if (node.parent && node.parent.type === "PAGE")
      paths.push(layerPathOf(node, rootNames));
  }
  return paths;
}

// Not node-scoped — operates on Variables/Text Styles directly, so it can't
// share the (nodes: SceneNode[]) shape above.
//
// tokensBuilder.ts injects Variables first, then Text Styles under the same
// TYPOGRAPHY_TOKEN_PREFIX group (setNested) — so when a Variable's full path
// is literally "typography/<name>" and a Text Style is also named "<name>",
// the Text Style (written second) silently overwrites the Variable's value
// in tokens.json. Record the collision so the overwrite isn't invisible.
//
// Only COLOR/FLOAT Variables ever reach tokens.json (tokensBuilder.ts's
// `supported` filter) — STRING/BOOLEAN Variables are dropped before
// setNested runs, so they can never actually collide with a Text Style.
// Mirror that filter here to avoid a false positive.
function isTokenBuilderSupported(variable: Variable): boolean {
  return variable.resolvedType === "COLOR" || variable.resolvedType === "FLOAT";
}

export function findTypographyTokenCollisions(
  variables: Variable[],
  textStyles: TextStyle[],
): TokenNameCollision[] {
  const collisions: TokenNameCollision[] = [];
  const textStyleNames = new Set(textStyles.map((s) => s.name));

  for (const variable of variables) {
    if (!isTokenBuilderSupported(variable)) continue;
    const parts = variable.name.split("/");
    if (parts[0] !== TYPOGRAPHY_TOKEN_PREFIX) continue;
    const rest = parts.slice(1).join("/");
    // `!rest` guards the Variable named exactly "typography" or "typography/":
    // its sub-path is empty, so it occupies the group itself rather than a
    // slot in it and can never be overwritten by a Text Style — not even by
    // one literally named "" (which Set.has("") would otherwise match).
    if (!rest || !textStyleNames.has(rest)) continue;
    collisions.push({ variableName: variable.name, textStyleName: rest });
  }
  return collisions;
}

/**
 * The nodes this export actually covers: each exported page-root frame plus
 * all of its descendants (design doc 4.7.4 「書き出し範囲の方針」).
 *
 * Instance internals are included on purpose. They carry the inherited
 * fillStyleId / boundVariables, and skipping them made the single most common
 * Figma setup — main components on a library page, instances on the exported
 * screen page — report zero Color Styles while every rendered pixel used one.
 * The duplication that skip was fighting is handled by grouping per
 * style/variable instead of per layer (4.7.2 走査範囲).
 */
function collectExportedNodes(frames: readonly SceneNode[]): SceneNode[] {
  const nodes: SceneNode[] = [];
  for (const frame of frames) {
    nodes.push(frame, ...collectAllNodes(frame));
  }
  return nodes;
}

/** Drop repeat entries so one underlying cause yields one README line. */
function dedupe<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface ExclusionScanInput {
  /**
   * Every page-root child. The exported frames are derived from this with
   * `isExportedFrame` rather than supplied separately: two independently
   * passed node sets could disagree, and the scan's whole promise is that
   * README entries are reconcilable against the zip built from the same page.
   */
  pageRootNodes: readonly SceneNode[];
  variables: Variable[];
  textStyles: TextStyle[];
}

/**
 * Collect every exclusion for one export run. Called at export time only —
 * never from Review, which reports errors exclusively (4.7.2).
 */
export function collectExclusions({
  pageRootNodes,
  variables,
  textStyles,
}: ExclusionScanInput): ExclusionReport {
  const rootNames = resolveRootSegmentNames(pageRootNodes);
  const exportedNodes = collectExportedNodes(pageRootNodes.filter(isExportedFrame));
  return {
    colorStyles: findColorStyleUsage(exportedNodes, rootNames),
    stringBooleanVariables: findStringBooleanVariableUsage(exportedNodes, rootNames),
    bareRootComponents: dedupe(
      findBareRootComponents(pageRootNodes, rootNames),
      (path) => path,
    ),
    tokenNameCollisions: dedupe(
      findTypographyTokenCollisions(variables, textStyles),
      (c) => `${c.variableName} :: ${c.textStyleName}`,
    ),
  };
}
