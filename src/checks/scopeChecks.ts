import { TYPOGRAPHY_TOKEN_PREFIX } from "../util/typography";
import { buildLayerPath } from "../export/layerPath";

// Design doc 4.7.2 「書き出し時の除外物告知（README 出力）」: things telldes
// intentionally excludes from tokens.json / the export. These are not Review
// findings — they never block Export and there is nothing for the designer to
// "fix" — so they are recorded in the exported README.md instead, as a factual
// record of what this particular export left out. The design doc's stance
// (4.3.4「ツールが無視・変換するものは必ず利用者に告知する（暗黙のドロップ/スキップ禁止）」)
// requires that information to survive somewhere; the README is where it lives.

/** A STRING/BOOLEAN Variable binding: which layer, and which Variable. */
export interface StringBooleanVariableUsage {
  /** Layer path, ` > `-joined (design doc 4.5.2 `path` convention). */
  path: string;
  variableName: string;
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
  /** Layer paths using a Color Style. */
  colorStyles: string[];
  stringBooleanVariables: StringBooleanVariableUsage[];
  /** Layer paths (page-root names) of bare Component/Component Set definitions. */
  bareRootComponents: string[];
  tokenNameCollisions: TokenNameCollision[];
}

/**
 * Layer path from the page down to `node`, e.g. `Home > Header > Title`. The
 * page name itself is not part of the path — the path names layers as the
 * designer sees them in the Figma layer tree, so they can find the item.
 */
function nodeLayerPath(node: SceneNode): string {
  const names: string[] = [];
  let current: BaseNode | null = node;
  while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    names.unshift(current.name);
    current = current.parent;
  }
  return names.reduce((path, name) => buildLayerPath(path, name), "");
}

// Color Styles (fillStyleId) and Variables (boundVariables.fills) are
// mutually-exclusive binding mechanisms in the Figma API — a fill bound to a
// Style never also sets boundVariables, so this can't double-count a
// Variable-bound fill. Color is sourced from Variables only (4.3.4), so a
// Color Style never becomes a token.
export function checkColorStyleUsage(nodes: SceneNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (!("fillStyleId" in node)) continue;
    const styleId = (node as MinimalFillsMixin).fillStyleId;
    // TextNodes can report fillStyleId === figma.mixed when some characters
    // are styled via a Color Style and others aren't (@figma/plugin-typings)
    // — that's still Color Style usage on part of the node, so record it too.
    const usesColorStyle =
      (typeof styleId === "string" && styleId !== "") || styleId === figma.mixed;
    if (usesColorStyle) paths.push(nodeLayerPath(node));
  }
  return paths;
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
export function checkStringBooleanVariableUsage(
  nodes: SceneNode[],
): StringBooleanVariableUsage[] {
  const usages: StringBooleanVariableUsage[] = [];
  for (const node of nodes) {
    const ids = collectBoundVariableIds(node);
    if (ids.length === 0) continue;
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
      if (!variable) continue;
      if (variable.resolvedType === "STRING" || variable.resolvedType === "BOOLEAN") {
        usages.push({ path: nodeLayerPath(node), variableName: variable.name });
      }
    }
  }
  return usages;
}

// Design doc 4.7.4: export units are page-root FRAME/SECTION only; reusable
// parts get expanded from instances placed inside them. A Component /
// Component Set placed bare at page root (not wrapped as an instance inside
// a screen frame) is therefore never reached by the exporter — record it
// rather than silently skip it.
export function checkBareRootComponents(nodes: SceneNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") continue;
    if (node.parent && node.parent.type === "PAGE") paths.push(nodeLayerPath(node));
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

export function checkTypographyTokenCollisions(
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
    if (!rest || !textStyleNames.has(rest)) continue;
    collisions.push({ variableName: variable.name, textStyleName: rest });
  }
  return collisions;
}

/**
 * Collect every exclusion for one export run. Called at export time only —
 * never from Review, which reports errors exclusively (4.7.2).
 */
export function runScopeChecks(
  nodes: SceneNode[],
  variables: Variable[],
  textStyles: TextStyle[],
): ExclusionReport {
  return {
    colorStyles: checkColorStyleUsage(nodes),
    stringBooleanVariables: checkStringBooleanVariableUsage(nodes),
    bareRootComponents: checkBareRootComponents(nodes),
    tokenNameCollisions: checkTypographyTokenCollisions(variables, textStyles),
  };
}
