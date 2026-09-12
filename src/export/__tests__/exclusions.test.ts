import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  findColorStyleUsage,
  findStringBooleanVariableUsage,
  findBareRootComponents,
  findTypographyTokenCollisions,
  collectExclusions,
  emptyExclusionReport,
} from "../exclusions";
import { buildReadme } from "../readmeBuilder";

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

describe("findColorStyleUsage", () => {
  it("reports the layer path of a fill bound to a Color Style", () => {
    const node = makeNested(["Home", "Header", "Title"], { fillStyleId: "S:abc123" });
    expect(findColorStyleUsage([node])).toEqual(["Home > Header > Title"]);
  });

  it("excludes the page name from the layer path", () => {
    const node = makeNode({ name: "Banner", fillStyleId: "S:1" });
    expect(findColorStyleUsage([node])).toEqual(["Banner"]);
  });

  it("ignores a node with no fillStyleId", () => {
    expect(findColorStyleUsage([makeNode({ fillStyleId: "" })])).toEqual([]);
  });

  it("ignores a node without a fillStyleId field at all", () => {
    const node = makeNode();
    delete (node as unknown as Record<string, unknown>).fillStyleId;
    expect(findColorStyleUsage([node])).toEqual([]);
  });

  it("detects a TextNode with mixed fillStyleId (partially Color-Style-styled characters)", () => {
    const node = makeNode({ name: "Label", fillStyleId: mixedSymbol });
    expect(findColorStyleUsage([node])).toEqual(["Label"]);
  });
});

describe("findStringBooleanVariableUsage", () => {
  it("reports the layer path and Variable name for a STRING Variable binding", () => {
    mockGetVariableById.mockReturnValue(makeVariable("copy/label", "STRING"));
    const node = makeNested(["Home", "Card"], {
      boundVariables: { characters: { type: "VARIABLE_ALIAS", id: "v1" } },
    });
    expect(findStringBooleanVariableUsage([node])).toEqual([
      { path: "Home > Card", variableName: "copy/label" },
    ]);
  });

  it("detects a node bound to a BOOLEAN Variable", () => {
    mockGetVariableById.mockReturnValue(makeVariable("visible", "BOOLEAN"));
    const node = makeNode({
      boundVariables: { visible: { type: "VARIABLE_ALIAS", id: "v2" } },
    });
    expect(findStringBooleanVariableUsage([node])).toHaveLength(1);
  });

  it("detects a STRING/BOOLEAN binding inside an array field (e.g. fills)", () => {
    mockGetVariableById.mockReturnValue(makeVariable("flag", "BOOLEAN"));
    const node = makeNode({
      boundVariables: { fills: [{ type: "VARIABLE_ALIAS", id: "v3" }] },
    });
    expect(findStringBooleanVariableUsage([node])).toHaveLength(1);
  });

  it("ignores COLOR/FLOAT bound Variables", () => {
    mockGetVariableById.mockReturnValue(makeVariable("brand/primary", "COLOR"));
    const node = makeNode({
      boundVariables: { fills: [{ type: "VARIABLE_ALIAS", id: "v4" }] },
    });
    expect(findStringBooleanVariableUsage([node])).toEqual([]);
  });

  it("ignores a node with no boundVariables", () => {
    expect(findStringBooleanVariableUsage([makeNode()])).toEqual([]);
  });

  it("survives a throwing getVariableById (Variables API unavailable)", () => {
    mockGetVariableById.mockImplementation(() => {
      throw new Error("no Variables API");
    });
    const node = makeNode({
      boundVariables: { fills: [{ type: "VARIABLE_ALIAS", id: "v6" }] },
    });
    expect(findStringBooleanVariableUsage([node])).toEqual([]);
  });

  it("reports a Variable bound on several fields of one node only once", () => {
    mockGetVariableById.mockReturnValue(makeVariable("copy/label", "STRING", "v1"));
    const node = makeNode({
      name: "Label",
      boundVariables: {
        characters: { type: "VARIABLE_ALIAS", id: "v1" },
        fills: [{ type: "VARIABLE_ALIAS", id: "v1" }],
      },
    });
    expect(findStringBooleanVariableUsage([node])).toEqual([
      { path: "Label", variableName: "copy/label" },
    ]);
  });

  it("ignores a binding whose Variable no longer exists (getVariableById → null)", () => {
    mockGetVariableById.mockReturnValue(null);
    const node = makeNode({
      boundVariables: { fills: [{ type: "VARIABLE_ALIAS", id: "gone" }] },
    });
    expect(findStringBooleanVariableUsage([node])).toEqual([]);
  });
});

