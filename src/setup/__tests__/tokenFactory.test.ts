import { describe, it, expect, vi, afterEach } from "vitest";
import {
  COLLECTIONS,
  EFFECT_STYLES,
  TEXT_STYLES,
  createTokens,
  webCodeSyntax,
} from "../tokenFactory";

// In-memory stand-in for the parts of the Figma Plugin API Setup calls. It
// keeps what a real file would keep (collections, variables, styles), so a
// second run sees the first run's output.

interface FakeVariable {
  id: string;
  name: string;
  resolvedType: string;
  variableCollectionId: string;
  valuesByMode: Record<string, unknown>;
  scopes: string[];
  codeSyntax: Record<string, string>;
  setValueForMode(modeId: string, value: unknown): void;
  setVariableCodeSyntax(platform: string, value: string): void;
}

interface FakeCollection {
  id: string;
  name: string;
  modes: { modeId: string; name: string }[];
  variableIds: string[];
}

interface FakeTextStyle {
  name: string;
  fontName?: FontName;
  fontSize?: number;
  lineHeight?: unknown;
  letterSpacing?: unknown;
  boundVariables: Record<string, { type: string; id: string }>;
  setBoundVariable(field: string, variable: FakeVariable): void;
}

interface FakeEffectStyle {
  name: string;
  effects: (Effect & { boundVariables?: Record<string, { id: string }> })[];
}

function makeFakeFile(options: { unloadableFonts?: string[] } = {}) {
  const collections: FakeCollection[] = [];
  const variables = new Map<string, FakeVariable>();
  const textStyles: FakeTextStyle[] = [];
  const effectStyles: FakeEffectStyle[] = [];
  const loadedFonts: FontName[] = [];
  let nextId = 0;

  function addCollection(name: string): FakeCollection {
    const c: FakeCollection = {
      id: `C:${nextId++}`,
      name,
      modes: [{ modeId: `M:${nextId++}`, name: "Mode 1" }],
      variableIds: [],
    };
    collections.push(c);
    return c;
  }

  function addVariable(name: string, collection: FakeCollection, resolvedType: string): FakeVariable {
    const v: FakeVariable = {
      id: `V:${nextId++}`,
      name,
      resolvedType,
      variableCollectionId: collection.id,
      valuesByMode: {},
      // Figma's default for a new variable (confirmed on device, W-1).
      scopes: ["ALL_SCOPES"],
      codeSyntax: {},
      setValueForMode(modeId, value) {
        this.valuesByMode[modeId] = value;
      },
      setVariableCodeSyntax(platform, value) {
        this.codeSyntax[platform] = value;
      },
    };
    variables.set(v.id, v);
    collection.variableIds.push(v.id);
    return v;
  }

  const api = {
    variables: {
      getLocalVariableCollectionsAsync: async () => [...collections],
      getVariableByIdAsync: async (id: string) => variables.get(id) ?? null,
      createVariableCollection: (name: string) => addCollection(name),
      createVariable: addVariable,
      setBoundVariableForEffect: (effect: Effect, field: string, v: FakeVariable) => ({
        ...effect,
        boundVariables: { [field]: { type: "VARIABLE_ALIAS", id: v.id } },
      }),
    },
    getLocalTextStylesAsync: async () => [...textStyles],
    getLocalEffectStylesAsync: async () => [...effectStyles],
    loadFontAsync: async (font: FontName) => {
      if (options.unloadableFonts?.includes(font.family)) {
        throw new Error(`font not found`);
      }
      loadedFonts.push(font);
    },
    createTextStyle: () => {
      const s: FakeTextStyle = {
        name: "",
        boundVariables: {},
        setBoundVariable(field, v) {
          this.boundVariables[field] = { type: "VARIABLE_ALIAS", id: v.id };
        },
      };
      textStyles.push(s);
      return s;
    },
    createEffectStyle: () => {
      const s: FakeEffectStyle = { name: "", effects: [] };
      effectStyles.push(s);
      return s;
    },
  };

  function varsIn(collectionName: string): FakeVariable[] {
    const c = collections.find((x) => x.name === collectionName);
    return c ? c.variableIds.map((id) => variables.get(id)!) : [];
  }

  function find(collectionName: string, name: string): FakeVariable {
    const v = varsIn(collectionName).find((x) => x.name === name);
    if (!v) throw new Error(`no ${collectionName}/${name}`);
    return v;
  }

  return { api, collections, variables, textStyles, effectStyles, loadedFonts, addCollection, addVariable, varsIn, find };
}

