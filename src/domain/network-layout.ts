import type { Genealogy } from "./genealogy";
import { isParent, type Relationship } from "./types";

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
  const angles = new Map([[root, -Math.PI / 2]]);
  // Circular barycentres cluster people beside their inward neighbours.
  // Equal angular slots and a shared radius step guarantee node clearance,
  // while keeping every radius exactly proportional to shortest-path distance.
  let step = 180;
  const clearance = Math.hypot(NETWORK_WIDTH, NETWORK_HEIGHT) + 22;
  for (const [distance, ring] of rings) {
    if (!distance) continue;
    const preferred = (id: string) => {
      const inward = [...adjacency.get(id)!].filter((other) => distances.get(other)! < distance).sort(compare);
      const x = inward.reduce((sum, other) => sum + Math.cos(angles.get(other)!), 0);
      const y = inward.reduce((sum, other) => sum + Math.sin(angles.get(other)!), 0);
      return Math.atan2(y, x);
    };
    ring.sort((a, b) => preferred(a) - preferred(b) || compare(a, b));
    const offsets = ring.map((id, i) => preferred(id) - i * 2 * Math.PI / ring.length);
    const offsetX = offsets.reduce((sum, angle) => sum + Math.cos(angle), 0);
    const offsetY = offsets.reduce((sum, angle) => sum + Math.sin(angle), 0);
    const offset = Math.hypot(offsetX, offsetY) < 1e-8 ? preferred(ring[0]) : Math.atan2(offsetY, offsetX);
    ring.forEach((id, i) => angles.set(id, offset + i * 2 * Math.PI / ring.length));
    if (ring.length > 1) {
      step = Math.max(step, clearance / (2 * distance * Math.sin(Math.PI / ring.length)));
    }
  }
  const positions = new Map([...distances].map(([id, distance]) => [id, {
    x: distance * step * Math.cos(angles.get(id)!),
    y: distance * step * Math.sin(angles.get(id)!),
  }]));
  const relationships = family.data.relationships.filter((r) => distances.has(r.from) && distances.has(r.to))
    .slice().sort((a, b) => compare(a.id, b.id));
  return { distances, rings, positions, step, relationships,
    disconnected: [...family.people.keys()].filter((id) => !distances.has(id)).sort(compare) };
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
