import type { CheckResult } from "./checks/types";
import type { ExclusionReport } from "./export/exclusions";

/**
 * The plugin → UI message payloads, declared once.
 *
 * code.ts (Figma sandbox) and App.tsx (iframe) can only talk through
 * postMessage, whose signature is `any` on both ends, and the repo runs no
 * `tsc` step — so nothing here is enforced at build time. The point is that
 * the two sides read the *same* declaration instead of restating it, which is
 * what kept them in sync before: a field added on one side and forgotten on
 * the other is a one-file edit away from being visible.
 *
 * Runtime enforcement lives where it can actually fire: code.test.ts asserts
 * `export-data` carries `exclusions`, and buildReadme throws on a missing
 * report inside the handler's try, surfacing as an export error rather than a
 * README that falsely claims nothing was excluded (design doc 4.3.4).
 */

/** One file inside a frame folder, with its zip-relative path. */
export interface ExportFile {
  path: string;
  data: Uint8Array;
}

/** Everything the UI needs to build one frame's zip folder. */
export interface ExportFrame {
  /** Frame name as Figma spells it — what the README names the frame by. */
  name: string;
  /**
   * The frame's zip folder name: sanitized and de-duplicated (design doc
   * 4.5.2). Decided by code.ts in the same pass that roots the README's layer
   * paths, so the folder a reader opens and the paths they were given cannot
   * disagree (4.7.2).
   */
  folderName: string;
  spec: { children?: { name: string }[]; viewport?: { width: number } };
  screenshots: ExportFile[];
  assets: ExportFile[];
}

/** Payload of the `export-data` message: a whole export, ready to zip. */
export interface ExportDataMessage {
  type: "export-data";
  frames: ExportFrame[];
  tokens: unknown;
  /**
   * What this export left out — rendered into README.md (design doc 4.7.2).
   * Required, not optional: an optional field would turn "the plugin failed
   * to report" into a README asserting that nothing was excluded, exactly the
   * silent drop 4.3.4 forbids.
   */
  exclusions: ExclusionReport;
}

/** Payload of the `check-results` message: Review finished, with its findings. */
export interface CheckResultsMessage {
  type: "check-results";
  results: CheckResult[];
}

/**
 * Payload of the `check-error` message: Review could not finish.
 *
 * The Review tab clears its "Running..." flag on `check-results` or this — a
 * throw with no message would leave the tab pinned on "Running..." with
 * nothing to tell the user why (the same hazard `export-error` covers for the
 * export path).
 */
export interface CheckErrorMessage {
  type: "check-error";
  message: string;
}
