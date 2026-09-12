import { describe, it, expect } from "vitest";
import { collectAllNodes, traverseNodes } from "../traversal";

function makeNode(
  overrides: Partial<SceneNode> & { children?: SceneNode[] },
): SceneNode {
  const base = {
    id: "0",
    name: "node",
    type: "FRAME" as const,
    parent: null,
    ...overrides,
  };
  return base as unknown as SceneNode;
}

describe("traverseNodes", () => {
  it("visits all descendants", () => {
    const leaf1 = makeNode({ id: "leaf1", name: "leaf1" });
    const leaf2 = makeNode({ id: "leaf2", name: "leaf2" });
    const mid = makeNode({ id: "mid", name: "mid", children: [leaf2] });
    const root = makeNode({ id: "root", name: "root", children: [leaf1, mid] });

    const visited: string[] = [];
    traverseNodes(root, (n) => visited.push(n.id));
    expect(visited).toEqual(["leaf1", "mid", "leaf2"]);
  });

  it("handles node with no children", () => {
    const root = makeNode({ id: "root" });
    const visited: string[] = [];
    traverseNodes(root, (n) => visited.push(n.id));
    expect(visited).toEqual([]);
  });
});

describe("collectAllNodes", () => {
  it("returns flat array of all descendants", () => {
    const leaf = makeNode({ id: "leaf" });
    const root = makeNode({ id: "root", children: [leaf] });
    const nodes = collectAllNodes(root);
    expect(nodes.map((n) => n.id)).toEqual(["leaf"]);
  });
});
