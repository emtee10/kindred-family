import { describe, expect, it } from "vitest";
import { shortestPathRelationships } from "./shortest-paths";
import { networkAdjacency, networkDistances } from "./network-layout";
import { relationshipTypes, type Relationship } from "./types";

const edge = (id: string, from: string, to: string, type: Relationship["type"] = "biological_parent", certainty?: Relationship["confidence"]): Relationship =>
  ({ id, from, to, type, confidence: certainty });

describe("shortest paths to the index person", () => {
  it("removes cycles, cross-links and equal-length alternatives without increasing any distance", () => {
    const ids = ["index", "a", "b", "c", "d", "isolated", "island"];
    const relationships = [
      edge("1", "a", "index"), edge("2", "b", "index"), edge("3", "a", "b", "spouse"),
      edge("4", "a", "c"), edge("5", "b", "c"), edge("6", "c", "d"),
      edge("7", "b", "d"), edge("8", "isolated", "island", "partner"),
    ];
    for (const root of ids) {
      const fullDistances = networkDistances(networkAdjacency(ids, relationships), root);
      const tree = shortestPathRelationships(ids, relationships, root);
      const distances = networkDistances(networkAdjacency(ids, tree), root);
      expect(Object.fromEntries(distances)).toEqual(Object.fromEntries(fullDistances));
      expect(tree).toHaveLength(fullDistances.size - 1);
      expect(shortestPathRelationships([...ids].reverse(), [...relationships].reverse(), root)).toEqual(tree);
      expect(tree.every((r) => relationships.includes(r))).toBe(true);
    }
  });

  it.each(relationshipTypes)("uses %s edges in both directions without changing stored direction", (type) => {
    const relationship = edge("1", "a", "b", type);
    expect(shortestPathRelationships(["a", "b"], [relationship], "a")).toEqual([relationship]);
    expect(shortestPathRelationships(["a", "b"], [relationship], "b")).toEqual([relationship]);
  });

  it("prefers confirmed primary relationships for ties, while choosing fewer hops ahead of role or confidence", () => {
    const relationships = [
      edge("step", "index", "a", "step_parent"), edge("bio", "index", "a"),
      edge("probable", "index", "a", "biological_parent", "probable"),
      edge("via-a", "a", "b"), edge("direct", "index", "b", "guardian", "speculative"),
    ];
    expect(shortestPathRelationships(["index", "a", "b"], relationships, "index").map((r) => r.id)).toEqual(["bio", "direct"]);
  });

  it("does not route through excluded people or invent links for disconnected people", () => {
    const relationships = [edge("1", "index", "hidden"), edge("2", "hidden", "visible")];
    expect(shortestPathRelationships(["index", "visible"], relationships, "index")).toEqual([]);
    expect(shortestPathRelationships([], relationships, "missing")).toEqual([]);
  });
});
