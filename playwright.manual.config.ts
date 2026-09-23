import { defineConfig, devices } from "@playwright/test";

// Lädt ADMIN_PASSWORD/DATABASE_URL aus der bestehenden .env, ohne sie irgendwo
// auszugeben. Läuft NICHT gegen einen frisch gestarteten Server, sondern gegen
// den bereits laufenden ssp-review-Container (siehe docs/DEPLOYMENT.md).
process.loadEnvFile(".env");
process.env.E2E_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export default defineConfig({
  testDir: "./scripts",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "line",
  use: {
    baseURL: "http://localhost:32801",
    trace: "off",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
