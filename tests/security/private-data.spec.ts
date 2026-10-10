import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { validateFamily } from "../../src/domain/validation";
import type { Person } from "../../src/domain/types";

function filesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(filename) : [filename];
  });
}

const privateFiles = filesIn("private-data");
const rawPeople = JSON.parse(readFileSync("private-data/people.json", "utf8"));
const rawRelationships = JSON.parse(readFileSync("private-data/relationships.json", "utf8"));
const expectedFamily = validateFamily(rawPeople, rawRelationships);
// Read markers from server files in the test process, never from client imports.
const privateValues = [...new Set(expectedFamily.people.flatMap((person: Person) =>
  person.names.flatMap(name => [name.given, name.surname])
).filter((value): value is string => Boolean(value && value.length >= 8)))];

async function expectNoFamilyValues(response: APIResponse) {
  const body = await response.text();
  for (const value of privateValues) expect(body).not.toContain(value);
}

async function expectUnauthorized(request: APIRequestContext) {
  const response = await request.get("/api/family-data", { maxRedirects: 0 });
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(await response.json()).toEqual({ error: "Unauthorized" });
}

async function signIn(request: APIRequestContext, password: string) {
  const csrf = await (await request.get("/api/auth/csrf")).json();
  const response = await request.post("/api/auth/callback/credentials", {
    headers: { "X-Auth-Return-Redirect": "1" },
    form: { csrfToken: csrf.csrfToken, password, callbackUrl: "http://127.0.0.1:3107/" },
    maxRedirects: 0,
  });
  return response.json() as Promise<{ url: string }>;
}

for (const filename of privateFiles) {
  const url = "/" + filename.split(path.sep).map(encodeURIComponent).join("/");
  for (const method of ["GET", "HEAD"] as const) {
    test(`${method} ${url} cannot serve a private file while logged out`, async ({ request }) => {
      const response = await request.fetch(url, { method, maxRedirects: 0 });
      expect(response.status()).toBe(404);
      if (method === "GET") await expectNoFamilyValues(response);
    });
  }
}

for (const url of [
  "/people.json", "/relationships.json", "/data/people.json", "/data/relationships.json",
  "/src/data/people.json", "/src/data/relationships.json",
  "/private-data/people.json?download=1", "/private-data/relationships.json?download=1",
  "/private-data%2Fpeople.json", "/private-data/%70eople.json",
  "/_next/static/private-data/people.json", "/_next/static/private-data/config.ts",
]) {
  test(`alternate URL ${url} does not disclose records`, async ({ request }) => {
    const response = await request.get(url, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
    await expectNoFamilyValues(response);
  });
}

for (const url of ["/%70rivate-data/people.json", "/private-data/config.ts/", "/private-data"]) {
  test(`encoded or directory URL ${url} cannot bypass authentication`, async ({ request }) => {
    let response = await request.get(url, { maxRedirects: 0 });
    if (response.status() === 308) {
      // Next.js canonicalizes trailing slashes before Proxy runs; check the destination too.
      const destination = new URL(response.headers().location, response.url());
      expect(destination.origin).toBe(new URL(response.url()).origin);
      expect(destination.pathname).toBe(url.replace(/\/$/, ""));
      await expectNoFamilyValues(response);
      response = await request.get(destination.href, { maxRedirects: 0 });
    }
    expect([307, 404]).toContain(response.status());
    if (response.status() === 307) {
      expect(new URL(response.headers().location, response.url()).pathname).toBe("/login");
    }
    await expectNoFamilyValues(response);
  });
}

test("root redirects to login and public login contains no family values", async ({ request }) => {
  const response = await request.get("/", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(new URL(response.headers().location, response.url()).pathname).toBe("/login");
  await expectNoFamilyValues(response);
  const login = await request.get("/login");
  expect(login.status()).toBe(200);
  await expectNoFamilyValues(login);
});

test("family-data API rejects a missing session", async ({ request }) => {
  await expectUnauthorized(request);
});

test("family-data API rejects a forged session cookie", async ({ request }) => {
  const response = await request.get("/api/family-data", {
    headers: { Cookie: "authjs.session-token=forged-session" }, maxRedirects: 0,
  });
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: "Unauthorized" });
});

for (const password of ["wrong-password", ""]) {
  test(`invalid ${password ? "password" : "empty password"} grants no data access`, async ({ request }) => {
    const result = await signIn(request, password);
    expect(new URL(result.url).searchParams.get("error")).toBe("CredentialsSignin");
    const session = await (await request.get("/api/auth/session")).json();
    expect(session).toBeNull();
    await expectUnauthorized(request);
  });
}

test("password unlocks only the protected API; logout removes access", async ({ request }) => {
  const result = await signIn(request, "security-suite-only-password");
  expect(new URL(result.url).searchParams.has("error")).toBe(false);
  const session = await (await request.get("/api/auth/session")).json();
  expect(session.user).toMatchObject({ name: "Family member" });

  const response = await request.get("/api/family-data");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  const data = await response.json();
  expect(data.people).toEqual(expectedFamily.people);
  expect(data.relationships).toEqual(expectedFamily.relationships);
  expect(data.config).toHaveProperty("featured");
  // New requests retain the session, but raw files stay unroutable even after login.
  expect((await request.get("/api/family-data")).status()).toBe(200);
  expect((await request.get("/", { maxRedirects: 0 })).status()).toBe(200);
  for (const filename of privateFiles) {
    expect((await request.get("/" + filename.split(path.sep).join("/"), { maxRedirects: 0 })).status()).toBe(404);
  }
  expect((await request.get("/api/photos/nonexistent.jpg")).status()).toBe(404);
  expect((await request.get("/api/photos/%2E%2E%2Fpeople.json")).status()).toBe(404);

  const csrf = await (await request.get("/api/auth/csrf")).json();
  await request.post("/api/auth/signout", {
    headers: { "X-Auth-Return-Redirect": "1" },
    form: { csrfToken: csrf.csrfToken, callbackUrl: "http://127.0.0.1:3107/login" },
  });
  expect(await (await request.get("/api/auth/session")).json()).toBeNull();
  await expectUnauthorized(request);
  expect((await request.get("/api/photos/example.jpg", { maxRedirects: 0 })).status()).toBe(401);
  expect((await request.get("/", { maxRedirects: 0 })).status()).toBe(307);
});

test("photos reject unauthenticated requests", async ({ request }) => {
  const response = await request.get("/api/photos/example.jpg", { maxRedirects: 0 });
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  await expectNoFamilyValues(response);
});

test("production browser JavaScript does not embed family records or the test password", () => {
  const scripts = filesIn(".next/static").filter(filename => filename.endsWith(".js"));
  expect(scripts.length).toBeGreaterThan(0);
  expect(privateValues.length).toBeGreaterThan(0);
  for (const filename of scripts) {
    const source = readFileSync(filename, "utf8");
    for (const value of privateValues) expect(source, `Private value in ${filename}`).not.toContain(value);
    expect(source).not.toContain("security-suite-only-password");
  }
});
