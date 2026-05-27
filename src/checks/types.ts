export type CheckLevel = "error" | "suggestion";

export interface CheckResult {
  level: CheckLevel;
  nodeId: string;
  nodeName: string;
  message: string;
  suggestion: string;
}
