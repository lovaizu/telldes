import { describe, it, expect, vi } from "vitest";
import { exportAssets } from "../assetExporter";

function makeNode(
  overrides: Record<string, unknown> = {},
): SceneNode {
  return {
    id: "n1",
    name: "node",
    type: "FRAME",
    fills: [],
    children: [],
    exportAsync: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    ...overrides,
  } as unknown as SceneNode;
}

describe("exportAssets", () => {
  it("exports raster images as PNG 2x", async () => {
    const img = makeNode({
      name: "photo",
      type: "RECTANGLE",
      fills: [{ type: "IMAGE", visible: true }],
      children: undefined,
    });
    delete (img as any).children;
    const root = makeNode({ children: [img] });
    const results = await exportAssets(root);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("assets/images/photo.png");
    expect(img.exportAsync).toHaveBeenCalledWith({
      format: "PNG",
      constraint: { type: "SCALE", value: 2 },
    });
  });

  it("exports vector nodes as SVG via SVG_STRING", async () => {
    const icon = makeNode({
      name: "arrow",
      type: "VECTOR",
      children: undefined,
      exportAsync: vi.fn().mockResolvedValue("<svg></svg>"),
    });
    delete (icon as any).children;
    const root = makeNode({ children: [icon] });
    const results = await exportAssets(root);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("assets/icons/arrow.svg");
    expect(icon.exportAsync).toHaveBeenCalledWith({ format: "SVG_STRING" });
    expect(new TextDecoder().decode(results[0].data)).toBe("<svg></svg>");
  });

  it("does not export a container frame's IMAGE fill as a raster asset", async () => {
    const child = makeNode({ name: "label", type: "TEXT", fills: [] });
    delete (child as any).children;
    // hero FRAME with a background photo + real child content
    const hero = makeNode({
      name: "hero",
      type: "FRAME",
      fills: [{ type: "IMAGE", visible: true }],
      children: [child],
    });
    const root = makeNode({ children: [hero] });
    const results = await exportAssets(root);
    expect(results).toHaveLength(0);
  });

  it("generates -- separated file names from layer path", async () => {
    const icon = makeNode({
      name: "icon-check",
      type: "VECTOR",
      children: undefined,
    });
    delete (icon as any).children;
    const section = makeNode({ name: "features", children: [icon] });
    const root = makeNode({ children: [section] });
    const results = await exportAssets(root);
    expect(results[0].path).toBe("assets/icons/features--icon-check.svg");
  });

  it("ignores nodes without image fills or vector type", async () => {
    const rect = makeNode({
      name: "bg",
      type: "RECTANGLE",
      fills: [{ type: "SOLID", visible: true }],
      children: undefined,
    });
    delete (rect as any).children;
    const root = makeNode({ children: [rect] });
    const results = await exportAssets(root);
    expect(results).toHaveLength(0);
  });

  it("handles BOOLEAN_OPERATION as vector", async () => {
    const boolOp = makeNode({
      name: "combined",
      type: "BOOLEAN_OPERATION",
      children: [],
    });
    const root = makeNode({ children: [boolOp] });
    const results = await exportAssets(root);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("assets/icons/combined.svg");
  });
});
