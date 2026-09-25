// What Review reports. Each finding belongs to the object of the one decision
// the designer makes to resolve it (docs/design.md: OOUI).

export type FindingOwner =
  /** Settings of the whole file, e.g. dark support on without a Dark collection. */
  | { kind: "file" }
  | { kind: "token"; id: string }
  /**
   * A raw value that matches no token, e.g. one color in 30 places: one
   * decision, one row in the token list. A value equal to a token belongs to
   * that token instead, since the decision there is "connect it to the token".
   */
  | { kind: "value"; value: string }
  | { kind: "screen"; id: string }
  | { kind: "layer"; id: string };

export interface Finding {
  /** error stops Export; notice only tells. */
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
