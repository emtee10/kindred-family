import { Genealogy } from "./genealogy";
import { confidence } from "./types";

/** Labels describe the second person relative to the first; only confirmed biological routes qualify. */
export function kinship(g: Genealogy, from: string, to: string): string | null {
  if (from === to) return "same person";
  const route = g.path(from, to);
  if (
    !route ||
    route.edges.some(
      (r) =>
        r.type !== "biological_parent" ||
        confidence(r.confidence) !== "confirmed",
    )
  )
    return null;
  const up = route.edges.map((r, i) => r.to === route.people[i]);
  const firstDown = up.indexOf(false);
  const ups = firstDown === -1 ? up.length : firstDown;
  if (up.slice(ups).some(Boolean)) return null;
  const downs = up.length - ups;
  const sex = g.people.get(to)?.sex;
  const gendered = (female: string, male: string, neutral: string) =>
    sex === "female" ? female : sex === "male" ? male : neutral;
  const grand = (count: number, base: string) =>
    count === 1 ? base : `${"great-".repeat(count - 2)}grand${base}`;
  if (!downs) return grand(ups, gendered("mother", "father", "parent"));
  if (!ups) return grand(downs, gendered("daughter", "son", "child"));
  // Require two shared, confirmed biological parents before asserting full sibling/cousin labels.
  const left = route.people[ups - 1],
    right = route.people[ups + 1];
  const parents = (id: string) =>
    g.data.relationships
      .filter(
        (r) =>
          r.to === id &&
          r.type === "biological_parent" &&
          confidence(r.confidence) === "confirmed",
      )
      .map((r) => r.from);
  if (parents(left).filter((id) => parents(right).includes(id)).length < 2)
    return null;
  if (ups === 1 && downs === 1) return gendered("sister", "brother", "sibling");
  if (downs === 1)
    return `${"great-".repeat(ups - 2)}${gendered("aunt", "uncle", "aunt or uncle")}`;
  if (ups === 1)
    return `${"great-".repeat(downs - 2)}${gendered("niece", "nephew", "niece or nephew")}`;
  const degree = Math.min(ups, downs) - 1,
    removed = Math.abs(ups - downs);
  const ordinal =
    ["first", "second", "third", "fourth", "fifth"][degree - 1] ??
    `${degree}th`;
  return `${ordinal} cousin${removed ? ` ${removed === 1 ? "once" : removed === 2 ? "twice" : `${removed} times`} removed` : ""}`;
}
