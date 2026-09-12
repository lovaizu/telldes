import { describe, it, expect, vi, afterEach } from "vitest";

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
async function loadPlugin(page: PageNode, variables: Variable[] = []) {
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
    const title = makeNode({ id: "t", name: "Title", fillStyleId: "S:1" });
    // `trap` blows up the moment the exclusion scan touches it, so a scan that
    // ran before the error gate would surface as "Export failed" instead.
    const trap = makeNode({ id: "x", name: "Trap" });
    Object.defineProperty(trap, "fillStyleId", {
      enumerable: true,
      get() {
        throw new Error("scanned before the error gate");
      },
    });
    const frame = makeFrame({ id: "f", name: "Home", layoutMode: "NONE" }, [title, trap]);
    const { posted, send } = await loadPlugin(makePage([frame]));

    await send({ type: "run-export" });

    const errorMsg = posted.find((m) => m.type === "export-error");
    expect(errorMsg?.message).toBe("1 error(s) must be fixed before export");
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
      colorStyles: ["Home > Title"],
      stringBooleanVariables: [],
      bareRootComponents: [],
      tokenNameCollisions: [],
    });
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
});
