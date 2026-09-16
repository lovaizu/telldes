import { describe, it, expect } from "vitest";
import {
  applyReviewOutcome,
  groupResultsByLevel,
  handlePluginMessage,
  reviewOutcome,
} from "../App";
import type { CheckResult } from "../checks/types";
import type { ExportDataMessage, PluginMessage, SelectionNote } from "../messages";
import { emptyExclusionReport } from "../export/exclusions";

// The Review tab shows one run's outcome. A DOM-free unit here is the only
// place it can be asserted: the rest of App.tsx needs a browser.

const error: CheckResult = {
  level: "error",
  nodeId: "n1",
  nodeName: "Home",
  message: "Auto Layout未適用のフレーム",
  suggestion: "Auto Layoutを適用してください",
};

describe("reviewOutcome", () => {
  it("shows the results of a run that finished", () => {
    expect(reviewOutcome({ type: "check-results", results: [error] })).toEqual({
      results: [error],
      hasRun: true,
      error: "",
    });
  });

  it("drops the previous run's results when the run failed", () => {
    // Otherwise the failure banner sits above a stale list that reads as this
    // run's findings — and the run produced none (design doc 4.7.2 実行失敗の扱い).
    expect(
      reviewOutcome({ type: "check-error", message: "Review failed: boom" }),
    ).toEqual({
      results: [],
      hasRun: false,
      error: "Review failed: boom",
    });
  });
});

// The step between `reviewOutcome` and the Review signals. Extracted so the
// wiring itself is assertable: with it inline in `window.onmessage`, dropping
// any one setter — or the `check-error` branch — changed nothing any test saw.

const stale: CheckResult = { ...error, nodeId: "old", nodeName: "Pricing" };

/** The four Review signals, as `applyReviewOutcome` leaves them. */
function applyTo(msg: Parameters<typeof applyReviewOutcome>[0]) {
  const state = {
    results: [stale] as CheckResult[],
    hasRun: true,
    checkError: "",
    running: true,
  };
  applyReviewOutcome(msg, {
    setResults: (value) => (state.results = value),
    setHasRun: (value) => (state.hasRun = value),
    setCheckError: (value) => (state.checkError = value),
    setRunning: (value) => (state.running = value),
  });
  return state;
}

describe("applyReviewOutcome", () => {
  it("replaces the previous run's results and clears Running on a finished run", () => {
    expect(applyTo({ type: "check-results", results: [error] })).toEqual({
      results: [error],
      hasRun: true,
      checkError: "",
      running: false,
    });
  });

  it("clears the results, the hasRun flag and Running on a failed run", () => {
    // Without the check-error branch the tab keeps "Running..." forever and
    // shows no reason (design doc 4.7.2 実行失敗の扱い).
    expect(applyTo({ type: "check-error", message: "Review failed: boom" })).toEqual({
      results: [],
      hasRun: false,
      checkError: "Review failed: boom",
      running: false,
    });
  });

  it("leaves the Review signals alone for a message meant for another tab", () => {
    expect(applyTo({ type: "note-saved", nodeId: "n1" })).toEqual({
      results: [stale],
      hasRun: true,
      checkError: "",
      running: true,
    });
  });
});

// `window.onmessage` itself, one step up: the branch per message type and the
// signals each one writes. Inline in the component, dropping a whole branch —
// or the `applyReviewOutcome` call that clears "Running..." — changed nothing
// any test saw.

const selected: SelectionNote = { nodeId: "n1", nodeName: "Home", note: "old" };

const exportData: ExportDataMessage = {
  type: "export-data",
  frames: [],
  tokens: null,
  exclusions: emptyExclusionReport(),
};

