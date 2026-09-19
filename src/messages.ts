import type { CheckResult } from "./checks/types";
import type { ExclusionReport } from "./export/exclusions";

// The plugin → UI message payloads. postMessage is `any` on both ends and the
// repo runs no `tsc` step, so these buy no build-time check — only code.ts and
// App.tsx reading one declaration instead of restating it. What is enforced is
// enforced at runtime, by the tests.

/** One file inside a frame folder, at its zip-relative path. */
export interface ExportFile {
  path: string;
  data: Uint8Array;
}

/** Everything the UI needs to build one frame's zip folder. */
export interface ExportFrame {
  /** Frame name as Figma spells it — what the README names the frame by. */
  name: string;
  /** The frame's zip folder name: sanitized and de-duplicated (4.5.2). */
  folderName: string;
  spec: { children?: { name: string }[]; viewport?: { width: number } };
  screenshots: ExportFile[];
  assets: ExportFile[];
}

export interface ExportDataMessage {
  type: "export-data";
  frames: ExportFrame[];
  tokens: unknown;
  // Required, not optional: a missing report would turn into a README
  // asserting that nothing was excluded (design doc 4.3.4).
  exclusions: ExclusionReport;
}

export interface CheckResultsMessage {
  type: "check-results";
  results: CheckResult[];
}

export interface CheckErrorMessage {
  type: "check-error";
  message: string;
}

/** The note the plugin read off the one selected layer (design doc 4.7.3). */
export interface SelectionNote {
  nodeId: string;
  nodeName: string;
  note: string;
}

export interface SelectionNoteMessage {
  type: "selection-note";
  /** `null` when the selection is not exactly one layer. */
  data: SelectionNote | null;
}

export interface NoteSavedMessage {
  type: "note-saved";
  nodeId: string;
}

/** The export could not finish, or was refused before it started. */
export interface ExportErrorMessage {
  type: "export-error";
  message: string;
}

/** Every message the UI can receive, so its handler can branch on one type. */
export type PluginMessage =
  | CheckResultsMessage
  | CheckErrorMessage
  | SelectionNoteMessage
  | NoteSavedMessage
  | ExportErrorMessage
  | ExportDataMessage;
