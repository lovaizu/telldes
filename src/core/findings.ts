// What Review reports. Each finding belongs to the object of the one decision
// the designer makes to resolve it (docs/design.md: OOUI).

export type FindingOwner =
  | { kind: "token"; id: string }
  /** A raw value used without a token, e.g. one color in 30 places: one decision, one row. */
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
  return owner.kind === "value" ? `value:${owner.value}` : `${owner.kind}:${owner.id}`;
}
