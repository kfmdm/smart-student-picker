import { test } from "@playwright/test";
import fs from "node:fs";
import {
  createSession,
  deleteSession,
  login,
  registerParticipant,
} from "../e2e/helpers";

// Erzeugt die Screenshots für public/anleitung.html gegen den bereits
// laufenden ssp-review-Container (siehe playwright.manual.config.ts).
// Kein Teil der CI/e2e-Suite – reines Doku-Tooling zum bei Bedarf erneuten
// Erzeugen der Bilder, wenn sich das UI ändert. Räumt seine Demo-Sessions
// am Ende jeweils selbst wieder ab.

const OUT_DIR = "public/anleitung-assets";
fs.mkdirSync(OUT_DIR, { recursive: true });

async function shot(
  page: import("@playwright/test").Page,
  name: string,
  fullPage = true,
) {
  await page.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage });
}

test("Sz1 – Einzelauslosung Screenshots", async ({ page, context }) => {
  await page.goto("/login");
  await shot(page, "sz1-00-login");

  await login(page);
  await shot(page, "sz1-01-dashboard");

  const name = "Anleitung-Demo (Einzelauslosung)";
  const uuid = await createSession(page, { name, type: "single_draw" });
  await shot(page, "sz1-02-dashboard-session-angelegt");

  const card = page.locator("div.flex.flex-col.rounded-2xl", {
    hasText: uuid,
  });
  await card.getByRole("button").first().click();
  await shot(page, "sz1-03-qr-code");
  await page.getByRole("button", { name: "×" }).click();

  await page.goto(`/sessions/${uuid}/live`);
  await page.getByText("Live verbunden").waitFor();
  await shot(page, "sz1-04-live-leer");

  const registerPage = await context.newPage();
  await registerPage.goto(`/register/${uuid}`);
  await shot(registerPage, "sz1-05-registrierung-formular");

  await registerPage.getByPlaceholder("Dein Name").fill("Anna");
  await registerPage.getByRole("button", { name: "Registrieren" }).click();
  await registerPage.getByText(/erfolgreich registriert/i).waitFor();
  await shot(registerPage, "sz1-06-registrierung-erfolgreich");

  for (const participant of ["Ben", "Cara"]) {
    await registerParticipant(registerPage, uuid, participant);
  }
  await registerPage.close();

  for (const participant of ["Anna", "Ben", "Cara"]) {
    await page.getByText(participant).first().waitFor();
  }
  await shot(page, "sz1-07-live-teilnehmer");

  await page.getByRole("button", { name: "Auslosen", exact: true }).click();
  await page
    .getByRole("button", { name: /als vorgetragen werten/ })
    .waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_200);
  await shot(page, "sz1-08-gewinner");

  await page.getByRole("button", { name: /als vorgetragen werten/ }).click();
  await page.getByRole("button", { name: "Runde gewertet" }).waitFor();
  await shot(page, "sz1-09-gewertet");

  await page
    .getByRole("button", { name: "Excel export" })
    .scrollIntoViewIfNeeded();
  await shot(page, "sz1-10-excel-export");

  await deleteSession(page.request, uuid);
});

test("Sz2 – Team-Auslosung Screenshots", async ({ page, context }) => {
  await login(page);

  const name = "Anleitung-Demo (Team-Auslosung)";
  const uuid = await createSession(page, {
    name,
    type: "team_draw",
    teamSize: 2,
  });

  await page.goto(`/sessions/${uuid}/live`);
  await page.getByText("Live verbunden").waitFor();

  const registerPage = await context.newPage();
  const names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"];
  for (const participant of names) {
    await registerParticipant(registerPage, uuid, participant);
  }
  await registerPage.close();

  await page.getByText("Alpha").first().waitFor();
  await shot(page, "sz2-01-live-teilnehmer");

  await page.getByRole("button", { name: /^Themen/ }).click();
  await page.getByPlaceholder("Thema hinzufügen").fill("Thema A");
  await page.getByTitle("Thema hinzufügen").click();
  await shot(page, "sz2-02-thema-hinzugefuegt");

  await page.getByRole("button", { name: "Teams auslosen" }).click();
  await page.getByText(/^Team 1$/).first().waitFor({ timeout: 15_000 });
  await shot(page, "sz2-03-teams-ausgelost");

  await page.getByTitle("In diesem Team fixieren").first().click();
  await shot(page, "sz2-04-mitglied-fixiert");

  await page.getByTitle("Team sperren").first().click();
  await shot(page, "sz2-05-team-gesperrt");

  await page.getByRole("button", { name: "Freien Rest neu auslosen" }).click();
  await page.getByText(/^Team 3$/).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_200);
  await shot(page, "sz2-06-neu-ausgelost");

  await page.getByTitle("Teams im Vollbild anzeigen").click();
  await page.waitForTimeout(500);
  await shot(page, "sz2-07-vollbild", false);

  await deleteSession(page.request, uuid);
});
