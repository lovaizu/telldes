import { describe, it, expect } from "vitest";
import { folderNameOf, isExportedFrame, resolveExportScope } from "../exportScope";

const node = (id: string, name: string, type = "FRAME") =>
  ({ id, name, type }) as unknown as SceneNode;

const names = (nodes: SceneNode[]) => [...resolveExportScope(nodes).rootNames.values()];

describe("isExportedFrame", () => {
  it("accepts the page-root FRAME/SECTION nodes the export turns into folders", () => {
    expect(isExportedFrame(node("f", "Home", "FRAME"))).toBe(true);
    expect(isExportedFrame(node("s", "Band", "SECTION"))).toBe(true);
  });

  it("rejects every other page-root node type", () => {
    expect(isExportedFrame(node("c", "Button", "COMPONENT"))).toBe(false);
    expect(isExportedFrame(node("r", "Rect", "RECTANGLE"))).toBe(false);
  });
});

describe("resolveExportScope", () => {
  it("derives the exported frames and keeps the page-root list they came from", () => {
    const frame = node("f", "Home");
    const component = node("c", "Button", "COMPONENT");

    const scope = resolveExportScope([frame, component]);

    expect(scope.frames).toEqual([frame]);
    expect(scope.pageRootNodes).toEqual([frame, component]);
  });

  it("names every page-root child, not just the exported frames", () => {
    // The exclusion scan reads bare Components off this same scope (4.7.2),
    // so a scope holding only the frames would leave them unnamed.
    const scope = resolveExportScope([node("c", "Button", "COMPONENT"), node("f", "Home")]);

    expect([...scope.rootNames.keys()].sort()).toEqual(["c", "f"]);
  });

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
    const scope = resolveExportScope([node("c", "Home", "COMPONENT"), node("f", "Home")]);
    expect(scope.rootNames.get("f")).toBe("Home");
    expect(scope.rootNames.get("c")).toBe("Home-2");
  });

  it("applies the frames' sanitisation to non-frames too", () => {
    // One rule over one `used` set: a Component named `A/B` must not end up
    // spelled like the folder a frame named `A/B` would own.
    expect(
      names([node("a", "A/B", "COMPONENT"), node("b", "  A-B  ", "COMPONENT")]),
    ).toEqual(["A-B", "A-B-2"]);
  });

  it("disambiguates same-named non-frames among themselves", () => {
    expect(
      names([node("a", "Button", "COMPONENT"), node("b", "Button", "COMPONENT_SET")]),
    ).toEqual(["Button", "Button-2"]);
  });
});

describe("resolveExportScope — names that are not usable as folders", () => {
  it("falls back to 'frame' for a name made only of dots", () => {
    // `..` as a folder name escapes the export root on extraction, and `.`
    // resolves back to it — neither is a name (design doc 4.5.2).
    expect(names([node("f1", "."), node("f2", ".."), node("f3", "...")])).toEqual([
      "frame",
      "frame-2",
      "frame-3",
    ]);
  });

  it("trims before deciding a name is only dots", () => {
    expect(names([node("f1", "  ..  ")])).toEqual(["frame"]);
  });

  it("keeps a dot inside a real name", () => {
    expect(names([node("f1", "v1.2")])).toEqual(["v1.2"]);
  });

  it("suffixes a frame named like a file the zip root already holds", () => {
    // Otherwise the zip carries both a `README.md` file and a `README.md/`
    // folder at its root (design doc 4.5.2).
    expect(names([node("f1", "README.md")])).toEqual(["README.md-2"]);
    expect(names([node("f1", "prompt.md")])).toEqual(["prompt.md-2"]);
    expect(names([node("f1", "steering.md")])).toEqual(["steering.md-2"]);
    expect(names([node("f1", "tokens.json")])).toEqual(["tokens.json-2"]);
  });

  it("suffixes a frame named like a reserved file in another case", () => {
    // macOS and Windows resolve `readme.md` and `README.md` to one path, so
    // the folder would swallow the file the export wrote (design doc 4.5.2).
    expect(names([node("f1", "readme.md")])).toEqual(["readme.md-2"]);
    expect(names([node("f1", "Tokens.JSON")])).toEqual(["Tokens.JSON-2"]);
  });

  it("leaves a name that only shares a stem with a reserved file alone", () => {
    expect(names([node("f2", "README")])).toEqual(["README"]);
  });

  it("separates two frames whose names differ only in case", () => {
    // Same reason: one folder on a case-insensitive filesystem, so the second
    // frame's spec.json would overwrite the first.
    expect(names([node("f1", "Home"), node("f2", "home")])).toEqual(["Home", "home-2"]);
  });

  it("hands back the spelling Figma uses, case and all", () => {
    expect(names([node("f1", "HOME"), node("f2", "Home"), node("f3", "home")])).toEqual([
      "HOME",
      "Home-2",
      "home-3",
    ]);
  });
});

describe("folderNameOf", () => {
  it("gives the frame the segment the scope named it with", () => {
    const frame = node("f", "Desktop / Home");
    expect(folderNameOf(resolveExportScope([frame]), frame)).toBe("Desktop - Home");
  });

  it("throws rather than hand back a name the scope has not got", () => {
    // `root.folder(undefined)` is the export root itself, so an unnamed frame
    // would pile its spec.json in there (design doc 4.3.4).
    const scope = resolveExportScope([]);
    expect(() => folderNameOf(scope, node("f", "Home"))).toThrow("no folder name");
  });
});
