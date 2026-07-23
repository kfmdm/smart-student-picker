import { describe, expect, it } from "vitest";
import { rowsToFairness } from "@/lib/xlsx";

describe("rowsToFairness", () => {
  it("mappt typisierte Zellen (Boolean/Number) korrekt", () => {
    const rows = [
      ["Name", "Vorgetragen", "Guthaben", "Meldungen"],
      ["Anna", false, 3, 2],
      ["Ben", true, 0, 1],
    ];
    const memory = rowsToFairness(rows);
    expect(memory["anna"]).toEqual({
      name: "Anna",
      presented: false,
      credit: 3,
      attempts: 2,
    });
    expect(memory["ben"]).toMatchObject({ presented: true });
  });

  it("versteht String-Schreibweisen für presented", () => {
    const rows = [
      ["Name", "Vorgetragen"],
      ["A", "ja"],
      ["B", "1"],
      ["C", "nein"],
    ];
    const memory = rowsToFairness(rows);
    expect(memory["a"].presented).toBe(true);
    expect(memory["b"].presented).toBe(true);
    expect(memory["c"].presented).toBe(false);
  });

  it("akzeptiert englische Spaltenüberschriften", () => {
    const rows = [
      ["name", "presented", "credit", "attempts"],
      ["Cara", true, 5, 4],
    ];
    expect(rowsToFairness(rows)["cara"]).toEqual({
      name: "Cara",
      presented: true,
      credit: 5,
      attempts: 4,
    });
  });

  it("ist tolerant gegenüber fehlenden Spalten und leeren Zeilen", () => {
    const rows = [["Name"], ["Anna"], [""], ["Ben"]];
    const memory = rowsToFairness(rows);
    expect(Object.keys(memory).sort()).toEqual(["anna", "ben"]);
    expect(memory["anna"]).toEqual({
      name: "Anna",
      presented: false,
      credit: 0,
      attempts: 0,
    });
  });

  it("liefert leeres Gedächtnis ohne Zeilen", () => {
    expect(rowsToFairness([])).toEqual({});
  });
});
