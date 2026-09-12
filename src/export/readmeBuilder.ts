import type { ExclusionReport } from "../checks/scopeChecks";

/**
 * README.md for the exported zip (design doc 4.7.4 output #8).
 *
 * Its "Not included in this export" section is the record of what telldes
 * dropped from *this* export: the design doc's 4.3.4 stance forbids silent
 * drops/skips, and Review reports errors only, so the exclusions detected at
 * export time (scopeChecks.ts) are reported here instead. A category with no
 * detections produces no output at all — the section states facts about this
 * export, not a checklist of things that might happen.
 */
export interface ReadmeInput {
  /** Zip folder name per exported frame, already de-duplicated. */
  frameNames: string[];
  hasTokens: boolean;
  exclusions: ExclusionReport;
}

/** An export with nothing excluded — also the fallback if the report is absent. */
export function emptyExclusionReport(): ExclusionReport {
  return {
    colorStyles: [],
    stringBooleanVariables: [],
    bareRootComponents: [],
    tokenNameCollisions: [],
  };
}

/** `- <lead>` followed by one indented `  - <item>` line per detection. */
function exclusionBullet(lead: string, items: string[]): string[] {
  if (items.length === 0) return [];
  return [`- ${lead}`, ...items.map((item) => `  - ${item}`)];
}

function exclusionLines(exclusions: ExclusionReport): string[] {
  return [
    ...exclusionBullet(
      "Color Styles are not exported as tokens — telldes sources colors from Variables only. Used on:",
      exclusions.colorStyles.map((path) => `\`${path}\``),
    ),
    ...exclusionBullet(
      "STRING/BOOLEAN Variables are not exported as tokens — only COLOR and FLOAT Variables become tokens. Used on:",
      exclusions.stringBooleanVariables.map(
        (usage) => `\`${usage.path}\` (Variable "${usage.variableName}")`,
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