describe("findBareRootComponents", () => {
  it("reports the layer path of a COMPONENT placed directly on the page", () => {
    const node = makeNode({ name: "Button", type: "COMPONENT", parent: page });
    expect(findBareRootComponents([node])).toEqual(["Button"]);
  });

  it("detects a COMPONENT_SET placed directly on the page", () => {
    const node = makeNode({ name: "Button Set", type: "COMPONENT_SET", parent: page });
    expect(findBareRootComponents([node])).toEqual(["Button Set"]);
  });

  it("ignores a Component nested inside a frame", () => {
    const frame = { type: "FRAME", name: "Home", parent: page };
    const node = makeNode({ type: "COMPONENT", parent: frame });
    expect(findBareRootComponents([node])).toEqual([]);
  });

  it("ignores non-Component node types at page root", () => {
    expect(findBareRootComponents([makeNode({ type: "FRAME", parent: page })])).toEqual([]);
  });
});

describe("findTypographyTokenCollisions", () => {
  it("reports the colliding token names under typography/<name>", () => {
    const variable = makeVariable("typography/heading-md", "COLOR");
    const textStyle = makeTextStyle("heading-md");
    expect(findTypographyTokenCollisions([variable], [textStyle])).toEqual([
      { variableName: "typography/heading-md", textStyleName: "heading-md" },
    ]);
  });

  it("ignores a STRING/BOOLEAN typed Variable even with a matching Text Style name (never reaches tokens.json)", () => {
    const stringVariable = makeVariable("typography/heading-md", "STRING");
    const booleanVariable = makeVariable("typography/heading-lg", "BOOLEAN");
    const textStyles = [makeTextStyle("heading-md"), makeTextStyle("heading-lg")];
    expect(
      findTypographyTokenCollisions([stringVariable, booleanVariable], textStyles),
    ).toEqual([]);
  });

  it("ignores a Variable not under the typography/ prefix", () => {
    const variable = makeVariable("color/brand-primary", "COLOR");
    const textStyle = makeTextStyle("brand-primary");
    expect(findTypographyTokenCollisions([variable], [textStyle])).toEqual([]);
  });

  it("ignores a typography/ Variable with no matching Text Style name", () => {
    const variable = makeVariable("typography/heading-md", "FLOAT");
    expect(
      findTypographyTokenCollisions([variable], [makeTextStyle("heading-lg")]),
    ).toEqual([]);
  });

  it("ignores a bare 'typography' Variable with no sub-path", () => {
    const variable = makeVariable("typography", "COLOR");
    expect(
      findTypographyTokenCollisions([variable], [makeTextStyle("typography")]),
    ).toEqual([]);
  });

  it("returns nothing when there are no variables or text styles", () => {
    expect(findTypographyTokenCollisions([], [])).toEqual([]);
  });
});


/** Page with real `children`, so sibling disambiguation and traversal work. */
function makePage(children: SceneNode[]): PageNode {
  const p = { type: "PAGE", name: "Page 1", parent: null, children } as unknown as PageNode;
  for (const child of children) {
    (child as unknown as Record<string, unknown>).parent = p;
  }
  return p;
}

