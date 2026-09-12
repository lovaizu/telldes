import { collectAllNodes } from "./checks/traversal";
import { runStructureChecks } from "./checks/structureChecks";
import { checkSizing } from "./checks/sizingChecks";
import { runScopeChecks } from "./checks/scopeChecks";
import type { CheckResult } from "./checks/types";
import { buildSpec } from "./export/specBuilder";
import { buildTokens } from "./export/tokensBuilder";
import { exportScreenshots } from "./export/screenshotExporter";
import { exportAssets } from "./export/assetExporter";

figma.showUI(__html__, { width: 360, height: 480 });

function getSelectedNote(): { nodeId: string; nodeName: string; note: string } | null {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1) return null;
  const node = sel[0];
  return {
    nodeId: node.id,
    nodeName: node.name,
    note: node.getPluginData("note"),
  };
}

function sendSelectionNote() {
  const data = getSelectedNote();
  figma.ui.postMessage({ type: "selection-note", data });
}

// Variables/Text Styles APIs may not be available in all Figma file types
// (e.g. some starter/free files) — swallow and fall back to empty so a check
// run or export never hard-fails just because this data is unavailable.
function fetchVariablesAndTextStyles(): { vars: Variable[]; textStyles: TextStyle[] } {
  let vars: Variable[] = [];
  try {
    vars = figma.variables.getLocalVariables();
  } catch {
    // Variables API may not be available
  }

  let textStyles: TextStyle[] = [];
  try {
    textStyles = figma.getLocalTextStyles();
  } catch {
    // Text Styles API may not be available
  }

  return { vars, textStyles };
}

// Review is errors-only (design doc 4.7.2) — every result here blocks Export.
// Scope/source exclusions are deliberately NOT part of this: they are not
// fixable violations, so they are collected at export time and recorded in the
// export README instead (scopeChecks.ts).
function runAllChecks(nodes: SceneNode[]): CheckResult[] {
  return [...runStructureChecks(nodes), ...checkSizing(nodes)];
}

sendSelectionNote();

figma.on("selectionchange", () => {
  sendSelectionNote();
});

figma.ui.onmessage = async (msg: { type: string; nodeId?: string; note?: string }) => {
  if (msg.type === "run-checks") {
    const results = runAllChecks(collectAllNodes(figma.currentPage));
    figma.ui.postMessage({ type: "check-results", results });
  }

  if (msg.type === "select-node" && msg.nodeId) {
    const node = figma.getNodeById(msg.nodeId);
    if (node && "type" in node) {
      const sceneNode = node as SceneNode;
      figma.currentPage.selection = [sceneNode];
      figma.viewport.scrollAndZoomIntoView([sceneNode]);
    }
  }

  if (msg.type === "save-note" && msg.nodeId && msg.note !== undefined) {
    const node = figma.getNodeById(msg.nodeId);
    if (node && "setPluginData" in node) {
      const sceneNode = node as SceneNode;
      sceneNode.setPluginData("note", msg.note);
      if (msg.note) {
        sceneNode.setRelaunchData({ editNote: "" });
      } else {
        sceneNode.setRelaunchData({});
      }
      figma.ui.postMessage({ type: "note-saved", nodeId: msg.nodeId });
    }
  }

  if (msg.type === "run-export") {
    const { vars, textStyles } = fetchVariablesAndTextStyles();
    const nodes = collectAllNodes(figma.currentPage);
    // Every check result is an error (CheckLevel is error-only), so the count
    // of results is the count of blockers — no level filter needed.
    const errors = runAllChecks(nodes);
    if (errors.length > 0) {
      figma.ui.postMessage({
        type: "export-error",
        message: `${errors.length} error(s) must be fixed before export`,
      });
      return;
    }

    // What this export leaves out, for the README (design doc 4.7.2/4.7.4).
    // Reuses the Variables/Text Styles already fetched above.
    const exclusions = runScopeChecks(nodes, vars, textStyles);

    try {
      const page = figma.currentPage;

      const tokens = buildTokens(vars, textStyles);

      const topFrames = page.children.filter(
        (n) => n.type === "FRAME" || n.type === "SECTION",
      );

      type ExportFile = { path: string; data: Uint8Array };
      const frames: {
        name: string;
        spec: object;
        screenshots: ExportFile[];
        assets: ExportFile[];
      }[] = [];

      for (const frame of topFrames) {
        const mockPage = {
          name: page.name,
          children: [frame],
        } as unknown as PageNode;
        const spec = buildSpec(mockPage);
        // Figma's postMessage structured-clones typed arrays; send the raw
        // Uint8Array rather than an 8x-larger number[].
        const screenshots = await exportScreenshots(frame);
        const assets = await exportAssets(frame);

        frames.push({
          name: frame.name,
          spec,
          screenshots,
          assets,
        });
      }

      figma.ui.postMessage({
        type: "export-data",
        frames,
        tokens,
        exclusions,
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "export-error",
        message: `Export failed: ${err}`,
      });
    }
  }
};
