import { describe, it, expect, vi, afterEach } from "vitest";
import type { CheckResult } from "../checks/types";

// The plugin-sandbox entry point (code.ts) is the seam between Review, the
// Export error gate and the exclusion scan. Everything that actually talks to
// the Figma image/export APIs is stubbed out so these tests assert the wiring:
// which messages go out, in which order, and with which payload.
vi.mock("../export/specBuilder", () => ({ buildSpec: () => ({ children: [] }) }));
vi.mock("../export/tokensBuilder", () => ({ buildTokens: () => null }));
vi.mock("../export/screenshotExporter", () => ({ exportScreenshots: async () => [] }));
vi.mock("../export/assetExporter", () => ({ exportAssets: async () => [] }));

interface PluginMessage {
  type: string;
  [key: string]: unknown;
}

function makeNode(overrides: Record<string, unknown> = {}): SceneNode {
  return { id: "n1", name: "node", type: "RECTANGLE", ...overrides } as unknown as SceneNode;
}

/** Page with both-direction parent/children links, as the Figma tree has. */
function makePage(children: SceneNode[]): PageNode {
  const page = {
    type: "PAGE",
    name: "Page 1",
    parent: null,
    selection: [],
    children,
  } as unknown as PageNode;
  for (const child of children) {
    (child as unknown as Record<string, unknown>).parent = page;
  }
  return page;
}

function makeFrame(
  overrides: Record<string, unknown>,
  children: SceneNode[] = [],
): SceneNode {
  const frame = makeNode({ type: "FRAME", layoutMode: "VERTICAL", children, ...overrides });
  for (const child of children) {
    (child as unknown as Record<string, unknown>).parent = frame;
  }
  return frame;
}

/**
 * code.ts has import-time side effects (showUI, sendSelectionNote, figma.on,
 * assigning figma.ui.onmessage), so the stub must exist before the import and
 * the module must be re-evaluated per test. The assigned onmessage handler is
 * what the tests drive.
 */
