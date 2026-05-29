import { describe, it, expect } from "vitest";
import {
  checkRepeatedColors,
  checkRepeatedSpacing,
  checkRepeatedFontSize,
} from "../variableChecks";

function makeSolidNode(
  id: string,
  color: { r: number; g: number; b: number },
  opacity = 1,
): SceneNode {
  return {
    id,
    name: `node-${id}`,
    type: "RECTANGLE",
    fills: [{ type: "SOLID", color, opacity, visible: true }],
  } as unknown as SceneNode;
}

function makeFrameWithSpacing(
  id: string,
  padding: { top: number; right: number; bottom: number; left: number },
  itemSpacing = 0,
): SceneNode {
  return {
    id,
    name: `frame-${id}`,
    type: "FRAME",
    paddingTop: padding.top,
    paddingRight: padding.right,
    paddingBottom: padding.bottom,
    paddingLeft: padding.left,
    itemSpacing,
  } as unknown as SceneNode;
}

function makeTextNode(id: string, fontSize: number): SceneNode {
  return {
    id,
    name: `text-${id}`,
    type: "TEXT",
    fontSize,
  } as unknown as SceneNode;
}

describe("checkRepeatedColors", () => {
  it("suggests when same color used 3+ times", () => {
    const red = { r: 1, g: 0, b: 0 };
    const nodes = [
      makeSolidNode("1", red),
      makeSolidNode("2", red),
      makeSolidNode("3", red),
    ];
    const results = checkRepeatedColors(nodes);
    expect(results).toHaveLength(3);
    expect(results[0].level).toBe("suggestion");
    expect(results[0].suggestion).toContain("Variable");
  });

  it("does not suggest when same color used less than 3 times", () => {
    const red = { r: 1, g: 0, b: 0 };
    const nodes = [makeSolidNode("1", red), makeSolidNode("2", red)];
    expect(checkRepeatedColors(nodes)).toHaveLength(0);
  });

  it("distinguishes different colors", () => {
    const red = { r: 1, g: 0, b: 0 };
    const blue = { r: 0, g: 0, b: 1 };
    const nodes = [
      makeSolidNode("1", red),
      makeSolidNode("2", red),
      makeSolidNode("3", blue),
    ];
    expect(checkRepeatedColors(nodes)).toHaveLength(0);
  });

  it("ignores invisible fills", () => {
    const red = { r: 1, g: 0, b: 0 };
    const nodes = [
      makeSolidNode("1", red),
      makeSolidNode("2", red),
      {
        id: "3",
        name: "node-3",
        type: "RECTANGLE",
        fills: [{ type: "SOLID", color: red, opacity: 1, visible: false }],
      } as unknown as SceneNode,
    ];
    expect(checkRepeatedColors(nodes)).toHaveLength(0);
  });

  it("counts an unbound fill even when a sibling fill on the same node is bound", () => {
    const red = { r: 1, g: 0, b: 0 };
    // index 0 bound to a variable, index 1 hardcoded — the hardcoded one must count
    const make = (id: string) => ({
      id,
      name: `node-${id}`,
      type: "RECTANGLE",
      boundVariables: { fills: [{ id: "var-x" }] },
      fills: [
        { type: "SOLID", color: { r: 0, g: 0, b: 1 }, opacity: 1, visible: true },
        { type: "SOLID", color: red, opacity: 1, visible: true },
      ],
    }) as unknown as SceneNode;
    const results = checkRepeatedColors([make("1"), make("2"), make("3")]);
    // 3 nodes contribute the hardcoded red → threshold reached (the bound blue is excluded)
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.message.includes("#ff0000"))).toBe(true);
  });

  it("does not inflate the count from repeated identical fills on one node", () => {
    const red = { r: 1, g: 0, b: 0 };
    // a single node with the same color in three fill layers must not reach the
    // 3-place threshold on its own
    const node = {
      id: "1",
      name: "node-1",
      type: "RECTANGLE",
      fills: [
        { type: "SOLID", color: red, opacity: 1, visible: true },
        { type: "SOLID", color: red, opacity: 1, visible: true },
        { type: "SOLID", color: red, opacity: 1, visible: true },
      ],
    } as unknown as SceneNode;
    expect(checkRepeatedColors([node])).toHaveLength(0);
  });
});

