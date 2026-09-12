// Review reports errors only (design doc 4.7.2): every check result blocks
// Export until it is fixed. Advisory results were removed — what the tool
// silently drops is recorded in the export README instead (export/exclusions.ts).
//
// `CheckLevel` and `CheckResult.level` are kept as a one-member union on
// purpose. Consumers (the Export gate in code.ts, the Review list in App.tsx)
// still filter on `level === "error"`, so reintroducing a non-blocking level
// here cannot silently promote it to a blocker.
export type CheckLevel = "error";

export interface CheckResult {
  level: CheckLevel;
  nodeId: string;
  nodeName: string;
  message: string;
  /** How to fix it — shown under the error in the Review list. */
  suggestion: string;
}
