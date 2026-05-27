import JSZip from "jszip";
import type { ScreenshotEntry } from "./screenshotExporter";
import type { AssetEntry } from "./assetExporter";

interface ZipInput {
  spec: object;
  tokens: object | null;
  screenshots: ScreenshotEntry[];
  assets: AssetEntry[];
  promptMd: string;
  steeringMd: string;
}

export async function buildZip(input: ZipInput): Promise<Uint8Array> {
  const zip = new JSZip();
  const root = zip.folder("telldes-export")!;

  root.file("prompt.md", input.promptMd);
  root.file("steering.md", input.steeringMd);
  root.file("spec.json", JSON.stringify(input.spec, null, 2));

  if (input.tokens) {
    root.file("tokens.json", JSON.stringify(input.tokens, null, 2));
  }

  for (const ss of input.screenshots) {
    root.file(ss.path, ss.data);
  }

  for (const asset of input.assets) {
    root.file(asset.path, asset.data);
  }

  return zip.generateAsync({ type: "uint8array" });
}
