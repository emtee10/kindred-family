import "server-only";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { config } from "../../../private-data/config";
import { assembleFamilyData, photoContentType } from "./validation";
import type { FamilyDataProvider, PrivatePhoto } from "./types";

export async function readLocalPhoto(segments: string[], directory = path.join(process.cwd(), "private-media")): Promise<PrivatePhoto | null> {
  const contentType = photoContentType(segments);
  if (!contentType) return null;
  try {
    const root = await realpath(directory);
    const filename = await realpath(path.join(root, ...segments));
    // Resolve symlinks before checking containment as well as validating URL segments.
    if (!filename.startsWith(root + path.sep) || !(await stat(filename)).isFile()) return null;
    return { bytes: await readFile(filename), contentType };
  } catch (error) {
    if (["ENOENT", "ENOTDIR", "ELOOP"].includes((error as NodeJS.ErrnoException).code ?? "")) return null;
    throw error;
  }
}

export const localFamilyDataProvider: FamilyDataProvider = {
  name: "local",
  async loadFamilyData() {
    const directory = path.join(process.cwd(), "private-data");
    const [people, relationships] = await Promise.all([
      readFile(path.join(directory, "people.json"), "utf8"),
      readFile(path.join(directory, "relationships.json"), "utf8"),
    ]);
    return assembleFamilyData(JSON.parse(people), JSON.parse(relationships), config);
  },
  readPhoto: readLocalPhoto,
};
