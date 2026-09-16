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

  it("detects a manually-placed COMPONENT / COMPONENT_SET", () => {
    const child = makeRect();
    const comp = makeFrame({ type: "COMPONENT", children: [child] });
    const compSet = makeFrame({ type: "COMPONENT_SET", children: [child] });
    expect(checkAutoLayout([comp])).toHaveLength(1);
    expect(checkAutoLayout([compSet])).toHaveLength(1);
  });

  it("ignores INSTANCE (layout inherited from main component)", () => {
    const child = makeRect();
    const instance = makeFrame({ type: "INSTANCE", children: [child] });
    expect(checkAutoLayout([instance])).toHaveLength(0);
  });

  it("ignores nodes inside an instance (not fixable on the instance)", () => {
    const instance = { id: "inst", type: "INSTANCE", parent: null };
    const innerFrame = makeFrame({
      id: "inner",
      layoutMode: "NONE",
      children: [makeRect()],
      parent: instance,
    });
    expect(checkAutoLayout([innerFrame])).toHaveLength(0);
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

  it("detects numberless Figma defaults (bare 'Vector' / 'Image')", () => {
    for (const name of ["Vector", "Image"]) {
      const node = makeRect({ name });
      expect(checkDefaultNames([node]), `should detect "${name}"`).toHaveLength(1);
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
  it("detects child named 'bg'", () => {
    const bg = makeRect({ id: "bg", name: "bg", type: "RECTANGLE" });
    const frame = makeFrame({ children: [bg] });
    const results = checkBackgroundAsChild([frame]);
    expect(results).toHaveLength(1);
    expect(results[0].suggestion).toContain("fill");
  });

  it("detects child named 'background'", () => {
    const bg = makeRect({ name: "background", type: "RECTANGLE" });
    const frame = makeFrame({ children: [bg] });
    const results = checkBackgroundAsChild([frame]);
    expect(results).toHaveLength(1);
  });

  it("detects the design doc's examples 'bg-image' and 'overlay' (name-driven, not size-driven)", () => {
    const bgImage = makeRect({ id: "bgi", name: "bg-image" });
    const overlay = makeRect({ id: "ov", name: "overlay" });
    const content = makeRect({ id: "c", name: "content" });
    const frame = makeFrame({ children: [bgImage, overlay, content] });
    const results = checkBackgroundAsChild([frame]);
    // both background layers flagged, content untouched
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.nodeName).sort()).toEqual(["bg-image", "overlay"]);
  });

  it("detects a background named child regardless of node type", () => {
    const bgFrame = {
      id: "bf",
      name: "bg",
      type: "FRAME",
      width: 400,
      height: 300,
      parent: null,
    } as unknown as SceneNode;
    const frame = makeFrame({ children: [bgFrame] });
    const results = checkBackgroundAsChild([frame]);
    expect(results).toHaveLength(1);
  });

  it("ignores children whose name does not signal a background", () => {
    const rect = makeRect({ name: "hero-image", type: "RECTANGLE" });
    const frame = makeFrame({ children: [rect] });
    const results = checkBackgroundAsChild([frame]);
    expect(results).toHaveLength(0);
  });
});
