import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Serieller Lauf: das In-Memory-Relay ist globaler Prozess-State.
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "list" : "line",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      DATABASE_URL:
        process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
      ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD ?? "e2e-secret",
    },
  },
});
