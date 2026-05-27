import { describe, it, expect } from "vitest";
import { buildTokens } from "../tokensBuilder";

function makeVariable(
  name: string,
  resolvedType: string,
  value: unknown,
): Variable {
  return {
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
});
