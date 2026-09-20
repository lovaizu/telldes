import { describe, it, expect } from "vitest";
import { buildLayerPath, layerPathOf, layerPathToSlug, uniqueChildName } from "../layerPath";

/** A node chain `child.parent` walks, as the Figma tree links it. */
function chain(...types: { type: string; name: string }[]): SceneNode {
  let parent: unknown = null;
  let node: unknown = null;
  for (const spec of types) {
    node = { ...spec, parent };
    parent = node;
  }
  return node as SceneNode;
}

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

describe("layerPathOf", () => {
  it("walks up to the page, naming each ancestor by the caller's rule", () => {
    const node = chain(
      { type: "PAGE", name: "Page 1" },
      { type: "FRAME", name: "Home" },
      { type: "TEXT", name: "Title" },
    );
    expect(layerPathOf(node, (n) => n.name)).toBe("Home > Title");
    expect(layerPathOf(node, (n) => n.name.toLowerCase())).toBe("home > title");
  });

  it("stops at a DOCUMENT too, for a chain that never passes a page", () => {
    const node = chain(
      { type: "DOCUMENT", name: "Document" },
      { type: "FRAME", name: "Home" },
    );
    expect(layerPathOf(node, (n) => n.name)).toBe("Home");
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
