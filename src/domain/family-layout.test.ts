import { describe, expect, it } from "vitest";
import { Genealogy } from "./genealogy";
import { layoutFamily, lineageRows } from "./family-layout";
import { planFamilyConnections } from "./family-connections";
import type { Person, Relationship } from "./types";

const person = (id: string): Person => ({
  id, names: [{ given: id, type: "current" }], photos: [], events: [],
});
function genealogy(links: [string, string, Relationship["type"]][]) {
  return new Genealogy({
    people: [...new Set(links.flatMap(([from, to]) => [from, to]))].map(person),
    relationships: links.map(([from, to, type], index) => ({
      id: String(index), from, to, type,
    })),
  });
}
const parent = "biological_parent";

describe("family graph layout", () => {
  it("centers ancestors above their children and respects the generation limit", () => {
    const family = genealogy([
      ["parent-a", "root", parent], ["parent-b", "root", parent],
      ["grandparent-a", "parent-a", parent], ["grandparent-b", "parent-a", parent],
      ["grandparent-c", "parent-b", parent],
      ["great-grandparent", "grandparent-a", parent],
      ["parent-a", "parent-b", "spouse"],
    ]);
    const levels = lineageRows(family, "root", "ancestors", 2);
    const result = planFamilyConnections(family, levels, layoutFamily(family, "root", levels, { groupPartners: false }), { includePartners: false });
    const x = (id: string) => result.positions.get(id)!.x;
    expect(result.positions.get("root")).toEqual({ x: 0, y: 0 });
    expect(Math.abs((x("parent-a") + x("parent-b")) / 2)).toBeLessThan(2);
    expect(Math.abs((x("grandparent-a") + x("grandparent-b")) / 2 - x("parent-a"))).toBeLessThan(2);
    expect(Math.abs(x("grandparent-c") - x("parent-b"))).toBeLessThan(2);
    expect(levels.get("parent-a")).toBe(-1);
    expect(levels.get("grandparent-a")).toBe(-2);
    expect(levels.has("great-grandparent")).toBe(false);
    expect(result.partners).toEqual([]);
    expect(result.groups.flatMap((group) => group.relationships)).toHaveLength(5);
  });

  it("centers unequal descendant branches below their parents", () => {
    const family = genealogy([
      ["root", "child-a", parent], ["root", "child-b", parent],
      ["child-a", "grandchild-a", parent], ["child-a", "grandchild-b", parent],
      ["child-a", "grandchild-c", parent], ["child-b", "grandchild-d", parent],
      ["grandchild-b", "great-grandchild", parent],
    ]);
    const levels = lineageRows(family, "root", "descendants", 2);
    const result = planFamilyConnections(family, levels, layoutFamily(family, "root", levels, { groupPartners: false }), { includePartners: false });
    const x = (id: string) => result.positions.get(id)!.x;
    expect(result.positions.get("root")).toEqual({ x: 0, y: 0 });
    expect(Math.abs((x("child-a") + x("child-b")) / 2)).toBeLessThan(2);
    expect(Math.abs((x("grandchild-a") + x("grandchild-b") + x("grandchild-c")) / 3 - x("child-a"))).toBeLessThan(2);
    expect(Math.abs(x("grandchild-d") - x("child-b"))).toBeLessThan(2);
    expect(levels.get("child-a")).toBe(1);
    expect(levels.get("grandchild-a")).toBe(2);
    expect(levels.has("great-grandchild")).toBe(false);
    expect(result.groups).toHaveLength(3);
    for (const level of new Set(levels.values())) {
      const xs = [...levels].filter(([, row]) => row === level)
        .map(([id]) => x(id)).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) {
        expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(235 - 1e-6);
      }
    }
  });

  it("places a child's branch beneath its parents rather than an aunt", () => {
    const family = genealogy([
      ["grandparent", "parent", parent],
      ["grandparent", "aunt", parent],
      ["parent", "root", parent],
      ["parent", "sibling", parent],
      ["root", "child", parent],
      ["sibling", "niece", parent],
      ["child", "grandchild", parent],
    ]);
    const positions = layoutFamily(family, "root", family.familyMembers("root", true));
    const x = (id: string) => positions.get(id)!.x;
    expect(Math.abs(x("parent") - (x("root") + x("sibling")) / 2)).toBeLessThan(2);
    expect(Math.abs(x("child") - x("root"))).toBeLessThan(2);
    expect(Math.abs(x("niece") - x("sibling"))).toBeLessThan(2);
    expect(Math.abs(x("grandchild") - x("child"))).toBeLessThan(2);
    expect(Math.abs(x("root") - x("parent"))).toBeLessThan(Math.abs(x("root") - x("aunt")));
    expect(positions.get("root")).toEqual({ x: 0, y: 0 });
    expect(positions.get("grandparent")!.y).toBe(-420);
    expect(positions.get("grandchild")!.y).toBe(420);
  });

  it("keeps partners adjacent and centers their shared children beneath them", () => {
    const family = genealogy([
      ["parent", "root", parent], ["parent", "sibling", parent],
      ["root", "partner", "spouse"],
      ["root", "child-a", parent], ["partner", "child-a", parent],
      ["root", "child-b", parent], ["partner", "child-b", parent],
      ["sibling", "niece", parent],
    ]);
    for (const extended of [false, true]) {
      const positions = layoutFamily(family, "root", family.familyMembers("root", extended));
      const x = (id: string) => positions.get(id)!.x;
      expect(Math.abs(x("root") - x("partner"))).toBe(235);
      expect(Math.abs((x("child-a") + x("child-b")) / 2 - (x("root") + x("partner")) / 2)).toBeLessThan(2);
      expect(Math.abs(x("sibling") - x("root"))).toBeGreaterThanOrEqual(235);
      expect(Math.abs(x("sibling") - x("partner"))).toBeGreaterThanOrEqual(235);
    }
  });

  it("makes room for unequal branches without overlapping cards", () => {
    const family = genealogy([
      ["parent", "root", parent], ["parent", "sibling", parent],
      ...Array.from({ length: 5 }, (_, i): [string, string, Relationship["type"]] => ["root", `child-${i}`, parent]),
      ["sibling", "niece", parent],
      ["child-2", "grandchild-a", parent], ["child-2", "grandchild-b", parent],
    ]);
    const levels = family.familyMembers("root", true);
    const positions = layoutFamily(family, "root", levels);
    const childCenter = Array.from({ length: 5 }, (_, i) => positions.get(`child-${i}`)!.x)
      .reduce((sum, x) => sum + x, 0) / 5;
    expect(Math.abs(childCenter - positions.get("root")!.x)).toBeLessThan(2);
    expect(Math.abs(positions.get("niece")!.x - positions.get("sibling")!.x)).toBeLessThan(2);
    for (const level of new Set(levels.values())) {
      const xs = [...levels].filter(([, row]) => row === level)
        .map(([id]) => positions.get(id)!.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) {
        expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(235 - 1e-6);
      }
    }
    expect(layoutFamily(family, "root", levels)).toEqual(positions);
  });

  it("aligns adoptive, step and guardian children and ignores hidden parents", () => {
    const family = genealogy([
      ["root", "child-a", "adoptive_parent"],
      ["root", "child-b", "step_parent"],
      ["root", "child-c", "guardian"],
      ["hidden", "child-a", parent],
    ]);
    const positions = layoutFamily(family, "root", family.familyMembers("root"));
    expect(positions.has("hidden")).toBe(false);
    expect((positions.get("child-a")!.x + positions.get("child-c")!.x) / 2).toBe(0);
    expect(positions.get("child-b")!.x).toBe(0);
  });

  it("centers shared children between visible parents without a partner record", () => {
    const family = genealogy([
      ["parent-a", "root", parent], ["parent-b", "root", parent],
      ["parent-a", "sibling", parent], ["parent-b", "sibling", parent],
      ["root", "child", parent],
    ]);
    const positions = layoutFamily(family, "root", family.familyMembers("root", true));
    const x = (id: string) => positions.get(id)!.x;
    expect(Math.abs((x("root") + x("sibling")) / 2 - (x("parent-a") + x("parent-b")) / 2)).toBeLessThan(2);
    expect(Math.abs(x("child") - x("root"))).toBeLessThan(2);
  });

  it("handles isolated people and conflicting generations without invalid positions", () => {
    const isolated = new Genealogy({ people: [person("root")], relationships: [] });
    expect(layoutFamily(isolated, "root", isolated.familyMembers("root", true)))
      .toEqual(new Map([["root", { x: 0, y: 0 }]]));
    const cyclic = genealogy([
      ["root", "child", parent], ["child", "root", "guardian"],
    ]);
    const levels = cyclic.familyMembers("root", true);
    const positions = layoutFamily(cyclic, "root", levels);
    for (const [id, position] of positions) {
      expect(Number.isFinite(position.x)).toBe(true);
      expect(position.y).toBe(levels.get(id)! * 210);
    }
  });
});
