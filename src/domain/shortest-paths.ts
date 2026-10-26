import { confidence, type Relationship } from "./types";

const confidenceRank = { confirmed: 0, probable: 1, possible: 2, speculative: 3 };
const roleRank = { biological_parent: 0, adoptive_parent: 1, spouse: 2, partner: 3, step_parent: 4, guardian: 5 };
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

// One breadth-first predecessor per person gives every reachable person one
// shortest route to the index, without same-depth links or alternate routes.
// Prefer certainty and primary parentage when equally short routes compete.
export function shortestPathRelationships(ids: Iterable<string>, relationships: Relationship[], root: string) {
  const adjacency = new Map([...ids].map((id) => [id, [] as { next: string; relationship: Relationship }[]]));
  if (!adjacency.has(root)) return [];
  for (const relationship of relationships) {
    const { from, to } = relationship;
    if (!adjacency.has(from) || !adjacency.has(to)) continue;
    adjacency.get(from)!.push({ next: to, relationship });
    adjacency.get(to)!.push({ next: from, relationship });
  }
  for (const neighbours of adjacency.values()) {
    neighbours.sort((a, b) =>
      confidenceRank[confidence(a.relationship.confidence)] - confidenceRank[confidence(b.relationship.confidence)] ||
      roleRank[a.relationship.type] - roleRank[b.relationship.type] ||
      compare(a.next, b.next) || compare(a.relationship.id, b.relationship.id),
    );
  }
  const seen = new Set([root]);
  const queue = [root];
  const result: Relationship[] = [];
  for (let i = 0; i < queue.length; i++) {
    for (const { next, relationship } of adjacency.get(queue[i])!) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
      result.push(relationship);
    }
  }
  return result;
}
