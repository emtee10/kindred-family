import { randomBytes } from "node:crypto";
import { defineConfig } from "@playwright/test";

// HTTP-only security tests: no browser installation or real credentials required.
// Use the production Webpack builder to bound build memory in small dev containers.
export default defineConfig({
  testDir: "./tests/security",
  fullyParallel: true,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3107" },
  webServer: {
    command: "npm run build -- --webpack && node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3107",
    url: "http://127.0.0.1:3107/login",
    reuseExistingServer: false,
    timeout: 360_000,
    stdout: "pipe",
    env: {
      FAMILY_PASSWORD: "security-suite-only-password",
      FAMILY_DATA_PROVIDER: "local",
      AUTH_SECRET: randomBytes(32).toString("base64"),
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_OPTIONS: "--max-old-space-size=768",
    },
  },
});
