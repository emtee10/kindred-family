import { z } from "zod";
import { personSchema, relationshipSchema, type FamilyData } from "./types";

export function validateFamily(
  people: unknown,
  relationships: unknown,
): FamilyData {
  const result = z
    .object({
      people: z.array(personSchema).min(1, "Add at least one person"),
      relationships: z.array(relationshipSchema),
    })
    .safeParse({ people, relationships });
  if (!result.success) {
    throw new Error(
      result.error.issues
        .map((issue) => {
          const [group, index] = issue.path;
          const records = group === "people" ? people : relationships;
          const id =
            Array.isArray(records) && typeof index === "number"
              ? records[index]?.id
              : undefined;
          const message =
            issue.code === "invalid_union"
              ? `Invalid date structure. ${[...new Set(issue.errors.flat().map((detail) => detail.message))].join("; ")}`
              : issue.message;
          return `${issue.path.join(".")} ${id ? `(${id}) ` : ""}: ${message}`;
        })
        .join("\n"),
    );
  }
  const data = result.data;
  const errors: string[] = [];
  for (const [label, records] of [
    ["person", data.people],
    ["relationship", data.relationships],
  ] as const) {
    const seen = new Set<string>();
    for (const record of records) {
      if (seen.has(record.id))
        errors.push(`Duplicate ${label} ID: ${record.id}`);
      seen.add(record.id);
    }
  }
  const ids = new Set(data.people.map((p) => p.id));
  for (const r of data.relationships) {
    if (!ids.has(r.from) || !ids.has(r.to))
      errors.push(
        `Relationship ${r.id}: unknown person reference (${r.from} → ${r.to})`,
      );
    if (r.from === r.to)
      errors.push(`Relationship ${r.id}: self relationships are not supported`);
  }
  for (const p of data.people)
    if (p.photos.filter((photo) => photo.primary).length > 1)
      errors.push(`Person ${p.id}: only one photo can be primary`);
  if (errors.length) throw new Error(errors.join("\n"));
  return data;
}
