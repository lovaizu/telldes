// The export zip, built from an `export-data` message (design doc 4.7.4 の出力
// 8点). Outside App.tsx so the report → README hop is assertable (4.3.4).
import type JSZip from "jszip";
import type { ExportDataMessage, ExportFile } from "../messages";
import { buildReadme, type ReadmeFrame } from "./readmeBuilder";

export interface ZipBuildInput {
  data: ExportDataMessage;
  promptTemplate: string;
  steeringTemplate: string;
}

function generateSectionTasks(sections: { name: string }[]): string {
  return (
    sections
      .map(
        (s) =>
          `- [ ] Code section: **${s.name}**\n  - [ ] Layout and structure\n  - [ ] Visual styles\n  - [ ] Assets and images\n  - [ ] Notes and interactions\n  - [ ] Compare with screenshot`,
      )
      .join("\n") || "- [ ] (no sections found)"
  );
}

function addFilesToFolder(
  folder: { file: (path: string, data: Uint8Array) => void },
  screenshots: ExportFile[],
  assets: ExportFile[],
): void {
  for (const ss of screenshots) folder.file(ss.path, ss.data);
  for (const asset of assets) folder.file(asset.path, asset.data);
}

/** Build the populated zip. The caller turns it into a blob and downloads it. */
export async function buildExportZip({
  data,
  promptTemplate,
  steeringTemplate,
}: ZipBuildInput): Promise<JSZip> {
  // Dynamic import so jszip stays out of the initial UI bundle.
  const { default: JSZipCtor } = await import("jszip");
  const zip = new JSZipCtor();
  const root = zip.folder("telldes-export")!;

  if (data.tokens) {
    root.file("tokens.json", JSON.stringify(data.tokens, null, 2));
  }

  const allSections: { name: string }[] = [];
  // What each folder ends up holding, so the Contents lines describe the zip.
  const readmeFrames: ReadmeFrame[] = [];
  // Primary viewport = the first frame's width (not whichever frame is last).
  const primaryWidth = data.frames[0]?.spec?.viewport?.width ?? 1440;

  for (const frame of data.frames) {
    // Folder name as code.ts decided it: deriving a second one here is what
    // let the folders and the README's layer paths drift (design doc 4.7.2).
    const folder = root.folder(frame.folderName)!;
    folder.file("spec.json", JSON.stringify(frame.spec, null, 2));
    addFilesToFolder(folder, frame.screenshots, frame.assets);
    readmeFrames.push({
      name: frame.name,
      folderName: frame.folderName,
      hasScreenshots: frame.screenshots.length > 0,
      hasAssets: frame.assets.length > 0,
    });
    allSections.push(...(frame.spec?.children ?? []));
  }

  const sectionTasks = generateSectionTasks(allSections);
  root.file(
    "prompt.md",
    promptTemplate.replace(/\{\{VIEWPORT_WIDTH\}\}/g, String(primaryWidth)),
  );
  root.file(
    "steering.md",
    steeringTemplate
      .replace(/\{\{VIEWPORT_WIDTH\}\}/g, String(primaryWidth))
      .replace(/\{\{SECTION_TASKS\}\}/g, sectionTasks),
  );
  root.file(
    "README.md",
    buildReadme({
      frames: readmeFrames,
      hasTokens: Boolean(data.tokens),
      // Not defaulted: a missing report must throw (and surface as an export
      // error) rather than claim nothing was excluded — design doc 4.3.4.
      exclusions: data.exclusions,
    }),
  );

  return zip;
}
