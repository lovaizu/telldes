import { describe, it, expect } from "vitest";
import { checkSizing } from "../sizingChecks";

function makeFrame(
  overrides: Record<string, unknown> = {},
): SceneNode {
  return {
    id: "f1",
    name: "frame",
    type: "FRAME",
    layoutSizingHorizontal: "FIXED",
    layoutSizingVertical: "FIXED",
    ...overrides,
  } as unknown as SceneNode;
}

describe("checkSizing", () => {
  it("passes when sizing is HUG", () => {
    const node = makeFrame({ layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG" });
    expect(checkSizing([node])).toHaveLength(0);
  });

  it("passes when sizing is FILL", () => {
    const node = makeFrame({ layoutSizingHorizontal: "FILL", layoutSizingVertical: "FILL" });
    expect(checkSizing([node])).toHaveLength(0);
  });

  it("passes when sizing is FIXED", () => {
    const node = makeFrame({ layoutSizingHorizontal: "FIXED", layoutSizingVertical: "FIXED" });
    expect(checkSizing([node])).toHaveLength(0);
  });

  it("detects invalid horizontal sizing", () => {
    const node = makeFrame({ layoutSizingHorizontal: "STRETCH" });
    const results = checkSizing([node]);
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe("error");
    expect(results[0].message).toContain("横方向");
  });

  it("detects invalid vertical sizing", () => {
    const node = makeFrame({ layoutSizingVertical: "STRETCH" });
    const results = checkSizing([node]);
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain("縦方向");
  });

  it("detects both directions invalid", () => {
    const node = makeFrame({
      layoutSizingHorizontal: "STRETCH",
      layoutSizingVertical: "STRETCH",
    });
    const results = checkSizing([node]);
    expect(results).toHaveLength(2);
  });

  it("skips INHERIT (node outside an Auto Layout context)", () => {
    const node = makeFrame({
      layoutSizingHorizontal: "INHERIT",
      layoutSizingVertical: "INHERIT",
    });
    expect(checkSizing([node])).toHaveLength(0);
  });

  it("ignores nodes without layoutSizingHorizontal", () => {
    const node = { id: "r1", name: "rect", type: "RECTANGLE" } as unknown as SceneNode;
    expect(checkSizing([node])).toHaveLength(0);
  });
});
