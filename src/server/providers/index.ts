import "server-only";
import type { FamilyDataProvider } from "./types";

export async function getFamilyDataProvider(): Promise<FamilyDataProvider> {
  // Preserve the existing clone-and-run local workflow when unset.
  switch (process.env.FAMILY_DATA_PROVIDER ?? "local") {
    case "local": return (await import("./local")).localFamilyDataProvider;
    case "blob": return (await import("./blob")).blobFamilyDataProvider;
    default: throw new Error("FAMILY_DATA_PROVIDER must be local or blob.");
  }
}
