import { describe, it, expect, vi } from "vitest";
import { buildTokens } from "../tokensBuilder";

const mockGetVariableById = vi.fn();

vi.stubGlobal("figma", {
  variables: { getVariableById: mockGetVariableById },
});

function makeVariable(
  name: string,
  resolvedType: string,
  value: unknown,
  id = name,
): Variable {
  return {
    id,
    name,
    resolvedType,
    valuesByMode: { mode1: value },
  } as unknown as Variable;
}

function makeTextStyle(
  name: string,
  overrides: Record<string, unknown> = {},
): TextStyle {
  return {
    name,
    fontName: { family: "Inter", style: "Bold" },
    fontSize: 28,
    lineHeight: { unit: "PIXELS", value: 36 },
    letterSpacing: { unit: "PIXELS", value: 0 },
    ...overrides,
  } as unknown as TextStyle;
}

describe("buildTokens", () => {
  it("returns null when no variables", () => {
    expect(buildTokens([])).toBeNull();
  });

  it("converts color variable to token", () => {
    const vars = [
      makeVariable("color/bg-primary", "COLOR", {
        r: 0.231,
        g: 0.51,
        b: 0.965,
        a: 1,
      }),
    ];
    const tokens = buildTokens(vars)!;
    expect(tokens.color).toBeDefined();
    const bgPrimary = (tokens.color as Record<string, unknown>)[
      "bg-primary"
    ] as Record<string, unknown>;
    expect(bgPrimary.$type).toBe("color");
    expect(bgPrimary.$value).toBe("#3B82F6");
  });

  it("converts number variable to token", () => {
    const vars = [
      makeVariable("spacing/section-gap", "FLOAT", 48),
    ];
    const tokens = buildTokens(vars)!;
    const sectionGap = (tokens.spacing as Record<string, unknown>)[
      "section-gap"
    ] as Record<string, unknown>;
    expect(sectionGap.$type).toBe("number");
    expect(sectionGap.$value).toBe(48);
  });

  it("creates nested group structure from slash-separated names", () => {
    const vars = [
      makeVariable("color/bg-primary", "COLOR", { r: 1, g: 0, b: 0, a: 1 }),
      makeVariable("color/text-primary", "COLOR", { r: 0, g: 0, b: 0, a: 1 }),
      makeVariable("spacing/section-gap", "FLOAT", 48),
    ];
    const tokens = buildTokens(vars)!;
    expect(Object.keys(tokens)).toEqual(["color", "spacing"]);
    const colorGroup = tokens.color as Record<string, unknown>;
    expect(Object.keys(colorGroup)).toEqual(["bg-primary", "text-primary"]);
  });

  it("handles deeply nested paths", () => {
    const vars = [
      makeVariable("font-size/heading/xl", "FLOAT", 36),
    ];
    const tokens = buildTokens(vars)!;
    const heading = (tokens["font-size"] as Record<string, unknown>)[
      "heading"
    ] as Record<string, unknown>;
    const xl = heading["xl"] as Record<string, unknown>;
    expect(xl.$type).toBe("number");
    expect(xl.$value).toBe(36);
  });

  it("preserves both a leaf and a group sharing a name (no silent loss)", () => {
    const vars = [
      makeVariable("color", "COLOR", { r: 1, g: 0, b: 0, a: 1 }),
      makeVariable("color/primary", "COLOR", { r: 0, g: 0, b: 1, a: 1 }),
    ];
    const tokens = buildTokens(vars)!;
    const colorGroup = tokens.color as Record<string, unknown>;
    // leaf "color" demoted to $base, "primary" kept as a child
    expect((colorGroup.$base as Record<string, unknown>).$value).toBe("#FF0000");
    expect((colorGroup.primary as Record<string, unknown>).$value).toBe("#0000FF");
  });

  it("drops STRING/BOOLEAN variables (only color & number are documented)", () => {
    const vars = [
      makeVariable("color/brand", "COLOR", { r: 1, g: 0, b: 0, a: 1 }),
      makeVariable("font/family", "STRING", "Inter"),
      makeVariable("flag/enabled", "BOOLEAN", true),
    ];
    const tokens = buildTokens(vars)!;
    expect(Object.keys(tokens)).toEqual(["color"]);
  });

  it("returns null when only unsupported (STRING/BOOLEAN) variables exist", () => {
    const vars = [makeVariable("font/family", "STRING", "Inter")];
    expect(buildTokens(vars)).toBeNull();
  });

  it("emits #RRGGBBAA when a color variable has alpha < 1", () => {
    const vars = [
      makeVariable("color/overlay", "COLOR", { r: 0, g: 0, b: 0, a: 0.5 }),
    ];
    const tokens = buildTokens(vars)!;
    const overlay = (tokens.color as Record<string, unknown>)[
      "overlay"
    ] as Record<string, unknown>;
    expect(overlay.$value).toBe("#00000080");
  });

  it("follows a VARIABLE_ALIAS to the referenced resolved value", () => {
    // semantic token aliases a primitive color token
    const primitive = makeVariable(
      "color/blue-500",
      "COLOR",
      { r: 0.231, g: 0.51, b: 0.965, a: 1 },
      "prim-id",
    );
    mockGetVariableById.mockImplementation((id: string) =>
      id === "prim-id" ? primitive : null,
    );
    const semantic = makeVariable("color/bg-primary", "COLOR", {
      type: "VARIABLE_ALIAS",
      id: "prim-id",
    });
    const tokens = buildTokens([semantic])!;
    const bg = (tokens.color as Record<string, unknown>)[
      "bg-primary"
    ] as Record<string, unknown>;
    expect(bg.$value).toBe("#3B82F6");
  });

  it("returns 0 instead of [object Object] on an alias cycle", () => {
    const selfRef = makeVariable("color/loop", "COLOR", {
      type: "VARIABLE_ALIAS",
      id: "color/loop",
    });
    mockGetVariableById.mockImplementation(() => selfRef);
    const tokens = buildTokens([selfRef])!;
    const loop = (tokens.color as Record<string, unknown>)["loop"] as Record<
      string,
      unknown
    >;
    expect(loop.$value).toBe(0);
  });
});

