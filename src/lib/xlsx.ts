import {
  normalizeName,
  type FairnessMemory,
  type FairnessRecord,
} from "./fairness";

// Excel-Export/-Import des Fairness-Gedächtnisses als echtes .xlsx.
// Die reine Mapping-Funktion rowsToFairness ist ohne Browser testbar.

type Cell = string | number | boolean | Date | null | undefined;

const HEADERS = {
  name: "Name",
  presented: "Vorgetragen",
  credit: "Guthaben",
  attempts: "Meldungen",
} as const;

function parseBool(value: Cell): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return ["1", "true", "wahr", "ja", "yes", "x"].includes(
    String(value ?? "").trim().toLowerCase(),
  );
}

function parseNumber(value: Cell): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

// Zeilen (wie von read-excel-file geliefert) -> FairnessMemory.
export function rowsToFairness(rows: Cell[][]): FairnessMemory {
  if (!rows || rows.length === 0) {
    return {};
  }

  const header = rows[0].map((cell) => String(cell ?? "").trim().toLowerCase());
  const findIndex = (names: string[]) =>
    header.findIndex((entry) => names.includes(entry));

  const nameIndex = findIndex(["name"]);
  const presentedIndex = findIndex(["vorgetragen", "presented"]);
  const creditIndex = findIndex(["guthaben", "credit"]);
  const attemptsIndex = findIndex(["meldungen", "attempts", "versuche"]);
  const effectiveNameIndex = nameIndex >= 0 ? nameIndex : 0;

  const memory: FairnessMemory = {};

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const name = String(row[effectiveNameIndex] ?? "").trim();

    if (!name) {
      continue;
    }

    memory[normalizeName(name)] = {
      name,
      presented: presentedIndex >= 0 ? parseBool(row[presentedIndex]) : false,
      credit: creditIndex >= 0 ? parseNumber(row[creditIndex]) : 0,
      attempts: attemptsIndex >= 0 ? parseNumber(row[attemptsIndex]) : 0,
    };
  }

  return memory;
}

// Fairness-Gedächtnis -> Tabellenzeilen (Header + Daten). Rein/testbar.
export function fairnessToRows(
  memory: FairnessMemory,
): (string | number | boolean)[][] {
  const records = Object.values(memory).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return [
    [HEADERS.name, HEADERS.presented, HEADERS.credit, HEADERS.attempts],
    ...records.map((record: FairnessRecord) => [
      record.name,
      record.presented,
      record.credit,
      record.attempts,
    ]),
  ];
}

// Browser-Export: lädt die xlsx-Datei herunter.
export async function exportFairnessWorkbook(
  memory: FairnessMemory,
  fileName: string,
): Promise<void> {
  const XLSX = await import("xlsx");

  const worksheet = XLSX.utils.aoa_to_sheet(fairnessToRows(memory));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Fairness");
  XLSX.writeFile(workbook, fileName);
}

// Browser-Import: liest eine xlsx-Datei ein.
export async function parseFairnessWorkbook(
  file: File,
): Promise<FairnessMemory> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!worksheet) {
    return {};
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    blankrows: false,
  }) as Cell[][];

  return rowsToFairness(rows);
}
