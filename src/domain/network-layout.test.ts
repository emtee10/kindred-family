import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Genealogy } from "./genealogy";
import { layoutFamily, lineageRows } from "./family-layout";
import { planFamilyConnections } from "./family-connections";
import { layoutNetwork, networkEdgePath, networkAdjacency, networkDistances, networkLegend, NETWORK_WIDTH, NETWORK_HEIGHT } from "./network-layout";
import { validateFamily } from "./validation";
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
  it.each([0, 1, 2, 3, 10])("limits nodes, edges and rings to %s edges from the index", (maxEdges) => {
    const family = fixture();
    const all = networkDistances(networkAdjacency(family.people.keys(), family.data.relationships), "root");
    const result = layoutNetwork(family, "root", maxEdges);
    expect(Object.fromEntries(result.distances)).toEqual(Object.fromEntries([...all].filter(([, depth]) => depth <= maxEdges)));
    expect([...result.positions.keys()]).toEqual([...result.distances.keys()]);
    expect([...result.rings.keys()].every((depth) => depth <= maxEdges)).toBe(true);
    expect(result.relationships).toHaveLength(result.positions.size - 1);
    expect(result.relationships.every((r) => result.positions.has(r.from) && result.positions.has(r.to))).toBe(true);
    expect(result.beyondDepth).toEqual([...all].filter(([, depth]) => depth > maxEdges).map(([id]) => id).sort());
    expect(result.disconnected).toEqual(["island", "isolated"]);
    const displayed = networkDistances(networkAdjacency(result.positions.keys(), result.relationships), "root");
    expect(Object.fromEntries(displayed)).toEqual(Object.fromEntries(result.distances));
  });

  it("supports the ten-edge limit inclusively and recalculates from a new index", () => {
    const ids = Array.from({ length: 13 }, (_, i) => `person${i}`);
    const family = new Genealogy({ people: ids.map(person), relationships: ids.slice(1).map((to, i) => ({
      id: `r${i}`, from: ids[i], to, type: parent,
    })) });
    const result = layoutNetwork(family, ids[0], 10);
    expect(result.positions.size).toBe(11);
    expect(result.distances.get(ids[10])).toBe(10);
    expect(result.positions.has(ids[11])).toBe(false);
    expect(result.beyondDepth).toEqual([ids[11], ids[12]]);
    expect(result.disconnected).toEqual([]);
    expect(layoutNetwork(family, ids[0])).toEqual(result);
    const recentered = layoutNetwork(family, ids[12], 1);
    expect([...recentered.positions.keys()]).toEqual([ids[12], ids[11]]);
    expect(recentered.distances.get(ids[12])).toBe(0);
  });

  it("positions branches using only retained shortest-path relationships", () => {
    const family = fixture();
    const before = layoutNetwork(family, "root");
    family.data.relationships.push({ id: "alternate", from: "spouse", to: "sibling", type: "guardian" });
    const after = layoutNetwork(family, "root");
    expect(after.relationships).toEqual(before.relationships);
    expect(after.positions).toEqual(before.positions);
  });

  it("keeps each branch contiguous and routes around cards for every index in the actual archive", () => {
    const family = new Genealogy(validateFamily(
      JSON.parse(readFileSync("private-data/people.json", "utf8")),
      JSON.parse(readFileSync("private-data/relationships.json", "utf8")),
    ));
    const collisions: string[] = [];
    for (const root of family.people.keys()) {
      const layout = layoutNetwork(family, root);
      const adjacency = networkAdjacency(layout.positions.keys(), layout.relationships);
      const points = [...layout.positions];
      for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
        const [a, p] = points[i], [b, q] = points[j];
        if (Math.abs(p.x - q.x) < NETWORK_WIDTH && Math.abs(p.y - q.y) < NETWORK_HEIGHT) collisions.push(`${root}: ${a} overlaps ${b}`);
      }
      for (const branch of adjacency.get(root)!) {
        const descendants = new Set([branch]);
        const queue = [branch];
        for (let i = 0; i < queue.length; i++) for (const next of adjacency.get(queue[i])!) {
          if (layout.distances.get(next)! <= layout.distances.get(queue[i])!) continue;
          descendants.add(next);
          queue.push(next);
        }
        for (const ring of layout.rings.values()) {
          const indices = ring.flatMap((id, index) => descendants.has(id) ? [index] : []);
          if (indices.length) expect(indices.at(-1)! - indices[0] + 1).toBe(indices.length);
        }
      }
      for (const relationship of layout.relationships) {
        const path = networkEdgePath(layout, relationship)!;
        expect(path).not.toMatch(/NaN|Infinity/);
        let previous = { x: 0, y: 0 };
        for (const match of path.matchAll(/([MLA]) ([^MLA]+)/g)) {
          const values = match[2].trim().split(/\s+/).map(Number);
          const end = { x: values.at(-2)!, y: values.at(-1)! };
          if (match[1] !== "M") {
            const angle = Math.atan2(previous.y, previous.x);
            let sweep = Math.atan2(end.y, end.x) - angle;
            if (values[4] === 1 && sweep < 0) sweep += 2 * Math.PI;
            if (values[4] === 0 && sweep > 0) sweep -= 2 * Math.PI;
            for (let i = 0; i <= 30; i++) {
              const t = i / 30;
              const sample = match[1] === "A"
                ? { x: values[0] * Math.cos(angle + sweep * t), y: values[0] * Math.sin(angle + sweep * t) }
                : { x: previous.x + (end.x - previous.x) * t, y: previous.y + (end.y - previous.y) * t };
              for (const [id, card] of points) {
                if (Math.abs(sample.x - card.x) < NETWORK_WIDTH / 2 - 1e-6 && Math.abs(sample.y - card.y) < NETWORK_HEIGHT / 2 - 1e-6) {
                  collisions.push(`${root}: ${relationship.id} passes through ${id}`);
                }
              }
            }
          }
          previous = end;
        }
      }
    }
    expect(collisions).toEqual([]);
  });

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

  it("keeps one shortest route per person and removes same-ring links and duplicate roles", () => {
    const family = fixture();
    family.data.relationships.push({ id: "second-role", from: "root", to: "child", type: "guardian" });
    const result = layoutNetwork(family, "root");
    expect(result.relationships.some((r) => r.id === "r7" || r.id === "second-role")).toBe(false);
    expect(result.relationships.find((r) => r.id === "r1")).toMatchObject({ from: "root", to: "child", type: parent });
    expect(result.relationships).toHaveLength(result.distances.size - 1);
    const displayedDistances = networkDistances(networkAdjacency(family.people.keys(), result.relationships), "root");
    expect(Object.fromEntries(displayedDistances)).toEqual(Object.fromEntries(result.distances));
    for (const r of result.relationships) {
      expect(Math.abs(result.distances.get(r.from)! - result.distances.get(r.to)!)).toBe(1);
    }
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
    expect(after.relationships).not.toEqual(before.relationships);
    expect(after.relationships).toHaveLength(after.distances.size - 1);
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
