import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), loadFamilyData: vi.fn() }));
vi.mock("../../../auth", () => ({ auth: mocks.auth }));
vi.mock("../../../server/family-data", () => ({ loadFamilyData: mocks.loadFamilyData }));
import { GET } from "./route";

// Exercise the route directly: Proxy cannot supply its authentication boundary.
describe("family-data route authentication independent of Proxy", () => {
  beforeEach(() => vi.resetAllMocks());

  for (const session of [null, {}]) {
    it(`rejects ${session === null ? "no session" : "a session without a user"} before reading private files`, async () => {
      mocks.auth.mockResolvedValue(session);
      const response = await GET();
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({ error: "Unauthorized" });
      expect(mocks.loadFamilyData).not.toHaveBeenCalled();
    });
  }

  it("loads records only after verifying an authenticated session", async () => {
    const records = { people: [], relationships: [], config: { title: "Test archive" } };
    mocks.auth.mockResolvedValue({ user: { name: "Family member" } });
    mocks.loadFamilyData.mockResolvedValue(records);
    const response = await GET();
    expect(mocks.auth).toHaveBeenCalledOnce();
    expect(mocks.loadFamilyData).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(records);
  });
});
