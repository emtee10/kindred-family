import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "@vercel/blob";
import { validateFamily } from "../../domain/validation";

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({ get: vi.fn() }));
import { blobFamilyDataProvider } from "./blob";
import { loadFamilyData } from "../family-data";
import { readPhoto } from "../photos";

const getBlob = vi.mocked(get);
const people = JSON.parse(readFileSync("private-data/people.json", "utf8"));
const relationships = JSON.parse(readFileSync("private-data/relationships.json", "utf8"));
const config = { title: "Test archive", subtitle: "Test", isDemo: true, featured: ["ada"] };
const objects: Record<string, string> = {
  "private-data/people.json": JSON.stringify(people),
  "private-data/relationships.json": JSON.stringify(relationships),
  "private-data/config.json": JSON.stringify(config),
};

function blobResult(pathname: string, body: string | Uint8Array) {
  return {
    statusCode: 200 as const,
    stream: new Response(typeof body === "string" ? body : new Uint8Array(body)).body!,
    headers: new Headers(),
    blob: {
      pathname, url: "https://store.private.blob.vercel-storage.com/" + pathname,
      downloadUrl: "https://store.private.blob.vercel-storage.com/" + pathname + "?download=1",
      contentType: "text/html", contentDisposition: "attachment", cacheControl: "public, max-age=9999",
      etag: "test-etag", size: body.length, uploadedAt: new Date(),
    },
  };
}

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.resetAllMocks();
  getBlob.mockImplementation(async pathname => {
    const body = objects[pathname];
    return body === undefined ? null : blobResult(pathname, body);
  });
});

describe("private Blob family records", () => {
  it("uses Blob through both existing server adapters when selected", async () => {
    vi.stubEnv("FAMILY_DATA_PROVIDER", "blob");
    expect(await loadFamilyData()).toEqual({ ...validateFamily(people, relationships), config });
    getBlob.mockResolvedValue(blobResult("private-media/person.jpg", new Uint8Array([1, 2, 3])));
    expect(await readPhoto(["person.jpg"])).toEqual({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" });
    expect(getBlob).toHaveBeenLastCalledWith("private-media/person.jpg", { access: "private", useCache: false });
  });
  it("returns the existing validated archive contract, without Blob URLs or metadata", async () => {
    expect(await blobFamilyDataProvider.loadFamilyData()).toEqual({ ...validateFamily(people, relationships), config });
    expect(getBlob).toHaveBeenCalledTimes(3);
    for (const pathname of Object.keys(objects)) {
      expect(getBlob).toHaveBeenCalledWith(pathname, { access: "private", useCache: false });
    }
  });

  for (const missing of Object.keys(objects)) {
    it(`fails instead of falling back to local records when ${missing} is absent`, async () => {
      getBlob.mockImplementation(async pathname => pathname === missing ? null : blobResult(pathname, objects[pathname]));
      await expect(blobFamilyDataProvider.loadFamilyData()).rejects.toThrow(`Missing required private blob: ${missing}.`);
    });
  }

  it("rejects malformed JSON", async () => {
    getBlob.mockImplementation(async pathname => blobResult(pathname, pathname.endsWith("people.json") ? "not JSON" : objects[pathname]));
    await expect(blobFamilyDataProvider.loadFamilyData()).rejects.toThrow("Invalid JSON in private blob: private-data/people.json.");
  });

  it("retains genealogy validation for invalid relationship references", async () => {
    getBlob.mockImplementation(async pathname => blobResult(pathname, pathname.endsWith("relationships.json")
      ? JSON.stringify([{ id: "bad", from: "missing", to: "ada", type: "biological_parent" }]) : objects[pathname]));
    await expect(blobFamilyDataProvider.loadFamilyData()).rejects.toThrow("unknown person reference");
  });

  it("rejects configuration that does not satisfy the existing archive contract", async () => {
    getBlob.mockImplementation(async pathname => blobResult(pathname, pathname.endsWith("config.json") ? "{}" : objects[pathname]));
    await expect(blobFamilyDataProvider.loadFamilyData()).rejects.toThrow();
  });

  it("does not return credential details from SDK errors", async () => {
    getBlob.mockRejectedValue(new Error("Storage failed with secret-token-value"));
    const error = await blobFamilyDataProvider.loadFamilyData().catch(cause => cause as Error);
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) throw new Error("Expected a storage error.");
    expect(error.message).toContain("Unable to read private Blob storage");
    expect(error.message).not.toContain("secret-token-value");
  });
});

describe("private Blob photos", () => {
  it("reads nested image paths as bytes with a trusted image MIME type", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    getBlob.mockResolvedValue(blobResult("private-media/portraits/person.JPG", bytes));
    expect(await blobFamilyDataProvider.readPhoto(["portraits", "person.JPG"])).toEqual({ bytes, contentType: "image/jpeg" });
    expect(getBlob).toHaveBeenCalledWith("private-media/portraits/person.JPG", { access: "private", useCache: false });
  });

  it("returns null for a missing photo", async () => {
    expect(await blobFamilyDataProvider.readPhoto(["missing.jpg"])).toBeNull();
  });

  for (const segments of [[], ["..", "photo.jpg"], ["../photo.jpg"], [".hidden", "photo.jpg"], ["", "photo.jpg"], ["a/b.jpg"], ["a%2Fb.jpg"], ["https://example.com/photo.jpg"], ["people.json"], ["photo.svg"]]) {
    it(`rejects unsafe or unsupported photo path ${JSON.stringify(segments)} before storage access`, async () => {
      expect(await blobFamilyDataProvider.readPhoto(segments)).toBeNull();
      expect(getBlob).not.toHaveBeenCalled();
    });
  }

  it("treats an unexpected conditional response as a storage error", async () => {
    getBlob.mockResolvedValue({ ...blobResult("photo.jpg", ""), statusCode: 304, stream: null,
      blob: { ...blobResult("photo.jpg", "").blob, contentType: null, size: null } });
    await expect(blobFamilyDataProvider.readPhoto(["photo.jpg"])).rejects.toThrow("Unable to read private Blob storage");
  });

  it("sanitizes failures while consuming the stream", async () => {
    const result = blobResult("photo.jpg", "");
    result.stream = new ReadableStream({ start(controller) { controller.error(new Error("secret-token-value")); } });
    getBlob.mockResolvedValue(result);
    await expect(blobFamilyDataProvider.readPhoto(["photo.jpg"])).rejects.toThrow("Unable to read private Blob storage");
  });
});
