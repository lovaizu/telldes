// Judgment side: which of the file's variables and styles are tokens, grouped
// the way the designer made them.
import type { TokenData } from "../shared/data";

export type TokenKind = "variable" | "textStyle" | "effectStyle" | "paintStyle";

/** Why a variable or style does not become a token (README: トークン化). */
export type TokenDrop = "color-style" | "not-color-or-number";

export interface TokenRef {
  kind: TokenKind;
  id: string;
  name: string;
  dropped: TokenDrop | null;
}

export interface TokenGroup {
  /** Collection name for variables; the style kind for styles. */
  name: string;
  tokens: TokenRef[];
}

export function tokenGroups(tokens: TokenData): TokenGroup[] {
  const variableGroups = tokens.collections.map((collection) => ({
    name: collection.name,
    tokens: tokens.variables
      .filter((v) => v.variableCollectionId === collection.id)
      .map((v): TokenRef => ({
        kind: "variable",
        id: v.id,
        name: v.name,
        dropped: v.resolvedType === "COLOR" || v.resolvedType === "FLOAT" ? null : "not-color-or-number",
      })),
  }));
  const styleGroup = (name: string, kind: TokenKind, styles: { id: string; name: string }[], dropped: TokenDrop | null) => ({
    name,
    tokens: styles.map((s): TokenRef => ({ kind, id: s.id, name: s.name, dropped })),
  });
  return [
    ...variableGroups,
    styleGroup("Text Style", "textStyle", tokens.textStyles, null),
    styleGroup("Effect Style", "effectStyle", tokens.effectStyles, null),
    styleGroup("Color Style", "paintStyle", tokens.paintStyles, "color-style"),
  ].filter((group) => group.tokens.length > 0);
}
