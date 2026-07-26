import { expect, test } from "@playwright/test";
import {
  createSession,
  deleteSession,
  login,
  registerParticipant,
} from "./helpers";

test("Sz2: Teams auslosen, Mitglied fixieren, neu auslosen behält Fixierten", async ({
  page,
  context,
}) => {
  await login(page);

  const name = `E2E Team ${Date.now()}`;
  const uuid = await createSession(page, {
    name,
    type: "team_draw",
    teamSize: 2,
  });

  await page.goto(`/sessions/${uuid}/live`);
  await expect(page.getByText("Live verbunden")).toBeVisible();

  const registerPage = await context.newPage();
  const names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];
  for (const participant of names) {
    await registerParticipant(registerPage, uuid, participant);
  }
  await registerPage.close();

  await expect(page.getByText("Alpha").first()).toBeVisible();

  // Teams auslosen (Animation) -> Grid erscheint
  await page.getByRole("button", { name: "Teams auslosen" }).click();
  await expect(page.getByText(/^Team 1$/).first()).toBeVisible({
    timeout: 15_000,
  });

  // Erste Person im Team-Grid fixieren; Namen vorher merken.
  const pin = page.getByTitle("In diesem Team fixieren").first();
  const fixedRow = pin.locator("..");
  const fixedName = (await fixedRow.locator("span").first().innerText()).trim();
  await pin.click();
  await expect(page.getByTitle("Fixierung aufheben")).toHaveCount(1);

  // Freien Rest neu auslosen -> Fixierter bleibt fixiert, alle bleiben vollständig
  await page.getByRole("button", { name: "Freien Rest neu auslosen" }).click();
  await expect(page.getByText(/^Team 1$/).first()).toBeVisible({
    timeout: 15_000,
  });

  // genau ein Fixierter, und es ist weiterhin dieselbe Person
  await expect(page.getByTitle("Fixierung aufheben")).toHaveCount(1);
  const stillFixedRow = page.getByTitle("Fixierung aufheben").first().locator("..");
  await expect(stillFixedRow.locator("span").first()).toHaveText(fixedName);

  // Vollständigkeit: alle fünf sind weiterhin da
  for (const participant of names) {
    await expect(page.getByText(participant).first()).toBeVisible();
  }

  await deleteSession(page.request, uuid);
});
