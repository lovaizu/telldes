import { describe, it, expect } from "vitest";
import {
  buildLayerPath,
  layerPathToSlug,
  resolvePageRootSegmentNames,
  uniqueChildName,
} from "../layerPath";

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

describe("resolvePageRootSegmentNames", () => {
  const node = (id: string, name: string, type = "FRAME") =>
    ({ id, name, type }) as unknown as SceneNode;
  const isFrame = (n: SceneNode) => n.type === "FRAME";
  const names = (nodes: SceneNode[]) =>
    [...resolvePageRootSegmentNames(nodes, isFrame).values()];

  it("keeps a plain frame name as its segment", () => {
    expect(names([node("f1", "Home"), node("f2", "Pricing")])).toEqual([
      "Home",
      "Pricing",
    ]);
  });

  it("suffixes duplicate frame names so the zip folders cannot clobber each other", () => {
    const frames = [node("f1", "Desktop / Home"), node("f2", "Desktop / Home")];
    expect(names(frames)).toEqual(["Desktop - Home", "Desktop - Home-2"]);
  });

  it("falls back to 'frame' for a blank name", () => {
    expect(names([node("f1", "   ")])).toEqual(["frame"]);
  });

  it("makes the non-frame yield when it shares a name with a frame", () => {
    const nodes = [node("c", "Home", "COMPONENT"), node("f", "Home")];
    const map = resolvePageRootSegmentNames(nodes, isFrame);
    expect(map.get("f")).toBe("Home");
    expect(map.get("c")).toBe("Home-2");
  });

  it("applies the frames' sanitisation to non-frames too", () => {
    // One rule over one `used` set: a Component named `A/B` must not end up
    // spelled like the folder a frame named `A/B` would own.
    expect(names([node("a", "A/B", "COMPONENT"), node("b", "  A-B  ", "COMPONENT")])).toEqual([
      "A-B",
      "A-B-2",
    ]);
  });

  it("disambiguates same-named non-frames among themselves", () => {
    expect(
      names([node("a", "Button", "COMPONENT"), node("b", "Button", "COMPONENT_SET")]),
    ).toEqual(["Button", "Button-2"]);
  });
});
