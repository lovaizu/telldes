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
