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

const page = { type: "PAGE", name: "Page 1", parent: null } as unknown as PageNode;

function makeNode(overrides: Record<string, unknown> = {}): SceneNode {
  return {
    id: "n1",
    name: "node",
    type: "RECTANGLE",
    parent: page,
    ...overrides,
  } as unknown as SceneNode;
}

/** frame > child chain, rooted at the page, for layer-path assertions. */
function makeNested(names: string[], leafOverrides: Record<string, unknown> = {}) {
  let parent: unknown = page;
  let node = makeNode();
  names.forEach((name, i) => {
    const isLeaf = i === names.length - 1;
    node = makeNode({
      id: `n-${name}`,
      name,
      parent,
      ...(isLeaf ? leafOverrides : { type: "FRAME" }),
    });
    parent = node;
  });
  return node;
}

function makeVariable(name: string, resolvedType: string, id = name): Variable {
  return { id, name, resolvedType } as unknown as Variable;
}

function makeTextStyle(name: string): TextStyle {
  return { name } as unknown as TextStyle;
}

describe("checkColorStyleUsage", () => {
  it("reports the layer path of a fill bound to a Color Style", () => {
    const node = makeNested(["Home", "Header", "Title"], { fillStyleId: "S:abc123" });
    expect(checkColorStyleUsage([node])).toEqual(["Home > Header > Title"]);
  });

  it("excludes the page name from the layer path", () => {
    const node = makeNode({ name: "Banner", fillStyleId: "S:1" });
    expect(checkColorStyleUsage([node])).toEqual(["Banner"]);
  });

  it("ignores a node with no fillStyleId", () => {
    expect(checkColorStyleUsage([makeNode({ fillStyleId: "" })])).toEqual([]);
  });

  it("ignores a node without a fillStyleId field at all", () => {
    const node = makeNode();
    delete (node as unknown as Record<string, unknown>).fillStyleId;
    expect(checkColorStyleUsage([node])).toEqual([]);
  });

  it("detects a TextNode with mixed fillStyleId (partially Color-Style-styled characters)", () => {
    const node = makeNode({ name: "Label", fillStyleId: mixedSymbol });
    expect(checkColorStyleUsage([node])).toEqual(["Label"]);
  });
});

describe("checkStringBooleanVariableUsage", () => {
  it("reports the layer path and Variable name for a STRING Variable binding", () => {
    mockGetVariableById.mockReturnValue(makeVariable("copy/label", "STRING"));
    const node = makeNested(["Home", "Card"], {
      boundVariables: { characters: { type: "VARIABLE_ALIAS", id: "v1" } },
    });
    expect(checkStringBooleanVariableUsage([node])).toEqual([
      { path: "Home > Card", variableName: "copy/label" },
    ]);
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
    expect(checkStringBooleanVariableUsage([node])).toEqual([]);
  });

  it("ignores a node with no boundVariables", () => {
    expect(checkStringBooleanVariableUsage([makeNode()])).toEqual([]);
  });

  it("survives a throwing getVariableById (Variables API unavailable)", () => {
    mockGetVariableById.mockImplementation(() => {
      throw new Error("no Variables API");
    });
    const node = makeNode({
      boundVariables: { fills: [{ type: "VARIABLE_ALIAS", id: "v6" }] },
    });
    expect(checkStringBooleanVariableUsage([node])).toEqual([]);
  });
});

describe("checkBareRootComponents", () => {
  it("reports the layer path of a COMPONENT placed directly on the page", () => {
    const node = makeNode({ name: "Button", type: "COMPONENT", parent: page });
    expect(checkBareRootComponents([node])).toEqual(["Button"]);
  });

  it("detects a COMPONENT_SET placed directly on the page", () => {
    const node = makeNode({ name: "Button Set", type: "COMPONENT_SET", parent: page });
    expect(checkBareRootComponents([node])).toEqual(["Button Set"]);
  });

  it("ignores a Component nested inside a frame", () => {
    const frame = { type: "FRAME", name: "Home", parent: page };
    const node = makeNode({ type: "COMPONENT", parent: frame });
    expect(checkBareRootComponents([node])).toEqual([]);
  });

  it("ignores non-Component node types at page root", () => {
    expect(checkBareRootComponents([makeNode({ type: "FRAME", parent: page })])).toEqual([]);
  });
});

describe("checkTypographyTokenCollisions", () => {
  it("reports the colliding token names under typography/<name>", () => {
    const variable = makeVariable("typography/heading-md", "COLOR");
    const textStyle = makeTextStyle("heading-md");
    expect(checkTypographyTokenCollisions([variable], [textStyle])).toEqual([
      { variableName: "typography/heading-md", textStyleName: "heading-md" },
    ]);
  });

  it("ignores a STRING/BOOLEAN typed Variable even with a matching Text Style name (never reaches tokens.json)", () => {
    const stringVariable = makeVariable("typography/heading-md", "STRING");
    const booleanVariable = makeVariable("typography/heading-lg", "BOOLEAN");
    const textStyles = [makeTextStyle("heading-md"), makeTextStyle("heading-lg")];
    expect(
      checkTypographyTokenCollisions([stringVariable, booleanVariable], textStyles),
    ).toEqual([]);
  });

  it("ignores a Variable not under the typography/ prefix", () => {
    const variable = makeVariable("color/brand-primary", "COLOR");
    const textStyle = makeTextStyle("brand-primary");
    expect(checkTypographyTokenCollisions([variable], [textStyle])).toEqual([]);
  });

  it("ignores a typography/ Variable with no matching Text Style name", () => {
    const variable = makeVariable("typography/heading-md", "FLOAT");
    expect(
      checkTypographyTokenCollisions([variable], [makeTextStyle("heading-lg")]),
    ).toEqual([]);
  });

  it("ignores a bare 'typography' Variable with no sub-path", () => {
    const variable = makeVariable("typography", "COLOR");
    expect(
      checkTypographyTokenCollisions([variable], [makeTextStyle("typography")]),
    ).toEqual([]);
  });

  it("returns nothing when there are no variables or text styles", () => {
    expect(checkTypographyTokenCollisions([], [])).toEqual([]);
  });
});

describe("runScopeChecks", () => {
  it("aggregates the four exclusion categories into one report", () => {
    const colorStyleNode = makeNode({ id: "a", name: "Banner", fillStyleId: "S:1" });
    const bareComponent = makeNode({
      id: "b",
      name: "Button",
      type: "COMPONENT",
      parent: page,
    });
    mockGetVariableById.mockReturnValue(makeVariable("flag", "BOOLEAN"));
    const stringVarNode = makeNode({
      id: "c",
      name: "Toggle",
      boundVariables: { visible: { type: "VARIABLE_ALIAS", id: "v5" } },
    });
    const variable = makeVariable("typography/body", "FLOAT");

    const report = runScopeChecks(
      [colorStyleNode, bareComponent, stringVarNode],
      [variable],
      [makeTextStyle("body")],
    );

    expect(report).toEqual({
      colorStyles: ["Banner"],
      stringBooleanVariables: [{ path: "Toggle", variableName: "flag" }],
      bareRootComponents: ["Button"],
      tokenNameCollisions: [
        { variableName: "typography/body", textStyleName: "body" },
      ],
    });
  });

  it("returns empty categories for a clean page", () => {
    expect(runScopeChecks([], [], [])).toEqual({
      colorStyles: [],
      stringBooleanVariables: [],
      bareRootComponents: [],
      tokenNameCollisions: [],
    });
  });
});
