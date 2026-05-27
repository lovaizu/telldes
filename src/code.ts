import { collectAllNodes } from "./checks/traversal";
import { runStructureChecks } from "./checks/structureChecks";
import { checkSizing } from "./checks/sizingChecks";
import { runVariableChecks } from "./checks/variableChecks";
import type { CheckResult } from "./checks/types";

figma.showUI(__html__, { width: 360, height: 480 });

figma.ui.onmessage = (msg: { type: string; nodeId?: string }) => {
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
};