async function loadPlugin(
  page: PageNode,
  variables: Variable[] = [],
  /** Overrides merged over the stub, for tests that break a Figma API. */
  figmaOverrides: Record<string, unknown> = {},
) {
  const posted: PluginMessage[] = [];
  const ui = {
    postMessage: (msg: PluginMessage) => posted.push(msg),
    onmessage: undefined as undefined | ((msg: PluginMessage) => unknown),
  };

  vi.stubGlobal("__html__", "<html></html>");
  vi.stubGlobal("figma", {
    showUI: () => {},
    on: () => {},
    ui,
    currentPage: page,
    mixed: Symbol("figma.mixed"),
    variables: {
      getLocalVariables: () => variables,
      getVariableById: (id: string) => variables.find((v) => v.id === id) ?? null,
    },
    getLocalTextStyles: () => [],
    getStyleById: (id: string) => ({ name: id }),
    ...figmaOverrides,
  });

  vi.resetModules();
  await import("../code");

  return {
    posted,
    send: async (msg: PluginMessage) => {
      await ui.onmessage!(msg);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("run-export", () => {
  it("blocks the export and posts no data when a check finds an error", async () => {
    // Auto-Layout-less frame with children = one structure error. The
    // Color-Style node is an exclusion, not an error — it must not affect this.
    // No trap here on purpose: with one, deleting the gate's `return` still
    // produced an export-error (from the trap) and no export-data, so the
    // assertions held and the test proved nothing about the gate.
    const title = makeNode({ id: "t", name: "Title", fillStyleId: "S:1" });
    const frame = makeFrame({ id: "f", name: "Home", layoutMode: "NONE" }, [title]);
    const { posted, send } = await loadPlugin(makePage([frame]));

    await send({ type: "run-export" });

    const errorMsg = posted.find((m) => m.type === "export-error");
    expect(errorMsg?.message).toBe("1 error(s) must be fixed before export");
    expect(posted.filter((m) => m.type === "export-data")).toHaveLength(0);
  });

  it("runs the exclusion scan only after the error gate has passed", async () => {
    // `trap` blows up the moment the exclusion scan touches it: if the scan
    // ran before the gate, the message would be "Export failed: ..." instead
    // of the error count.
    const trap = makeNode({ id: "x", name: "Trap" });
    Object.defineProperty(trap, "fillStyleId", {
      enumerable: true,
      get() {
        throw new Error("scanned before the error gate");
      },
    });
    const frame = makeFrame({ id: "f", name: "Home", layoutMode: "NONE" }, [trap]);
    const { posted, send } = await loadPlugin(makePage([frame]));

    await send({ type: "run-export" });

    expect(posted.find((m) => m.type === "export-error")?.message).toBe(
      "1 error(s) must be fixed before export",
    );
  });

  it("blocks the export on a sizing error, not just a structure error", async () => {
    const loose = makeNode({
      id: "s",
      name: "Loose",
      layoutSizingHorizontal: "SCALE",
      layoutSizingVertical: "FIXED",
    });
    const frame = makeFrame({ id: "f", name: "Home" }, [loose]);
    const { posted, send } = await loadPlugin(makePage([frame]));

    await send({ type: "run-export" });

    expect(posted.find((m) => m.type === "export-error")?.message).toBe(
      "1 error(s) must be fixed before export",
    );
    expect(posted.filter((m) => m.type === "export-data")).toHaveLength(0);
  });

  it("posts export-data once, carrying the exclusions for the README", async () => {
    const title = makeNode({ id: "t", name: "Title", fillStyleId: "S:1" });
    const frame = makeFrame({ id: "f", name: "Home" }, [title]);
    const { posted, send } = await loadPlugin(makePage([frame]));

    await send({ type: "run-export" });

    const data = posted.filter((m) => m.type === "export-data");
    expect(data).toHaveLength(1);
    expect(data[0].exclusions).toEqual({
      colorStyles: [
        { styleName: "S:1", examplePaths: ["Home > Title"], layerCount: 1 },
      ],
      stringBooleanVariables: [],
      bareRootComponents: [],
      tokenNameCollisions: [],
    });
  });

  it("scans the exported frames for node categories and the page root for bare Components", async () => {
    // Pins which node list reaches which part of the scan: a scan over all
    // page children would put the loose Banner and the Button's Label into the
    // Color Style list (neither appears in any zip folder), while a bare-
    // Component scan over the exported frames alone would drop Button.
    const title = makeNode({ id: "t", name: "Title", fillStyleId: "S:1" });
    const frame = makeFrame({ id: "f", name: "Home" }, [title]);
    const banner = makeNode({ id: "bn", name: "Banner", fillStyleId: "S:2" });
    const buttonLabel = makeNode({ id: "bl", name: "Label", fillStyleId: "S:3" });
    const button = makeFrame({ id: "b", name: "Button", type: "COMPONENT" }, [
      buttonLabel,
    ]);
    const { posted, send } = await loadPlugin(makePage([frame, banner, button]));

    await send({ type: "run-export" });

    const data = posted.find((m) => m.type === "export-data");
    expect(data?.exclusions).toEqual({
      colorStyles: [
        { styleName: "S:1", examplePaths: ["Home > Title"], layerCount: 1 },
      ],
      stringBooleanVariables: [],
      bareRootComponents: ["Button"],
      tokenNameCollisions: [],
    });
  });

  it("exports a page-root SECTION as a frame and scans inside it", async () => {
    // SECTION is an export unit alongside FRAME (design doc 4.7.4).
    const title = makeNode({ id: "t", name: "Title", fillStyleId: "S:1" });
    const section = makeFrame({ id: "s", name: "Band", type: "SECTION" }, [title]);
    const { posted, send } = await loadPlugin(makePage([section]));

    await send({ type: "run-export" });

    const data = posted.find((m) => m.type === "export-data");
    expect((data?.frames as { name: string }[]).map((f) => f.name)).toEqual(["Band"]);
    expect(data?.exclusions).toMatchObject({
      colorStyles: [
        { styleName: "S:1", examplePaths: ["Band > Title"], layerCount: 1 },
      ],
    });
  });

  it("does not let a non-error check result block the export", async () => {
    // The gate filters on level === "error" so that reintroducing a
    // non-blocking level (design doc 4.7.2) cannot silently promote it to a
    // blocker. CheckLevel is a one-member union today, hence the cast.
    vi.doMock("../checks/structureChecks", () => ({
      runStructureChecks: () => [
        {
          level: "suggestion",
          nodeId: "n",
          nodeName: "node",
          message: "advisory",
          suggestion: "advice",
        } as unknown as CheckResult,
      ],
    }));
    try {
      const frame = makeFrame({ id: "f", name: "Home" });
      const { posted, send } = await loadPlugin(makePage([frame]));

      await send({ type: "run-export" });

      expect(posted.filter((m) => m.type === "export-data")).toHaveLength(1);
      expect(posted.filter((m) => m.type === "export-error")).toHaveLength(0);
    } finally {
      vi.doUnmock("../checks/structureChecks");
    }
  });

  it("exports the page-root frames only, not every frame in the subtree", async () => {
    // Export units are page-root FRAME/SECTION (design doc 4.7.4). A scan over
    // the whole subtree would silently turn a nested frame into its own
    // top-level zip folder, duplicating it inside its parent's spec.json.
    const inner = makeFrame({ id: "i", name: "Inner" });
    const frame = makeFrame({ id: "f", name: "Home" }, [inner]);
    const { posted, send } = await loadPlugin(makePage([frame]));

    await send({ type: "run-export" });

    const data = posted.find((m) => m.type === "export-data");
    expect((data?.frames as { name: string }[]).map((f) => f.name)).toEqual(["Home"]);
  });

  it("still exports when the Variables API is unavailable", async () => {
    // fetchVariablesAndTextStyles runs inside the run-export try, so dropping
    // its own catch would silently turn "export anyway" into "Export failed".
    const frame = makeFrame({ id: "f", name: "Home" });
    const { posted, send } = await loadPlugin(makePage([frame]), [], {
      variables: {
        getLocalVariables: () => {
          throw new Error("no Variables API");
        },
        getVariableById: () => null,
      },
    });

    await send({ type: "run-export" });

    expect(posted.filter((m) => m.type === "export-error")).toHaveLength(0);
    const data = posted.find((m) => m.type === "export-data");
    expect((data?.exclusions as { tokenNameCollisions: unknown[] }).tokenNameCollisions)
      .toEqual([]);
  });

  it("still exports when the Text Styles API is unavailable", async () => {
    const frame = makeFrame({ id: "f", name: "Home" });
    const { posted, send } = await loadPlugin(makePage([frame]), [], {
      getLocalTextStyles: () => {
        throw new Error("no Text Styles API");
      },
    });

    await send({ type: "run-export" });

    expect(posted.filter((m) => m.type === "export-error")).toHaveLength(0);
    const data = posted.find((m) => m.type === "export-data");
    expect((data?.exclusions as { tokenNameCollisions: unknown[] }).tokenNameCollisions)
      .toEqual([]);
  });

  it("reports an export failure instead of leaving the UI stuck", async () => {
    // A throw anywhere in the export path (here: collecting nodes) must still
    // reach the UI — it only clears "Exporting..." on export-error/export-data.
    const frame = makeFrame({ id: "f", name: "Home" });
    const page = makePage([frame]);
    Object.defineProperty(page, "children", {
      get() {
        throw new Error("boom");
      },
    });
    const { posted, send } = await loadPlugin(page);

    await send({ type: "run-export" });

    expect(posted.find((m) => m.type === "export-error")?.message).toContain(
      "Export failed",
    );
  });
});

describe("run-checks", () => {
  it("reports no exclusion-category findings — Review is errors-only", async () => {
    const stringVar = { id: "v1", name: "copy/label", resolvedType: "STRING" } as unknown as Variable;
    const title = makeNode({ id: "t", name: "Title", fillStyleId: "S:1" });
    const label = makeNode({
      id: "l",
      name: "Label",
      boundVariables: { characters: { type: "VARIABLE_ALIAS", id: "v1" } },
    });
    const frame = makeFrame({ id: "f", name: "Home" }, [title, label]);
    const bareComponent = makeNode({ id: "b", name: "Button", type: "COMPONENT", children: [] });
    const { posted, send } = await loadPlugin(
      makePage([frame, bareComponent]),
      [stringVar],
    );

    await send({ type: "run-checks" });

    const results = posted.find((m) => m.type === "check-results")?.results;
    expect(results).toEqual([]);
  });

  it("reports the structure and sizing errors it does find, with their fix messages", async () => {
    // Without this, a handler that always posted [] would pass the suite.
    const loose = makeNode({
      id: "s",
      name: "Loose",
      layoutSizingHorizontal: "SCALE",
      layoutSizingVertical: "FIXED",
    });
    const frame = makeFrame({ id: "f", name: "Home", layoutMode: "NONE" }, [loose]);
    const { posted, send } = await loadPlugin(makePage([frame]));

    await send({ type: "run-checks" });

    const results = posted.find((m) => m.type === "check-results")
      ?.results as CheckResult[];
    expect(results).toEqual(
      expect.arrayContaining([
        {
          level: "error",
          nodeId: "f",
          nodeName: "Home",
          message: "Auto Layout未適用のフレーム",
          suggestion: "Auto Layoutを適用してください",
        },
        {
          level: "error",
          nodeId: "s",
          nodeName: "Loose",
          message: "横方向のサイジングが不明確（SCALE）",
          suggestion: "Hug/Fill/Fixedのいずれかに設定してください",
        },
      ]),
    );
    expect(results).toHaveLength(2);
  });

  it("reports a check failure instead of leaving the Review tab stuck", async () => {
    // The Review tab clears "Running..." on check-results or check-error only.
    const page = makePage([]);
    Object.defineProperty(page, "children", {
      get() {
        throw new Error("boom");
      },
    });
    const { posted, send } = await loadPlugin(page);

    await send({ type: "run-checks" });

    expect(posted.filter((m) => m.type === "check-results")).toHaveLength(0);
    expect(posted.find((m) => m.type === "check-error")?.message).toContain(
      "Review failed",
    );
  });
});
