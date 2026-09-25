// Figma-side entry. It only opens the UI and routes messages to the read / write
// gateways; rendering and judgment live on the UI side.
import type { MainToUi, UiToMain } from "../shared/messages";
import { readFile } from "./read";

figma.showUI(__html__, { width: 360, height: 560, themeColors: true });

function post(message: MainToUi): void {
  figma.ui.postMessage(message);
}

figma.ui.onmessage = async (message: UiToMain) => {
  switch (message.type) {
    case "read":
      try {
        post({ type: "read-done", data: await readFile() });
      } catch (error) {
        post({ type: "read-failed", message: error instanceof Error ? error.message : String(error) });
      }
      return;
  }
};
