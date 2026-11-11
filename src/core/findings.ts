// What Review reports. Each finding belongs to the object of the one decision
// the designer makes to resolve it (docs/design.md: OOUI).

export type FindingOwner =
  /** Settings of the whole file, such as dark support turned on without a Dark collection. */
  | { kind: "file" }
  | { kind: "token"; id: string }
  /**
   * A raw value that matches no token, such as one color used in 30 places: one
   * decision, one row in the token list. A value equal to a token belongs to
   * that token instead, since the decision there is to connect it to the token.
   */
  | { kind: "value"; value: string }
  | { kind: "screen"; id: string }
  | { kind: "layer"; id: string };

export interface Finding {
  /** An error stops Export; a notice shows without stopping it. */
  severity: "error" | "notice";
  owner: FindingOwner;
  message: string;
  fix: string;
  /** The layers where it occurs, for selecting them on the canvas. */
  layerIds: string[];
}

/** One string per owner, for grouping findings by the row they belong to. */
export function ownerKey(owner: FindingOwner): string {
  switch (owner.kind) {
    case "file":
      return "file";
    case "value":
      return `value:${owner.value}`;
    default:
      return `${owner.kind}:${owner.id}`;
  }
}
