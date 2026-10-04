import { describe, expect, it } from "vitest";
import { loadFamily } from "../data/load";
import { Genealogy, displayName, formatDate } from "./genealogy";
import { kinship } from "./kinship";
import { confidence, type Person } from "./types";
import { validateFamily } from "./validation";

const family = loadFamily();
const person = (id: string): Person => ({
  id,
  names: [{ given: id, type: "current" }],
  photos: [],
  events: [],
});
describe("family exploration", () => {
  it("loads synthetic records and resolves parents, children and partners", () => {
    expect(family.people.size).toBe(26);
    expect(family.parents("elara")).toEqual(["rowan", "hazel"]);
    expect(family.children("elara")).toEqual(["piper", "kit"]);
    expect(family.partners("theo")).toEqual(["celia", "sylvie"]);
  });
  it("distinguishes full siblings and half-siblings without counting step parents as biological", () => {
    expect(family.siblings("elara")).toContainEqual({
      id: "milo",
      half: false,
      kind: "biological",
    });
    expect(family.siblings("finn")).toContainEqual({
      id: "wren",
      half: false,
      kind: "biological",
    });
    expect(family.siblings("finn")).toContainEqual({
      id: "lark",
      half: true,
      kind: "biological",
    });
  });
  it("bounds ancestor and descendant traversal", () => {
    expect(family.traverse("piper", "ancestors", 2).get("rowan")).toBe(2);
    expect(family.traverse("piper", "ancestors", 2).has("ada")).toBe(false);
    expect(family.traverse("ada", "descendants", 3).get("piper")).toBe(3);
  });
  it("safely traverses directed cycles and collapses repeated ancestors", () => {
    const g = new Genealogy({
      people: ["a", "b", "c", "d"].map(person),
      relationships: [
        { id: "1", from: "a", to: "b", type: "biological_parent" },
        { id: "2", from: "b", to: "c", type: "biological_parent" },
        { id: "3", from: "c", to: "a", type: "guardian" },
        { id: "4", from: "a", to: "d", type: "biological_parent" },
        { id: "5", from: "d", to: "c", type: "biological_parent" },
      ],
    });
    expect(g.traverse("a", "descendants", 100).size).toBe(4);
    expect(g.traverse("c", "ancestors", 100).size).toBe(4);
    expect(g.path("a", "c")?.edges).toHaveLength(1);
  });
  it("finds shortest routes in either direction through every supported connection", () => {
    for (const type of [
      "biological_parent",
      "adoptive_parent",
      "step_parent",
      "guardian",
      "spouse",
      "partner",
    ] as const) {
      const g = new Genealogy({
        people: [person("a"), person("b")],
        relationships: [{ id: "r", from: "a", to: "b", type }],
      });
      expect(g.path("b", "a")?.edges[0].type).toBe(type);
    }
    expect(family.path("milo", "sage")?.edges[0].type).toBe("partner");
    expect(family.path("elara", "arden")?.edges).toHaveLength(1);
    expect(family.path("robin", "sage")?.edges[0].type).toBe("adoptive_parent");
    expect(family.path("ash", "lark")?.edges[0].type).toBe("guardian");
    expect(family.path("unknown", "elara")).toBeNull();
    expect(family.path("elara", "elara")?.edges).toEqual([]);
    const disconnected = new Genealogy({
      people: [person("a"), person("b")],
      relationships: [],
    });
    expect(disconnected.path("a", "b")).toBeNull();
  });
  it("searches changed names, alternate names and nicknames", () => {
    expect(family.search("Hazel Mossvale")[0].id).toBe("hazel");
    expect(family.search("ellie")[0].id).toBe("elara");
    expect(
      displayName({
        ...person("a"),
        names: [
          { given: "Old", type: "former" },
          { given: "New", type: "current" },
        ],
      }),
    ).toBe("New");
    expect(
      displayName({
        ...person("a"),
        names: [
          { given: "Nick", type: "nickname" },
          { given: "Birth", type: "birth" },
        ],
      }),
    ).toBe("Birth");
    expect(
      displayName({
        ...person("a"),
        names: [{ given: "Nick", type: "nickname" }],
      }),
    ).toBe("Nick");
  });
});
describe("kinship", () => {
  it("labels confirmed biological relatives", () => {
    expect(kinship(family, "elara", "hazel")).toBe("mother");
    expect(kinship(family, "piper", "rowan")).toBe("grandfather");
    expect(kinship(family, "piper", "ada")).toBe("great-grandmother");
    expect(kinship(family, "elara", "milo")).toBe("brother");
    expect(kinship(family, "elara", "theo")).toBe("uncle");
    expect(kinship(family, "theo", "elara")).toBe("niece");
    expect(kinship(family, "elara", "finn")).toBe("first cousin");
    expect(kinship(family, "piper", "finn")).toBe("first cousin once removed");
    expect(kinship(family, "piper", "clover")).toBe("second cousin");
  });
  it("declines labels through non-biological, uncertain or ambiguous half-sibling paths", () => {
    expect(kinship(family, "elara", "arden")).toBeNull();
    expect(kinship(family, "robin", "milo")).toBeNull();
    expect(kinship(family, "ash", "lark")).toBeNull();
    expect(kinship(family, "finn", "sylvie")).toBeNull();
    expect(kinship(family, "edwin", "orin")).toBeNull();
    expect(kinship(family, "finn", "lark")).toBeNull();
  });
});
describe("dates and confidence", () => {
  it("formats exact, partial, approximate, before, after and range dates without timezones", () => {
    expect(formatDate({ value: "1942-05-18", qualifier: "exact" })).toBe(
      "18 May 1942",
    );
    expect(formatDate({ value: "1942-05", qualifier: "exact" })).toBe(
      "May 1942",
    );
    expect(formatDate({ value: "1942", qualifier: "about" })).toBe("c. 1942");
    expect(formatDate({ value: "1890", qualifier: "before" })).toBe(
      "before 1890",
    );
    expect(formatDate({ value: "1890", qualifier: "after" })).toBe(
      "after 1890",
    );
    expect(formatDate({ start: "1910", end: "1914", qualifier: "range" })).toBe(
      "1910 – 1914",
    );
    expect(formatDate(null)).toBe("Unknown");
    expect(confidence()).toBe("confirmed");
  });
});
describe("runtime validation", () => {
  it("accepts sparse records and default qualifiers", () => {
    const result = validateFamily(
      [
        {
          id: "a",
          names: [{ given: "A", type: "current" }],
          birth: { date: { value: "2000" } },
        },
      ],
      [],
    );
    expect(result.people[0].birth?.date?.qualifier).toBe("exact");
    expect(result.people[0].photos).toEqual([]);
  });
  it("identifies invalid references and duplicate IDs", () => {
    expect(() =>
      validateFamily(
        [person("a")],
        [{ id: "bad", from: "a", to: "missing", type: "spouse" }],
      ),
    ).toThrow("Relationship bad: unknown person reference");
    expect(() => validateFamily([person("a"), person("a")], [])).toThrow(
      "Duplicate person ID",
    );
    const r = { id: "r", from: "a", to: "b", type: "spouse" };
    expect(() => validateFamily([person("a"), person("b")], [r, r])).toThrow(
      "Duplicate relationship ID",
    );
    expect(() => validateFamily([person("a")], [{ ...r, to: "a" }])).toThrow(
      "self relationships",
    );
  });
  it.each([
    { names: [] },
    { names: [{ given: "", type: "current" }] },
    { birth: { date: { value: "2001-02-29" } } },
    { birth: { date: { value: "2020-13" } } },
    { birth: { date: { start: "2020", end: "2019", qualifier: "range" } } },
    { birth: { date: { value: "1942", confidence: "maybe" } } },
    { events: [{ type: "baptism" }] },
    { photos: Array(4).fill({ file: "portrait.webp" }) },
    { photos: [{ file: "../private.webp" }] },
    {
      photos: [
        { file: "a.webp", primary: true },
        { file: "b.webp", primary: true },
      ],
    },
  ])("rejects malformed record %j", (change) => {
    expect(() =>
      validateFamily([{ ...person("record"), ...change }], []),
    ).toThrow();
  });
  it("rejects missing required fields and unsupported relationship types with record context", () => {
    expect(() =>
      validateFamily([{ names: [{ given: "A", type: "current" }] }], []),
    ).toThrow("people.0.id");
    expect(() =>
      validateFamily(
        [person("a"), person("b")],
        [{ id: "bad", from: "a", to: "b", type: "sibling" }],
      ),
    ).toThrow("(bad)");
    expect(() => validateFamily([], [])).toThrow("Add at least one person");
  });
});
