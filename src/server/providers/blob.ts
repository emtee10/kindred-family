import "server-only";
import { get } from "@vercel/blob";
import { assembleFamilyData, photoContentType } from "./validation";
import type { FamilyDataProvider } from "./types";

async function readBlob(pathname: string): Promise<Uint8Array | null> {
  try {
    // The SDK resolves server-side OIDC or BLOB_READ_WRITE_TOKEN credentials.
    // Fixed private pathnames never originate from a client-supplied URL.
    const result = await get(pathname, { access: "private", useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200 || !result.stream) throw new Error("Unexpected Blob response.");
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  } catch {
    // SDK errors may include credential or storage details; keep them out of API responses.
    throw new Error("Unable to read private Blob storage. Check the server's Blob credentials and store configuration.");
  }
}

async function readJson(pathname: string): Promise<unknown> {
  const bytes = await readBlob(pathname);
  if (!bytes) throw new Error(`Missing required private blob: ${pathname}.`);
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error(`Invalid JSON in private blob: ${pathname}.`); }
}

export const blobFamilyDataProvider: FamilyDataProvider = {
  name: "blob",
  async loadFamilyData() {
    const [people, relationships, config] = await Promise.all([
      readJson("private-data/people.json"),
      readJson("private-data/relationships.json"),
      readJson("private-data/config.json"),
    ]);
    return assembleFamilyData(people, relationships, config);
  },
  async readPhoto(segments) {
    const contentType = photoContentType(segments);
    if (!contentType) return null;
    const bytes = await readBlob(`private-media/${segments.join("/")}`);
    return bytes ? { bytes, contentType } : null;
  },
};
