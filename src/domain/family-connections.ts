import type { Genealogy } from "./genealogy";
import { getSmoothStepPath, Position } from "@xyflow/react";
import { isParent, type Relationship } from "./types";

export const PERSON_WIDTH = 190;
export const PERSON_HEIGHT = 95;
const TRACK_SPACING = 16;

export type Point = { x: number; y: number };
export type PersonRect = Point & { width: number; height: number };
export type FamilyConnection = {
  id: string;
  parents: string[];
  children: string[];
  relationships: Relationship[];
  parentLevel: number;
  childLevel: number;
  lane: number;
  childBridgeLanes: number;
  union?: PartnerConnection;
};
export type PartnerConnection = { relationship: Relationship; bridge: boolean; lane: number };

export function planFamilyConnections(
  family: Genealogy,
  levels: Map<string, number>,
  positions: Map<string, Point>,
  { includePartners = true }: { includePartners?: boolean } = {},
) {
  const incoming = new Map<string, Relationship[]>();
  for (const relation of family.data.relationships) {
    if (!isParent(relation)) continue;
    const parents = incoming.get(relation.to) ?? [];
    parents.push(relation);
    incoming.set(relation.to, parents);
  }
  const groups = new Map<string, FamilyConnection>();
  const direct: Relationship[] = [];
  for (const [child, childLevel] of levels) {
    const recorded = incoming.get(child) ?? [];
    const visible = recorded.filter((r) => levels.has(r.from));
    if (!visible.length) continue;
    const first = visible[0];
    const parentLevel = levels.get(first.from)!;
    // Conflicting generation assignments still require individual routing.
    if (parentLevel + 1 !== childLevel || visible.some((r) =>
      levels.get(r.from) !== parentLevel,
    )) {
      direct.push(...visible);
      continue;
    }
    // Include hidden parents in the key: half-siblings must not become full
    // siblings just because one of their parents is outside the current view.
    // Relationship metadata belongs to the branches, not the family identity.
    const signature = [...new Set(recorded.map((r) => r.from))].sort();
    const key = JSON.stringify([parentLevel, childLevel, signature]);
    const group = groups.get(key) ?? {
      id: `family:${key}`,
      parents: [...new Set(visible.map((r) => r.from))],
      children: [], relationships: [], parentLevel, childLevel, lane: 0, childBridgeLanes: 0,
    };
    group.children.push(child);
    group.relationships.push(...visible);
    groups.set(key, group);
  }

  const connections = [...groups.values()];
  const center = (id: string) => positions.get(id)!.x + PERSON_WIDTH / 2;
  const bands = new Map<number, FamilyConnection[]>();
  for (const group of connections) {
    const band = bands.get(group.childLevel) ?? [];
    band.push(group);
    bands.set(group.childLevel, band);
  }
  const laneCounts = new Map<number, number>();
  for (const [level, band] of bands) {
    const intervals = band.map((group) => {
      const xs = [...group.parents, ...group.children].map(center);
      return { group, left: Math.min(...xs) - 12, right: Math.max(...xs) + 12 };
    }).sort((a, b) => a.left - b.left || a.group.id.localeCompare(b.group.id));
    const ends: number[] = [];
    for (const { group, left, right } of intervals) {
      const free = ends.findIndex((end) => end < left);
      group.lane = free < 0 ? ends.length : free;
      ends[group.lane] = right;
    }
    laneCounts.set(level, ends.length);
  }

  const partners: PartnerConnection[] = [];
  const bridges = new Map<number, number>();
  for (const relationship of family.data.relationships) {
    if (!includePartners || isParent(relationship) || !levels.has(relationship.from) || !levels.has(relationship.to)) continue;
    const fromLevel = levels.get(relationship.from)!;
    if (fromLevel !== levels.get(relationship.to)) {
      direct.push(relationship);
      continue;
    }
    const left = Math.min(center(relationship.from), center(relationship.to));
    const right = Math.max(center(relationship.from), center(relationship.to));
    const bridge = [...levels].some(([id, level]) =>
      level === fromLevel && center(id) > left && center(id) < right,
    );
    const lane = bridge ? bridges.get(fromLevel) ?? 0 : 0;
    if (bridge) bridges.set(fromLevel, lane + 1);
    partners.push({ relationship, bridge, lane });
  }
  for (const group of connections) {
    group.childBridgeLanes = bridges.get(group.childLevel) ?? 0;
    if (group.parents.length === 2 &&
      new Set((incoming.get(group.children[0]) ?? []).map((r) => r.from)).size === 2) {
      group.union = partners.find(({ relationship }) =>
        group.parents.includes(relationship.from) && group.parents.includes(relationship.to),
      );
    }
  }

  // Dense rows get actual routing space, rather than overlapping more lines
  // inside the same fixed-height gap. Anchor generation zero when expanding.
  const ys = new Map<number, number>();
  const sortedLevels = [...new Set(levels.values())].sort((a, b) => a - b);
  for (let i = 0; i < sortedLevels.length; i++) {
    const level = sortedLevels[i];
    const previous = sortedLevels[i - 1];
    const gap = Math.max(210, PERSON_HEIGHT + 56 +
      (laneCounts.get(level) ?? 0) * TRACK_SPACING * 2 +
      (bridges.get(level) ?? 0) * TRACK_SPACING);
    ys.set(level, i === 0 ? 0 : ys.get(previous)! + gap * (level - previous));
  }
  const rootY = ys.get(0) ?? 0;
  const routedPositions = new Map([...positions].map(([id, position]) => [id, {
    x: position.x, y: ys.get(levels.get(id)!)! - rootY,
  }]));
  return { groups: connections, direct, partners, positions: routedPositions };
}