describe("checkRepeatedSpacing", () => {
  it("suggests when same spacing used in 2+ nodes", () => {
    const nodes = [
      makeFrameWithSpacing("1", { top: 16, right: 16, bottom: 16, left: 16 }),
      makeFrameWithSpacing("2", { top: 16, right: 8, bottom: 8, left: 8 }),
    ];
    const results = checkRepeatedSpacing(nodes);
    const spacing16 = results.filter((r) => r.message.includes("16px"));
    expect(spacing16).toHaveLength(2);
    expect(spacing16[0].level).toBe("suggestion");
  });

  it("does not suggest for unique spacing values", () => {
    const nodes = [
      makeFrameWithSpacing("1", { top: 16, right: 16, bottom: 16, left: 16 }),
      makeFrameWithSpacing("2", { top: 24, right: 24, bottom: 24, left: 24 }),
    ];
    const results = checkRepeatedSpacing(nodes);
    expect(results).toHaveLength(0);
  });

  it("includes itemSpacing", () => {
    const nodes = [
      makeFrameWithSpacing("1", { top: 0, right: 0, bottom: 0, left: 0 }, 12),
      makeFrameWithSpacing("2", { top: 12, right: 0, bottom: 0, left: 0 }),
    ];
    const results = checkRepeatedSpacing(nodes);
    const spacing12 = results.filter((r) => r.message.includes("12px"));
    expect(spacing12).toHaveLength(2);
  });

  it("counts unbound padding sides and excludes individually bound ones", () => {
    // node A: paddingTop bound, paddingRight=16 hardcoded
    const a = {
      id: "a",
      name: "a",
      type: "FRAME",
      boundVariables: { paddingTop: { id: "v1" } },
      paddingTop: 32,
      paddingRight: 16,
      paddingBottom: 0,
      paddingLeft: 0,
      itemSpacing: 0,
    } as unknown as SceneNode;
    // node B: paddingLeft=16 hardcoded (paddingTop NOT bound)
    const b = {
      id: "b",
      name: "b",
      type: "FRAME",
      boundVariables: {},
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 16,
      itemSpacing: 0,
    } as unknown as SceneNode;
    const results = checkRepeatedSpacing([a, b]);
    const s16 = results.filter((r) => r.message.includes("16px"));
    // both hardcoded 16s counted (false negative fixed); bound 32 never suggested
    expect(s16).toHaveLength(2);
    expect(results.some((r) => r.message.includes("32px"))).toBe(false);
  });
});

describe("checkRepeatedFontSize", () => {
  it("suggests when same font-size used in 2+ text nodes", () => {
    const nodes = [makeTextNode("1", 16), makeTextNode("2", 16)];
    const results = checkRepeatedFontSize(nodes);
    expect(results).toHaveLength(2);
    expect(results[0].level).toBe("suggestion");
    expect(results[0].suggestion).toContain("フォントサイズ");
  });

  it("does not suggest for unique font sizes", () => {
    const nodes = [makeTextNode("1", 16), makeTextNode("2", 24)];
    expect(checkRepeatedFontSize(nodes)).toHaveLength(0);
  });

  it("ignores non-text nodes", () => {
    const rect = {
      id: "r1",
      name: "rect",
      type: "RECTANGLE",
    } as unknown as SceneNode;
    expect(checkRepeatedFontSize([rect])).toHaveLength(0);
  });

  it("resolves mixed fontSize via the first character (not dropped)", () => {
    const makeMixed = (id: string) => ({
      id,
      name: `text-${id}`,
      type: "TEXT",
      characters: "Hi",
      fontSize: Symbol("mixed"),
      getRangeFontSize: () => 18,
    }) as unknown as SceneNode;
    const results = checkRepeatedFontSize([makeMixed("1"), makeMixed("2")]);
    expect(results).toHaveLength(2);
    expect(results[0].message).toContain("18px");
  });
});