/** Container node with real parent/children links in both directions. */
function makeContainer(
  overrides: Record<string, unknown>,
  children: SceneNode[],
): SceneNode {
  const node = makeNode({ type: "FRAME", children, ...overrides });
  for (const child of children) {
    (child as unknown as Record<string, unknown>).parent = node;
  }
  return node;
}

describe("nodeLayerPath (via findColorStyleUsage)", () => {
  it("distinguishes same-named siblings by layer order, like spec.json paths", () => {
    // Same-named sibling INSTANCEs are exempt from the duplicate-name error,
    // so without uniqueChildName these two layers render as identical lines.
    const a = makeNode({ id: "a", name: "Label", fillStyleId: "S:1" });
    const b = makeNode({ id: "b", name: "Label", fillStyleId: "S:1" });
    const frame = makeContainer({ id: "f", name: "Home" }, [a, b]);
    makePage([frame]);
    expect(findColorStyleUsage([a, b])).toEqual(["Home > Label", "Home > Label-2"]);
  });

  it("names a detached node (no parent) by itself", () => {
    const node = makeNode({ name: "Floating", parent: null, fillStyleId: "S:1" });
    expect(findColorStyleUsage([node])).toEqual(["Floating"]);
  });

  it("walks to the top of a chain that never reaches a PAGE", () => {
    const leaf = makeNode({ id: "leaf", name: "Child", fillStyleId: "S:1" });
    makeContainer({ id: "root", name: "Orphan", parent: null }, [leaf]);
    expect(findColorStyleUsage([leaf])).toEqual(["Orphan > Child"]);
  });
});

