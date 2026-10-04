import "server-only";
import { getFamilyDataProvider } from "./providers";
import type { PrivatePhoto } from "./providers/types";

export async function readPhoto(segments: string[]): Promise<PrivatePhoto | null> {
  return (await getFamilyDataProvider()).readPhoto(segments);
}