/** Every signal the handler writes, starting from a tab mid-use. */
function handle(msg: PluginMessage) {
  const state = {
    results: [stale] as CheckResult[],
    hasRun: true,
    checkError: "",
    running: true,
    selectionNote: selected as SelectionNote | null,
    noteText: "old",
    noteSaved: false,
    exportError: "",
    exporting: true,
    exported: [] as ExportDataMessage[],
  };
  handlePluginMessage(msg, {
    setResults: (value) => (state.results = value),
    setHasRun: (value) => (state.hasRun = value),
    setCheckError: (value) => (state.checkError = value),
    setRunning: (value) => (state.running = value),
    setSelectionNote: (value) => (state.selectionNote = value),
    setNoteText: (value) => (state.noteText = value),
    setNoteSaved: (value) => (state.noteSaved = value),
    setExportError: (value) => (state.exportError = value),
    setExporting: (value) => (state.exporting = value),
    selectedNodeId: () => state.selectionNote?.nodeId,
    startExport: (value) => state.exported.push(value),
  });
  return state;
}

describe("handlePluginMessage", () => {
  it("hands a finished Review run to the Review signals", () => {
    const state = handle({ type: "check-results", results: [error] });

    expect(state.results).toEqual([error]);
    expect(state.running).toBe(false);
  });

  it("clears Running when the Review run failed", () => {
    // Without this the tab sits on "Running..." for good (design doc 4.7.2).
    const state = handle({ type: "check-error", message: "Review failed: boom" });

    expect(state.checkError).toBe("Review failed: boom");
    expect(state.running).toBe(false);
  });

  it("shows the newly selected layer's note and drops the Saved mark", () => {
    const next: SelectionNote = { nodeId: "n2", nodeName: "Pricing", note: "hi" };

    const state = handle({ type: "selection-note", data: next });

    expect(state.selectionNote).toEqual(next);
    expect(state.noteText).toBe("hi");
    expect(state.noteSaved).toBe(false);
  });

  it("empties the note box when the selection is not a single layer", () => {
    const state = handle({ type: "selection-note", data: null });

    expect(state.selectionNote).toBeNull();
    expect(state.noteText).toBe("");
  });

  it("marks the note saved once the plugin acknowledges this layer", () => {
    const state = handle({ type: "note-saved", nodeId: selected.nodeId });

    expect(state.noteSaved).toBe(true);
  });

  it("ignores a late acknowledgement for a layer already navigated away from", () => {
    // Otherwise the note box for the layer now selected claims to be saved.
    const state = handle({ type: "note-saved", nodeId: "n-other" });

    expect(state.noteSaved).toBe(false);
  });

  it("shows why the export failed and clears Exporting", () => {
    const state = handle({ type: "export-error", message: "2 error(s)" });

    expect(state.exportError).toBe("2 error(s)");
    expect(state.exporting).toBe(false);
  });

  it("starts the zip build on export data, leaving Exporting to it", () => {
    // The zip is built asynchronously; the handler's part is getting there.
    const state = handle(exportData);

    expect(state.exported).toEqual([exportData]);
    expect(state.exporting).toBe(true);
  });

  it("leaves every other tab's signals alone for a Review message", () => {
    const state = handle({ type: "check-results", results: [error] });

    expect(state.selectionNote).toEqual(selected);
    expect(state.noteText).toBe("old");
    expect(state.exportError).toBe("");
    expect(state.exported).toEqual([]);
  });
});

describe("groupResultsByLevel", () => {
  it("groups the results so every one of them is under a heading", () => {
    expect(groupResultsByLevel([error, stale])).toEqual([
      { level: "error", items: [error, stale] },
    ]);
  });

  it("has no group at all when there is nothing to show", () => {
    expect(groupResultsByLevel([])).toEqual([]);
  });

  it("counts each group by what it lists, for a level Review does not emit yet", () => {
    // The panel renders one heading per group, so a result of a level the
    // component does not know about is still listed and still counted — it
    // cannot inflate the error heading or vanish (design doc 4.3.4).
    const advisory = { ...error, level: "suggestion" } as unknown as CheckResult;
    expect(groupResultsByLevel([error, advisory, stale])).toEqual([
      { level: "error", items: [error, stale] },
      { level: "suggestion", items: [advisory] },
    ]);
  });
});
