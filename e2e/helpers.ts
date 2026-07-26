import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "e2e-secret";

type SessionType = "single_draw" | "team_draw";

export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("Passwort").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(
    page.getByRole("heading", { name: "Smart Student Picker" }),
  ).toBeVisible();
}

export async function createSession(
  page: Page,
  options: { name: string; type: SessionType; teamSize?: number },
): Promise<string> {
  await page.getByPlaceholder("Session-Name").fill(options.name);
  await page.getByRole("combobox").first().selectOption(options.type);

  if (options.type === "team_draw" && options.teamSize) {
    await page.getByPlaceholder("Teamgröße").fill(String(options.teamSize));
  }

  await page.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(page.getByText(options.name).first()).toBeVisible();

  // uuid über die (authentifizierte) API holen – robuster als DOM-Scraping.
  const response = await page.request.get("/api/sessions");
  const sessions = (await response.json()) as { uuid: string; name: string }[];
  const created = sessions.find((session) => session.name === options.name);

  if (!created) {
    throw new Error(`Session "${options.name}" nach dem Anlegen nicht gefunden`);
  }

  return created.uuid;
}

export async function registerParticipant(
  page: Page,
  uuid: string,
  name: string,
): Promise<void> {
  await page.goto(`/register/${uuid}`);
  await page.getByPlaceholder("Dein Name").fill(name);
  await page.getByRole("button", { name: "Registrieren" }).click();
  await expect(page.getByText(/erfolgreich registriert/i)).toBeVisible();
}

export async function deleteSession(
  request: APIRequestContext,
  uuid: string,
): Promise<void> {
  await request.delete(`/api/sessions/${uuid}`);
}
