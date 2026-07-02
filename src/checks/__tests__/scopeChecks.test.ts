import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkColorStyleUsage,
  checkStringBooleanVariableUsage,
  checkBareRootComponents,
  checkTypographyTokenCollisions,
  runScopeChecks,
} from "../scopeChecks";

const mockGetVariableById = vi.fn();
const mixedSymbol = Symbol("figma.mixed");

vi.stubGlobal("figma", {
  variables: { getVariableById: mockGetVariableById },
  mixed: mixedSymbol,
});

beforeEach(() => {
  mockGetVariableById.mockReset();
});

function makeNode(overrides: Record<string, unknown> = {}): SceneNode {
  return {
    id: "n1",
    name: "node",
    type: "RECTANGLE",
    parent: null,
    ...overrides,
  } as unknown as SceneNode;
}

function makeVariable(
  name: string,
  resolvedType: string,
  id = name,
): Variable {
  return { id, name, resolvedType } as unknown as Variable;
}

function makeTextStyle(name: string): TextStyle {
  return { name } as unknown as TextStyle;
}

describe("checkColorStyleUsage", () => {
  it("detects a fill bound to a Color Style", () => {
    const node = makeNode({ fillStyleId: "S:abc123" });
    const results = checkColorStyleUsage([node]);
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe("suggestion");
    expect(results[0].message).toContain("Color Style");
    expect(results[0].suggestion).toContain("Variableに移行");
  });

  it("ignores a node with no fillStyleId", () => {
    const node = makeNode({ fillStyleId: "" });
    expect(checkColorStyleUsage([node])).toHaveLength(0);
  });

  it("ignores a node without a fillStyleId field at all", () => {
    const node = makeNode();
    delete (node as unknown as Record<string, unknown>).fillStyleId;
    expect(checkColorStyleUsage([node])).toHaveLength(0);
  });

  it("detects a TextNode with mixed fillStyleId (partially Color-Style-styled characters)", () => {
    const node = makeNode({ fillStyleId: mixedSymbol });
    const results = checkColorStyleUsage([node]);
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain("Color Style");
  });
});

describe("checkStringBooleanVariableUsage", () => {
  it("detects a node bound to a STRING Variable", () => {
    mockGetVariableById.mockReturnValue(makeVariable("copy/label", "STRING"));
    const node = makeNode({
      boundVariables: { characters: { type: "VARIABLE_ALIAS", id: "v1" } },
    });
    const results = checkStringBooleanVariableUsage([node]);
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe("suggestion");
    expect(results[0].suggestion).toBe("これらはトークン出力対象外です");
  });

  it("detects a node bound to a BOOLEAN Variable", () => {
    mockGetVariableById.mockReturnValue(makeVariable("visible", "BOOLEAN"));
    const node = makeNode({
      boundVariables: { visible: { type: "VARIABLE_ALIAS", id: "v2" } },
    });
    expect(checkStringBooleanVariableUsage([node])).toHaveLength(1);
  });

  it("detects a STRING/BOOLEAN binding inside an array field (e.g. fills)", () => {
    mockGetVariableById.mockReturnValue(makeVariable("flag", "BOOLEAN"));
    const node = makeNode({
      boundVariables: { fills: [{ type: "VARIABLE_ALIAS", id: "v3" }] },
    });
    expect(checkStringBooleanVariableUsage([node])).toHaveLength(1);
  });

  it("ignores COLOR/FLOAT bound Variables", () => {
    mockGetVariableById.mockReturnValue(makeVariable("brand/primary", "COLOR"));
    const node = makeNode({
      boundVariables: { fills: [{ type: "VARIABLE_ALIAS", id: "v4" }] },
    });
    expect(checkStringBooleanVariableUsage([node])).toHaveLength(0);
  });

  it("ignores a node with no boundVariables", () => {
    const node = makeNode();
    expect(checkStringBooleanVariableUsage([node])).toHaveLength(0);
  });
});

