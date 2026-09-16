// What this export leaves out (design doc 4.7.2): never a Review finding and
// never a blocker, but 4.3.4 forbids dropping it silently (readmeBuilder.ts).
import { TYPOGRAPHY_TOKEN_PREFIX } from "../util/typography";
import { buildLayerPath, uniqueChildName } from "./layerPath";
import type { ExportScope } from "./exportScope";
import { collectAllNodes } from "../checks/traversal";

const MAX_EXAMPLE_PATHS = 3;

/** Bucket for multi-Color-Style text nodes; a NUL cannot collide with a style id. */
const MIXED_COLOR_STYLE_KEY = "\u0000mixed";

export interface ColorStyleUsage {
  /** `null` = several Color Styles on one node; readmeBuilder.ts words it. */
  styleName: string | null;
  examplePaths: string[];
  layerCount: number;
}

export interface StringBooleanVariableUsage {
  variableName: string;
  examplePaths: string[];
  layerCount: number;
}

export interface TokenNameCollision {
  variableName: string;
  textStyleName: string;
}

export interface ExclusionReport {
  colorStyles: ColorStyleUsage[];
  stringBooleanVariables: StringBooleanVariableUsage[];
  bareRootComponents: string[];
  tokenNameCollisions: TokenNameCollision[];
}

/** Tests only: as an export default it would falsely claim nothing was left out. */
export function emptyExclusionReport(): ExclusionReport {
  return {
    colorStyles: [],
    stringBooleanVariables: [],
    bareRootComponents: [],
    tokenNameCollisions: [],
  };
}

// `rootNames` holds every page-root child, so a miss is a node below one of
// them: those are disambiguated against siblings like spec.json paths (4.5.2).
function segmentName(node: BaseNode, rootNames: ReadonlyMap<string, string>): string {
  const fromRoot = rootNames.get(node.id);
  if (fromRoot !== undefined) return fromRoot;
  const parent = node.parent;
  if (parent && "children" in parent) {
    const siblings = (parent as ChildrenMixin).children;
    const index = siblings.indexOf(node as SceneNode);
    // index < 0 on a detached tree: the raw name beats an empty segment.
    if (index >= 0) return uniqueChildName(siblings, index);
  }
  return node.name;
}

// `Home > Title`: unlike the spec.json `path` (4.5.2) it includes the frame.
function layerPathOf(node: SceneNode, rootNames: ReadonlyMap<string, string>): string {
  const names: string[] = [];
  let current: BaseNode | null = node;
  while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    names.unshift(segmentName(current, rootNames));
    current = current.parent;
  }
  return names.reduce((path, name) => buildLayerPath(path, name), "");
}

class UsageGrouper<T extends { examplePaths: string[]; layerCount: number }> {
  private readonly entries = new Map<string, T>();
  private readonly seen = new Map<string, Set<string>>();

  constructor(private readonly make: (key: string) => T) {}

  add(key: string, nodeId: string, path: string): void {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = this.make(key);
      this.entries.set(key, entry);
      this.seen.set(key, new Set());
    }
    const nodes = this.seen.get(key)!;
    // Keyed on the node id, not the path: a layer name may contain ` > `, so
    // two layers can render one string and keying on it would under-count.
    if (nodes.has(nodeId)) return;
    nodes.add(nodeId);
    entry.layerCount += 1;
    if (entry.examplePaths.length < MAX_EXAMPLE_PATHS) entry.examplePaths.push(path);
  }

  result(): T[] {
    return [...this.entries.values()];
  }
}

// getStyleById may throw or return null; the raw id keeps the line truthful.
function colorStyleName(styleId: string): string {
  try {
    const style = figma.getStyleById(styleId);
    if (style && style.name) return style.name;
  } catch {
    // Styles API unavailable or the id no longer resolves.
  }
  return styleId;
}

