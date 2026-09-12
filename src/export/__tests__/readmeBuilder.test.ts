import { describe, it, expect } from "vitest";
import { buildReadme, emptyExclusionReport } from "../readmeBuilder";
import type { ExclusionReport } from "../../checks/scopeChecks";

function makeExclusions(overrides: Partial<ExclusionReport> = {}): ExclusionReport {
  return { ...emptyExclusionReport(), ...overrides };
}

const base = {
  frameNames: ["Home"],
  hasTokens: true,
  exclusions: emptyExclusionReport(),
};

function excludedSection(readme: string): string {
  const idx = readme.indexOf("## Not included in this export");
  expect(idx).toBeGreaterThan(-1);
  return readme.slice(idx);
}

describe("buildReadme", () => {
  it("lists the contents, including tokens.json and one line per frame folder", () => {
    const readme = buildReadme({ ...base, frameNames: ["Home", "Pricing"] });
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
    expect(buildReadme({ ...base, hasTokens: false })).not.toContain("tokens.json");
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

  it("lists detected Color Style usage with layer paths", () => {
    const section = excludedSection(
      buildReadme({
        ...base,
        exclusions: makeExclusions({
          colorStyles: ["Home > Header > Title", "Home > Footer"],
        }),
      }),
    );
    expect(section).toContain("Color Style");
    expect(section).toContain("  - `Home > Header > Title`");
    expect(section).toContain("  - `Home > Footer`");
  });

  it("lists detected STRING/BOOLEAN Variable usage with layer path and Variable name", () => {
    const section = excludedSection(
      buildReadme({
        ...base,
        exclusions: makeExclusions({
          stringBooleanVariables: [
            { path: "Home > Card", variableName: "copy/label" },
          ],
        }),
      }),
    );
    expect(section).toContain("STRING/BOOLEAN Variables");
    expect(section).toContain('  - `Home > Card` (Variable "copy/label")');
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

  it("renders several categories at once and keeps the section last", () => {
    const readme = buildReadme({
      ...base,
      exclusions: makeExclusions({
        colorStyles: ["Home > Title"],
        bareRootComponents: ["Button"],
      }),
    });
    const section = excludedSection(readme);
    expect(section).toContain("  - `Home > Title`");
    expect(section).toContain("  - `Button`");
    expect(section).not.toContain("STRING/BOOLEAN");
    expect(readme.trimEnd().endsWith("`Button`")).toBe(true);
  });
});
