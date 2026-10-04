import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateFamily } from "../domain/validation";
import { config } from "../../private-data/config";
import type { ArchiveData } from "../data/types";
export async function loadFamilyData(): Promise<ArchiveData> {
  const directory = path.join(process.cwd(), "private-data");
  const [people, relationships] = await Promise.all([
    readFile(path.join(directory, "people.json"), "utf8"),
    readFile(path.join(directory, "relationships.json"), "utf8"),
  ]);
  return { ...validateFamily(JSON.parse(people), JSON.parse(relationships)), config };
}
