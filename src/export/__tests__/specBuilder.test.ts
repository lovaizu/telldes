import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildSpec } from "../specBuilder";

const mockGetVariableById = vi.fn();

vi.stubGlobal("figma", {
  variables: { getVariableById: mockGetVariableById },
});

function makeTextNode(overrides: Record<string, unknown> = {}): SceneNode {
  return {
    id: "t1",
    name: "heading",
    type: "TEXT",
    characters: "Hello",
    fontSize: 28,
    fontName: { family: "Inter", style: "Bold" },
    fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, visible: true }],
    boundVariables: {},
    getPluginData: () => "",
    ...overrides,
  } as unknown as SceneNode;
}

function makeFrame(overrides: Record<string, unknown> = {}): SceneNode {
  return {
    id: "f1",
    name: "section-1",
    type: "FRAME",
    width: 1440,
    height: 800,
    layoutMode: "VERTICAL",
    layoutWrap: "NO_WRAP",
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "CENTER",
    paddingTop: 80,
    paddingRight: 24,
    paddingBottom: 80,
    paddingLeft: 24,
    itemSpacing: 48,
    layoutSizingHorizontal: "FILL",
    layoutSizingVertical: "HUG",
    fills: [],
    cornerRadius: 0,
    boundVariables: {},
    children: [],
    getPluginData: () => "",
    ...overrides,
  } as unknown as SceneNode;
}

function makePage(children: SceneNode[]): PageNode {
  return {
    name: "LP - Test",
    children,
  } as unknown as PageNode;
}

beforeEach(() => {
  mockGetVariableById.mockReset();
});

describe("buildSpec", () => {
  it("generates correct page name and viewport", () => {
    const frame = makeFrame({ width: 1440, children: [] });
    const page = makePage([frame]);
    const spec = buildSpec(page);
    expect(spec.page).toBe("LP - Test");
    expect(spec.viewport.width).toBe(1440);
  });

  it("sets type=section for direct children of page frame", () => {
    const child = makeFrame({ name: "pricing", children: [] });
    const root = makeFrame({ children: [child] });
    const spec = buildSpec(makePage([root]));
    expect(spec.children[0].type).toBe("section");
  });

  it("sets type=block for nodes with children at depth > 1", () => {
    const leaf = makeTextNode({ name: "text" });
    const block = makeFrame({ name: "card", children: [leaf] });
    const section = makeFrame({ name: "pricing", children: [block] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    const pricingNode = spec.children[0];
    expect(pricingNode.children![0].type).toBe("block");
  });

  it("sets type=element for leaf nodes", () => {
    const leaf = makeTextNode({ name: "heading" });
    const section = makeFrame({ name: "hero", children: [leaf] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    expect(spec.children[0].children![0].type).toBe("element");
  });

  it("generates correct path with > separator", () => {
    const leaf = makeTextNode({ name: "label" });
    const block = makeFrame({ name: "card", children: [leaf] });
    const section = makeFrame({ name: "pricing", children: [block] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    expect(spec.children[0].path).toBe("pricing");
    expect(spec.children[0].children![0].path).toBe("pricing > card");
    expect(spec.children[0].children![0].children![0].path).toBe(
      "pricing > card > label",
    );
  });

  it("includes screenshot for section and block", () => {
    const leaf = makeTextNode({ name: "text" });
    const block = makeFrame({ name: "plans", children: [leaf] });
    const section = makeFrame({ name: "pricing", children: [block] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    expect(spec.children[0].screenshot).toBe("screenshots/pricing.png");
    expect(spec.children[0].children![0].screenshot).toBe(
      "screenshots/pricing--plans.png",
    );
  });

  it("does not include screenshot for element", () => {
    const leaf = makeTextNode({ name: "heading" });
    const section = makeFrame({ name: "hero", children: [leaf] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    expect(spec.children[0].children![0].screenshot).toBeUndefined();
  });

  it("extracts layout properties", () => {
    const section = makeFrame({
      name: "hero",
      layoutMode: "VERTICAL",
      primaryAxisAlignItems: "CENTER",
      counterAxisAlignItems: "CENTER",
      paddingTop: 40,
      paddingRight: 20,
      paddingBottom: 40,
      paddingLeft: 20,
      itemSpacing: 24,
      layoutSizingHorizontal: "FILL",
      layoutSizingVertical: "HUG",
      children: [],
    });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    const layout = spec.children[0].layout!;
    expect(layout.direction).toBe("VERTICAL");
    expect(layout.primaryAxisAlign).toBe("CENTER");
    expect(layout.counterAxisAlign).toBe("CENTER");
    expect(layout.padding).toEqual({ top: 40, right: 20, bottom: 40, left: 20 });
    expect(layout.gap).toBe(24);
    expect(layout.sizing).toEqual({ width: "FILL", height: "HUG" });
  });

  it("extracts text properties", () => {
    const text = makeTextNode({
      characters: "Pricing Plans",
      fontSize: 28,
      fontName: { family: "Inter", style: "Bold" },
      fills: [
        { type: "SOLID", color: { r: 0.067, g: 0.094, b: 0.153 }, visible: true },
      ],
    });
    const section = makeFrame({ name: "hero", children: [text] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    const textSpec = spec.children[0].children![0].text!;
    expect(textSpec.characters).toBe("Pricing Plans");
    expect(textSpec.fontSize).toBe(28);
    expect(textSpec.fontFamily).toBe("Inter");
    expect(textSpec.fontWeight).toBe(700);
    expect(textSpec.fill).toBe("#111827");
  });

  it("includes note only when set", () => {
    const withNote = makeTextNode({
      name: "cta",
      getPluginData: (key: string) => (key === "note" ? "link to /signup" : ""),
    });
    const withoutNote = makeTextNode({ name: "heading" });
    const section = makeFrame({ name: "hero", children: [withNote, withoutNote] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    expect(spec.children[0].children![0].note).toBe("link to /signup");
    expect(spec.children[0].children![1].note).toBeUndefined();
  });

  it("adds *Token fields when variable is bound", () => {
    mockGetVariableById.mockReturnValue({ name: "font-size/heading" });
    const text = makeTextNode({
      boundVariables: {
        fontSize: { id: "var-1" },
      },
    });
    const section = makeFrame({ name: "hero", children: [text] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    expect(spec.children[0].children![0].text!.fontSizeToken).toBe(
      "font-size/heading",
    );
  });

  it("includes fills for non-text nodes", () => {
    const rect = {
      id: "r1",
      name: "card-bg",
      type: "RECTANGLE",
      fills: [
        { type: "SOLID", color: { r: 0.231, g: 0.51, b: 0.965 }, visible: true },
      ],
      boundVariables: {},
      getPluginData: () => "",
    } as unknown as SceneNode;
    const section = makeFrame({ name: "hero", children: [rect] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    const fills = spec.children[0].children![0].fills!;
    expect(fills).toHaveLength(1);
    expect(fills[0].type).toBe("SOLID");
    expect(fills[0].color).toBe("#3B82F6");
  });

  it("includes cornerRadius when set", () => {
    const frame = makeFrame({
      name: "card",
      cornerRadius: 8,
      children: [],
    });
    const section = makeFrame({ name: "hero", children: [frame] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    expect(spec.children[0].children![0].cornerRadius).toBe(8);
  });

  it("sets nodeType TEXT for text nodes", () => {
    const text = makeTextNode();
    const section = makeFrame({ name: "hero", children: [text] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    expect(spec.children[0].children![0].nodeType).toBe("TEXT");
  });
});
