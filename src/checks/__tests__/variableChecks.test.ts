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

  it("ignores mixed fontSize (symbol)", () => {
    const node = {
      id: "t1",
      name: "text",
      type: "TEXT",
      fontSize: Symbol("mixed"),
    } as unknown as SceneNode;
    expect(checkRepeatedFontSize([node])).toHaveLength(0);
  });
});
