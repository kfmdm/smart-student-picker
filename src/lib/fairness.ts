// Reine Fairness-Logik für die Einzelauslosung (Sz1).
// Läuft ausschließlich im Prof-Client; persistiert wird nur per CSV (Prinzip P1).
//
// Idee: Wer sich meldet und nicht drankommt, sammelt "Guthaben" (credit) und wird
// beim nächsten Mal wahrscheinlicher gezogen. Schwerere Aufgaben geben mehr Guthaben.
// Wer schon vorgetragen hat (presented), fällt aus dem Pool.

export type FairnessRecord = {
  name: string; // Anzeigename (Original-Schreibweise)
  presented: boolean;
  credit: number;
  attempts: number;
};

// Schlüssel = normalisierter Name.
export type FairnessMemory = Record<string, FairnessRecord>;

export const DEFAULT_ALPHA = 1; // Einfluss des Guthabens aufs Gewicht
export const DEFAULT_BETA = 1; // Guthaben-Zuwachs je Schwierigkeitsstufe

export const DIFFICULTY_LEVELS = [
  { value: 1, label: "leicht" },
  { value: 2, label: "mittel" },
  { value: 3, label: "schwer" },
] as const;

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function emptyRecord(name: string): FairnessRecord {
  return { name: name.trim(), presented: false, credit: 0, attempts: 0 };
}

export function getRecord(memory: FairnessMemory, name: string): FairnessRecord {
  return memory[normalizeName(name)] ?? emptyRecord(name);
}

// Auswahlgewicht einer Person. Presented => 0 (nicht mehr im Pool).
export function drawWeight(
  record: FairnessRecord,
  alpha: number = DEFAULT_ALPHA,
): number {
  if (record.presented) {
    return 0;
  }

  return 1 + alpha * Math.max(0, record.credit);
}

// Gewichtete Zufallsauswahl. Erwartet bereits gefilterte, berechtigte Einträge.
export function pickWeighted<T>(
  entries: { item: T; weight: number }[],
): T | null {
  const total = entries.reduce(
    (sum, entry) => sum + Math.max(0, entry.weight),
    0,
  );

  if (total <= 0) {
    return null;
  }

  let threshold = Math.random() * total;

  for (const entry of entries) {
    threshold -= Math.max(0, entry.weight);

    if (threshold < 0) {
      return entry.item;
    }
  }

  return entries[entries.length - 1]?.item ?? null;
}

// Ergebnis einer Runde ins Gedächtnis übernehmen: Gewinner => presented,
// alle übrigen Melder => credit += beta*difficulty, attempts += 1.
export function applyRoundResult(
  memory: FairnessMemory,
  params: {
    winnerName: string;
    volunteerNames: string[];
    difficulty: number;
    beta?: number;
  },
): FairnessMemory {
  const beta = params.beta ?? DEFAULT_BETA;
  const next: FairnessMemory = { ...memory };

  const applyTo = (name: string, update: (record: FairnessRecord) => FairnessRecord) => {
    const key = normalizeName(name);
    const current = next[key] ?? emptyRecord(name);
    next[key] = update({ ...current, name: name.trim() });
  };

  applyTo(params.winnerName, (record) => ({ ...record, presented: true }));

  const winnerKey = normalizeName(params.winnerName);

  for (const name of params.volunteerNames) {
    if (normalizeName(name) === winnerKey) {
      continue;
    }

    applyTo(name, (record) => ({
      ...record,
      credit: record.credit + beta * Math.max(0, params.difficulty),
      attempts: record.attempts + 1,
    }));
  }

  return next;
}

// Presented-Flag einer Person zurücksetzen (z.B. versehentlich gewertet).
export function resetPresented(
  memory: FairnessMemory,
  name: string,
): FairnessMemory {
  const key = normalizeName(name);
  const current = memory[key];

  if (!current) {
    return memory;
  }

  return { ...memory, [key]: { ...current, presented: false } };
}
