import "server-only";
import type { ArchiveData } from "../../data/types";

export interface PrivatePhoto {
  bytes: Uint8Array;
  contentType: string;
}

export interface FamilyDataProvider {
  readonly name: "local" | "blob";
  loadFamilyData(): Promise<ArchiveData>;
  readPhoto(segments: string[]): Promise<PrivatePhoto | null>;
}
