import "server-only";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
const imageTypes: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".avif": "image/avif",
};
// Catch-all segments preserve the existing schema's nested portrait paths.
export async function readPhoto(segments: string[], directory = path.join(process.cwd(), "private-media")) {
  if (!segments.length || segments.some(segment => !/^[\w.-]+$/.test(segment) || segment.includes("..") || segment.startsWith("."))) return null;
  const contentType = imageTypes[path.extname(segments.at(-1)!).toLowerCase()];
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
