import { expect, test } from "@playwright/test";
import { ADMIN_PASSWORD } from "./helpers";

test("Dashboard ohne Login leitet zur Anmeldung", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("falsches Passwort wird abgelehnt", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Passwort").fill("definitiv-falsch");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByText(/Falsches Passwort/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("korrektes Passwort führt ins Dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Passwort").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(
    page.getByRole("heading", { name: "Smart Student Picker" }),
  ).toBeVisible();
});
