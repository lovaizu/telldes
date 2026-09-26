// Request helper over the Figma plugin postMessage channel: each call gets an
// id, and the response with the same id settles its Promise.
import type { CallType, Calls, Request, Response } from "../shared/messages";
import { assertNever } from "../shared/never";

const pending = new Map<number, { resolve: (result: unknown) => void; reject: (error: Error) => void }>();
let lastId = 0;

window.addEventListener("message", (event: MessageEvent<{ pluginMessage?: Response } | null>) => {
  const response = event.data?.pluginMessage;
  if (!response) return;
  const call = pending.get(response.id);
  if (!call) return;
  pending.delete(response.id);
  switch (response.ok) {
    case true:
      call.resolve(response.result);
      return;
    case false:
      call.reject(new Error(response.error));
      return;
    default:
      assertNever(response);
  }
});

export function request<K extends CallType>(type: K, params: Calls[K]["params"]): Promise<Calls[K]["result"]> {
  const id = ++lastId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (result: unknown) => void, reject });
    parent.postMessage({ pluginMessage: { ...params, id, type } as Request }, "*");
  });
}
