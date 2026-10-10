import "server-only";
import { getFamilyDataProvider } from "./providers";
import type { ArchiveData } from "../data/types";

export async function loadFamilyData(): Promise<ArchiveData> {
  return (await getFamilyDataProvider()).loadFamilyData();
}
