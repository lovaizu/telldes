import { collectAllNodes } from "./checks/traversal";
import { runStructureChecks } from "./checks/structureChecks";
import { checkSizing } from "./checks/sizingChecks";
import { collectExclusions } from "./export/exclusions";
import { folderNameOf, resolveExportScope } from "./export/exportScope";
import type { CheckResult } from "./checks/types";
import type {
  CheckErrorMessage,
  CheckResultsMessage,
  ExportDataMessage,
  ExportErrorMessage,
  ExportFrame,
  LayerNote,
  NoteSavedMessage,
  NotesListMessage,
  SelectionNote,
  SelectionNoteMessage,
  SetupDoneMessage,
  SetupErrorMessage,
} from "./messages";
import { layerPathOf } from "./export/layerPath";
import { buildSpec } from "./export/specBuilder";
import { buildTokens } from "./export/tokensBuilder";
import { exportScreenshots } from "./export/screenshotExporter";
import { exportAssets } from "./export/assetExporter";
import { createTokens } from "./setup/tokenFactory";

figma.showUI(__html__, { width: 360, height: 480 });

function getSelectedNote(): SelectionNote | null {
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
  const message: SelectionNoteMessage = { type: "selection-note", data };
  figma.ui.postMessage(message);
}

// The whole page, not the export scope: a note can sit on any layer, and one
// the list left out would read as a note the designer never wrote (4.7.3).
function collectNotes(page: PageNode): LayerNote[] {
  const notes: LayerNote[] = [];
  for (const node of collectAllNodes(page)) {
    const note = node.getPluginData("note");
    if (!note) continue;
    notes.push({
      nodeId: node.id,
      layerPath: layerPathOf(node, (ancestor) => ancestor.name),
      note,
    });
  }
  return notes;
}

// Contained: this runs at import time, before `figma.ui.onmessage` is
// assigned, so a throw in the scan would leave the plugin with no message
// handler at all — every tab dead because one list could not be built.
function sendNotesList() {
  try {
    const message: NotesListMessage = {
      type: "notes-list",
      notes: collectNotes(figma.currentPage),
    };
    figma.ui.postMessage(message);
  } catch {
    // Leave the list as the UI last had it rather than claim it is empty.
  }
}

// Variables/Text Styles APIs may not be available in all Figma file types
// (e.g. some starter/free files) — swallow and fall back to empty so the
// export never hard-fails just because this data is unavailable. Only the
// export path calls this: Review is errors-only and reads no token sources.
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
// export README instead (export/exclusions.ts).
function runAllChecks(nodes: SceneNode[]): CheckResult[] {
  return [...runStructureChecks(nodes), ...checkSizing(nodes)];
}

sendSelectionNote();
sendNotesList();

figma.on("selectionchange", () => {
  sendSelectionNote();
});

figma.ui.onmessage = async (msg: { type: string; nodeId?: string; note?: string }) => {
  if (msg.type === "run-checks") {
    // Same containment as run-export below: the Review tab only clears its
    // "Running..." flag on check-results / check-error, so a throw inside the
    // checks (a Figma API that rejects a node, a malformed tree) would pin the
    // tab on "Running..." with nothing to tell the user why.
    try {
      const results = runAllChecks(collectAllNodes(figma.currentPage));
      const message: CheckResultsMessage = { type: "check-results", results };
      figma.ui.postMessage(message);
    } catch (err) {
      const message: CheckErrorMessage = {
        type: "check-error",
        message: `Review failed: ${err}`,
      };
      figma.ui.postMessage(message);
    }
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
      const message: NoteSavedMessage = { type: "note-saved", nodeId: msg.nodeId };
      figma.ui.postMessage(message);
      sendNotesList();
    }
  }

  if (msg.type === "run-setup") {
    // Contained like run-export: a font that will not load must reach the UI
    // as a reason, not leave Setup looking like it never finished.
    try {
      const result = await createTokens();
      const message: SetupDoneMessage = { type: "setup-done", ...result };
      figma.ui.postMessage(message);
    } catch (err) {
      const message: SetupErrorMessage = {
        type: "setup-error",
        message: `Setup failed: ${err instanceof Error ? err.message : err}`,
      };
      figma.ui.postMessage(message);
    }
  }

  if (msg.type === "run-export") {
    // Everything from here on runs inside the try: a throw in the checks or in
    // the exclusion scan must still reach the UI as an `export-error`,
    // otherwise the Export tab stays pinned on "Exporting..." forever (the UI
    // only clears that flag on export-error / export-data).
    try {
      const page = figma.currentPage;
      const { vars, textStyles } = fetchVariablesAndTextStyles();

      // CheckLevel is error-only today, so this filter passes everything
      // through. It is a deliberate guard, not redundancy: if a non-blocking
      // level is ever reintroduced (design doc 4.7.2), the Export gate must
      // keep blocking on errors alone rather than silently promoting the new
      // level to a blocker. Do not remove.
      const errors = runAllChecks(collectAllNodes(page)).filter(
        (result) => result.level === "error",
      );
      if (errors.length > 0) {
        const message: ExportErrorMessage = {
          type: "export-error",
          message: `${errors.length} error(s) must be fixed before export`,
        };
        figma.ui.postMessage(message);
        return;
      }

      const tokens = buildTokens(vars, textStyles);

      // The export units and their names, decided once from the page-root
      // children (design doc 4.7.4/4.5.2). Everything below reads this one
      // value, so the zip folders, the README and the exclusion scan cannot
      // disagree about what is in the export or what it is called (4.7.2).
      const scope = resolveExportScope(page.children);

      // What this export leaves out, for the README (design doc 4.7.2/4.7.4).
      // Collected after the error gate, off the same scope, so every README
      // entry is reconcilable against the zip built from it.
      const exclusions = collectExclusions({
        scope,
        variables: vars,
        textStyles,
      });

      // Typed by the shared payload declaration rather than restated here: a
      // field added to ExportFrame and forgotten on this side must be a type
      // error, not an invisible omission laundered through a cast.
      const frames: ExportFrame[] = [];

      for (const frame of scope.frames) {
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
          // Throws rather than fall back: an unnamed frame would land its
          // spec.json in the export root (design doc 4.3.4, exportScope.ts).
          folderName: folderNameOf(scope, frame),
          name: frame.name,
          spec,
          screenshots,
          assets,
        });
      }

      // Shape declared once in messages.ts and read by App.tsx too, so the
      // two ends of postMessage are not restating the payload separately.
      const message: ExportDataMessage = {
        type: "export-data",
        frames,
        tokens,
        exclusions,
      };
      figma.ui.postMessage(message);
    } catch (err) {
      const message: ExportErrorMessage = {
        type: "export-error",
        message: `Export failed: ${err}`,
      };
      figma.ui.postMessage(message);
    }
  }
};
