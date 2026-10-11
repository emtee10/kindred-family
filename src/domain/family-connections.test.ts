import { describe, expect, it } from "vitest";
import { Genealogy } from "./genealogy";
import { layoutFamily } from "./family-layout";
import {
  familyConnectorGeometry,
  partnerConnectorGeometry,
  planFamilyConnections,
  PERSON_HEIGHT,
  PERSON_WIDTH,
  type PersonRect,
} from "./family-connections";
import type { Person, Relationship } from "./types";

const person = (id: string): Person => ({
  id, names: [{ given: id, type: "current" }], photos: [], events: [],
});
function fixture(links: [string, string, Relationship["type"], Relationship["confidence"]?][]) {
  return new Genealogy({
    people: [...new Set(links.flatMap(([from, to]) => [from, to]))].map(person),
    relationships: links.map(([from, to, type, confidence], index) => ({
      id: String(index), from, to, type, confidence,
    })),
  });
}
const parent = "biological_parent";
const plan = (family: Genealogy, root = "root", extended = true) => {
  const levels = family.familyMembers(root, extended);
  return planFamilyConnections(family, levels, layoutFamily(family, root, levels));
};
const rects = (positions: Map<string, { x: number; y: number }>) =>
  new Map<string, PersonRect>([...positions].map(([id, position]) => [id, {
    ...position, width: PERSON_WIDTH, height: PERSON_HEIGHT,
  }]));

