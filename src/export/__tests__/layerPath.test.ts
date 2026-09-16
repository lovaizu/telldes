import { describe, it, expect } from "vitest";
import { buildLayerPath, layerPathToSlug, uniqueChildName } from "../layerPath";

describe("layerPathToSlug", () => {
  it("joins ` > ` as `--` and neutralizes path separators", () => {
    expect(layerPathToSlug("a > b > c")).toBe("a--b--c");
    expect(layerPathToSlug("Home / Desktop > hero")).toBe("Home - Desktop--hero");
  });
});

describe("buildLayerPath", () => {
  it("omits the separator at the root", () => {
    expect(buildLayerPath("", "hero")).toBe("hero");
    expect(buildLayerPath("hero", "cta")).toBe("hero > cta");
  });
});

describe("uniqueChildName", () => {
  it("keeps unique names and suffixes duplicates by order", () => {
    const sibs = [{ name: "a" }, { name: "b" }, { name: "a" }];
    expect(uniqueChildName(sibs, 0)).toBe("a");
    expect(uniqueChildName(sibs, 1)).toBe("b");
    expect(uniqueChildName(sibs, 2)).toBe("a-2");
  });

  it("does not collide a generated suffix with a real sibling of that name", () => {
    const sibs = [{ name: "item" }, { name: "item" }, { name: "item-2" }];
    expect(uniqueChildName(sibs, 0)).toBe("item");
    expect(uniqueChildName(sibs, 1)).toBe("item-2");
    expect(uniqueChildName(sibs, 2)).toBe("item-2-2");
  });
});
