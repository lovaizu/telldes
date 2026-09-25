// Messages between the UI and the Figma side. The UI sends a request with an
// `id`; the Figma side answers every request once, with the same `id`, in one
// envelope shape. Each request type is listed once in `Calls`.
import type { FileData } from "./data";

/** Request type → what the request carries besides `id` and `type`, and what it answers. */
export interface Calls {
  read: { params: Record<never, never>; result: FileData };
}

export type CallType = keyof Calls;

/** UI → Figma side */
export type Request = { [K in CallType]: { id: number; type: K } & Calls[K]["params"] }[CallType];

/** Figma side → UI */
export type Response =
  | { id: number; ok: true; result: Calls[CallType]["result"] }
  | { id: number; ok: false; error: string };
