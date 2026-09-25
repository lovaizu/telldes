// Figma-side entry. It only opens the UI and routes requests to the read / write
// gateways; rendering and judgment live on the UI side.
import type { Calls, Request, Response } from "../shared/messages";
import { assertNever } from "../shared/never";
import { readFile } from "./read";

figma.showUI(__html__, { width: 360, height: 560, themeColors: true });

figma.ui.onmessage = async (request: Request) => {
  let response: Response;
  try {
    response = { id: request.id, ok: true, result: await handle(request) };
  } catch (error) {
    response = { id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  figma.ui.postMessage(response);
};

function handle(request: Request): Promise<Calls[Request["type"]]["result"]> {
  switch (request.type) {
    case "read":
      return readFile();
    default:
      return assertNever(request.type);
  }
}
