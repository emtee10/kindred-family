import { z } from "zod";

export const confidenceSchema = z.enum([
  "confirmed",
  "probable",
  "possible",
  "speculative",
]);
export type Confidence = z.infer<typeof confidenceSchema>;
const iso = z
  .string()
  .regex(/^\d{4}(-\d{2})?(-\d{2})?$/, "Use YYYY, YYYY-MM, or YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    if (month !== undefined && (month < 1 || month > 12)) return false;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day !== undefined && (day < 1 || day > days[month - 1])) return false;
    return true;
  }, "Invalid calendar date");
export const dateSchema = z.union([
  z
    .object({
      value: iso,
      qualifier: z.enum(["exact", "about", "before", "after"]).default("exact"),
      confidence: confidenceSchema.optional(),
    })
    .strict(),
  z
    .object({
      start: iso,
      end: iso,
      qualifier: z.literal("range"),
      confidence: confidenceSchema.optional(),
    })
    .strict()
    .refine((d) => d.start <= d.end, "Range start must precede end"),
]);
export type FamilyDate = z.infer<typeof dateSchema>;
const placeSchema = z
  .object({
    value: z.string().trim().min(1),
    confidence: confidenceSchema.optional(),
  })
  .strict();
const factSchema = z
  .object({ date: dateSchema.nullish(), place: placeSchema.nullish() })
  .strict();
export const personSchema = z
  .object({
    id: z.string().trim().min(1),
    names: z
      .array(
        z
          .object({
            given: z.string().trim().min(1),
            surname: z.string().trim().optional(),
            type: z.enum([
              "current",
              "birth",
              "former",
              "alternate",
              "nickname",
            ]),
          })
          .strict(),
      )
      .min(1),
    sex: z.enum(["female", "male", "other", "unknown"]).nullish(),
    birth: factSchema.nullish(),
    death: factSchema.nullish(),
    events: z
      .array(
        z
          .object({
            type: z.enum([
              "marriage",
              "divorce",
              "residence",
              "immigration",
              "education",
              "occupation",
            ]),
            date: dateSchema.nullish(),
            place: placeSchema.nullish(),
            label: z.string().trim().min(1).optional(),
            confidence: confidenceSchema.optional(),
          })
          .strict(),
      )
      .default([]),
    photos: z
      .array(
        z
          .object({
            file: z
              .string()
              .regex(
                /^(?!.*(?:\.\.|:\/\/|^\/))[\w./-]+\.(?:png|jpe?g|webp|avif)$/i,
                "Use a relative image file path",
              ),
            label: z.string().optional(),
            primary: z.boolean().optional(),
            date: dateSchema.nullish(),
          })
          .strict(),
      )
      .max(3)
      .default([]),
  })
  .strict();
export type Person = z.infer<typeof personSchema>;
export const relationshipTypes = [
  "biological_parent",
  "adoptive_parent",
  "step_parent",
  "guardian",
  "spouse",
  "partner",
] as const;
export const relationshipSchema = z
  .object({
    id: z.string().trim().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
    type: z.enum(relationshipTypes),
    confidence: confidenceSchema.optional(),
  })
  .strict();
export type Relationship = z.infer<typeof relationshipSchema>;
export interface FamilyData {
  people: Person[];
  relationships: Relationship[];
}
export const confidence = (value?: Confidence) => value ?? "confirmed";
export const isParent = (r: Relationship) =>
  r.type !== "spouse" && r.type !== "partner";
