export const SESSION_TYPES = [
  {
    value: "single_draw",
    label: "Einzelauslosung",
    description: "Eine Person wird zufällig aus dem Teilnehmerpool gezogen.",
  },
  {
    value: "team_draw",
    label: "Team-Auslosung",
    description: "Teilnehmer werden zufällig in Teams aufgeteilt.",
  },
] as const;

export type SessionType = (typeof SESSION_TYPES)[number]["value"];
export type SessionSettings = {
  teamSize?: number;
};

export const DEFAULT_SESSION_TYPE: SessionType = "single_draw";
export const DEFAULT_TEAM_SIZE = 2;
export const MIN_TEAM_SIZE = 2;
export const MAX_TEAM_SIZE = 20;

const sessionTypeValues = new Set<string>(
  SESSION_TYPES.map((sessionType) => sessionType.value),
);

export function isSessionType(value: unknown): value is SessionType {
  return typeof value === "string" && sessionTypeValues.has(value);
}

export function getSessionTypeLabel(value: string) {
  return (
    SESSION_TYPES.find((sessionType) => sessionType.value === value)?.label ??
    value
  );
}

export function clampTeamSize(value: unknown) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_TEAM_SIZE;
  }

  return Math.min(
    MAX_TEAM_SIZE,
    Math.max(MIN_TEAM_SIZE, Math.round(numericValue)),
  );
}

export function normalizeSessionSettings(
  type: SessionType,
  settings: unknown,
): SessionSettings {
  if (type !== "team_draw") {
    return {};
  }

  const rawSettings =
    settings && typeof settings === "object"
      ? (settings as Record<string, unknown>)
      : {};

  return {
    teamSize: clampTeamSize(rawSettings.teamSize),
  };
}

export function parseSessionSettings(settings: unknown): SessionSettings {
  if (!settings) {
    return {};
  }

  if (typeof settings === "string") {
    try {
      const parsedSettings = JSON.parse(settings) as unknown;
      return parsedSettings && typeof parsedSettings === "object"
        ? (parsedSettings as SessionSettings)
        : {};
    } catch {
      return {};
    }
  }

  if (typeof settings === "object") {
    return settings as SessionSettings;
  }

  return {};
}
