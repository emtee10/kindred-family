import type { Genealogy } from "./genealogy";
import { isParent, type Relationship } from "./types";
import { shortestPathRelationships } from "./shortest-paths";

export const NETWORK_WIDTH = 132;
export const NETWORK_HEIGHT = 44;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function networkAdjacency(ids: Iterable<string>, relationships: Relationship[]) {
  const adjacency = new Map([...ids].sort(compare).map((id) => [id, new Set<string>()]));
  for (const r of relationships) {
    if (!adjacency.has(r.from) || !adjacency.has(r.to)) continue;
    adjacency.get(r.from)!.add(r.to);
    adjacency.get(r.to)!.add(r.from);
  }
  return adjacency;
}

export function networkDistances(adjacency: Map<string, Set<string>>, root: string) {
  const distances = new Map<string, number>();
  if (!adjacency.has(root)) return distances;
  distances.set(root, 0);
  const queue = [root];
  for (let i = 0; i < queue.length; i++) {
    for (const next of [...adjacency.get(queue[i])!].sort(compare)) {
      if (distances.has(next)) continue;
      distances.set(next, distances.get(queue[i])! + 1);
      queue.push(next);
    }
  }
  return distances;
}

// Layout consumes the existing loaded corpus. Unreachable people have no finite
// ring; return them separately rather than inventing a graph distance for them.
export function layoutNetwork(family: Genealogy, root: string) {
  const adjacency = networkAdjacency(family.people.keys(), family.data.relationships);
  const distances = networkDistances(adjacency, root);
  const rings = new Map<number, string[]>();
  for (const [id, distance] of distances) {
    const ring = rings.get(distance) ?? [];
    ring.push(id);
    rings.set(distance, ring);
  }
  const relationships = shortestPathRelationships(family.people.keys(), family.data.relationships, root)
    .sort((a, b) => compare(a.id, b.id));
  const tree = networkAdjacency(distances.keys(), relationships);
  const children = new Map([...distances].map(([id, depth]) => [id,
    [...tree.get(id)!].filter((next) => distances.get(next) === depth + 1).sort(compare),
  ]));
  const ordered = [...distances.keys()].sort((a, b) => distances.get(b)! - distances.get(a)! || compare(a, b));
  const clearance = Math.hypot(NETWORK_WIDTH, NETWORK_HEIGHT) + 22;
  // Reserve enough angle for each card and its entire branch. Outer rings need
  // less angle per card, so long branches do not crowd the first ring.
  const demandsAt = (step: number) => {
    const demands = new Map<string, number>();
    for (const id of ordered) {
      const depth = distances.get(id)!;
      const own = depth ? 2 * Math.asin(Math.min(1, clearance / (2 * depth * step))) : 0;
      demands.set(id, Math.max(own, children.get(id)!.reduce((sum, child) => sum + demands.get(child)!, 0)));
    }
    return demands;
  };
  let step = 180;
  let demands = demandsAt(step);
  while ((demands.get(root) ?? 0) > 2 * Math.PI) {
    step *= 1.1;
    demands = demandsAt(step);
  }
  const angles = new Map([[root, -Math.PI / 2]]);
  const assign = (id: string, start: number, span: number) => {
    const descendants = children.get(id) ?? [];
    const total = descendants.reduce((sum, child) => sum + demands.get(child)!, 0);
    let cursor = start;
    for (const child of descendants) {
      const width = span * demands.get(child)! / total;
      angles.set(child, cursor + width / 2);
      assign(child, cursor, width);
      cursor += width;
    }
  };
  assign(root, -Math.PI, 2 * Math.PI);
  // Point the deepest branch horizontally to use a wide canvas efficiently.
  const rotation = ordered.length ? -angles.get(ordered[0])! : 0;
  for (const [id, angle] of angles) if (id !== root) angles.set(id, angle + rotation);
  for (const ring of rings.values()) ring.sort((a, b) => angles.get(a)! - angles.get(b)! || compare(a, b));
  const positions = new Map([...distances].map(([id, depth]) => [id, {
    x: depth * step * Math.cos(angles.get(id)!),
    y: depth * step * Math.sin(angles.get(id)!),
  }]));
  return { distances, rings, positions, angles, step, relationships,
    disconnected: [...family.people.keys()].filter((id) => !distances.has(id)).sort(compare) };
}

export function networkEdgePath(layout: ReturnType<typeof layoutNetwork>, relationship: Relationship) {
  const from = layout.positions.get(relationship.from);
  const to = layout.positions.get(relationship.to);
  if (!from || !to) return null;
  const boundary = (centre: { x: number; y: number }, toward: { x: number; y: number }) => {
    const dx = toward.x - centre.x, dy = toward.y - centre.y;
    const scale = 1 / Math.max(Math.abs(dx) / (NETWORK_WIDTH / 2 + 3), Math.abs(dy) / (NETWORK_HEIGHT / 2 + 3));
    return { x: centre.x + dx * scale, y: centre.y + dy * scale };
  };
  const fromDepth = layout.distances.get(relationship.from)!;
  const toDepth = layout.distances.get(relationship.to)!;
  if (Math.min(fromDepth, toDepth) === 0) {
    const start = boundary(from, to), end = boundary(to, from);
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }
  // Radial legs and an arc stay inside the empty gap between adjacent rings.
  // Follow the stored direction so arrowheads still point toward the child.
  const radius = (fromDepth + toDepth) * layout.step / 2;
  const a = layout.angles.get(relationship.from)!;
  const b = layout.angles.get(relationship.to)!;
  const bendFrom = { x: radius * Math.cos(a), y: radius * Math.sin(a) };
  const bendTo = { x: radius * Math.cos(b), y: radius * Math.sin(b) };
  const start = boundary(from, bendFrom), end = boundary(to, bendTo);
  const arc = Math.abs(a - b) < 1e-8 ? "" : ` A ${radius} ${radius} 0 ${Math.abs(b - a) > Math.PI ? 1 : 0} ${b > a ? 1 : 0} ${bendTo.x} ${bendTo.y}`;
  return `M ${start.x} ${start.y} L ${bendFrom.x} ${bendFrom.y}${arc} L ${end.x} ${end.y}`;
}

export const networkStyles: Record<Relationship["type"], { label: string; color: string; dash?: string }> = {
  biological_parent: { label: "Biological", color: "#487665" },
  adoptive_parent: { label: "Adoptive", color: "#526ca1", dash: "7 3" },
  step_parent: { label: "Step-parent", color: "#a57437", dash: "3 3" },
  guardian: { label: "Guardian", color: "#84699b", dash: "8 3 2 3" },
  spouse: { label: "Spouse", color: "#a75c78" },
  partner: { label: "Partner", color: "#786847", dash: "6 4" },
};

export function networkLegend(types: Iterable<Relationship["type"]>) {
  const present = new Set(types);
  return (Object.keys(networkStyles) as Relationship["type"][]).filter((type) => present.has(type)).flatMap((type) => {
    const style = networkStyles[type];
    if (!isParent({ type } as Relationship)) return [{ ...style, direction: "none", text: style.label }];
    const parent = type === "guardian" ? "guardian" : type === "step_parent" ? "step-parent" : "parent";
    return [
      { ...style, direction: "out", text: `${style.label}: ${parent} → child` },
      { ...style, direction: "in", text: `${style.label}: child → ${parent}` },
    ];
  });
}
