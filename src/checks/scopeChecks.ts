import type { CheckResult } from "./types";
import { TYPOGRAPHY_TOKEN_PREFIX } from "../util/typography";

// Design doc 4.7.2 「源泉・範囲チェック（提案／告知）」: things telldes
// intentionally excludes from tokens.json / export. Never blocks Export —
// surfaced pre-export so the designer isn't surprised by silently-dropped
// data ("予測できない動き" per the design doc's own framing).

function suggestionResult(
  node: SceneNode,
  message: string,
  suggestion: string,
): CheckResult {
  return {
    level: "suggestion",
    nodeId: node.id,
    nodeName: node.name,
    message,
    suggestion,
  };
}

// Color Styles (fillStyleId) and Variables (boundVariables.fills) are
// mutually-exclusive binding mechanisms in the Figma API — a fill bound to a
// Style never also sets boundVariables, so this can't double-count a
// Variable-bound fill.
export function checkColorStyleUsage(nodes: SceneNode[]): CheckResult[] {
  const results: CheckResult[] = [];
  for (const node of nodes) {
    if (!("fillStyleId" in node)) continue;
    const styleId = (node as MinimalFillsMixin).fillStyleId;
    if (typeof styleId === "string" && styleId !== "") {
      results.push(
        suggestionResult(
          node,
          "Color Styleを使用",
          "Variableに移行しませんか？（カラーはVariablesに一本化）",
        ),
      );
    }
  }
  return results;
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
// Warn here so the designer knows before export rather than after.
export function checkStringBooleanVariableUsage(nodes: SceneNode[]): CheckResult[] {
  const results: CheckResult[] = [];
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
        results.push(
          suggestionResult(
            node,
            `STRING/BOOLEAN Variable「${variable.name}」を使用`,
            "これらはトークン出力対象外です",
          ),
        );
      }
    }
  }
  return results;
}

// Design doc 4.7.4: export units are page-root FRAME/SECTION only; reusable
// parts get expanded from instances placed inside them. A Component /
// Component Set placed bare at page root (not wrapped as an instance inside
// a screen frame) is therefore never reached by the exporter — flag it
// rather than silently skip it.
export function checkBareRootComponents(nodes: SceneNode[]): CheckResult[] {
  const results: CheckResult[] = [];
  for (const node of nodes) {
    if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") continue;
    if (node.parent && node.parent.type === "PAGE") {
      results.push(
        suggestionResult(
          node,
          "ページ直下に裸で置かれたComponent/Component Set定義",
          "書き出し対象外です。画面フレーム内にインスタンスとして配置するか、ライブラリページへ",
        ),
      );
    }
  }
  return results;
}

export function runScopeChecks(nodes: SceneNode[]): CheckResult[] {
  return [
    ...checkColorStyleUsage(nodes),
    ...checkStringBooleanVariableUsage(nodes),
    ...checkBareRootComponents(nodes),
  ];
}

// Not node-scoped — operates on Variables/Text Styles directly, so it can't
// share the (nodes: SceneNode[]) => CheckResult[] shape above. There is no
// single SceneNode to point at, so nodeId/nodeName use "" as a sentinel:
// App.tsx's selectNode() still round-trips safely, since code.ts's
// select-node handler calls figma.getNodeById(""), which resolves to null
// and is a no-op (guarded by `if (node && "type" in node)`).
//
// tokensBuilder.ts injects Variables first, then Text Styles under the same
// TYPOGRAPHY_TOKEN_PREFIX group (setNested) — so when a Variable's full path
// is literally "typography/<name>" and a Text Style is also named "<name>",
// the Text Style (written second) silently overwrites the Variable's value
// in tokens.json. Warn about the collision pre-export instead.
export function checkTypographyTokenCollisions(
  variables: Variable[],
  textStyles: TextStyle[],
): CheckResult[] {
  const results: CheckResult[] = [];
  const textStyleNames = new Set(textStyles.map((s) => s.name));

  for (const variable of variables) {
    const parts = variable.name.split("/");
    if (parts[0] !== TYPOGRAPHY_TOKEN_PREFIX) continue;
    const rest = parts.slice(1).join("/");
    if (!rest || !textStyleNames.has(rest)) continue;
    results.push({
      level: "suggestion",
      nodeId: "",
      nodeName: variable.name,
      message: `トークン名が衝突しています（Variable「${variable.name}」とText Style「${rest}」が同じ名前）`,
      suggestion:
        "tokens.jsonでは後に書き出されるText Style側の値で上書きされます。名前を変更してください",
    });
  }
  return results;
}
