import {
  isParent,
  type Person,
  type Relationship,
  type FamilyData,
  type FamilyDate,
} from "./types";

export function displayName(p: Person) {
  const n =
    p.names.find((n) => n.type === "current") ??
    p.names.find((n) => n.type !== "nickname") ??
    p.names[0];
  return [n.given, n.surname].filter(Boolean).join(" ");
}
export function initials(p: Person) {
  return displayName(p)
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}
export function formatDate(date?: FamilyDate | null): string {
  if (!date) return "Unknown";
  const format = (value: string) => {
    const [y, m, d] = value.split("-");
    const month = m
      ? [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ][Number(m) - 1]
      : "";
    return [d ? Number(d).toString() : "", month, y].filter(Boolean).join(" ");
  };
  if (date.qualifier === "range")
    return `${format(date.start)} – ${format(date.end)}`;
  return `${{ exact: "", about: "c. ", before: "before ", after: "after " }[date.qualifier]}${format(date.value)}`;
}
export function lifespan(p: Person) {
  const year = (d?: FamilyDate | null) =>
    !d
      ? "?"
      : d.qualifier === "range"
        ? `${d.start.slice(0, 4)}–${d.end.slice(0, 4)}`
        : `${d.qualifier === "about" ? "c. " : d.qualifier === "before" ? "< " : d.qualifier === "after" ? "> " : ""}${d.value.slice(0, 4)}`;
  if (!p.birth?.date && !p.death) return "Dates not recorded";
  return p.death
    ? `${year(p.birth?.date)} – ${year(p.death.date)}`
    : `b. ${year(p.birth?.date)}`;
}
export class Genealogy {
  people: Map<string, Person>;
  constructor(public data: FamilyData) {
    this.people = new Map(data.people.map((p) => [p.id, p]));
  }
  parents(id: string) {
    return this.data.relationships
      .filter((r) => isParent(r) && r.to === id)
      .map((r) => r.from);
  }
  children(id: string) {
    return this.data.relationships
      .filter((r) => isParent(r) && r.from === id)
      .map((r) => r.to);
  }
  partners(id: string) {
    return this.data.relationships
      .filter((r) => !isParent(r) && (r.from === id || r.to === id))
      .map((r) => (r.from === id ? r.to : r.from));
  }
  siblings(
    id: string,
  ): { id: string; half: boolean; kind: "biological" | "family" }[] {
    const allParents = new Set(this.parents(id));
    const bioParents = new Set(
      this.data.relationships
        .filter((r) => r.type === "biological_parent" && r.to === id)
        .map((r) => r.from),
    );
    return [
      ...new Set([...allParents].flatMap((parent) => this.children(parent))),
    ]
      .filter((other) => other !== id)
      .map((other) => {
        const otherBio = this.data.relationships
          .filter((r) => r.type === "biological_parent" && r.to === other)
          .map((r) => r.from);
        const sharedBio = otherBio.filter((parent) => bioParents.has(parent));
        return {
          id: other,
          half:
            sharedBio.length === 1 &&
            bioParents.size >= 2 &&
            otherBio.length >= 2,
          kind: sharedBio.length ? "biological" : "family",
        };
      });
  }
  traverse(
    id: string,
    direction: "ancestors" | "descendants",
    generations: number,
  ): Map<string, number> {
    const result = new Map([[id, 0]]);
    const queue = [id];
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i],
        depth = result.get(current)!;
      if (depth >= generations) continue;
      for (const next of direction === "ancestors"
        ? this.parents(current)
        : this.children(current)) {
        if (!result.has(next)) {
          result.set(next, depth + 1);
          queue.push(next);
        }
      }
    }
    return result;
  }
  immediate(id: string) {
    return new Set([
      id,
      ...this.parents(id),
      ...this.children(id),
      ...this.partners(id),
      ...this.siblings(id).map((s) => s.id),
    ]);
  }
  search(query: string) {
    const normalize = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const terms = normalize(query).trim().split(/\s+/);
    return this.data.people
      .filter((p) =>
        p.names.some((n) =>
          terms.every((term) =>
            normalize(`${n.given} ${n.surname ?? ""}`).includes(term),
          ),
        ),
      )
      .sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }
  path(
    from: string,
    to: string,
  ): { people: string[]; edges: Relationship[] } | null {
    if (!this.people.has(from) || !this.people.has(to)) return null;
    const seen = new Set([from]),
      queue = [{ people: [from], edges: [] as Relationship[] }];
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i],
        current = item.people[item.people.length - 1];
      if (current === to) return item;
      for (const edge of this.data.relationships.filter(
        (r) => r.from === current || r.to === current,
      )) {
        const next = edge.from === current ? edge.to : edge.from;
        if (!seen.has(next)) {
          seen.add(next);
          queue.push({
            people: [...item.people, next],
            edges: [...item.edges, edge],
          });
        }
      }
    }
    return null;
  }
}
export function edgeLabel(r: Relationship, from = r.from) {
  if (!isParent(r)) return r.type === "spouse" ? "spouse of" : "partner of";
  const kind =
    r.type === "biological_parent"
      ? ""
      : r.type === "guardian"
        ? "guardian"
        : r.type === "adoptive_parent"
          ? "adoptive"
          : "step";
  if (r.type === "guardian") return from === r.from ? "guardian of" : "ward of";
  return `${kind ? `${kind} ` : ""}${from === r.from ? "parent of" : "child of"}`;
}
