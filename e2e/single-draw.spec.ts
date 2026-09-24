import { expect, test } from "@playwright/test";
import {
  createSession,
  deleteSession,
  login,
  registerParticipant,
} from "./helpers";

test("Sz1: Registrieren, Ziehung werten, Refresh-Persistenz, Excel-Export = Reset", async ({
  page,
  context,
}) => {
  await login(page);

  const name = `E2E Single ${Date.now()}`;
  const uuid = await createSession(page, { name, type: "single_draw" });

  await page.goto(`/sessions/${uuid}/live`);
  await expect(page.getByText("Live verbunden")).toBeVisible();

  // In einem zweiten Tab anmelden – die Live-Bühne bleibt offen (SSE).
  const registerPage = await context.newPage();
  const names = ["Anna", "Ben", "Cara"];
  for (const participant of names) {
    await registerParticipant(registerPage, uuid, participant);
  }
  await registerPage.close();

  // Erscheinen live per SSE
  for (const participant of names) {
    await expect(page.getByText(participant).first()).toBeVisible();
  }

  // Auslosen (2,3s Animation) -> Gewinner -> werten
  await page.getByRole("button", { name: "Auslosen", exact: true }).click();
  const scoreButton = page.getByRole("button", {
    name: /als vorgetragen werten/,
  });
  await expect(scoreButton).toBeVisible({ timeout: 15_000 });
  await scoreButton.click();
  await expect(
    page.getByRole("button", { name: "Runde gewertet" }),
  ).toBeVisible();
  // Niemand wird dauerhaft ausgeschlossen: alle drei bleiben ziehbar (Gewichtsregler sichtbar).
  await expect(page.getByTitle("Gewichtung verringern")).toHaveCount(3);

  // Refresh -> Bewerber bleiben dank localStorage erhalten
  await page.reload();
  for (const participant of names) {
    await expect(page.getByText(participant).first()).toBeVisible();
  }

  // Excel-Export lädt eine .xlsx herunter und setzt danach zurück
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Excel export" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);

  // Nach dem Reset ist der Pool leer
  await expect(
    page.getByText(/Sobald jemand den QR-Code nutzt/i),
  ).toBeVisible();

  await deleteSession(page.request, uuid);
});
