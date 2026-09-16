import { describe, it, expect, vi } from "vitest";
import { exportScreenshots } from "../screenshotExporter";

function makeNode(
  overrides: Record<string, unknown> = {},
): SceneNode {
  return {
    id: "n1",
    name: "node",
    type: "FRAME",
    children: [],
    exportAsync: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    ...overrides,
  } as unknown as SceneNode;
}

describe("exportScreenshots", () => {
  it("exports sections (depth 1)", async () => {
    const section = makeNode({ name: "pricing" });
    const root = makeNode({ children: [section] });
    const results = await exportScreenshots(root);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("screenshots/pricing.png");
  });

  it("exports blocks with children (depth > 1)", async () => {
    const leaf = makeNode({ name: "text", children: undefined });
    delete (leaf as any).children;
    const block = makeNode({ name: "plans", children: [leaf] });
    const section = makeNode({ name: "pricing", children: [block] });
    const root = makeNode({ children: [section] });
    const results = await exportScreenshots(root);
    const paths = results.map((r) => r.path);
    expect(paths).toContain("screenshots/pricing.png");
    expect(paths).toContain("screenshots/pricing--plans.png");
  });

  it("does not export elements (leaf nodes)", async () => {
    const leaf = makeNode({ name: "heading", children: undefined });
    delete (leaf as any).children;
    const section = makeNode({ name: "hero", children: [leaf] });
    const root = makeNode({ children: [section] });
    const results = await exportScreenshots(root);
    const paths = results.map((r) => r.path);
    expect(paths).not.toContain("screenshots/hero--heading.png");
  });

  it("generates correct file names with -- separator", async () => {
    const leaf = makeNode({ name: "text", children: undefined });
    delete (leaf as any).children;
    const block = makeNode({ name: "plan-pro", children: [leaf] });
    const mid = makeNode({ name: "plans", children: [block] });
    const section = makeNode({ name: "pricing", children: [mid] });
    const root = makeNode({ children: [section] });
    const results = await exportScreenshots(root);
    const paths = results.map((r) => r.path);
    expect(paths).toContain("screenshots/pricing--plans--plan-pro.png");
  });

  it("uses PNG scale 2x", async () => {
    const section = makeNode({ name: "hero" });
    const root = makeNode({ children: [section] });
    await exportScreenshots(root);
    expect(section.exportAsync).toHaveBeenCalledWith({
      format: "PNG",
      constraint: { type: "SCALE", value: 2 },
    });
  });
});
