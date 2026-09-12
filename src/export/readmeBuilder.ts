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

/** One exported frame folder, as the Contents list needs to describe it. */
export interface ReadmeFrame {
  /** Zip folder name, already de-duplicated. */
  name: string;
  /** Whether `screenshots/` files were written into the folder. */
  hasScreenshots: boolean;
  /** Whether `assets/` files were written into the folder. */
  hasAssets: boolean;
}

export interface ReadmeInput {
  frames: ReadmeFrame[];
  hasTokens: boolean;
  exclusions: ExclusionReport;
}

/**
 * Wording for a text node whose characters carry several Color Styles at once
 * (`fillStyleId === figma.mixed`): there is no single style to name, so the
 * entry says so instead. Lives here rather than in the detection layer because
 * it is README prose, not a style name — exclusions.ts carries `null`.
 */
const MIXED_COLOR_STYLE_LABEL = "multiple Color Styles on one text node";

/**
 * Contents line for one frame folder. Only the files actually written are
 * listed: a childless frame yields a folder holding nothing but `spec.json`,
 * and the README is the one file whose job is to be reconcilable against the
 * zip the reader is holding (design doc 4.7.2).
 */
function frameContentsLine({ name, hasScreenshots, hasAssets }: ReadmeFrame): string {
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
  return `- \`${name}/\` — ${listed} for frame "${name}"`;
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
