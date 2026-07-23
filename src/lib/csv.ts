// CSV-Export/-Import des Fairness-Gedächtnisses. Läuft rein im Frontend (P1).
// Tolerant gegenüber Komma- und Semikolon-Trennung (DE-Excel).

import { normalizeName, type FairnessMemory, type FairnessRecord } from "./fairness";

const HEADER = ["name", "presented", "credit", "attempts"] as const;

function escapeCell(value: string, delimiter: string): string {
  if (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function serializeFairness(
  memory: FairnessMemory,
  delimiter: string = ",",
): string {
  const rows = Object.values(memory)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((record) =>
      [
        escapeCell(record.name, delimiter),
        record.presented ? "1" : "0",
        String(record.credit),
        String(record.attempts),
      ].join(delimiter),
    );

  return [HEADER.join(delimiter), ...rows].join("\r\n");
}

// Zerlegt eine CSV-Zeile unter Beachtung von Quotes.
function parseLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

export function parseFairness(text: string): FairnessMemory {
  const lines = text
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return {};
  }

  const delimiter = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const header = parseLine(lines[0], delimiter).map((cell) =>
    cell.trim().toLowerCase(),
  );

  const columnIndex = (name: string) => header.indexOf(name);
  const nameIndex = columnIndex("name");
  const presentedIndex = columnIndex("presented");
  const creditIndex = columnIndex("credit");
  const attemptsIndex = columnIndex("attempts");

  // Ohne erkennbare name-Spalte: erste Spalte als Name annehmen.
  const effectiveNameIndex = nameIndex >= 0 ? nameIndex : 0;

  const memory: FairnessMemory = {};

  for (let index = 1; index < lines.length; index += 1) {
    const cells = parseLine(lines[index], delimiter);
    const name = (cells[effectiveNameIndex] ?? "").trim();

    if (!name) {
      continue;
    }

    const record: FairnessRecord = {
      name,
      presented:
        presentedIndex >= 0
          ? ["1", "true", "ja", "yes"].includes(
              (cells[presentedIndex] ?? "").trim().toLowerCase(),
            )
          : false,
      credit: creditIndex >= 0 ? Number(cells[creditIndex]) || 0 : 0,
      attempts: attemptsIndex >= 0 ? Number(cells[attemptsIndex]) || 0 : 0,
    };

    memory[normalizeName(name)] = record;
  }

  return memory;
}