/** Color comes from Variables only (4.3.4), so a Color Style is never a token. */
export function findColorStyleUsage(
  nodes: readonly SceneNode[],
  rootNames: ReadonlyMap<string, string>,
): ColorStyleUsage[] {
  const grouper = new UsageGrouper<ColorStyleUsage>((key) => ({
    styleName: key === MIXED_COLOR_STYLE_KEY ? null : colorStyleName(key),
    examplePaths: [],
    layerCount: 0,
  }));
  for (const node of nodes) {
    if (!("fillStyleId" in node)) continue;
    const styleId = (node as MinimalFillsMixin).fillStyleId;
    // figma.mixed: still usage, but no single id to group by.
    if (styleId === figma.mixed) {
      grouper.add(MIXED_COLOR_STYLE_KEY, node.id, layerPathOf(node, rootNames));
    } else if (typeof styleId === "string" && styleId !== "") {
      grouper.add(styleId, node.id, layerPathOf(node, rootNames));
    }
  }
  return grouper.result();
}

// A boundVariables value is one alias or an array of them (fields like fills).
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

/** tokens.json carries COLOR/FLOAT only (4.5.1), so record what it dropped. */
export function findStringBooleanVariableUsage(
  nodes: readonly SceneNode[],
  rootNames: ReadonlyMap<string, string>,
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
    // One node may bind a Variable on several fields; resolve each id once.
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
      // A binding can outlive its Variable: null, not a throw, for a deleted one.
      if (!variable) continue;
      if (variable.resolvedType === "STRING" || variable.resolvedType === "BOOLEAN") {
        names.set(id, variable.name);
        grouper.add(id, node.id, layerPathOf(node, rootNames));
      }
    }
  }
  return grouper.result();
}

/** Page-root nodes, not exported subtrees: a bare Component is in neither (4.7.4). */
export function findBareRootComponents(
  nodes: readonly SceneNode[],
  rootNames: ReadonlyMap<string, string>,
): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") continue;
    if (node.parent && node.parent.type === "PAGE")
      paths.push(layerPathOf(node, rootNames));
  }
  return paths;
}

// tokensBuilder writes Variables first, then Text Styles into the same group,
// so `typography/<name>` is overwritten by the Text Style `<name>` (4.5.1).
function isTokenBuilderSupported(variable: Variable): boolean {
  return variable.resolvedType === "COLOR" || variable.resolvedType === "FLOAT";
}

export function findTypographyTokenCollisions(
  variables: readonly Variable[],
  textStyles: readonly TextStyle[],
): TokenNameCollision[] {
  const collisions: TokenNameCollision[] = [];
  const textStyleNames = new Set(textStyles.map((s) => s.name));

  for (const variable of variables) {
    if (!isTokenBuilderSupported(variable)) continue;
    const parts = variable.name.split("/");
    if (parts[0] !== TYPOGRAPHY_TOKEN_PREFIX) continue;
    const rest = parts.slice(1).join("/");
    // `!rest`: a Variable named exactly "typography" occupies the group, not a
    // slot in it, so no Text Style can overwrite it — not even one named "".
    if (!rest || !textStyleNames.has(rest)) continue;
    collisions.push({ variableName: variable.name, textStyleName: rest });
  }
  return collisions;
}

// Each exported frame and its descendants (4.7.4). Instance internals included:
// they carry the inherited fillStyleId / boundVariables (4.7.2 走査範囲).
function collectExportedNodes(frames: readonly SceneNode[]): SceneNode[] {
  const nodes: SceneNode[] = [];
  for (const frame of frames) {
    nodes.push(frame, ...collectAllNodes(frame));
  }
  return nodes;
}

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
   * The frames, the page-root nodes and their names as one value: code.ts
   * stamps these same names onto the zip folders, and a scan taking the two
   * halves separately could be handed a pair that disagrees (design doc 4.7.2).
   */
  scope: ExportScope;
  variables: readonly Variable[];
  textStyles: readonly TextStyle[];
}

export function collectExclusions({
  scope,
  variables,
  textStyles,
}: ExclusionScanInput): ExclusionReport {
  const { rootNames } = scope;
  const exportedNodes = collectExportedNodes(scope.frames);
  return {
    colorStyles: findColorStyleUsage(exportedNodes, rootNames),
    stringBooleanVariables: findStringBooleanVariableUsage(exportedNodes, rootNames),
    // No dedupe: the scope already gives two Components named `Button` distinct
    // segments, so a dedupe would delete a real exclusion.
    bareRootComponents: findBareRootComponents(scope.pageRootNodes, rootNames),
    tokenNameCollisions: dedupe(
      findTypographyTokenCollisions(variables, textStyles),
      (c) => `${c.variableName} :: ${c.textStyleName}`,
    ),
  };
}
