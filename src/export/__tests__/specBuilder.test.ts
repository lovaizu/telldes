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

  it("captures fill opacity for a semi-transparent overlay", () => {
    const rect = {
      id: "r1",
      name: "overlay",
      type: "RECTANGLE",
      fills: [
        { type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.5, visible: true },
      ],
      boundVariables: {},
      getPluginData: () => "",
    } as unknown as SceneNode;
    const section = makeFrame({ name: "hero", children: [rect] });
    const spec = buildSpec(makePage([makeFrame({ children: [section] })]));
    expect(spec.children[0].children![0].fills![0].opacity).toBe(0.5);
  });

  it("emits IMAGE and GRADIENT fills (not only SOLID)", () => {
    const rect = {
      id: "r1",
      name: "banner",
      type: "RECTANGLE",
      fills: [
        { type: "IMAGE", scaleMode: "FILL", visible: true },
        {
          type: "GRADIENT_LINEAR",
          visible: true,
          gradientTransform: [
            [1, 0, 0],
            [0, 1, 0],
          ],
          gradientStops: [
            { position: 0, color: { r: 0, g: 0, b: 0, a: 0 } },
            { position: 1, color: { r: 0, g: 0, b: 0, a: 0.6 } },
          ],
        },
      ],
      boundVariables: {},
      getPluginData: () => "",
    } as unknown as SceneNode;
    const section = makeFrame({ name: "hero", children: [rect] });
    const spec = buildSpec(makePage([makeFrame({ children: [section] })]));
    const fills = spec.children[0].children![0].fills!;
    expect(fills).toHaveLength(2);
    expect(fills[0]).toMatchObject({ type: "IMAGE", scaleMode: "FILL" });
    expect(fills[1].type).toBe("GRADIENT_LINEAR");
    // per-stop alpha preserved as #RRGGBBAA (fade-to-transparent overlay)
    expect(fills[1].gradientStops).toEqual([
      { position: 0, color: "#00000000" },
      { position: 1, color: "#00000099" },
    ]);
    expect(fills[1].gradientTransform).toEqual([
      [1, 0, 0],
      [0, 1, 0],
    ]);
  });

  it("includes min/max sizing constraints when set", () => {
    const frame = makeFrame({
      name: "col",
      children: [],
      minWidth: 320,
      maxWidth: 1200,
      minHeight: null,
      maxHeight: null,
    });
    const section = makeFrame({ name: "hero", children: [frame] });
    const spec = buildSpec(makePage([makeFrame({ children: [section] })]));
    const sizing = spec.children[0].children![0].layout!.sizing!;
    expect(sizing.minWidth).toBe(320);
    expect(sizing.maxWidth).toBe(1200);
    expect(sizing).not.toHaveProperty("minHeight");
  });

  it("emits widthPx/heightPx for FIXED sizing", () => {
    const frame = makeFrame({
      name: "box",
      children: [],
      layoutSizingHorizontal: "FIXED",
      layoutSizingVertical: "FIXED",
      width: 200,
      height: 120,
    });
    const section = makeFrame({ name: "hero", children: [frame] });
    const spec = buildSpec(makePage([makeFrame({ children: [section] })]));
    const sizing = spec.children[0].children![0].layout!.sizing!;
    expect(sizing.width).toBe("FIXED");
    expect(sizing.widthPx).toBe(200);
    expect(sizing.heightPx).toBe(120);
  });

  it("carries sizing on a non-auto-layout leaf that is an AL child", () => {
    const leaf = {
      id: "lf",
      name: "divider",
      type: "RECTANGLE",
      layoutSizingHorizontal: "FIXED",
      layoutSizingVertical: "FIXED",
      width: 300,
      height: 1,
      fills: [],
      boundVariables: {},
      getPluginData: () => "",
    } as unknown as SceneNode;
    const section = makeFrame({ name: "hero", children: [leaf] });
    const spec = buildSpec(makePage([makeFrame({ children: [section] })]));
    const layout = spec.children[0].children![0].layout!;
    expect(layout.direction).toBeUndefined();
    expect(layout.sizing).toEqual({
      width: "FIXED",
      height: "FIXED",
      widthPx: 300,
      heightPx: 1,
    });
  });

  it("disambiguates same-named sibling blocks in path and screenshot", () => {
    const grandchild = makeFrame({ name: "label", children: [] });
    const itemA = makeFrame({ name: "item", children: [grandchild] });
    const itemB = makeFrame({ name: "item", children: [grandchild] });
    const section = makeFrame({ name: "plans", children: [itemA, itemB] });
    const spec = buildSpec(makePage([makeFrame({ children: [section] })]));
    const items = spec.children[0].children!;
    expect(items[0].path).toBe("plans > item");
    expect(items[1].path).toBe("plans > item-2");
    expect(items[0].screenshot).toBe("screenshots/plans--item.png");
    expect(items[1].screenshot).toBe("screenshots/plans--item-2.png");
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

  it("emits a per-corner object for a mixed cornerRadius", () => {
    const card = {
      id: "c1",
      name: "card",
      type: "RECTANGLE",
      cornerRadius: Symbol("figma.mixed"),
      topLeftRadius: 12,
      topRightRadius: 0,
      bottomRightRadius: 8,
      bottomLeftRadius: 0,
      boundVariables: {},
      getPluginData: () => "",
    } as unknown as SceneNode;
    const section = makeFrame({ name: "hero", children: [card] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    expect(spec.children[0].children![0].cornerRadius).toEqual({
      topLeft: 12,
      topRight: 0,
      bottomRight: 8,
      bottomLeft: 0,
    });
  });

  it("reads cornerRadiusToken from the topLeftRadius binding", () => {
    mockGetVariableById.mockReturnValue({ name: "radius/card" });
    const card = {
      id: "c1",
      name: "card",
      type: "RECTANGLE",
      cornerRadius: 8,
      boundVariables: { topLeftRadius: { id: "var-r" } },
      getPluginData: () => "",
    } as unknown as SceneNode;
    const section = makeFrame({ name: "hero", children: [card] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    expect(spec.children[0].children![0].cornerRadiusToken).toBe("radius/card");
  });

  it("maps ExtraBold/UltraBold font styles to weight 800", () => {
    for (const style of ["ExtraBold", "Extra Bold", "UltraBold"]) {
      const text = makeTextNode({ fontName: { family: "Inter", style } });
      const section = makeFrame({ name: "hero", children: [text] });
      const spec = buildSpec(makePage([makeFrame({ children: [section] })]));
      expect(spec.children[0].children![0].text!.fontWeight, style).toBe(800);
    }
  });

  it("resolves a mixed fontName from the first character (not empty/400)", () => {
    const text = makeTextNode({
      fontName: Symbol("figma.mixed"),
      getRangeFontName: () => ({ family: "Roboto", style: "Bold" }),
    });
    const section = makeFrame({ name: "hero", children: [text] });
    const spec = buildSpec(makePage([makeFrame({ children: [section] })]));
    const t = spec.children[0].children![0].text!;
    expect(t.fontFamily).toBe("Roboto");
    expect(t.fontWeight).toBe(700);
  });

  it("captures the top-level frame's own fill as page background", () => {
    const section = makeFrame({ name: "hero", children: [] });
    const root = makeFrame({
      children: [section],
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, visible: true }],
    });
    const spec = buildSpec(makePage([root]));
    expect(spec.background).toEqual([{ type: "SOLID", color: "#000000" }]);
  });

  it("omits background when the top-level frame has no fill", () => {
    const section = makeFrame({ name: "hero", children: [] });
    const spec = buildSpec(makePage([makeFrame({ children: [section] })]));
    expect(spec).not.toHaveProperty("background");
  });

  it("sets nodeType TEXT for text nodes", () => {
    const text = makeTextNode();
    const section = makeFrame({ name: "hero", children: [text] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    expect(spec.children[0].children![0].nodeType).toBe("TEXT");
  });

  it("includes layoutAlign STRETCH on child nodes", () => {
    const child = makeTextNode({ layoutAlign: "STRETCH" });
    const section = makeFrame({ name: "hero", children: [child] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    expect((spec.children[0].children![0] as any).layoutAlign).toBe("STRETCH");
  });

  it("includes layoutGrow 1 on child nodes", () => {
    const child = makeTextNode({ layoutGrow: 1 });
    const section = makeFrame({ name: "hero", children: [child] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    expect((spec.children[0].children![0] as any).layoutGrow).toBe(1);
  });

  it("omits layoutAlign when not STRETCH", () => {
    const child = makeTextNode({ layoutAlign: "INHERIT" });
    const section = makeFrame({ name: "hero", children: [child] });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    expect((spec.children[0].children![0] as any).layoutAlign).toBeUndefined();
  });

  it("includes counterAxisAlignContent on wrap layouts", () => {
    const section = makeFrame({
      name: "grid",
      layoutWrap: "WRAP",
      counterAxisAlignContent: "SPACE_BETWEEN",
      children: [],
    });
    const root = makeFrame({ children: [section] });
    const spec = buildSpec(makePage([root]));
    expect(spec.children[0].layout!.counterAxisAlignContent).toBe("SPACE_BETWEEN");
  });
});
