import { describe, expect, it } from "vitest";
import { fairnessToRows, rowsToFairness } from "@/lib/xlsx";
import type { FairnessMemory } from "@/lib/fairness";

describe("Export -> Import Round-Trip", () => {
  it("stellt das Gedächtnis verlustfrei wieder her", () => {
    const memory: FairnessMemory = {
      alice: { name: "Alice", credit: 4, attempts: 2 },
      bob: { name: "Bob", credit: 0, attempts: 5 },
      cara: { name: "Cara", credit: 1, attempts: 1 },
    };
    expect(rowsToFairness(fairnessToRows(memory))).toEqual(memory);
  });
});

describe("rowsToFairness", () => {
  it("mappt typisierte Zellen (Number) korrekt", () => {
    const rows = [
      ["Name", "Guthaben", "Meldungen"],
      ["Anna", 3, 2],
      ["Ben", 0, 1],
    ];
    const memory = rowsToFairness(rows);
    expect(memory["anna"]).toEqual({
      name: "Anna",
      credit: 3,
      attempts: 2,
    });
    expect(memory["ben"]).toMatchObject({ credit: 0, attempts: 1 });
  });

  it("akzeptiert englische Spaltenüberschriften", () => {
    const rows = [
      ["name", "credit", "attempts"],
      ["Cara", 5, 4],
    ];
    expect(rowsToFairness(rows)["cara"]).toEqual({
      name: "Cara",
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
      credit: 0,
      attempts: 0,
    });
  });

  it("liefert leeres Gedächtnis ohne Zeilen", () => {
    expect(rowsToFairness([])).toEqual({});
  });
});
