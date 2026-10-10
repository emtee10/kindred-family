import { describe, expect, it } from "vitest";
import { Genealogy } from "./genealogy";
import { layoutFamily } from "./family-layout";
import {
  familyConnectorGeometry,
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

  it("preserves types and confidence, with individual connections for mixed parentage", () => {
    const family = fixture([
      ["root", "adopted", "adoptive_parent"],
      ["root", "ward", "guardian", "possible"],
      ["root", "mixed", parent], ["other", "mixed", "step_parent"],
      ["root", "other", "partner"],
    ]);
    const result = plan(family);
    expect(result.groups.map((group) => group.children)).toEqual([["adopted"], ["ward"]]);
    expect(result.groups[0].relationships[0].type).toBe("adoptive_parent");
    expect(result.groups[1].relationships[0].confidence).toBe("possible");
    expect(result.direct.map((r) => r.to)).toEqual(["mixed", "mixed"]);
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
