import { describe, it, expect } from "vitest";
import { buildExportZip } from "../zipBuilder";
import { emptyExclusionReport, type ExclusionReport } from "../exclusions";
import type { ExportDataMessage } from "../../messages";

// The report → README hop. Inside the Solid component nothing could assert on
// it, so a zip whose README claimed nothing was excluded while four categories
// were detected would have shipped unnoticed — the silent drop design doc
// 4.3.4 forbids.

type Frame = ExportDataMessage["frames"][number];

/**
 * Frame payload with the fields every test varies. The folder name defaults to
 * the frame name, which is what code.ts stamps on when nothing needs
 * sanitizing or a `-N` suffix.
 */
function makeFrame(overrides: Partial<Frame> = {}): Frame {
  const name = overrides.name ?? "Home";
  return {
    name,
    folderName: name,
    spec: { children: [] },
    screenshots: [],
    assets: [],
    ...overrides,
  };
}

function makeData(overrides: Partial<ExportDataMessage> = {}): ExportDataMessage {
  return {
    type: "export-data",
    frames: [makeFrame()],
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

  it("writes each frame into the folder name the message carries", async () => {
    // The folder name is decided once, in code.ts, alongside the layer-path
    // roots the README quotes; deriving a second one here is what let the two
    // drift (design doc 4.7.2).
    const files = await buildFiles(
      makeData({
        frames: [
          makeFrame({ name: "Desktop / Home", folderName: "Desktop - Home" }),
          makeFrame({ name: "Desktop / Home", folderName: "Desktop - Home-2" }),
        ],
      }),
    );
    expect(files["telldes-export/Desktop - Home/spec.json"]).toBeDefined();
    expect(files["telldes-export/Desktop - Home-2/spec.json"]).toBeDefined();
    expect(files["telldes-export/README.md"]).toContain("- `Desktop - Home-2/`");
  });

  it("names the frame in README as Figma spells it, not as the folder does", async () => {
    // `Desktop / Home` has no folder-legal spelling, so the Contents line used
    // to point the designer at a frame name that exists nowhere on the page.
    const files = await buildFiles(
      makeData({
        frames: [makeFrame({ name: "Desktop / Home", folderName: "Desktop - Home" })],
      }),
    );
    expect(files["telldes-export/README.md"]).toContain(
      '- `Desktop - Home/` — spec.json for frame "Desktop / Home"',
    );
  });

  it("still writes the four root files when the page has no exportable frame", async () => {
    // Nothing to fold over: the export must still produce a readable zip
    // rather than throw on an empty frame list.
    const files = await buildFiles(makeData({ frames: [] }));
    expect(Object.keys(files).sort()).toEqual([
      "telldes-export/README.md",
      "telldes-export/prompt.md",
      "telldes-export/steering.md",
      "telldes-export/tokens.json",
    ]);
    expect(files["telldes-export/README.md"]).not.toContain("for frame");
    expect(files["telldes-export/prompt.md"]).toBe("prompt 1440");
    expect(files["telldes-export/steering.md"]).toContain("- [ ] (no sections found)");
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
          makeFrame({ spec: { viewport: { width: 375 }, children: [{ name: "hero" }] } }),
        ],
      }),
    );
    expect(files["telldes-export/prompt.md"]).toBe("prompt 375");
    expect(files["telldes-export/steering.md"]).toContain("Code section: **hero**");
  });

  it("takes the primary viewport from the first frame, not the last", async () => {
    // prompt.md tells Claude Code which viewport to code against; the frame
    // order on the page is the designer's statement of which one is primary.
    const files = await buildFiles(
      makeData({
        frames: [
          makeFrame({ name: "Mobile", spec: { viewport: { width: 375 } } }),
          makeFrame({ name: "Desktop", spec: { viewport: { width: 1440 } } }),
        ],
      }),
    );
    expect(files["telldes-export/prompt.md"]).toBe("prompt 375");
    expect(files["telldes-export/steering.md"]).toContain("steering 375");
  });

  it("writes each frame's screenshots and assets into its own folder", async () => {
    // The step that turns exported bytes into zip entries. Everything else
    // here passes empty lists, so without this the whole path is unexercised.
    const hero = new Uint8Array([137, 80, 78, 71]);
    const icon = new Uint8Array([60, 115, 118, 103]);
    const zip = await buildExportZip({
      data: makeData({
        frames: [
          makeFrame({
            screenshots: [{ path: "screenshots/hero.png", data: hero }],
            assets: [{ path: "assets/icons/x.svg", data: icon }],
          }),
        ],
      }),
      promptTemplate: "prompt {{VIEWPORT_WIDTH}}",
      steeringTemplate: "steering {{SECTION_TASKS}}",
    });

    const shot = zip.files["telldes-export/Home/screenshots/hero.png"];
    const asset = zip.files["telldes-export/Home/assets/icons/x.svg"];
    expect(shot).toBeDefined();
    expect(asset).toBeDefined();
    expect(await shot.async("uint8array")).toEqual(hero);
    expect(await asset.async("uint8array")).toEqual(icon);
  });

  it("describes each folder by what it actually holds", async () => {
    // A childless frame yields a folder with nothing but spec.json; the
    // Contents list must not promise screenshots and assets that aren't there.
    const files = await buildFiles(
      makeData({
        frames: [
          makeFrame({
            name: "Home",
            screenshots: [{ path: "screenshots/hero.png", data: new Uint8Array([1]) }],
            assets: [{ path: "assets/x.svg", data: new Uint8Array([2]) }],
          }),
          makeFrame({ name: "Bare" }),
        ],
      }),
    );
    const readme = files["telldes-export/README.md"];
    expect(readme).toContain(
      '- `Home/` — spec.json, screenshots, and assets for frame "Home"',
    );
    expect(readme).toContain('- `Bare/` — spec.json for frame "Bare"');
  });

  it("collects section tasks from every frame, not just the first", async () => {
    const files = await buildFiles(
      makeData({
        frames: [
          makeFrame({ name: "Home", spec: { children: [{ name: "hero" }] } }),
          makeFrame({ name: "Pricing", spec: { children: [{ name: "footer" }] } }),
        ],
      }),
    );
    const steering = files["telldes-export/steering.md"];
    expect(steering).toContain("Code section: **hero**");
    expect(steering).toContain("Code section: **footer**");
  });

  it("fails loudly rather than folding two frames into one folder", async () => {
    // JSZip merges same-named folders, so the second spec.json would overwrite
    // the first while the README listed the folder twice. code.ts keeps the
    // names unique; nothing else would notice if it stopped (design doc 4.3.4).
    const data = makeData({
      frames: [
        makeFrame({ name: "Home", folderName: "Home" }),
        makeFrame({ name: "Home (copy)", folderName: "Home" }),
      ],
    });
    await expect(buildFiles(data)).rejects.toThrow(/Home/);
  });

  it("writes a nameless frame under the fallback folder, naming it as Figma does", async () => {
    // An unnamed frame gets the `frame` folder (design doc 4.5.2), and the
    // Contents line still quotes the raw name — here, the empty string.
    const files = await buildFiles(
      makeData({ frames: [makeFrame({ name: "", folderName: "frame" })] }),
    );
    expect(files["telldes-export/frame/spec.json"]).toBeDefined();
    expect(files["telldes-export/README.md"]).toContain(
      '- `frame/` — spec.json for frame ""',
    );
  });

  it("says so explicitly when no frame yielded a section", async () => {
    const files = await buildFiles(makeData({ frames: [makeFrame()] }));
    expect(files["telldes-export/steering.md"]).toContain("- [ ] (no sections found)");
  });
});