describe("collectExclusions", () => {
  function scan(overrides: Partial<Parameters<typeof collectExclusions>[0]> = {}) {
    return collectExclusions({
      exportedFrames: [],
      pageRootNodes: [],
      variables: [],
      textStyles: [],
      ...overrides,
    });
  }

  it("aggregates the four exclusion categories into one report", () => {
    mockGetVariableById.mockReturnValue(makeVariable("flag", "BOOLEAN"));
    const banner = makeNode({ id: "a", name: "Banner", fillStyleId: "S:1" });
    const toggle = makeNode({
      id: "c",
      name: "Toggle",
      boundVariables: { visible: { type: "VARIABLE_ALIAS", id: "v5" } },
    });
    const frame = makeContainer({ id: "f", name: "Home" }, [banner, toggle]);
    const bareComponent = makeNode({ id: "b", name: "Button", type: "COMPONENT" });
    makePage([frame, bareComponent]);

    expect(
      scan({
        exportedFrames: [frame],
        pageRootNodes: [frame, bareComponent],
        variables: [makeVariable("typography/body", "FLOAT")],
        textStyles: [makeTextStyle("body")],
      }),
    ).toEqual({
      colorStyles: ["Home > Banner"],
      stringBooleanVariables: [{ path: "Home > Toggle", variableName: "flag" }],
      bareRootComponents: ["Button"],
      tokenNameCollisions: [
        { variableName: "typography/body", textStyleName: "body" },
      ],
    });
  });

  it("returns empty categories for a clean page", () => {
    expect(scan()).toEqual(emptyExclusionReport());
  });

  it("scans the exported frame itself, not just its descendants", () => {
    const frame = makeContainer({ id: "f", name: "Home", fillStyleId: "S:1" }, []);
    makePage([frame]);
    expect(scan({ exportedFrames: [frame], pageRootNodes: [frame] }).colorStyles).toEqual([
      "Home",
    ]);
  });

  it("ignores a loose page-root node outside every exported frame", () => {
    // It appears nowhere in the zip, so a README line naming it would be
    // unreconcilable for the reader.
    const frame = makeContainer({ id: "f", name: "Home" }, []);
    const loose = makeNode({ id: "l", name: "Banner", fillStyleId: "S:1" });
    makePage([frame, loose]);
    expect(
      scan({ exportedFrames: [frame], pageRootNodes: [frame, loose] }).colorStyles,
    ).toEqual([]);
  });

  it("ignores nodes inside instances so N placements yield no N duplicate lines", () => {
    const icon1 = makeNode({ id: "i1", name: "Icon", fillStyleId: "S:1" });
    const icon2 = makeNode({ id: "i2", name: "Icon", fillStyleId: "S:1" });
    const card1 = makeContainer({ id: "c1", name: "Card", type: "INSTANCE" }, [icon1]);
    const card2 = makeContainer({ id: "c2", name: "Card", type: "INSTANCE" }, [icon2]);
    const frame = makeContainer({ id: "f", name: "Home" }, [card1, card2]);
    makePage([frame]);
    expect(
      scan({ exportedFrames: [frame], pageRootNodes: [frame] }).colorStyles,
    ).toEqual([]);
  });

  it("ignores STRING Variable bindings inside instances too", () => {
    mockGetVariableById.mockReturnValue(makeVariable("copy/label", "STRING"));
    const label = makeNode({
      id: "l",
      name: "Label",
      boundVariables: { characters: { type: "VARIABLE_ALIAS", id: "v1" } },
    });
    const card = makeContainer({ id: "c", name: "Card", type: "INSTANCE" }, [label]);
    const frame = makeContainer({ id: "f", name: "Home" }, [card]);
    makePage([frame]);
    expect(
      scan({ exportedFrames: [frame], pageRootNodes: [frame] }).stringBooleanVariables,
    ).toEqual([]);
  });

  it("does not also report the contents of a bare page-root Component", () => {
    // The whole Component is already reported as excluded — listing its inner
    // layers again under Color Styles would double-count one exclusion.
    const label = makeNode({ id: "l", name: "Label", fillStyleId: "S:1" });
    const button = makeContainer({ id: "b", name: "Button", type: "COMPONENT" }, [label]);
    const frame = makeContainer({ id: "f", name: "Home" }, []);
    makePage([frame, button]);

    const report = scan({ exportedFrames: [frame], pageRootNodes: [frame, button] });
    expect(report.colorStyles).toEqual([]);
    expect(report.bareRootComponents).toEqual(["Button"]);
  });

  it("collapses identical entries so one cause yields one README line", () => {
    const title = makeNode({ id: "t", name: "Title", fillStyleId: "S:1" });
    const frame = makeContainer({ id: "f", name: "Home" }, [title]);
    makePage([frame]);
    expect(
      scan({ exportedFrames: [frame, frame], pageRootNodes: [frame] }).colorStyles,
    ).toEqual(["Home > Title"]);
  });
});

describe("collectExclusions rendered through buildReadme", () => {
  it("carries every detected category from detection into the README section", () => {
    mockGetVariableById.mockReturnValue(makeVariable("copy/label", "STRING"));
    const title = makeNode({ id: "t", name: "Title", fillStyleId: "S:1" });
    const card = makeNode({
      id: "c",
      name: "Card",
      boundVariables: { characters: { type: "VARIABLE_ALIAS", id: "v1" } },
    });
    const frame = makeContainer({ id: "f", name: "Home" }, [title, card]);
    const button = makeNode({ id: "b", name: "Button", type: "COMPONENT" });
    makePage([frame, button]);

    const readme = buildReadme({
      frameNames: ["Home"],
      hasTokens: true,
      exclusions: collectExclusions({
        exportedFrames: [frame],
        pageRootNodes: [frame, button],
        variables: [makeVariable("typography/heading-md", "COLOR")],
        textStyles: [makeTextStyle("heading-md")],
      }),
    });

    const section = readme.slice(readme.indexOf("## Not included in this export"));
    expect(section).toContain("  - `Home > Title`");
    expect(section).toContain('  - `Home > Card` (Variable "copy/label")');
    expect(section).toContain("  - `Button`");
    expect(section).toContain(
      "  - `typography/heading-md` (Variable) vs `heading-md` (Text Style)",
    );
  });
});
