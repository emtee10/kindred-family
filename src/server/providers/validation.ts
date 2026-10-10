import "server-only";
import path from "node:path";
import { z } from "zod";
import { validateFamily } from "../../domain/validation";
import type { ArchiveData } from "../../data/types";

// Archive configuration retains the same client contract in either storage model.
const archiveConfigSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  isDemo: z.boolean(),
  featured: z.array(z.string()),
});

export function assembleFamilyData(people: unknown, relationships: unknown, config: unknown): ArchiveData {
  return { ...validateFamily(people, relationships), config: archiveConfigSchema.parse(config) };
}

const imageTypes: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".avif": "image/avif",
};

export function photoContentType(segments: string[]): string | null {
  if (!segments.length || segments.some(segment => !/^[\w.-]+$/.test(segment) || segment.includes("..") || segment.startsWith("."))) return null;
  return imageTypes[path.extname(segments.at(-1)!).toLowerCase()] ?? null;
}
