import { describe, it, expect } from "vitest";
import { buildExportZip } from "../zipBuilder";
import { emptyExclusionReport, type ExclusionReport } from "../exclusions";
import type { ExportDataMessage } from "../../messages";

// The report → README hop. Inside the Solid component nothing could assert on
// it, so a zip whose README claimed nothing was excluded while four categories
// were detected would have shipped unnoticed — the silent drop design doc
// 4.3.4 forbids.

function makeData(overrides: Partial<ExportDataMessage> = {}): ExportDataMessage {
  return {
    type: "export-data",
    frames: [{ name: "Home", spec: { children: [] }, screenshots: [], assets: [] }],
    tokens: { color: {} },
    exclusions: emptyExclusionReport(),
    ...overrides,
  };
}

async function buildFiles(data: ExportDataMessage): Promise<Record<string, string>> {
  const zip = await buildExportZip({
    data,
    promptTemplate: "prompt {{VIEWPORT_WIDTH}}",
    steeringTemplate: "steering {{VIEWPORT_WIDTH}}\n{{SECTION_TASKS}}",
  });
  const out: Record<string, string> = {};
  const entries = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  for (const path of entries) {
    out[path] = await zip.files[path].async("string");
  }
  return out;
}

const detected: ExclusionReport = {
  colorStyles: [
    {
      styleName: "brand/primary",
      examplePaths: ["Home > Card > Icon"],
      layerCount: 10,
    },
  ],
  stringBooleanVariables: [
    { variableName: "copy/label", examplePaths: ["Home > Card"], layerCount: 2 },
  ],
  bareRootComponents: ["Button"],
  tokenNameCollisions: [
    { variableName: "typography/heading-md", textStyleName: "heading-md" },
  ],
};

describe("buildExportZip", () => {
  it("writes the eight documented outputs under telldes-export/", async () => {
    const files = await buildFiles(makeData());
    expect(Object.keys(files).sort()).toEqual([
      "telldes-export/Home/spec.json",
      "telldes-export/README.md",
      "telldes-export/prompt.md",
      "telldes-export/steering.md",
      "telldes-export/tokens.json",
    ]);
  });

  it("renders the real exclusion report into README.md, not an empty one", async () => {
    const files = await buildFiles(makeData({ exclusions: detected }));
    const readme = files["telldes-export/README.md"];
    expect(readme).toContain(
      "  - `brand/primary` — used on 10 layers, e.g. `Home > Card > Icon`",
    );
    expect(readme).toContain("  - `copy/label` — used on 2 layers, e.g. `Home > Card`");
    expect(readme).toContain("  - `Button`");
    expect(readme).toContain(
      "  - `typography/heading-md` (Variable) vs `heading-md` (Text Style)",
    );
  });

  it("omits the tokens.json Contents line and file when no tokens were produced", async () => {
    const files = await buildFiles(makeData({ tokens: null }));
    expect(files["telldes-export/tokens.json"]).toBeUndefined();
    const contents = files["telldes-export/README.md"].split(
      "## Not included in this export",
    )[0];
    expect(contents).not.toContain("tokens.json");
  });

  it("names the README frame folders exactly like the zip folders", async () => {
    const files = await buildFiles(
      makeData({
        frames: [
          { name: "Desktop / Home", spec: {}, screenshots: [], assets: [] },
          { name: "Desktop / Home", spec: {}, screenshots: [], assets: [] },
        ],
      }),
    );
    expect(files["telldes-export/Desktop - Home/spec.json"]).toBeDefined();
    expect(files["telldes-export/Desktop - Home-2/spec.json"]).toBeDefined();
    expect(files["telldes-export/README.md"]).toContain("- `Desktop - Home-2/`");
  });

  it("fails loudly rather than writing a README that claims nothing was excluded", async () => {
    const data = makeData();
    delete (data as Partial<ExportDataMessage>).exclusions;
    await expect(buildFiles(data)).rejects.toThrow();
  });

  it("fills the templates with the first frame's viewport width and its sections", async () => {
    const files = await buildFiles(
      makeData({
        frames: [
          {
            name: "Home",
            spec: { viewport: { width: 375 }, children: [{ name: "hero" }] },
            screenshots: [],
            assets: [],
          },
        ],
      }),
    );
    expect(files["telldes-export/prompt.md"]).toBe("prompt 375");
    expect(files["telldes-export/steering.md"]).toContain("Code section: **hero**");
  });
});
