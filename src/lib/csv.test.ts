import { describe, expect, it } from "vitest";
import { parseFairness, serializeFairness } from "@/lib/csv";
import type { FairnessMemory } from "@/lib/fairness";

describe("serializeFairness / parseFairness", () => {
  it("macht einen verlustfreien Round-Trip", () => {
    const memory: FairnessMemory = {
      alice: { name: "Alice", presented: false, credit: 2, attempts: 1 },
      bob: { name: "Bob", presented: true, credit: 0, attempts: 3 },
    };

    const roundTripped = parseFairness(serializeFairness(memory));
    expect(roundTripped).toEqual(memory);
  });

  it("schreibt einen Header und eine Zeile je Person", () => {
    const csv = serializeFairness({
      a: { name: "Alice", presented: false, credit: 0, attempts: 0 },
    });
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("name,presented,credit,attempts");
    expect(lines[1]).toBe("Alice,0,0,0");
  });
});

describe("parseFairness", () => {
  it("versteht Semikolon-getrennte Dateien (DE-Excel)", () => {
    const memory = parseFairness(
      "name;presented;credit;attempts\nAnna;1;4;2",
    );
    expect(memory["anna"]).toEqual({
      name: "Anna",
      presented: true,
      credit: 4,
      attempts: 2,
    });
  });

  it("respektiert Anführungszeichen mit Trennzeichen im Namen", () => {
    const memory = parseFairness(
      'name,presented,credit,attempts\n"Meier, Tom",0,1,1',
    );
    expect(memory["meier, tom"].name).toBe("Meier, Tom");
  });

  it("erkennt verschiedene presented-Schreibweisen", () => {
    const memory = parseFairness(
      "name,presented\nA,ja\nB,true\nC,0\nD,nein",
    );
    expect(memory["a"].presented).toBe(true);
    expect(memory["b"].presented).toBe(true);
    expect(memory["c"].presented).toBe(false);
    expect(memory["d"].presented).toBe(false);
  });

  it("ist tolerant gegenüber fehlenden Spalten", () => {
    const memory = parseFairness("name\nAnna\nBen");
    expect(memory["anna"]).toEqual({
      name: "Anna",
      presented: false,
      credit: 0,
      attempts: 0,
    });
    expect(Object.keys(memory)).toHaveLength(2);
  });

  it("liefert für leere Eingaben ein leeres Gedächtnis", () => {
    expect(parseFairness("")).toEqual({});
    expect(parseFairness("   \n  ")).toEqual({});
  });

  it("ignoriert Zeilen ohne Namen", () => {
    const memory = parseFairness("name,credit\nAnna,3\n,5");
    expect(Object.keys(memory)).toEqual(["anna"]);
  });
});
