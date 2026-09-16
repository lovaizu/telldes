import { describe, it, expect } from "vitest";
import { reviewOutcome } from "../App";
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
