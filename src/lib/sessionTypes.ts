export const SESSION_TYPES = [
  {
    value: "single_draw",
    label: "Einzelauslosung",
    description: "Eine Person wird zufällig aus dem Teilnehmerpool gezogen.",
  },
] as const;

export type SessionType = (typeof SESSION_TYPES)[number]["value"];

export const DEFAULT_SESSION_TYPE: SessionType = "single_draw";

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
