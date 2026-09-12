import type { ExclusionReport } from "./exclusions";

/**
 * README.md for the exported zip (design doc 4.7.4 output #8).
 *
 * Its "Not included in this export" section is the record of what telldes
 * dropped from *this* export: the design doc's 4.3.4 stance forbids silent
 * drops/skips, and Review reports errors only, so the exclusions detected at
 * export time (exclusions.ts) are reported here instead. A category with no
 * detections produces no output at all — the section states facts about this
 * export, not a checklist of things that might happen.
 */
export interface ReadmeInput {
  /** Zip folder name per exported frame, already de-duplicated. */
  frameNames: string[];
  hasTokens: boolean;
  exclusions: ExclusionReport;
}

/** `- <lead>` followed by one indented `  - <item>` line per detection. */
function exclusionBullet(lead: string, items: string[]): string[] {
  if (items.length === 0) return [];
  return [`- ${lead}`, ...items.map((item) => `  - ${item}`)];
}

/**
 * One line per excluded style/variable: what it is, how many layers use it,
 * and up to three of them by layer path so the designer can find one.
 *
 * Grouping is per style/variable rather than per layer (design doc 4.7.2
 * 走査範囲), so a component placed 40 times is one line, not 40. When the
 * count is fully covered by the examples the line must not imply there are
 * more, hence the two phrasings.
 */
function usageLine(name: string, examplePaths: string[], layerCount: number): string {
  const paths = examplePaths.map((p) => `\`${p}\``).join(", ");
  const layers = `${layerCount} ${layerCount === 1 ? "layer" : "layers"}`;
  return layerCount > examplePaths.length
    ? `\`${name}\` — used on ${layers}, e.g. ${paths}`
    : `\`${name}\` — used on ${layers}: ${paths}`;
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
  frameNames,
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
    ...frameNames.map(
      (n) => `- \`${n}/\` — spec.json, screenshots, and assets for frame "${n}"`,
    ),
    "",
    "## Not included in this export",
    "",
    "- `prompt.md`, `steering.md`, and this `README.md` are generated from templates, not derived from design nodes — only `spec.json`, `screenshots/`, and `assets/` map 1:1 to Figma nodes.",
    ...exclusionLines(exclusions),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
