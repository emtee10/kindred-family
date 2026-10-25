import { describe, expect, it } from "vitest";
import { Genealogy } from "./genealogy";
import { layoutFamily, lineageRows } from "./family-layout";
import { planFamilyConnections } from "./family-connections";
import { layoutNetwork, networkAdjacency, networkDistances, networkLegend, NETWORK_WIDTH, NETWORK_HEIGHT } from "./network-layout";
import { relationshipTypes, type Person, type Relationship } from "./types";

const person = (id: string): Person => ({ id, names: [{ given: id, type: "current" }], events: [], photos: [] });
const parent = "biological_parent";
function fixture() {
  return new Genealogy({
    people: ["root", "parent", "child", "sibling", "spouse", "partner", "far", "isolated", "island"].map(person),
    relationships: [
      ["parent", "root", parent], ["root", "child", parent],
      ["parent", "sibling", parent], ["root", "spouse", "spouse"],
      ["partner", "spouse", "partner"], ["partner", "far", "guardian"],
      ["sibling", "far", "step_parent"], ["spouse", "child", "adoptive_parent"],
      ["isolated", "island", "partner"],
    ].map(([from, to, type], i) => ({ id: `r${i}`, from, to, type: type as Relationship["type"] })),
  });
}

describe("radial network", () => {
  it("assigns parent, child, sibling and spouse to shortest-path rings", () => {
    const result = layoutNetwork(fixture(), "root");
    expect(Object.fromEntries(result.distances)).toEqual({ root: 0, parent: 1, child: 1, spouse: 1, sibling: 2, partner: 2, far: 3 });
    expect(result.positions.get("root")).toEqual({ x: 0, y: -0 });
    for (const [id, point] of result.positions) {
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(result.distances.get(id)! * result.step);
    }
  });

  it("uses a shorter path discovered through a spouse instead of the longer family path", () => {
    const family = fixture();
    family.data.relationships.push({ id: "shortcut", from: "far", to: "spouse", type: "partner" });
    const result = layoutNetwork(family, "root");
    expect(result.distances.get("far")).toBe(2);
    expect(result.relationships).toContainEqual(family.data.relationships.at(-1));
  });

  it.each(relationshipTypes)("traverses %s as one edge in either direction", (type) => {
    const adjacency = networkAdjacency(["a", "b"], [{ id: "edge", from: "a", to: "b", type }]);
    expect(networkDistances(adjacency, "a").get("b")).toBe(1);
    expect(networkDistances(adjacency, "b").get("a")).toBe(1);
  });

  it("preserves every actual visible edge, including same-ring edges and multiple roles", () => {
    const family = fixture();
    family.data.relationships.push({ id: "second-role", from: "root", to: "child", type: "guardian" });
    const result = layoutNetwork(family, "root");
    expect(result.relationships).toEqual(family.data.relationships.filter((r) => r.id !== "r8").sort((a, b) => a.id.localeCompare(b.id)));
    expect(result.relationships.find((r) => r.id === "r7")).toMatchObject({ from: "spouse", to: "child", type: "adoptive_parent" });
    expect(result.relationships.length).toBeGreaterThan(result.distances.size - 1);
  });

  it("preserves stored parent-to-child direction even when traversed toward a parent", () => {
    const family = fixture();
    for (const root of ["root", "child", "parent"]) {
      const result = layoutNetwork(family, root);
      expect(result.relationships.find((r) => r.id === "r0")).toMatchObject({ from: "parent", to: "root" });
      expect(result.relationships.find((r) => r.id === "r1")).toMatchObject({ from: "root", to: "child" });
    }
    const legend = networkLegend(relationshipTypes);
    expect(legend.map((entry) => entry.text)).toContain("Biological: parent → child");
    expect(legend.map((entry) => entry.text)).toContain("Biological: child → parent");
    expect(legend.filter((entry) => entry.direction === "in")).toHaveLength(4);
    expect(legend.filter((entry) => entry.direction === "out")).toHaveLength(4);
    expect(legend.filter((entry) => entry.direction === "none").map((entry) => entry.text)).toEqual(["Spouse", "Partner"]);
    expect(networkLegend(["partner"])).toHaveLength(1);
  });

  it("is deterministic even when people and relationship input order changes", () => {
    const family = fixture();
    const first = layoutNetwork(family, "root");
    const reordered = new Genealogy({ people: [...family.data.people].reverse(), relationships: [...family.data.relationships].reverse() });
    expect(layoutNetwork(reordered, "root")).toEqual(first);
    expect(layoutNetwork(family, "root")).toEqual(first);
  });

  it("separates disconnected people and tolerates unknown endpoints or a missing root", () => {
    const family = fixture();
    family.data.relationships.push({ id: "invalid", from: "missing", to: "root", type: parent });
    const result = layoutNetwork(family, "root");
    expect(result.disconnected).toEqual(["island", "isolated"]);
    expect(result.positions.has("isolated")).toBe(false);
    expect(result.relationships.some((r) => r.id === "invalid")).toBe(false);
    expect(layoutNetwork(family, "missing").positions.size).toBe(0);
    const isolated = layoutNetwork(family, "island");
    expect(isolated.distances.size).toBe(2);
    expect(isolated.distances.get("isolated")).toBe(1);
    expect(layoutNetwork(new Genealogy({ people: [person("solo")], relationships: [] }), "solo").rings.get(0)).toEqual(["solo"]);
  });

  it("recomputes distances and centres when another person is selected", () => {
    const family = fixture();
    const before = layoutNetwork(family, "root");
    const after = layoutNetwork(family, "sibling");
    expect(after.distances.get("sibling")).toBe(0);
    expect(Math.hypot(after.positions.get("sibling")!.x, after.positions.get("sibling")!.y)).toBe(0);
    expect(after.distances.get("root")).toBe(2);
    expect(after.distances.get("child")).toBe(3);
    expect(after.relationships).toEqual(before.relationships);
  });

  it("expands dense rings without shrinking or overlapping nodes", () => {
    const people = [person("root"), ...Array.from({ length: 60 }, (_, i) => person(`p${i}`))];
    const result = layoutNetwork(new Genealogy({ people, relationships: people.slice(1).map((p) => ({ id: p.id, from: "root", to: p.id, type: parent })) }), "root");
    const points = [...result.positions.values()];
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      expect(Math.abs(points[i].x - points[j].x) >= NETWORK_WIDTH || Math.abs(points[i].y - points[j].y) >= NETWORK_HEIGHT).toBe(true);
    }
  });

  it("leaves existing family, extended, lineage and path results unchanged", () => {
    const family = fixture();
    const data = JSON.stringify(family.data);
    const existing = () => [false, true].map((extended) => {
      const rows = family.familyMembers("root", extended);
      return planFamilyConnections(family, rows, layoutFamily(family, "root", rows));
    }).concat(...(["ancestors", "descendants"] as const).map((view) => {
      const rows = lineageRows(family, "root", view, 3);
      return [planFamilyConnections(family, rows, layoutFamily(family, "root", rows, { groupPartners: false }), { includePartners: false })];
    }));
    const before = existing(), path = family.path("root", "far");
    layoutNetwork(family, "root");
    layoutNetwork(family, "child");
    expect(existing()).toEqual(before);
    expect(family.path("root", "far")).toEqual(path);
    expect(JSON.stringify(family.data)).toBe(data);
  });
});