function install(file: ReturnType<typeof makeFakeFile>) {
  vi.stubGlobal("figma", file.api);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const LIGHT_SCOPES: Record<string, string[]> = {
  bg: ["FRAME_FILL", "SHAPE_FILL"],
  surface: ["FRAME_FILL", "SHAPE_FILL"],
  "primary/default": ["FRAME_FILL", "SHAPE_FILL"],
  "primary/hover": ["FRAME_FILL", "SHAPE_FILL"],
  "code/bg": ["FRAME_FILL", "SHAPE_FILL"],
  "notice/bg": ["FRAME_FILL", "SHAPE_FILL"],
  "fg/default": ["TEXT_FILL"],
  "fg/muted": ["TEXT_FILL"],
  "primary/on": ["TEXT_FILL"],
  link: ["TEXT_FILL"],
  "code/fg": ["TEXT_FILL"],
  "notice/fg": ["TEXT_FILL"],
  border: ["STROKE_COLOR"],
  shadow: ["EFFECT_COLOR"],
};

describe("token set constants", () => {
  it("holds 44 variables and 11 styles, as design doc 4.3.4 counts them", () => {
    const counts = Object.fromEntries(COLLECTIONS.map((c) => [c.name, c.variables.length]));
    expect(counts).toEqual({ Light: 14, Dark: 14, Base: 16 });
    expect(TEXT_STYLES).toHaveLength(9);
    expect(EFFECT_STYLES).toHaveLength(2);
  });

  it("gives Light and Dark the same color names", () => {
    const [light, dark] = COLLECTIONS;
    expect(dark.variables.map((v) => v.name)).toEqual(light.variables.map((v) => v.name));
  });

  it("gives adjacent steps visibly different placeholder values", () => {
    for (const c of COLLECTIONS) {
      for (const prefix of ["spacing/", "radius/"]) {
        const values = c.variables.filter((v) => v.name.startsWith(prefix)).map((v) => v.value as number);
        for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    }
    const sizes = TEXT_STYLES.map((s) => s.fontSize);
    expect(sizes.slice(0, 4)).toEqual([...sizes.slice(0, 4)].sort((a, b) => b - a));
  });

  it("writes the WEB code syntax with every slash turned into a hyphen", () => {
    expect(webCodeSyntax("fg/default")).toBe("var(--fg-default)");
    expect(webCodeSyntax("spacing/2xl")).toBe("var(--spacing-2xl)");
    expect(webCodeSyntax("bg")).toBe("var(--bg)");
  });
});

describe("createTokens on an empty file", () => {
  it("creates exactly 44 variables in 3 collections and 11 styles", async () => {
    const file = makeFakeFile();
    install(file);

    const result = await createTokens();

    expect(result).toEqual({ createdVariables: 44, createdStyles: 11 });
    expect(file.collections.map((c) => c.name)).toEqual(["Light", "Dark", "Base"]);
    expect(file.variables.size).toBe(44);
    expect(file.varsIn("Base").map((v) => v.name)).toEqual([
      "spacing/xs", "spacing/sm", "spacing/md", "spacing/lg", "spacing/xl", "spacing/2xl", "spacing/3xl", "spacing/4xl",
      "radius/sm", "radius/md", "radius/lg", "radius/xl", "radius/full",
      "font/heading", "font/body", "font/mono",
    ]);
    expect(file.textStyles.map((s) => s.name)).toEqual(TEXT_STYLES.map((s) => s.name));
    expect(file.effectStyles.map((s) => s.name)).toEqual(["shadow-sm", "shadow-md"]);
  });

  it("sets the scopes of design doc 4.3.4, and [] on every Dark variable", async () => {
    const file = makeFakeFile();
    install(file);
    await createTokens();

    for (const v of file.varsIn("Light")) expect(v.scopes, v.name).toEqual(LIGHT_SCOPES[v.name]);
    expect(file.varsIn("Light")).toHaveLength(Object.keys(LIGHT_SCOPES).length);
    for (const v of file.varsIn("Dark")) expect(v.scopes, v.name).toEqual([]);
    for (const v of file.varsIn("Base")) {
      const expected = v.name.startsWith("spacing/") ? ["GAP"] : v.name.startsWith("radius/") ? ["CORNER_RADIUS"] : ["FONT_FAMILY"];
      expect(v.scopes, v.name).toEqual(expected);
    }
  });

  it("gives every variable a var(--name) WEB code syntax", async () => {
    const file = makeFakeFile();
    install(file);
    await createTokens();

    for (const v of file.variables.values()) {
      expect(v.codeSyntax.WEB, v.name).toBe(`var(--${v.name.replace(/\//g, "-")})`);
    }
    expect(file.find("Light", "fg/default").codeSyntax.WEB).toBe("var(--fg-default)");
  });

  it("stores the placeholder values in the collection's one mode", async () => {
    const file = makeFakeFile();
    install(file);
    await createTokens();

    const base = file.collections.find((c) => c.name === "Base")!;
    expect(file.find("Base", "radius/full").valuesByMode[base.modes[0].modeId]).toBe(9999);
    expect(file.find("Base", "font/body").valuesByMode[base.modes[0].modeId]).toBe("Noto Sans JP");
    const light = file.collections.find((c) => c.name === "Light")!;
    expect(file.find("Light", "shadow").valuesByMode[light.modes[0].modeId]).toEqual({ r: 0, g: 0, b: 0, a: 0.12 });
    const dark = file.collections.find((c) => c.name === "Dark")!;
    expect(file.find("Dark", "shadow").valuesByMode[dark.modes[0].modeId]).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
  });

  it("builds each text style from its font variable and binds the family to it", async () => {
    const file = makeFakeFile();
    install(file);
    await createTokens();

    const display = file.textStyles.find((s) => s.name === "display")!;
    expect(display.fontName).toEqual({ family: "Inter", style: "Bold" });
    expect(display.fontSize).toBe(64);
    expect(display.lineHeight).toEqual({ unit: "PERCENT", value: 120 });
    expect(display.letterSpacing).toEqual({ unit: "PERCENT", value: 0 });

    for (const spec of TEXT_STYLES) {
      const style = file.textStyles.find((s) => s.name === spec.name)!;
      expect(style.boundVariables.fontFamily.id, spec.name).toBe(file.find("Base", spec.fontVariable).id);
    }
    expect(file.textStyles.find((s) => s.name === "code")!.fontName).toEqual({ family: "Roboto Mono", style: "Regular" });
    expect(file.textStyles.find((s) => s.name === "label")!.fontName).toEqual({ family: "Noto Sans JP", style: "Bold" });
    // Every font set on a style was loaded first.
    for (const s of file.textStyles) expect(file.loadedFonts).toContainEqual(s.fontName);
  });

  it("binds both shadows' color to the Light collection's shadow", async () => {
    const file = makeFakeFile();
    install(file);
    await createTokens();

    const lightShadow = file.find("Light", "shadow");
    const md = file.effectStyles.find((s) => s.name === "shadow-md")!;
    expect(md.effects).toHaveLength(1);
    expect(md.effects[0]).toMatchObject({
      type: "DROP_SHADOW",
      offset: { x: 0, y: 8 },
      radius: 24,
      spread: -4,
      visible: true,
      blendMode: "NORMAL",
    });
    for (const s of file.effectStyles) {
      expect(s.effects[0].boundVariables?.color?.id, s.name).toBe(lightShadow.id);
    }
  });
});

describe("createTokens on a file that already has tokens", () => {
  it("creates nothing on a second run and changes no value", async () => {
    const file = makeFakeFile();
    install(file);
    await createTokens();
    const before = JSON.stringify([...file.variables.values()]);

    const result = await createTokens();

    expect(result).toEqual({ createdVariables: 0, createdStyles: 0 });
    expect(file.collections).toHaveLength(3);
    expect(file.variables.size).toBe(44);
    expect(file.textStyles.length + file.effectStyles.length).toBe(11);
    expect(JSON.stringify([...file.variables.values()])).toBe(before);
  });

  it("keeps the designer's edits and adds only what is missing", async () => {
    const file = makeFakeFile();
    const light = file.addCollection("Light");
    const bg = file.addVariable("bg", light, "COLOR");
    const mine = { r: 0.5, g: 0.1, b: 0.1, a: 1 };
    bg.setValueForMode(light.modes[0].modeId, mine);
    bg.scopes = ["ALL_SCOPES"];
    const body = file.api.createTextStyle();
    body.name = "body";
    install(file);

    const result = await createTokens();

    expect(result).toEqual({ createdVariables: 43, createdStyles: 10 });
    expect(file.collections.filter((c) => c.name === "Light")).toHaveLength(1);
    expect(file.varsIn("Light")).toHaveLength(14);
    expect(bg.valuesByMode[light.modes[0].modeId]).toEqual(mine);
    expect(bg.scopes).toEqual(["ALL_SCOPES"]);
    expect(bg.codeSyntax).toEqual({});
    expect(file.textStyles.filter((s) => s.name === "body")).toHaveLength(1);
    expect(body.fontName).toBeUndefined();
  });

  it("binds new styles to the font and shadow variables the designer already has", async () => {
    const file = makeFakeFile();
    const base = file.addCollection("Base");
    const heading = file.addVariable("font/heading", base, "STRING");
    heading.setValueForMode(base.modes[0].modeId, "Poppins");
    const light = file.addCollection("Light");
    const shadow = file.addVariable("shadow", light, "COLOR");
    shadow.setValueForMode(light.modes[0].modeId, { r: 0.2, g: 0, b: 0, a: 0.3 });
    install(file);

    await createTokens();

    const display = file.textStyles.find((s) => s.name === "display")!;
    expect(display.fontName).toEqual({ family: "Poppins", style: "Bold" });
    expect(display.boundVariables.fontFamily.id).toBe(heading.id);
    const sm = file.effectStyles.find((s) => s.name === "shadow-sm")!;
    expect(sm.effects[0].boundVariables?.color?.id).toBe(shadow.id);
    expect(sm.effects[0]).toMatchObject({ color: { r: 0.2, g: 0, b: 0, a: 0.3 } });
  });
});

describe("createTokens when a font cannot be loaded", () => {
  it("fails with the family and style in the message, leaving no half-built style", async () => {
    const file = makeFakeFile({ unloadableFonts: ["Noto Sans JP"] });
    install(file);

    await expect(createTokens()).rejects.toThrow('Could not load font "Noto Sans JP" Regular');
    // display..heading-sm (Inter) were made; lead (first Noto Sans JP) was not.
    expect(file.textStyles.map((s) => s.name)).toEqual(["display", "heading-lg", "heading-md", "heading-sm"]);
  });
});
