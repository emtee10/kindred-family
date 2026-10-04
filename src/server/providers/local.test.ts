import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateFamily } from "../../domain/validation";

vi.mock("server-only", () => ({}));
import { config } from "../../../private-data/config";
import { localFamilyDataProvider, readLocalPhoto } from "./local";

let temporary: string;
let media: string;
beforeEach(async () => {
  temporary = await mkdtemp(path.join(tmpdir(), "kindred-provider-"));
  media = path.join(temporary, "media");
  await mkdir(path.join(media, "portraits"), { recursive: true });
});
afterEach(async () => { await rm(temporary, { recursive: true, force: true }); });

describe("local family-data provider", () => {
  it("preserves the existing validated records and config", async () => {
    const [people, relationships] = await Promise.all([
      readFile("private-data/people.json", "utf8"), readFile("private-data/relationships.json", "utf8"),
    ]);
    expect(await localFamilyDataProvider.loadFamilyData()).toEqual({
      ...validateFamily(JSON.parse(people), JSON.parse(relationships)), config,
    });
  });

  it("reads a nested portrait", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    await writeFile(path.join(media, "portraits/photo.webp"), bytes);
    expect(await readLocalPhoto(["portraits", "photo.webp"], media)).toEqual({ bytes: Buffer.from(bytes), contentType: "image/webp" });
  });

  it("returns null for a missing photo or directory", async () => {
    expect(await readLocalPhoto(["missing.jpg"], media)).toBeNull();
    expect(await readLocalPhoto(["missing.jpg"], path.join(temporary, "absent"))).toBeNull();
  });

  it("rejects traversal, symlink escapes, and directories", async () => {
    await writeFile(path.join(temporary, "outside.jpg"), "private");
    await symlink(path.join(temporary, "outside.jpg"), path.join(media, "escape.jpg"));
    await mkdir(path.join(media, "directory.jpg"));
    expect(await readLocalPhoto(["..", "outside.jpg"], media)).toBeNull();
    expect(await readLocalPhoto(["escape.jpg"], media)).toBeNull();
    expect(await readLocalPhoto(["directory.jpg"], media)).toBeNull();
  });
});