describe("checkBareRootComponents", () => {
  it("detects a COMPONENT placed directly on the page", () => {
    const page = { type: "PAGE" };
    const node = makeNode({ type: "COMPONENT", parent: page });
    const results = checkBareRootComponents([node]);
    expect(results).toHaveLength(1);
    expect(results[0].suggestion).toContain("書き出し対象外");
  });

  it("detects a COMPONENT_SET placed directly on the page", () => {
    const page = { type: "PAGE" };
    const node = makeNode({ type: "COMPONENT_SET", parent: page });
    expect(checkBareRootComponents([node])).toHaveLength(1);
  });

  it("ignores a Component nested inside a frame", () => {
    const frame = { type: "FRAME" };
    const node = makeNode({ type: "COMPONENT", parent: frame });
    expect(checkBareRootComponents([node])).toHaveLength(0);
  });

  it("ignores non-Component node types at page root", () => {
    const page = { type: "PAGE" };
    const node = makeNode({ type: "FRAME", parent: page });
    expect(checkBareRootComponents([node])).toHaveLength(0);
  });
});

describe("checkTypographyTokenCollisions", () => {
  it("detects a Variable/Text Style name collision under typography/<name>", () => {
    const variable = makeVariable("typography/heading-md", "COLOR");
    const textStyle = makeTextStyle("heading-md");
    const results = checkTypographyTokenCollisions([variable], [textStyle]);
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe("suggestion");
    expect(results[0].nodeId).toBe("");
    expect(results[0].message).toContain("heading-md");
    expect(results[0].suggestion).toBe(
      "tokens.jsonでは片方が上書きされます。名前を変更してください",
    );
  });

  it("ignores a STRING/BOOLEAN typed Variable even with a matching Text Style name (never reaches tokens.json)", () => {
    const stringVariable = makeVariable("typography/heading-md", "STRING");
    const booleanVariable = makeVariable("typography/heading-lg", "BOOLEAN");
    const textStyles = [makeTextStyle("heading-md"), makeTextStyle("heading-lg")];
    expect(
      checkTypographyTokenCollisions([stringVariable, booleanVariable], textStyles),
    ).toHaveLength(0);
  });

  it("ignores a Variable not under the typography/ prefix", () => {
    const variable = makeVariable("color/brand-primary", "COLOR");
    const textStyle = makeTextStyle("brand-primary");
    expect(checkTypographyTokenCollisions([variable], [textStyle])).toHaveLength(0);
  });

  it("ignores a typography/ Variable with no matching Text Style name", () => {
    const variable = makeVariable("typography/heading-md", "FLOAT");
    const textStyle = makeTextStyle("heading-lg");
    expect(checkTypographyTokenCollisions([variable], [textStyle])).toHaveLength(0);
  });

  it("ignores a bare 'typography' Variable with no sub-path", () => {
    const variable = makeVariable("typography", "COLOR");
    const textStyle = makeTextStyle("typography");
    expect(checkTypographyTokenCollisions([variable], [textStyle])).toHaveLength(0);
  });

  it("returns nothing when there are no variables or text styles", () => {
    expect(checkTypographyTokenCollisions([], [])).toHaveLength(0);
  });
});

describe("runScopeChecks", () => {
  it("aggregates the three node-scoped scope checks", () => {
    const page = { type: "PAGE" };
    const colorStyleNode = makeNode({ id: "a", fillStyleId: "S:1" });
    const bareComponent = makeNode({ id: "b", type: "COMPONENT", parent: page });
    mockGetVariableById.mockReturnValue(makeVariable("flag", "BOOLEAN"));
    const stringVarNode = makeNode({
      id: "c",
      boundVariables: { visible: { type: "VARIABLE_ALIAS", id: "v5" } },
    });

    const results = runScopeChecks([colorStyleNode, bareComponent, stringVarNode]);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.level === "suggestion")).toBe(true);
  });
});
