import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  findColorStyleUsage,
  findStringBooleanVariableUsage,
  findBareRootComponents,
  findTypographyTokenCollisions,
  collectExclusions,
  emptyExclusionReport,
  isExportedFrame,
} from "../exclusions";
import { resolveFrameFolderNames } from "../layerPath";
import { buildReadme } from "../readmeBuilder";

const mockGetVariableById = vi.fn();
const mockGetStyleById = vi.fn();
const mixedSymbol = Symbol("figma.mixed");

vi.stubGlobal("figma", {
  variables: { getVariableById: mockGetVariableById },
  getStyleById: mockGetStyleById,
  mixed: mixedSymbol,
});

beforeEach(() => {
  mockGetVariableById.mockReset();
  // Unresolvable by default, so a test that doesn't care about style names
  // sees the raw id and its path assertions stay readable.
  mockGetStyleById.mockReset();
  mockGetStyleById.mockReturnValue(null);
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

/**
 * Page-root segment names, for the detectors that take them. Empty here on
 * purpose: these unit tests build nodes without a page-root frame, so every
 * segment comes from the sibling rule. The page-root naming itself — and the
 * fact that it is spelled like the zip folder — is pinned by the
 * `collectExclusions` suites below, which is the only entry point production
 * uses. The parameter is required (no default) so production cannot silently
 * fall through to the raw frame name.
 */
const NO_ROOT_NAMES: ReadonlyMap<string, string> = new Map();

const colorUsage = (nodes: SceneNode[]) => findColorStyleUsage(nodes, NO_ROOT_NAMES);
const variableUsage = (nodes: SceneNode[]) =>
  findStringBooleanVariableUsage(nodes, NO_ROOT_NAMES);
const bareRootComponents = (nodes: SceneNode[]) =>
  findBareRootComponents(nodes, NO_ROOT_NAMES);

/** Layer paths of every grouped Color Style entry, in report order. */
function colorPaths(nodes: SceneNode[]): string[] {
  return colorUsage(nodes).flatMap((u) => u.examplePaths);
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

describe("isExportedFrame", () => {
  it("accepts the page-root FRAME/SECTION nodes the export turns into folders", () => {
    expect(isExportedFrame(makeNode({ type: "FRAME" }))).toBe(true);
    expect(isExportedFrame(makeNode({ type: "SECTION" }))).toBe(true);
  });

  it("rejects every other page-root node type", () => {
    expect(isExportedFrame(makeNode({ type: "COMPONENT" }))).toBe(false);
    expect(isExportedFrame(makeNode({ type: "RECTANGLE" }))).toBe(false);
  });
});

describe("findColorStyleUsage", () => {
  it("reports the layer path of a fill bound to a Color Style", () => {
    const node = makeNested(["Home", "Header", "Title"], { fillStyleId: "S:abc123" });
    expect(colorPaths([node])).toEqual(["Home > Header > Title"]);
  });

  it("excludes the page name from the layer path", () => {
    const node = makeNode({ name: "Banner", fillStyleId: "S:1" });
    expect(colorPaths([node])).toEqual(["Banner"]);
  });

  it("ignores a node with no fillStyleId", () => {
    expect(colorUsage([makeNode({ fillStyleId: "" })])).toEqual([]);
  });

  it("ignores a node without a fillStyleId field at all", () => {
    const node = makeNode();
    delete (node as unknown as Record<string, unknown>).fillStyleId;
    expect(colorUsage([node])).toEqual([]);
  });

  it("detects a TextNode with mixed fillStyleId (partially Color-Style-styled characters)", () => {
    const node = makeNode({ name: "Label", fillStyleId: mixedSymbol });
    expect(colorUsage([node])).toEqual([
      { styleName: null, examplePaths: ["Label"], layerCount: 1 },
    ]);
  });

  it("keeps mixed-fill nodes in their own bucket, apart from single-style ones", () => {
    const mixed = makeNode({ id: "m", name: "Mixed", fillStyleId: mixedSymbol });
    const single = makeNode({ id: "s", name: "Single", fillStyleId: "S:1" });
    expect(colorUsage([mixed, single]).map((u) => u.styleName)).toEqual([null, "S:1"]);
  });

  it("names the entry by the resolved Color Style name", () => {
    mockGetStyleById.mockReturnValue({ name: "brand/primary" });
    const node = makeNode({ name: "Title", fillStyleId: "S:1" });
    expect(colorUsage([node])[0].styleName).toBe("brand/primary");
  });

  it("falls back to the raw style id when the style cannot be resolved", () => {
    mockGetStyleById.mockReturnValue(null);
    const node = makeNode({ name: "Title", fillStyleId: "S:gone" });
    expect(colorUsage([node])[0].styleName).toBe("S:gone");
  });

  it("survives a throwing getStyleById (Styles API unavailable)", () => {
    mockGetStyleById.mockImplementation(() => {
      throw new Error("no Styles API");
    });
    const node = makeNode({ name: "Title", fillStyleId: "S:1" });
    expect(colorUsage([node])).toEqual([
      { styleName: "S:1", examplePaths: ["Title"], layerCount: 1 },
    ]);
  });

  it("groups many layers sharing one Color Style into a single capped entry", () => {
    mockGetStyleById.mockReturnValue({ name: "brand/primary" });
    const nodes = ["a", "b", "c", "d", "e"].map((id) =>
      makeNode({ id, name: `Icon-${id}`, fillStyleId: "S:1" }),
    );
    expect(colorUsage(nodes)).toEqual([
      {
        styleName: "brand/primary",
        examplePaths: ["Icon-a", "Icon-b", "Icon-c"],
        layerCount: 5,
      },
    ]);
  });

  it("keeps two distinct Color Styles as two entries", () => {
    const a = makeNode({ id: "a", name: "A", fillStyleId: "S:1" });
    const b = makeNode({ id: "b", name: "B", fillStyleId: "S:2" });
    expect(colorUsage([a, b]).map((u) => u.styleName)).toEqual(["S:1", "S:2"]);
  });
});

describe("findStringBooleanVariableUsage", () => {
  it("reports the layer path and Variable name for a STRING Variable binding", () => {
    mockGetVariableById.mockReturnValue(makeVariable("copy/label", "STRING"));
    const node = makeNested(["Home", "Card"], {
      boundVariables: { characters: { type: "VARIABLE_ALIAS", id: "v1" } },
    });
    expect(variableUsage([node])).toEqual([
      { variableName: "copy/label", examplePaths: ["Home > Card"], layerCount: 1 },
    ]);
  });

  it("detects a node bound to a BOOLEAN Variable", () => {
    mockGetVariableById.mockReturnValue(makeVariable("visible", "BOOLEAN"));
    const node = makeNode({
      boundVariables: { visible: { type: "VARIABLE_ALIAS", id: "v2" } },
    });
    expect(variableUsage([node])).toHaveLength(1);
  });

  it("detects a STRING/BOOLEAN binding inside an array field (e.g. fills)", () => {
    mockGetVariableById.mockReturnValue(makeVariable("flag", "BOOLEAN"));
    const node = makeNode({
      boundVariables: { fills: [{ type: "VARIABLE_ALIAS", id: "v3" }] },
    });
    expect(variableUsage([node])).toHaveLength(1);
  });

  it("ignores COLOR/FLOAT bound Variables", () => {
    mockGetVariableById.mockReturnValue(makeVariable("brand/primary", "COLOR"));
    const node = makeNode({
      boundVariables: { fills: [{ type: "VARIABLE_ALIAS", id: "v4" }] },
    });
    expect(variableUsage([node])).toEqual([]);
  });

  it("ignores a node with no boundVariables", () => {
    expect(variableUsage([makeNode()])).toEqual([]);
  });

  it("survives a throwing getVariableById (Variables API unavailable)", () => {
    mockGetVariableById.mockImplementation(() => {
      throw new Error("no Variables API");
    });
    const node = makeNode({
      boundVariables: { fills: [{ type: "VARIABLE_ALIAS", id: "v6" }] },
    });
    expect(variableUsage([node])).toEqual([]);
  });

  it("counts a Variable bound on several fields of one node only once", () => {
    mockGetVariableById.mockReturnValue(makeVariable("copy/label", "STRING", "v1"));
    const node = makeNode({
      name: "Label",
      boundVariables: {
        characters: { type: "VARIABLE_ALIAS", id: "v1" },
        fills: [{ type: "VARIABLE_ALIAS", id: "v1" }],
      },
    });
    expect(variableUsage([node])).toEqual([
      { variableName: "copy/label", examplePaths: ["Label"], layerCount: 1 },
    ]);
  });

  it("keeps two different Variables bound on one node as two entries", () => {
    // Grouping is per Variable, so the dedupe key must discriminate on the
    // Variable — keying on the layer path alone would collapse these.
    mockGetVariableById.mockImplementation((id: string) =>
      id === "v1"
        ? makeVariable("copy/title", "STRING", "v1")
        : makeVariable("copy/body", "STRING", "v2"),
    );
    const node = makeNode({
      name: "Label",
      boundVariables: {
        characters: { type: "VARIABLE_ALIAS", id: "v1" },
        visible: { type: "VARIABLE_ALIAS", id: "v2" },
      },
    });
    expect(variableUsage([node])).toEqual([
      { variableName: "copy/title", examplePaths: ["Label"], layerCount: 1 },
      { variableName: "copy/body", examplePaths: ["Label"], layerCount: 1 },
    ]);
  });

  it("groups many layers binding one Variable into a single capped entry", () => {
    mockGetVariableById.mockReturnValue(makeVariable("copy/label", "STRING", "v1"));
    const nodes = ["a", "b", "c", "d"].map((id) =>
      makeNode({
        id,
        name: `Label-${id}`,
        boundVariables: { characters: { type: "VARIABLE_ALIAS", id: "v1" } },
      }),
    );
    expect(variableUsage(nodes)).toEqual([
      {
        variableName: "copy/label",
        examplePaths: ["Label-a", "Label-b", "Label-c"],
        layerCount: 4,
      },
    ]);
  });

  it("ignores a binding whose Variable no longer exists (getVariableById → null)", () => {
    mockGetVariableById.mockReturnValue(null);
    const node = makeNode({
      boundVariables: { fills: [{ type: "VARIABLE_ALIAS", id: "gone" }] },
    });
    expect(variableUsage([node])).toEqual([]);
  });
});

describe("findBareRootComponents", () => {
  it("reports the layer path of a COMPONENT placed directly on the page", () => {
    const node = makeNode({ name: "Button", type: "COMPONENT", parent: page });
    expect(bareRootComponents([node])).toEqual(["Button"]);
  });

  it("detects a COMPONENT_SET placed directly on the page", () => {
    const node = makeNode({ name: "Button Set", type: "COMPONENT_SET", parent: page });
    expect(bareRootComponents([node])).toEqual(["Button Set"]);
  });

  it("ignores a Component nested inside a frame", () => {
    const frame = { type: "FRAME", name: "Home", parent: page };
    const node = makeNode({ type: "COMPONENT", parent: frame });
    expect(bareRootComponents([node])).toEqual([]);
  });

  it("ignores non-Component node types at page root", () => {
    expect(bareRootComponents([makeNode({ type: "FRAME", parent: page })])).toEqual([]);
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

  it("requires typography/ to be the first path segment, not merely present", () => {
    // `brand/typography/heading-md` occupies that exact slot in tokens.json,
    // and Text Styles are only ever written under the *top-level* typography
    // group — so no Text Style can overwrite it.
    const nested = makeVariable("brand/typography/heading-md", "COLOR");
    expect(
      findTypographyTokenCollisions([nested], [makeTextStyle("heading-md")]),
    ).toEqual([]);
    // The same rule, on the input a substring test actually gets wrong: the
    // sub-path after the prefix ("typography") does name a Text Style here.
    const prefixed = makeVariable("brand/typography", "COLOR");
    expect(
      findTypographyTokenCollisions([prefixed], [makeTextStyle("typography")]),
    ).toEqual([]);
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

  it("ignores a trailing-slash 'typography/' Variable even against an empty-named Text Style", () => {
    // The only input that reaches the empty-sub-path guard with a Set that
    // would otherwise match: without `!rest`, `textStyleNames.has("")` is true
    // and this reports a collision that tokens.json can never have.
    const variable = makeVariable("typography/", "COLOR");
    expect(findTypographyTokenCollisions([variable], [makeTextStyle("")])).toEqual([]);
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

describe("layer paths (via findColorStyleUsage)", () => {
  it("distinguishes same-named siblings by layer order, like spec.json paths", () => {
    // Same-named sibling INSTANCEs are exempt from the duplicate-name error,
    // so without uniqueChildName these two layers render as identical lines.
    const a = makeNode({ id: "a", name: "Label", fillStyleId: "S:1" });
    const b = makeNode({ id: "b", name: "Label", fillStyleId: "S:1" });
    const frame = makeContainer({ id: "f", name: "Home" }, [a, b]);
    makePage([frame]);
    expect(colorPaths([a, b])).toEqual(["Home > Label", "Home > Label-2"]);
  });

  it("names a detached node (no parent) by itself", () => {
    const node = makeNode({ name: "Floating", parent: null, fillStyleId: "S:1" });
    expect(colorPaths([node])).toEqual(["Floating"]);
  });

  it("walks to the top of a chain that never reaches a PAGE", () => {
    const leaf = makeNode({ id: "leaf", name: "Child", fillStyleId: "S:1" });
    makeContainer({ id: "root", name: "Orphan", parent: null }, [leaf]);
    expect(colorPaths([leaf])).toEqual(["Orphan > Child"]);
  });

  it("still names a node its parent's children array does not contain", () => {
    // Detached / mid-mutation trees make indexOf return -1; without the
    // fallback the segment would be empty and the line would name no layer.
    const orphan = makeNode({ id: "o", name: "Ghost", fillStyleId: "S:1" });
    const frame = makeContainer({ id: "f", name: "Home" }, []);
    (orphan as unknown as Record<string, unknown>).parent = frame;
    makePage([frame]);
    expect(colorPaths([orphan])).toEqual(["Home > Ghost"]);
  });
});

describe("collectExclusions", () => {
  function scan(overrides: Partial<Parameters<typeof collectExclusions>[0]> = {}) {
    return collectExclusions({
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
        pageRootNodes: [frame, bareComponent],
        variables: [makeVariable("typography/body", "FLOAT")],
        textStyles: [makeTextStyle("body")],
      }),
    ).toEqual({
      colorStyles: [
        { styleName: "S:1", examplePaths: ["Home > Banner"], layerCount: 1 },
      ],
      stringBooleanVariables: [
        { variableName: "flag", examplePaths: ["Home > Toggle"], layerCount: 1 },
      ],
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
    expect(scan({ pageRootNodes: [frame] }).colorStyles[0].examplePaths).toEqual([
      "Home",
    ]);
  });

  it("scans a page-root SECTION, which is an export unit too (4.7.4)", () => {
    const title = makeNode({ id: "t", name: "Title", fillStyleId: "S:1" });
    const section = makeContainer({ id: "s", name: "Band", type: "SECTION" }, [title]);
    makePage([section]);
    expect(scan({ pageRootNodes: [section] }).colorStyles[0].examplePaths).toEqual([
      "Band > Title",
    ]);
  });

  it("ignores a loose page-root node outside every exported frame", () => {
    // It appears nowhere in the zip, so a README line naming it would be
    // unreconcilable for the reader.
    const frame = makeContainer({ id: "f", name: "Home" }, []);
    const loose = makeNode({ id: "l", name: "Banner", fillStyleId: "S:1" });
    makePage([frame, loose]);
    expect(scan({ pageRootNodes: [frame, loose] }).colorStyles).toEqual([]);
  });

  it("scans instance internals, so a library-page main component is still reported", () => {
    // The most common Figma setup: main components on another page, instances
    // on the exported one. The inherited fillStyleId lives on the instance's
    // internal nodes, so skipping them reported zero Color Styles while every
    // rendered card used one.
    mockGetStyleById.mockReturnValue({ name: "brand/primary" });
    const icon1 = makeNode({ id: "i1", name: "Icon", fillStyleId: "S:1" });
    const icon2 = makeNode({ id: "i2", name: "Icon", fillStyleId: "S:1" });
    const card1 = makeContainer({ id: "c1", name: "Card", type: "INSTANCE" }, [icon1]);
    const card2 = makeContainer({ id: "c2", name: "Card", type: "INSTANCE" }, [icon2]);
    const frame = makeContainer({ id: "f", name: "Home" }, [card1, card2]);
    makePage([frame]);

    expect(scan({ pageRootNodes: [frame] }).colorStyles).toEqual([
      {
        styleName: "brand/primary",
        examplePaths: ["Home > Card > Icon", "Home > Card-2 > Icon"],
        layerCount: 2,
      },
    ]);
  });

  it("collapses N instances of one style into a single grouped entry", () => {
    // What the old isInsideInstance skip was really fighting: noise. Grouping
    // per style handles it without hiding the usage.
    mockGetStyleById.mockReturnValue({ name: "brand/primary" });
    const cards = [1, 2, 3, 4, 5].map((n) =>
      makeContainer({ id: `c${n}`, name: "Card", type: "INSTANCE" }, [
        makeNode({ id: `i${n}`, name: "Icon", fillStyleId: "S:1" }),
      ]),
    );
    const frame = makeContainer({ id: "f", name: "Home" }, cards);
    makePage([frame]);

    const report = scan({ pageRootNodes: [frame] });
    expect(report.colorStyles).toHaveLength(1);
    expect(report.colorStyles[0].layerCount).toBe(5);
    expect(report.colorStyles[0].examplePaths).toHaveLength(3);
  });

  it("scans STRING Variable bindings inside instances too", () => {
    mockGetVariableById.mockReturnValue(makeVariable("copy/label", "STRING", "v1"));
    const label = makeNode({
      id: "l",
      name: "Label",
      boundVariables: { characters: { type: "VARIABLE_ALIAS", id: "v1" } },
    });
    const card = makeContainer({ id: "c", name: "Card", type: "INSTANCE" }, [label]);
    const frame = makeContainer({ id: "f", name: "Home" }, [card]);
    makePage([frame]);
    expect(scan({ pageRootNodes: [frame] }).stringBooleanVariables).toEqual([
      {
        variableName: "copy/label",
        examplePaths: ["Home > Card > Label"],
        layerCount: 1,
      },
    ]);
  });

  it("does not also report the contents of a bare page-root Component", () => {
    // The whole Component is already reported as excluded — listing its inner
    // layers again under Color Styles would double-count one exclusion.
    const label = makeNode({ id: "l", name: "Label", fillStyleId: "S:1" });
    const button = makeContainer({ id: "b", name: "Button", type: "COMPONENT" }, [label]);
    const frame = makeContainer({ id: "f", name: "Home" }, []);
    makePage([frame, button]);

    const report = scan({ pageRootNodes: [frame, button] });
    expect(report.colorStyles).toEqual([]);
    expect(report.bareRootComponents).toEqual(["Button"]);
  });

  it("counts a layer reached twice only once", () => {
    // One cause, one README line — and one increment of the count.
    const title = makeNode({ id: "t", name: "Title", fillStyleId: "S:1" });
    const frame = makeContainer({ id: "f", name: "Home" }, [title]);
    makePage([frame]);
    expect(colorUsage([title, title])).toEqual([
      { styleName: "S:1", examplePaths: ["Home > Title"], layerCount: 1 },
    ]);
  });
});

describe("layer-path roots agree with the zip folder names", () => {
  // 4.7.2 「読み手がzipの中身と突き合わせられるものでなければならない」: the root
  // of a README layer path must be spelled exactly like the folder the reader
  // opens, or the report contradicts the zip sitting next to it.
  it("names the path root after the frame's zip folder, not its sibling index", () => {
    const title = makeNode({ id: "t", name: "Title", fillStyleId: "S:1" });
    const frame = makeContainer({ id: "f", name: "Home" }, [title]);
    const component = makeNode({ id: "b", name: "Home", type: "COMPONENT" });
    // Component first: a page-root-child-index rule would push the frame to
    // "Home-2" while the zip still writes a folder called "Home".
    makePage([component, frame]);

    const report = collectExclusions({
      pageRootNodes: [component, frame],
      variables: [],
      textStyles: [],
    });
    const [folderName] = resolveFrameFolderNames([frame.name]);
    const pathRoot = report.colorStyles[0].examplePaths[0].split(" > ")[0];

    expect(pathRoot).toBe(folderName);
    expect(pathRoot).toBe("Home");
  });

  it("spells a slash-containing frame name the way the folder does", () => {
    const title = makeNode({ id: "t", name: "Title", fillStyleId: "S:1" });
    const frame = makeContainer({ id: "f", name: "Desktop / Home" }, [title]);
    makePage([frame]);

    const report = collectExclusions({
      pageRootNodes: [frame],
      variables: [],
      textStyles: [],
    });
    expect(report.colorStyles[0].examplePaths[0]).toBe("Desktop - Home > Title");
    expect(resolveFrameFolderNames([frame.name])).toEqual(["Desktop - Home"]);
  });

  it("suffixes duplicate frame names the same way the folders are suffixed", () => {
    const a = makeNode({ id: "a", name: "Title", fillStyleId: "S:1" });
    const b = makeNode({ id: "b", name: "Title", fillStyleId: "S:2" });
    const first = makeContainer({ id: "f1", name: "Home" }, [a]);
    const second = makeContainer({ id: "f2", name: "Home" }, [b]);
    makePage([first, second]);

    const report = collectExclusions({
      pageRootNodes: [first, second],
      variables: [],
      textStyles: [],
    });
    expect(report.colorStyles.map((u) => u.examplePaths[0])).toEqual([
      "Home > Title",
      "Home-2 > Title",
    ]);
    expect(resolveFrameFolderNames(["Home", "Home"])).toEqual(["Home", "Home-2"]);
  });
});

describe("collectExclusions rendered through buildReadme", () => {
  it("carries every detected category from detection into the README section", () => {
    mockGetVariableById.mockReturnValue(makeVariable("copy/label", "STRING"));
    mockGetStyleById.mockReturnValue({ name: "brand/primary" });
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
      frames: [{ name: "Home", hasScreenshots: true, hasAssets: true }],
      hasTokens: true,
      exclusions: collectExclusions({
        pageRootNodes: [frame, button],
        variables: [makeVariable("typography/heading-md", "COLOR")],
        textStyles: [makeTextStyle("heading-md")],
      }),
    });

    const section = readme.slice(readme.indexOf("## Not included in this export"));
    expect(section).toContain("  - `brand/primary` — used on 1 layer: `Home > Title`");
    expect(section).toContain("  - `copy/label` — used on 1 layer: `Home > Card`");
    expect(section).toContain("  - `Button`");
    expect(section).toContain(
      "  - `typography/heading-md` (Variable) vs `heading-md` (Text Style)",
    );
  });
});

describe("page-root segment naming", () => {
  // 4.5.2 / 4.7.2: every page-root sibling is named in one pass, so the README
  // can never spell two different nodes the same way, nor claim that the frame
  // owning a zip folder was not exported.
  it("keeps the unsuffixed name on the frame and suffixes the bare Component", () => {
    const title = makeNode({ id: "t", name: "Title", fillStyleId: "S:1" });
    const frame = makeContainer({ id: "f", name: "Home" }, [title]);
    const component = makeNode({ id: "c", name: "Home", type: "COMPONENT" });
    // Component first in page order: the frame still owns `Home/` in the zip.
    makePage([component, frame]);

    const report = collectExclusions({
      pageRootNodes: [component, frame],
      variables: [],
      textStyles: [],
    });
    expect(report.colorStyles[0].examplePaths).toEqual(["Home > Title"]);
    expect(report.bareRootComponents).toEqual(["Home-2"]);
    expect(resolveFrameFolderNames([frame.name])).toEqual(["Home"]);
  });

  it("does not let a non-frame collide with a sanitized frame folder name", () => {
    // `A/B` becomes folder `A-B`; a Component literally named `A-B` must not
    // render as the same string, or one name would denote two different things.
    const title = makeNode({ id: "t", name: "Title", fillStyleId: "S:1" });
    const frame = makeContainer({ id: "f", name: "A/B" }, [title]);
    const component = makeNode({ id: "c", name: "A-B", type: "COMPONENT" });
    makePage([frame, component]);

    const report = collectExclusions({
      pageRootNodes: [frame, component],
      variables: [],
      textStyles: [],
    });
    expect(report.colorStyles[0].examplePaths).toEqual(["A-B > Title"]);
    expect(report.bareRootComponents).toEqual(["A-B-2"]);
  });

  it("keeps two same-named bare Components as two distinct entries", () => {
    // Without the disambiguation these render identically, and a reader has no
    // way to tell that two Components — not one — were left out.
    const first = makeNode({ id: "b1", name: "Button", type: "COMPONENT" });
    const second = makeNode({ id: "b2", name: "Button", type: "COMPONENT" });
    makePage([first, second]);

    expect(
      collectExclusions({
        pageRootNodes: [first, second],
        variables: [],
        textStyles: [],
      }).bareRootComponents,
    ).toEqual(["Button", "Button-2"]);
  });
});

describe("layerCount counts layers, not rendered strings", () => {
  it("counts two layers whose paths render identically as two", () => {
    // Nothing neutralizes ` > ` inside a layer name, so a layer literally
    // called "A > B" renders the same path as the layer B inside the frame A.
    // The README states the count as a fact about layers.
    const literal = makeNode({ id: "x", name: "A > B", fillStyleId: "S:1" });
    const leaf = makeNode({ id: "y", name: "B", fillStyleId: "S:1" });
    const middle = makeContainer({ id: "a", name: "A" }, [leaf]);
    const frame = makeContainer({ id: "f", name: "Home" }, [literal, middle]);
    makePage([frame]);

    const [usage] = collectExclusions({
      pageRootNodes: [frame],
      variables: [],
      textStyles: [],
    }).colorStyles;
    expect(usage.examplePaths).toEqual(["Home > A > B", "Home > A > B"]);
    expect(usage.layerCount).toBe(2);
  });
});

describe("token-collision dedupe", () => {
  it("reports one line when two same-named Variables collide with one Text Style", () => {
    // Variable names are unique per collection, not per file: two collections
    // can both hold `typography/body`. tokens.json has one slot, so the Text
    // Style overwrites once — one cause, one README line.
    const inCollectionA = makeVariable("typography/body", "FLOAT", "v-a");
    const inCollectionB = makeVariable("typography/body", "FLOAT", "v-b");
    expect(
      collectExclusions({
        pageRootNodes: [],
        variables: [inCollectionA, inCollectionB],
        textStyles: [makeTextStyle("body")],
      }).tokenNameCollisions,
    ).toEqual([{ variableName: "typography/body", textStyleName: "body" }]);
  });
});