describe("buildTokens — typography (Text Styles)", () => {
  it("converts a single text style to a typography token with correct $type/$value", () => {
    const styles = [
      makeTextStyle("heading-md", {
        fontName: { family: "Inter", style: "Bold" },
        fontSize: 28,
        lineHeight: { unit: "PIXELS", value: 36 },
        letterSpacing: { unit: "PIXELS", value: 0 },
      }),
    ];
    const tokens = buildTokens([], styles)!;
    const headingMd = (tokens.typography as Record<string, unknown>)[
      "heading-md"
    ] as Record<string, unknown>;
    expect(headingMd.$type).toBe("typography");
    expect(headingMd.$value).toEqual({
      fontFamily: "Inter",
      fontSize: 28,
      fontWeight: 700,
      lineHeight: "36px",
      letterSpacing: "0em",
    });
  });

  it("maps AUTO lineHeight to the CSS keyword 'normal'", () => {
    const styles = [makeTextStyle("body", { lineHeight: { unit: "AUTO" } })];
    const tokens = buildTokens([], styles)!;
    const body = (tokens.typography as Record<string, unknown>)["body"] as Record<
      string,
      unknown
    >;
    expect((body.$value as Record<string, unknown>).lineHeight).toBe("normal");
  });

  it("maps zero letterSpacing to the literal '0em' (never omitted)", () => {
    const styles = [
      makeTextStyle("body", { letterSpacing: { unit: "PIXELS", value: 0 } }),
    ];
    const tokens = buildTokens([], styles)!;
    const body = (tokens.typography as Record<string, unknown>)["body"] as Record<
      string,
      unknown
    >;
    expect((body.$value as Record<string, unknown>).letterSpacing).toBe("0em");
  });

  it("converts PERCENT-unit lineHeight/letterSpacing to %/em", () => {
    const styles = [
      makeTextStyle("lead", {
        lineHeight: { unit: "PERCENT", value: 150 },
        letterSpacing: { unit: "PERCENT", value: 2 },
      }),
    ];
    const tokens = buildTokens([], styles)!;
    const lead = (tokens.typography as Record<string, unknown>)["lead"] as Record<
      string,
      unknown
    >;
    const value = lead.$value as Record<string, unknown>;
    expect(value.lineHeight).toBe("150%");
    expect(value.letterSpacing).toBe("0.02em");
  });

  it("nests a slash-named text style under the typography group", () => {
    const styles = [makeTextStyle("heading/md")];
    const tokens = buildTokens([], styles)!;
    const typographyGroup = tokens.typography as Record<string, unknown>;
    const headingGroup = typographyGroup.heading as Record<string, unknown>;
    const md = headingGroup.md as Record<string, unknown>;
    expect(md.$type).toBe("typography");
  });

  it("returns non-null when only text styles exist (no Variables)", () => {
    const styles = [makeTextStyle("body")];
    const tokens = buildTokens([], styles);
    expect(tokens).not.toBeNull();
    expect(tokens!.typography).toBeDefined();
  });

  it("still returns null when both variables and text styles are empty", () => {
    expect(buildTokens([], [])).toBeNull();
  });
});
