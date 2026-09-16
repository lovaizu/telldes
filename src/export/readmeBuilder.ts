// README.md for the exported zip (design doc 4.7.4 output #8). Its "Not
// included in this export" section states what this export left out (4.7.2),
// facts only: a category with no detections produces no line at all.
import type { ExclusionReport } from "./exclusions";

export interface ReadmeFrame {
  /** Frame name as Figma spells it, so the designer can find it on the page. */
  name: string;
  /** Zip folder name, already sanitized and de-duplicated. */
  folderName: string;
  hasScreenshots: boolean;
  hasAssets: boolean;
}

export interface ReadmeInput {
  frames: ReadmeFrame[];
  hasTokens: boolean;
  exclusions: ExclusionReport;
}

/** Wording for a text node with several Color Styles at once (styleName null). */
const MIXED_COLOR_STYLE_LABEL = "multiple Color Styles on one text node";

// Contents line for one frame folder, listing only the files actually written:
// the README has to be reconcilable against the zip in hand (design doc 4.7.2).
function frameContentsLine({
  name,
  folderName,
  hasScreenshots,
  hasAssets,
}: ReadmeFrame): string {
  const parts = ["spec.json"];
  if (hasScreenshots) parts.push("screenshots");
  if (hasAssets) parts.push("assets");
  const last = parts[parts.length - 1];
  const listed =
    parts.length === 1
      ? last
      : parts.length === 2
        ? `${parts[0]} and ${last}`
        : `${parts.slice(0, -1).join(", ")}, and ${last}`;
  return `- \`${folderName}/\` — ${listed} for frame "${name}"`;
}

/** `- <lead>` followed by one indented `  - <item>` line per detection. */
function exclusionBullet(lead: string, items: string[]): string[] {
  if (items.length === 0) return [];
  return [`- ${lead}`, ...items.map((item) => `  - ${item}`)];
}

// One line per excluded style/variable, grouped per style rather than per layer
// (design doc 4.7.2 走査範囲). Two phrasings, so a line whose examples cover
// every layer does not imply there are more.
function usageLine(
  name: string | null,
  examplePaths: string[],
  layerCount: number,
): string {
  const label = name === null ? `(${MIXED_COLOR_STYLE_LABEL})` : `\`${name}\``;
  const paths = examplePaths.map((p) => `\`${p}\``).join(", ");
  const layers = `${layerCount} ${layerCount === 1 ? "layer" : "layers"}`;
  return layerCount > examplePaths.length
    ? `${label} — used on ${layers}, e.g. ${paths}`
    : `${label} — used on ${layers}: ${paths}`;
}

function exclusionLines(exclusions: ExclusionReport): string[] {
  return [
    ...exclusionBullet(
      "Color Styles are not exported as tokens — telldes sources colors from Variables only. Used on:",
      exclusions.colorStyles.map((usage) =>
        usageLine(usage.styleName, usage.examplePaths, usage.layerCount),
      ),
    ),
    ...exclusionBullet(
      "STRING/BOOLEAN Variables are not exported as tokens — only COLOR and FLOAT Variables become tokens. Used on:",
      exclusions.stringBooleanVariables.map((usage) =>
        usageLine(usage.variableName, usage.examplePaths, usage.layerCount),
      ),
    ),
    ...exclusionBullet(
      "Component/Component Set definitions placed directly on the page (outside any frame) are not exported at all. Move them into a frame as an instance, or onto a separate library page, to include them:",
      exclusions.bareRootComponents.map((path) => `\`${path}\``),
    ),
    ...exclusionBullet(
      "Token names collide in `tokens.json` — the Text Style is written last, so it overwrites the Variable. Rename one side to keep both:",
      exclusions.tokenNameCollisions.map(
        (c) => `\`${c.variableName}\` (Variable) vs \`${c.textStyleName}\` (Text Style)`,
      ),
    ),
  ];
}

export function buildReadme({
  frames,
  hasTokens,
  exclusions,
}: ReadmeInput): string {
  return [
    "# Telldes Export",
    "",
    "This zip was exported by the Telldes Figma plugin.",
    "",
    "## Contents",
    "",
    "- `prompt.md` — Coding instructions for Claude Code",
    "- `steering.md` — Pre-coding checklist, tasks, and rules",
    hasTokens ? "- `tokens.json` — Design tokens (W3C DTCG format)" : null,
    ...frames.map(frameContentsLine),
    "",
    "## Not included in this export",
    "",
    "- `prompt.md`, `steering.md`, and this `README.md` are generated from templates, not derived from design nodes — only `spec.json`, `screenshots/`, and `assets/` map 1:1 to Figma nodes.",
    ...exclusionLines(exclusions),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