describe("family connectors", () => {
  it.each(["single", "paired", "unpartnered"])("shares one sibling bar and stem for %s parents despite differing metadata", (kind) => {
    const family = fixture([
      ["root", "a", parent],
      ["root", "b", "adoptive_parent", "probable"],
      ["root", "c", "guardian", "possible"],
      ...(kind === "single" ? [] : [
        ["other", "a", parent],
        ["other", "b", "step_parent"],
        ["other", "c", parent, "speculative"],
      ] as [string, string, Relationship["type"], Relationship["confidence"]?][]),
      ...(kind === "paired" ? [["other", "root", "spouse"] as [string, string, Relationship["type"]]] : []),
    ]);
    const levels = new Map([["root", 0], ["a", 1], ["b", 1], ["c", 1]]);
    if (kind !== "single") levels.set("other", 0);
    const result = planFamilyConnections(family, levels, layoutFamily(family, "root", levels));
    expect(result.groups).toHaveLength(1);
    expect(result.direct).toEqual([]);
    const group = result.groups[0];
    expect(group.children).toEqual(["a", "b", "c"]);
    const measured = rects(result.positions);
    const geometry = familyConnectorGeometry(group, measured)!;
    const bar = geometry.sharedPaths.at(-1)!.split(" ").map(Number);
    const barY = bar[2];
    expect(bar[5]).toBe(barY);
    expect(geometry.childBranches).toHaveLength(3);
    for (const branch of geometry.childBranches) {
      const rect = measured.get(branch.child)!;
      const x = rect.x + rect.width / 2;
      expect(branch.path).toBe(`M ${x} ${barY} L ${x} ${rect.y}`);
      expect(x).toBeGreaterThanOrEqual(bar[1]);
      expect(x).toBeLessThanOrEqual(bar[4]);
    }
    const stem = geometry.sharedPaths.at(-2)!.split(" ").map(Number);
    expect(stem[1]).toBe(stem[4]);
    expect(stem[5]).toBe(barY);
    expect(geometry.sharedPaths.filter((path) => {
      const coords = path.split(" ").map(Number);
      return coords[1] === coords[4] && coords[5] === barY;
    })).toHaveLength(1);
    expect(group.relationships.map((r) => r.id).sort()).toEqual(
      family.data.relationships.filter((r) => r.type !== "spouse").map((r) => r.id).sort(),
    );
  });

  it.each(["spouse", "partner"] as const)("starts shared children at the visible %s line midpoint", (type) => {
    const family = fixture([
      ["other", "root", type],
      ["root", "a", parent], ["other", "a", parent],
      ["root", "b", parent], ["other", "b", parent],
    ]);
    const result = plan(family);
    const group = result.groups[0];
    expect(group.union).toEqual(result.partners[0]);
    const measured = rects(result.positions);
    measured.set("other", { ...measured.get("other")!, width: 210, height: 115 });
    const midpoint = partnerConnectorGeometry(result.partners[0], measured)!.midpoint;
    const geometry = familyConnectorGeometry(group, measured)!;
    expect(geometry.paths[0]).toMatch(new RegExp(`^M ${midpoint.x} ${midpoint.y} L ${midpoint.x} `));
    expect(geometry.junctions).toContainEqual(midpoint);
    expect(geometry.paths).toHaveLength(4);
    for (const id of group.parents) {
      const rect = measured.get(id)!;
      expect(geometry.paths.some((path) => path.startsWith(`M ${rect.x + rect.width / 2} ${rect.y + rect.height} `))).toBe(false);
    }
  });

  it("uses the routed bridge midpoint for non-adjacent parents", () => {
    const family = fixture([
      ["root", "other", "partner"], ["root", "middle", "partner"],
      ["root", "child", parent], ["other", "child", parent],
    ]);
    const levels = new Map([["root", 0], ["middle", 0], ["other", 0], ["child", 1]]);
    const positions = new Map([
      ["root", { x: 0, y: 0 }], ["middle", { x: 235, y: 0 }],
      ["other", { x: 470, y: 0 }], ["child", { x: 235, y: 210 }],
    ]);
    const result = planFamilyConnections(family, levels, positions);
    const group = result.groups[0];
    expect(group.union?.bridge).toBe(true);
    const measured = rects(result.positions);
    const midpoint = partnerConnectorGeometry(group.union!, measured)!.midpoint;
    expect(midpoint).toEqual({ x: 330, y: -18 });
    expect(familyConnectorGeometry(group, measured)!.paths[0]).toMatch(/^M 330 -18 L 330 /);
  });

  it("retains parent attachments when partnership edges are excluded or a third parent is recorded", () => {
    const family = fixture([
      ["root", "other", "spouse"],
      ["root", "child", parent], ["other", "child", parent],
      ["hidden", "child", parent],
    ]);
    const levels = new Map([["root", 0], ["other", 0], ["child", 1]]);
    const positions = layoutFamily(family, "root", levels);
    const thirdParent = planFamilyConnections(family, levels, positions);
    expect(thirdParent.groups[0].union).toBeUndefined();
    const twoParents = fixture(family.data.relationships.filter((r) => r.from !== "hidden")
      .map((r) => [r.from, r.to, r.type]));
    const excluded = planFamilyConnections(twoParents, levels, positions, { includePartners: false });
    expect(excluded.groups[0].union).toBeUndefined();
    expect(excluded.partners).toEqual([]);
    expect(familyConnectorGeometry(excluded.groups[0], rects(excluded.positions))!.paths).toHaveLength(5);
  });

  it("draws one family connector for shared children without implying a partnership", () => {
    const family = fixture([
      ["root", "a", parent], ["other", "a", parent],
      ["root", "b", parent], ["other", "b", parent],
    ]);
    const levels = new Map([["root", 0], ["other", 0], ["a", 1], ["b", 1]]);
    const result = planFamilyConnections(family, levels, layoutFamily(family, "root", levels));
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].parents).toEqual(["root", "other"]);
    expect(result.groups[0].children).toEqual(["a", "b"]);
    expect(result.groups[0].relationships).toHaveLength(4);
    expect(result.partners).toEqual([]);
    expect(result.direct).toEqual([]);
    const geometry = familyConnectorGeometry(result.groups[0], rects(result.positions))!;
    expect(geometry.paths).toHaveLength(7);
    expect(geometry.junctions).toHaveLength(2);
    expect(geometry.label.y).toBeGreaterThan(PERSON_HEIGHT);
    expect(geometry.label.y).toBeLessThan(result.positions.get("a")!.y);
  });

  it("keeps half-sibling groups separate even when their other parents are hidden", () => {
    const family = fixture([
      ["root", "a", parent], ["hidden-a", "a", parent],
      ["root", "b", parent], ["hidden-b", "b", parent],
    ]);
    const result = plan(family);
    expect(result.positions.has("hidden-a")).toBe(false);
    expect(result.groups).toHaveLength(2);
    expect(result.groups.map((group) => group.children)).toEqual([["a"], ["b"]]);
    expect(result.groups[0].lane).not.toBe(result.groups[1].lane);
  });

  it("preserves types and confidence within groups with mixed parentage", () => {
    const family = fixture([
      ["root", "adopted", "adoptive_parent"],
      ["root", "ward", "guardian", "possible"],
      ["root", "mixed", parent], ["other", "mixed", "step_parent"],
      ["root", "other", "partner"],
    ]);
    const result = plan(family);
    expect(result.groups.map((group) => group.children)).toEqual([["adopted", "ward"], ["mixed"]]);
    expect(result.groups[0].relationships[0].type).toBe("adoptive_parent");
    expect(result.groups[0].relationships[1].confidence).toBe("possible");
    expect(result.groups[1].relationships.map((r) => r.type)).toEqual([parent, "step_parent"]);
    expect(result.groups[1].union).toEqual(result.partners[0]);
    expect(result.direct).toEqual([]);
    const represented = [
      ...result.groups.flatMap((group) => group.relationships),
      ...result.direct, ...result.partners.map((partner) => partner.relationship),
    ];
    expect(represented.map((r) => r.id).sort()).toEqual(family.data.relationships.map((r) => r.id).sort());
  });

  it("reuses routing lanes for disjoint branches and expands dense generations", () => {
    const family = fixture([
      ["root", "a", parent], ["root", "b", "adoptive_parent"],
      ["root", "c", "step_parent"], ["root", "d", "guardian"],
      ["hidden-a", "a", parent], ["hidden-b", "b", parent],
      ["hidden-c", "c", parent], ["hidden-d", "d", parent],
      ["separate", "e", parent],
    ]);
    const levels = new Map([
      ["root", 0], ["separate", 0], ["a", 1], ["b", 1], ["c", 1], ["d", 1], ["e", 1],
    ]);
    const positions = new Map([
      ["root", { x: 0, y: 0 }], ["separate", { x: 1500, y: 0 }],
      ...["a", "b", "c", "d", "e"].map((id, index): [string, { x: number; y: number }] =>
        [id, { x: index === 4 ? 1500 : index * 235, y: 210 }]),
    ]);
    const result = planFamilyConnections(family, levels, positions);
    expect(new Set(result.groups.filter((group) => group.parents.includes("root")).map((group) => group.lane)).size).toBe(4);
    expect(result.groups.find((group) => group.parents.includes("separate"))!.lane).toBe(0);
    expect(result.positions.get("a")!.y).toBeGreaterThan(210);
    expect(result.positions.get("root")!.y).toBe(0);
    for (const group of result.groups) {
      const geometry = familyConnectorGeometry(group, rects(result.positions))!;
      expect(geometry.label.y).toBeGreaterThan(PERSON_HEIGHT);
      expect(geometry.label.y).toBeLessThan(result.positions.get(group.children[0])!.y);
      expect(geometry.paths.join(" ")).not.toMatch(/NaN|Infinity/);
    }
    expect(planFamilyConnections(family, levels, positions)).toEqual(result);
  });

  it("puts two partners on opposite sides of their shared partner", () => {
    const family = fixture([
      ["root", "partner-a", "spouse"], ["root", "partner-b", "partner"],
      ["root", "a", parent], ["partner-a", "a", parent],
      ["root", "b", parent], ["partner-b", "b", parent],
    ]);
    const result = plan(family);
    const x = (id: string) => result.positions.get(id)!.x;
    expect(x("partner-a")).toBeLessThan(x("root"));
    expect(x("partner-b")).toBeGreaterThan(x("root"));
    expect(result.groups.map((group) => group.children)).toEqual([["a"], ["b"]]);
    expect(result.partners.every((partner) => !partner.bridge)).toBe(true);
  });

  it("routes non-adjacent partners above intervening cards and reserves space below sibling bars", () => {
    const family = fixture([
      ["grandparent", "root", parent], ["grandparent", "sibling", parent],
      ["root", "partner-a", "partner"], ["root", "partner-b", "partner"],
      ["root", "partner-c", "partner"],
    ]);
    const result = plan(family);
    expect(result.partners.some((partner) => partner.bridge)).toBe(true);
    const group = result.groups.find((group) => group.children.includes("root"))!;
    expect(group.childBridgeLanes).toBeGreaterThan(0);
    const geometry = familyConnectorGeometry(group, rects(result.positions))!;
    const barY = Math.max(...geometry.junctions.map((point) => point.y));
    expect(barY).toBeLessThan(result.positions.get("root")!.y - 18 - (group.childBridgeLanes - 1) * 16);
  });

  it("uses measured card dimensions for attachments and handles missing measurements", () => {
    const family = fixture([["root", "child", parent]]);
    const result = plan(family);
    const measured = rects(result.positions);
    measured.set("root", { ...measured.get("root")!, width: 200, height: 115 });
    const geometry = familyConnectorGeometry(result.groups[0], measured)!;
    expect(geometry.paths[0]).toMatch(/^M 100 115 /);
    measured.delete("child");
    expect(familyConnectorGeometry(result.groups[0], measured)).toBeNull();
  });

  it("retains individually routed edges for conflicting generation assignments", () => {
    const family = fixture([["root", "child", parent], ["child", "root", "guardian"]]);
    const result = plan(family);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].relationships[0].type).toBe("guardian");
    expect(result.direct).toHaveLength(1);
    expect(result.direct[0].from).toBe("root");
    expect([...result.positions.values()].every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  });
});
