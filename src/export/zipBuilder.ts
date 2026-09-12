import type JSZip from "jszip";
import type { ExportDataMessage, ExportFile } from "../messages";
import { buildReadme } from "./readmeBuilder";
import { resolveFrameFolderNames } from "./layerPath";

/**
 * Assemble the export zip from an `export-data` message (design doc 4.7.4
 * 「書き出し」の出力8点).
 *
 * Lives outside App.tsx so it is testable without a DOM: the hop from the
 * exclusion report into README.md is the step 4.3.4 depends on — a zip whose
 * README claims nothing was excluded while four categories were detected is
 * precisely the silent drop the design forbids, and inside a Solid component
 * nothing could assert against it. App.tsx keeps only the download.
 */
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
  // Primary viewport = the first frame's width (not whichever frame is last).
  const primaryWidth = data.frames[0]?.spec?.viewport?.width ?? 1440;
  // Same function the README's layer-path roots use (exclusions.ts), so the
  // folder a reader opens is spelled exactly like the path they were given.
  const frameNames = resolveFrameFolderNames(data.frames.map((f) => f.name));

  data.frames.forEach((frame, idx) => {
    const folder = root.folder(frameNames[idx])!;
    folder.file("spec.json", JSON.stringify(frame.spec, null, 2));
    addFilesToFolder(folder, frame.screenshots, frame.assets);
    allSections.push(...(frame.spec?.children ?? []));
  });

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
      frameNames,
      hasTokens: Boolean(data.tokens),
      // Not defaulted: a missing report must throw here (caught by the caller
      // and surfaced as an export error) rather than produce a README that
      // asserts nothing was excluded — design doc 4.3.4.
      exclusions: data.exclusions,
    }),
  );

  return zip;
}
