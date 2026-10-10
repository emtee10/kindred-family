import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), readPhoto: vi.fn() }));
vi.mock("../../../../auth", () => ({ auth: mocks.auth }));
vi.mock("../../../../server/photos", () => ({ readPhoto: mocks.readPhoto }));
import { GET } from "./route";
const request = new Request("http://localhost/api/photos/person.jpg");
const context = { params: Promise.resolve({ filename: ["person.jpg"] }) };

beforeEach(() => vi.resetAllMocks());
describe("photo route provider boundary", () => {
  it("rejects unauthenticated requests without consulting storage", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await GET(request, context);
    expect(response.status).toBe(401);
    expect(mocks.readPhoto).not.toHaveBeenCalled();
  });
  it("preserves the authenticated photo bytes and private cache headers", async () => {
    mocks.auth.mockResolvedValue({ user: { name: "Family member" } });
    mocks.readPhoto.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" });
    const response = await GET(request, context);
    expect(mocks.readPhoto).toHaveBeenCalledWith(["person.jpg"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
  it("preserves 404 for a missing authenticated photo", async () => {
    mocks.auth.mockResolvedValue({ user: { name: "Family member" } });
    mocks.readPhoto.mockResolvedValue(null);
    const response = await GET(request, context);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
