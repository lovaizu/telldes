import { describe, it, expect } from "vitest";
import { buildReadme, type ReadmeFrame } from "../readmeBuilder";
import { emptyExclusionReport, type ExclusionReport } from "../exclusions";

function makeExclusions(overrides: Partial<ExclusionReport> = {}): ExclusionReport {
  return { ...emptyExclusionReport(), ...overrides };
}

/** A frame folder holding all three of spec.json, screenshots and assets. */
function makeFrame(name: string, overrides: Partial<ReadmeFrame> = {}): ReadmeFrame {
  return { name, hasScreenshots: true, hasAssets: true, ...overrides };
}

const base = {
  frames: [makeFrame("Home")],
  hasTokens: true,
  exclusions: emptyExclusionReport(),
};

function excludedSection(readme: string): string {
  const idx = readme.indexOf("## Not included in this export");
  expect(idx).toBeGreaterThan(-1);
  return readme.slice(idx);
}

function contentsSection(readme: string): string {
  const start = readme.indexOf("## Contents");
  expect(start).toBeGreaterThan(-1);
  return readme.slice(start, readme.indexOf("## Not included in this export"));
}

describe("buildReadme", () => {
  it("lists the contents, including tokens.json and one line per frame folder", () => {
    const readme = buildReadme({
      ...base,
      frames: [makeFrame("Home"), makeFrame("Pricing")],
    });
    expect(readme).toContain("# Telldes Export");
    expect(readme).toContain("- `tokens.json` — Design tokens (W3C DTCG format)");
    expect(readme).toContain(
      '- `Home/` — spec.json, screenshots, and assets for frame "Home"',
    );
    expect(readme).toContain(
      '- `Pricing/` — spec.json, screenshots, and assets for frame "Pricing"',
    );
  });

  it("omits the tokens.json line when no tokens were produced", () => {
    // Scoped to Contents: the token-collision bullet legitimately mentions
    // `tokens.json`, so a whole-document assertion would false-fail as soon as
    // a collision is present.
    expect(contentsSection(buildReadme({ ...base, hasTokens: false }))).not.toContain(
      "tokens.json",
    );
  });

  it("lists no frame folders when the page has no exportable frames", () => {
    const readme = buildReadme({ ...base, frames: [] });
    expect(contentsSection(readme)).not.toContain("spec.json, screenshots");
    expect(contentsSection(readme)).toContain("- `prompt.md`");
  });

  it("names only the files a frame folder actually holds", () => {
    // A childless frame produces neither screenshots nor assets, and the
    // Contents list is the one place a reader reconciles README against zip
    // (design doc 4.7.2) — promising folders that aren't there breaks that.
    const readme = buildReadme({
      ...base,
      frames: [makeFrame("Bare", { hasScreenshots: false, hasAssets: false })],
    });
    expect(contentsSection(readme)).toContain(
      '- `Bare/` — spec.json for frame "Bare"',
    );
  });

  it("lists spec.json and screenshots for a frame that produced no assets", () => {
    const readme = buildReadme({
      ...base,
      frames: [makeFrame("Home", { hasAssets: false })],
    });
    expect(contentsSection(readme)).toContain(
      '- `Home/` — spec.json and screenshots for frame "Home"',
    );
  });

  it("lists all three when the folder holds screenshots and assets", () => {
    expect(contentsSection(buildReadme(base))).toContain(
      '- `Home/` — spec.json, screenshots, and assets for frame "Home"',
    );
  });

  it("names a mixed-Color-Style text node by what it is, not by a style name", () => {
    // `fillStyleId === figma.mixed` resolves to no single style, so the
    // detection layer carries `null` and the wording lives here.
    const section = excludedSection(
      buildReadme({
        ...base,
        exclusions: makeExclusions({
          colorStyles: [
            { styleName: null, examplePaths: ["Home > Label"], layerCount: 1 },
          ],
        }),
      }),
    );
    expect(section).toContain(
      "  - (multiple Color Styles on one text node) — used on 1 layer: `Home > Label`",
    );
  });

  it("always states that the template files are not derived from design nodes", () => {
    expect(excludedSection(buildReadme(base))).toContain("generated from templates");
  });

  it("omits every exclusion category when nothing was detected", () => {
    const section = excludedSection(buildReadme(base));
    expect(section).not.toContain("Color Style");
    expect(section).not.toContain("STRING/BOOLEAN");
    expect(section).not.toContain("Component/Component Set");
    expect(section).not.toContain("Token name");
  });

  it("lists each detected Color Style once, with its layer count and examples", () => {
    const section = excludedSection(
      buildReadme({
        ...base,
        exclusions: makeExclusions({
          colorStyles: [
            {
              styleName: "brand/primary",
              examplePaths: ["Home > Card > Icon", "Home > Card-2 > Icon"],
              layerCount: 10,
            },
          ],
        }),
      }),
    );
    expect(section).toContain("Color Style");
    expect(section).toContain(
      "  - `brand/primary` — used on 10 layers, e.g. `Home > Card > Icon`, `Home > Card-2 > Icon`",
    );
  });

  it("does not imply there are more layers when the examples cover them all", () => {
    const section = excludedSection(
      buildReadme({
        ...base,
        exclusions: makeExclusions({
          colorStyles: [
            {
              styleName: "brand/primary",
              examplePaths: ["Home > Title", "Home > Footer"],
              layerCount: 2,
            },
          ],
        }),
      }),
    );
    expect(section).toContain(
      "  - `brand/primary` — used on 2 layers: `Home > Title`, `Home > Footer`",
    );
    expect(section).not.toContain("e.g.");
  });

  it("uses the singular for a style used on exactly one layer", () => {
    const section = excludedSection(
      buildReadme({
        ...base,
        exclusions: makeExclusions({
          colorStyles: [
            { styleName: "brand/primary", examplePaths: ["Home > Title"], layerCount: 1 },
          ],
        }),
      }),
    );
    expect(section).toContain("  - `brand/primary` — used on 1 layer: `Home > Title`");
  });

  it("lists detected STRING/BOOLEAN Variable usage by Variable, with examples", () => {
    const section = excludedSection(
      buildReadme({
        ...base,
        exclusions: makeExclusions({
          stringBooleanVariables: [
            {
              variableName: "copy/label",
              examplePaths: ["Home > Card", "Home > Card-2"],
              layerCount: 7,
            },
          ],
        }),
      }),
    );
    expect(section).toContain("STRING/BOOLEAN Variables");
    expect(section).toContain(
      "  - `copy/label` — used on 7 layers, e.g. `Home > Card`, `Home > Card-2`",
    );
  });

  it("lists bare page-root Components with layer paths", () => {
    const section = excludedSection(
      buildReadme({
        ...base,
        exclusions: makeExclusions({ bareRootComponents: ["Button"] }),
      }),
    );
    expect(section).toContain(
      "Component/Component Set definitions placed directly on the page",
    );
    expect(section).toContain("  - `Button`");
    // The old copy claimed Review flags these as a suggestion — no longer true.
    expect(section).not.toContain("suggestion");
  });

  it("lists token name collisions by token name, not layer path", () => {
    const section = excludedSection(
      buildReadme({
        ...base,
        exclusions: makeExclusions({
          tokenNameCollisions: [
            { variableName: "typography/heading-md", textStyleName: "heading-md" },
          ],
        }),
      }),
    );
    expect(section).toContain("`tokens.json`");
    expect(section).toContain(
      "  - `typography/heading-md` (Variable) vs `heading-md` (Text Style)",
    );
  });

  it("renders all four categories at once, in a stable order", () => {
    const section = excludedSection(
      buildReadme({
        ...base,
        exclusions: {
          colorStyles: [
            { styleName: "brand/primary", examplePaths: ["Home > Title"], layerCount: 1 },
          ],
          stringBooleanVariables: [
            { variableName: "copy/label", examplePaths: ["Home > Card"], layerCount: 1 },
          ],
          bareRootComponents: ["Button"],
          tokenNameCollisions: [
            { variableName: "typography/heading-md", textStyleName: "heading-md" },
          ],
        },
      }),
    );
    const order = [
      "Color Styles are not exported",
      "STRING/BOOLEAN Variables are not exported",
      "Component/Component Set definitions placed directly on the page",
      "Token names collide in `tokens.json`",
    ].map((lead) => section.indexOf(lead));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(section).toContain("  - `brand/primary` — used on 1 layer: `Home > Title`");
    expect(section).toContain("  - `copy/label` — used on 1 layer: `Home > Card`");
    expect(section).toContain("  - `Button`");
    expect(section).toContain(
      "  - `typography/heading-md` (Variable) vs `heading-md` (Text Style)",
    );
  });

  it("renders several categories at once and keeps the section last", () => {
    const readme = buildReadme({
      ...base,
      exclusions: makeExclusions({
        colorStyles: [
          { styleName: "brand/primary", examplePaths: ["Home > Title"], layerCount: 1 },
        ],
        bareRootComponents: ["Button"],
      }),
    });
    const section = excludedSection(readme);
    expect(section).toContain("  - `brand/primary` — used on 1 layer: `Home > Title`");
    expect(section).toContain("  - `Button`");
    expect(section).not.toContain("STRING/BOOLEAN");
    expect(readme.trimEnd().endsWith("`Button`")).toBe(true);
  });
});