export function partnerConnectorGeometry(partner: PartnerConnection, rects: Map<string, PersonRect>) {
  const from = rects.get(partner.relationship.from);
  const to = rects.get(partner.relationship.to);
  if (!from || !to) return null;
  const fromLeft = from.x < to.x;
  const sourceX = from.x + (fromLeft ? from.width : 0);
  const targetX = to.x + (fromLeft ? 0 : to.width);
  const sourceY = from.y + from.height / 2;
  const targetY = to.y + to.height / 2;
  let [path, x, y] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition: fromLeft ? Position.Right : Position.Left,
    targetPosition: fromLeft ? Position.Left : Position.Right,
    borderRadius: 6,
  });
  if (partner.bridge) {
    const bridgeY = Math.min(from.y, to.y) - 18 - partner.lane * TRACK_SPACING;
    const direction = fromLeft ? 1 : -1;
    const fromX = sourceX + direction * 12;
    const toX = targetX - direction * 12;
    path = `M ${sourceX} ${sourceY} L ${fromX} ${sourceY} L ${fromX} ${bridgeY} L ${toX} ${bridgeY} L ${toX} ${targetY} L ${targetX} ${targetY}`;
    x = (fromX + toX) / 2;
    y = bridgeY;
  }
  return { path, midpoint: { x, y } };
}

export function familyConnectorGeometry(group: FamilyConnection, rects: Map<string, PersonRect>) {
  const parents = group.parents.map((id) => rects.get(id));
  const children = group.children.map((id) => rects.get(id));
  if (parents.some((rect) => !rect) || children.some((rect) => !rect)) return null;
  const parentRects = parents as PersonRect[];
  const childRects = children as PersonRect[];
  const px = parentRects.map((rect) => rect.x + rect.width / 2);
  const cx = childRects.map((rect) => rect.x + rect.width / 2);
  const union = group.union ? partnerConnectorGeometry(group.union, rects) : null;
  const hubX = union?.midpoint.x ?? px.reduce((sum, x) => sum + x, 0) / px.length;
  const joinY = union?.midpoint.y ?? Math.max(...parentRects.map((rect) => rect.y + rect.height)) + 20 + group.lane * TRACK_SPACING;
  const barY = Math.min(...childRects.map((rect) => rect.y)) - 24 -
    (group.lane + group.childBridgeLanes) * TRACK_SPACING;
  const paths: string[] = [];
  const segment = (from: Point, to: Point) => {
    if (from.x !== to.x || from.y !== to.y) paths.push(`M ${from.x} ${from.y} L ${to.x} ${to.y}`);
  };
  if (!union) {
    parentRects.forEach((rect, i) => segment(
      { x: px[i], y: rect.y + rect.height }, { x: px[i], y: joinY },
    ));
    segment({ x: Math.min(...px), y: joinY }, { x: Math.max(...px), y: joinY });
  }
  segment({ x: hubX, y: joinY }, { x: hubX, y: barY });
  segment({ x: Math.min(hubX, ...cx), y: barY }, { x: Math.max(hubX, ...cx), y: barY });
  const sharedPaths = [...paths];
  const childBranches = childRects.map((rect, i) => ({
    child: group.children[i],
    path: `M ${cx[i]} ${barY} L ${cx[i]} ${rect.y}`,
    label: { x: cx[i], y: (barY + rect.y) / 2 },
  }));
  childRects.forEach((rect, i) => segment({ x: cx[i], y: barY }, { x: cx[i], y: rect.y }));
  const junctions: Point[] = [];
  if (px.length > 1) junctions.push({ x: hubX, y: joinY });
  if (cx.length > 1) junctions.push({ x: hubX, y: barY });
  for (const x of union ? [] : px) {
    if (x > Math.min(...px) && x < Math.max(...px)) junctions.push({ x, y: joinY });
  }
  for (const x of cx) {
    if (x > Math.min(hubX, ...cx) && x < Math.max(hubX, ...cx)) junctions.push({ x, y: barY });
  }
  const uniqueJunctions = [...new Map(junctions.map((point) =>
    [JSON.stringify(point), point],
  )).values()];
  return { paths, sharedPaths, childBranches, junctions: uniqueJunctions, label: { x: hubX, y: (joinY + barY) / 2 } };
}
