import { describe, it, expect } from "vitest";
import { detectResponsiveLayout } from "../responsiveDetector";

function makeFrame(width: number, name = "frame"): SceneNode {
  return { id: "f", name, type: "FRAME", width } as unknown as SceneNode;
}

describe("detectResponsiveLayout", () => {
  it("returns single mode for 1 frame", () => {
    const result = detectResponsiveLayout([makeFrame(1440)]);
    expect(result.mode).toBe("single");
    expect(result.frames).toHaveLength(1);
  });

  it("returns single mode for 0 frames", () => {
    const result = detectResponsiveLayout([]);
    expect(result.mode).toBe("single");
    expect(result.frames).toHaveLength(0);
  });

  it("detects desktop + mobile by standard widths", () => {
    const result = detectResponsiveLayout([
      makeFrame(1440, "Desktop"),
      makeFrame(375, "Mobile"),
    ]);
    expect(result.mode).toBe("responsive");
    expect(result.frames.find((f) => f.role === "desktop")!.width).toBe(1440);
    expect(result.frames.find((f) => f.role === "mobile")!.width).toBe(375);
  });

  it("handles tolerance for desktop width", () => {
    const result = detectResponsiveLayout([
      makeFrame(1440, "Desktop"),
      makeFrame(390, "Mobile"),
    ]);
    expect(result.mode).toBe("responsive");
    expect(result.frames.find((f) => f.role === "mobile")).toBeDefined();
  });

  it("assigns roles by width when both are unknown", () => {
    const result = detectResponsiveLayout([
      makeFrame(1200, "Wide"),
      makeFrame(320, "Narrow"),
    ]);
    expect(result.mode).toBe("responsive");
    expect(result.frames[0].role).toBe("desktop");
    expect(result.frames[1].role).toBe("mobile");
  });
});
