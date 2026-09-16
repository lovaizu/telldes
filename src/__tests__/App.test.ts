import { describe, it, expect } from "vitest";
import { applyReviewOutcome, groupResultsByLevel, reviewOutcome } from "../App";
import type { CheckResult } from "../checks/types";

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
    expect(applyTo({ type: "export-data" })).toEqual({
      results: [stale],
      hasRun: true,
      checkError: "",
      running: true,
    });
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
