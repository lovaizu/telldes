import { describe, it, expect } from "vitest";
import {
  checkAutoLayout,
  checkDefaultNames,
  checkDuplicateNames,
  checkBackgroundAsChild,
} from "../structureChecks";

function makeFrame(
  overrides: Record<string, unknown> = {},
): SceneNode {
  return {
    id: "f1",
    name: "frame",
    type: "FRAME",
    layoutMode: "NONE",
    width: 400,
    height: 300,
    children: [],
    parent: null,
    ...overrides,
  } as unknown as SceneNode;
}

function makeRect(
  overrides: Record<string, unknown> = {},
): SceneNode {
  return {
    id: "r1",
    name: "rect",
    type: "RECTANGLE",
    width: 100,
    height: 100,
    parent: null,
    ...overrides,
  } as unknown as SceneNode;
}

describe("checkAutoLayout", () => {
  it("detects frame without Auto Layout that has children", () => {
    const child = makeRect();
    const frame = makeFrame({ children: [child] });
    const results = checkAutoLayout([frame]);
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain("Auto Layout未適用");
  });

  it("ignores frame with Auto Layout", () => {
    const child = makeRect();
    const frame = makeFrame({ layoutMode: "HORIZONTAL", children: [child] });
    const results = checkAutoLayout([frame]);
    expect(results).toHaveLength(0);
  });

  it("ignores empty frame without Auto Layout", () => {
    const frame = makeFrame({ layoutMode: "NONE", children: [] });
    const results = checkAutoLayout([frame]);
    expect(results).toHaveLength(0);
  });

  it("ignores non-frame nodes", () => {
    const rect = makeRect({ type: "RECTANGLE" });
    const results = checkAutoLayout([rect]);
    expect(results).toHaveLength(0);
  });
});

describe("checkDefaultNames", () => {
  it("detects Figma default names", () => {
    const defaults = [
      "Frame 1", "Rectangle 3", "Ellipse 2", "Group 5",
      "Text 1", "Line 7", "Vector 12", "Section 1",
    ];
    for (const name of defaults) {
      const node = makeRect({ name });
      const results = checkDefaultNames([node]);
      expect(results, `should detect "${name}"`).toHaveLength(1);
    }
  });

  it("ignores custom names", () => {
    const customs = ["header", "hero-section", "Frame", "Rectangle", "my-frame-1"];
    for (const name of customs) {
      const node = makeRect({ name });
      const results = checkDefaultNames([node]);
      expect(results, `should not flag "${name}"`).toHaveLength(0);
    }
  });
});

describe("checkDuplicateNames", () => {
  it("detects siblings with same name", () => {
    const parent = { id: "parent" };
    const a = makeRect({ id: "a", name: "card", parent });
    const b = makeRect({ id: "b", name: "card", parent });
    const results = checkDuplicateNames([a, b]);
    expect(results).toHaveLength(2);
  });

  it("ignores same name under different parents", () => {
    const p1 = { id: "p1" };
    const p2 = { id: "p2" };
    const a = makeRect({ id: "a", name: "card", parent: p1 });
    const b = makeRect({ id: "b", name: "card", parent: p2 });
    const results = checkDuplicateNames([a, b]);
    expect(results).toHaveLength(0);
  });

  it("ignores unique names under same parent", () => {
    const parent = { id: "parent" };
    const a = makeRect({ id: "a", name: "header", parent });
    const b = makeRect({ id: "b", name: "footer", parent });
    const results = checkDuplicateNames([a, b]);
    expect(results).toHaveLength(0);
  });

  it("ignores same-name component instances under same parent", () => {
    const parent = { id: "parent" };
    const a = makeRect({ id: "a", name: "item", type: "INSTANCE", parent });
    const b = makeRect({ id: "b", name: "item", type: "INSTANCE", parent });
    const results = checkDuplicateNames([a, b]);
    expect(results).toHaveLength(0);
  });
});

describe("checkBackgroundAsChild", () => {
  it("detects rectangle named 'bg' matching parent size", () => {
    const bg = makeRect({
      id: "bg",
      name: "bg",
      type: "RECTANGLE",
      width: 400,
      height: 300,
    });
    const frame = makeFrame({ children: [bg] });
    const results = checkBackgroundAsChild([frame]);
    expect(results).toHaveLength(1);
    expect(results[0].suggestion).toContain("fill");
  });

  it("detects rectangle named 'background'", () => {
    const bg = makeRect({
      name: "background",
      type: "RECTANGLE",
      width: 400,
      height: 300,
    });
    const frame = makeFrame({ children: [bg] });
    const results = checkBackgroundAsChild([frame]);
    expect(results).toHaveLength(1);
  });

  it("ignores rectangle with different size", () => {
    const rect = makeRect({
      name: "bg",
      type: "RECTANGLE",
      width: 100,
      height: 100,
    });
    const frame = makeFrame({ children: [rect] });
    const results = checkBackgroundAsChild([frame]);
    expect(results).toHaveLength(0);
  });

  it("ignores full-size rectangle with non-bg name", () => {
    const rect = makeRect({
      name: "hero-image",
      type: "RECTANGLE",
      width: 400,
      height: 300,
    });
    const frame = makeFrame({ children: [rect] });
    const results = checkBackgroundAsChild([frame]);
    expect(results).toHaveLength(0);
  });

  it("ignores non-rectangle full-size child named bg", () => {
    const text = {
      id: "t1",
      name: "bg",
      type: "TEXT",
      width: 400,
      height: 300,
      parent: null,
    } as unknown as SceneNode;
    const frame = makeFrame({ children: [text] });
    const results = checkBackgroundAsChild([frame]);
    expect(results).toHaveLength(0);
  });
});
