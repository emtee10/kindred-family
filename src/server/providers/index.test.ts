import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./local", () => ({ localFamilyDataProvider: { name: "local" } }));
vi.mock("./blob", () => ({ blobFamilyDataProvider: { name: "blob" } }));
import { getFamilyDataProvider } from "./index";

afterEach(() => vi.unstubAllEnvs());

describe("provider selection", () => {
  it("defaults to the existing local provider", async () => {
    vi.stubEnv("FAMILY_DATA_PROVIDER", undefined);
    expect((await getFamilyDataProvider()).name).toBe("local");
  });
  for (const name of ["local", "blob"]) {
    it(`selects ${name} explicitly`, async () => {
      vi.stubEnv("FAMILY_DATA_PROVIDER", name);
      expect((await getFamilyDataProvider()).name).toBe(name);
    });
  }
  for (const name of ["", "public", "unknown"]) {
    it(`fails closed for invalid provider ${JSON.stringify(name)}`, async () => {
      vi.stubEnv("FAMILY_DATA_PROVIDER", name);
      await expect(getFamilyDataProvider()).rejects.toThrow("FAMILY_DATA_PROVIDER must be local or blob.");
    });
  }
});
