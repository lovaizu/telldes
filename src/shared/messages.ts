// Messages between the UI and the Figma side. Each direction is a discriminated
// union on `type`, so both ends must handle exactly the same set.
import type { FileData } from "./data";

/** UI → Figma side */
export type UiToMain = { type: "read" };

/** Figma side → UI */
export type MainToUi =
  | { type: "read-done"; data: FileData }
  | { type: "read-failed"; message: string };
