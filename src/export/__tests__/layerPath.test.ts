import { describe, it, expect } from "vitest";
import {
  buildLayerPath,
  layerPathToSlug,
  resolveFrameFolderNames,
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

describe("resolveFrameFolderNames", () => {
  it("keeps a plain frame name as the folder name", () => {
    expect(resolveFrameFolderNames(["Home", "Pricing"])).toEqual(["Home", "Pricing"]);
  });

  it("suffixes duplicate frame names so folders cannot clobber each other", () => {
    expect(resolveFrameFolderNames(["Home", "Home", "Home"])).toEqual([
      "Home",
      "Home-2",
      "Home-3",
    ]);
  });

  it("neutralizes path separators so a name cannot spawn nested folders", () => {
    expect(resolveFrameFolderNames(["Desktop / Home", "a\\b"])).toEqual([
      "Desktop - Home",
      "a-b",
    ]);
  });

  it("falls back to 'frame' for a blank name", () => {
    expect(resolveFrameFolderNames(["   "])).toEqual(["frame"]);
  });
});

describe("resolvePageRootSegmentNames", () => {
  const node = (id: string, name: string, type = "FRAME") =>
    ({ id, name, type }) as unknown as SceneNode;
  const isFrame = (n: SceneNode) => n.type === "FRAME";
  const names = (nodes: SceneNode[]) =>
    [...resolvePageRootSegmentNames(nodes, isFrame).values()];

  it("gives frames exactly the names resolveFrameFolderNames would", () => {
    // The zip folders come from resolveFrameFolderNames over the frames alone;
    // if these two disagreed, README paths would name folders that don't exist.
    const frames = [node("f1", "Desktop / Home"), node("f2", "Desktop / Home")];
    const map = resolvePageRootSegmentNames(frames, isFrame);
    expect(frames.map((f) => map.get(f.id))).toEqual(
      resolveFrameFolderNames(frames.map((f) => f.name)),
    );
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
