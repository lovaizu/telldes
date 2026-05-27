interface FrameInfo {
  node: SceneNode;
  width: number;
  role: "desktop" | "mobile" | "unknown";
}

const DESKTOP_WIDTH = 1440;
const MOBILE_WIDTH = 375;
const TOLERANCE = 100;

function detectRole(width: number): "desktop" | "mobile" | "unknown" {
  if (Math.abs(width - DESKTOP_WIDTH) <= TOLERANCE) return "desktop";
  if (Math.abs(width - MOBILE_WIDTH) <= TOLERANCE) return "mobile";
  return "unknown";
}

export interface ResponsiveLayout {
  mode: "single" | "responsive";
  frames: FrameInfo[];
}

export function detectResponsiveLayout(
  topFrames: readonly SceneNode[],
): ResponsiveLayout {
  if (topFrames.length <= 1) {
    return {
      mode: "single",
      frames: topFrames.map((node) => ({
        node,
        width: "width" in node ? (node as any).width : 0,
        role: "desktop" as const,
      })),
    };
  }

  const frames: FrameInfo[] = topFrames.map((node) => {
    const width = "width" in node ? (node as any).width : 0;
    return { node, width, role: detectRole(width) };
  });

  const hasDesktop = frames.some((f) => f.role === "desktop");
  const hasMobile = frames.some((f) => f.role === "mobile");

  if (hasDesktop && hasMobile) {
    return { mode: "responsive", frames };
  }

  if (frames.some((f) => f.role === "unknown")) {
    const sorted = [...frames].sort((a, b) => b.width - a.width);
    sorted[0].role = "desktop";
    if (sorted.length > 1) sorted[sorted.length - 1].role = "mobile";
    return { mode: "responsive", frames: sorted };
  }

  return { mode: "single", frames };
}
