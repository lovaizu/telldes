// Review reports errors only (design doc 4.7.2): every check result blocks
// Export until it is fixed. Advisory results were removed — what the tool
// silently drops is recorded in the export README instead (see scopeChecks.ts).
export type CheckLevel = "error";

export interface CheckResult {
  level: CheckLevel;
  nodeId: string;
  nodeName: string;
  message: string;
  /** How to fix it — shown under the error in the Review list. */
  suggestion: string;
}
