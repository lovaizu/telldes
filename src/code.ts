import { collectAllNodes } from "./checks/traversal";
import { runStructureChecks } from "./checks/structureChecks";
import { checkSizing } from "./checks/sizingChecks";
import { runVariableChecks } from "./checks/variableChecks";
import type { CheckResult } from "./checks/types";

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

sendSelectionNote();

figma.on("selectionchange", () => {
  sendSelectionNote();
});

figma.ui.onmessage = (msg: { type: string; nodeId?: string; note?: string }) => {
  if (msg.type === "run-checks") {
    const page = figma.currentPage;
    const nodes = collectAllNodes(page);
    const results: CheckResult[] = [
      ...runStructureChecks(nodes),
      ...checkSizing(nodes),
      ...runVariableChecks(nodes),
    ];
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

  if (msg.type === "get-note") {
    sendSelectionNote();
  }
};
