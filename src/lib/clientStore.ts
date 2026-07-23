// Kleine, sichere localStorage-Helfer (nur im Browser aktiv).

export function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Speicher voll / nicht verfügbar -> still ignorieren.
  }
}

export function removeKey(key: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignorieren
  }
}

export const participantsKey = (sessionUuid: string) =>
  `ssp:participants:${sessionUuid}`;
export const fairnessKey = (sessionUuid: string) => `ssp:fairness:${sessionUuid}`;
