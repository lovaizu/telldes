import { describe, it, expect } from "vitest";
import { isExportedFrame, resolvePageRootNames } from "../exportScope";

const node = (id: string, name: string, type = "FRAME") =>
  ({ id, name, type }) as unknown as SceneNode;

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

describe("resolvePageRootNames", () => {
  it("names every page-root child, frames keeping the unsuffixed spelling", () => {
    // The one pass both the zip folders and the README layer paths read from.
    const map = resolvePageRootNames([
      node("c", "Home", "COMPONENT"),
      node("f", "Home"),
    ]);
    expect(map.get("f")).toBe("Home");
    expect(map.get("c")).toBe("Home-2");
  });

  it("applies the folder-name normalisation to the segment it hands back", () => {
    const map = resolvePageRootNames([node("f", "Desktop / Home")]);
    expect(map.get("f")).toBe("Desktop - Home");
  });
});
