import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyRoundResult,
  drawWeight,
  getRecord,
  normalizeName,
  pickWeighted,
  resetPresented,
  type FairnessMemory,
} from "@/lib/fairness";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeName", () => {
  it("trimmt, senkt Groß-/Kleinschreibung und normalisiert Whitespace", () => {
    expect(normalizeName("  Anna   Müller ")).toBe("anna müller");
    expect(normalizeName("BEN")).toBe("ben");
    expect(normalizeName("Ben")).toBe(normalizeName(" ben "));
  });
});

describe("drawWeight", () => {
  it("gibt 0 für bereits vorgetragene Personen", () => {
    expect(
      drawWeight({ name: "A", presented: true, credit: 10, attempts: 3 }),
    ).toBe(0);
  });

  it("ist 1 ohne Guthaben und steigt linear mit dem Guthaben (alpha)", () => {
    expect(
      drawWeight({ name: "A", presented: false, credit: 0, attempts: 0 }),
    ).toBe(1);
    expect(
      drawWeight({ name: "A", presented: false, credit: 4, attempts: 0 }),
    ).toBe(5);
    expect(
      drawWeight({ name: "A", presented: false, credit: 4, attempts: 0 }, 2),
    ).toBe(9);
  });

  it("behandelt negatives Guthaben als 0", () => {
    expect(
      drawWeight({ name: "A", presented: false, credit: -3, attempts: 0 }),
    ).toBe(1);
  });
});

describe("pickWeighted", () => {
  it("gibt null bei leerem oder gewichtslosem Pool", () => {
    expect(pickWeighted([])).toBeNull();
    expect(
      pickWeighted([
        { item: "a", weight: 0 },
        { item: "b", weight: 0 },
      ]),
    ).toBeNull();
  });

  it("wählt deterministisch anhand von Math.random", () => {
    const entries = [
      { item: "a", weight: 1 },
      { item: "b", weight: 3 },
    ];
    // total = 4; threshold = random*4
    vi.spyOn(Math, "random").mockReturnValue(0); // -> a
    expect(pickWeighted(entries)).toBe("a");
    vi.spyOn(Math, "random").mockReturnValue(0.2); // 0.8 < 1 -> a
    expect(pickWeighted(entries)).toBe("a");
    vi.spyOn(Math, "random").mockReturnValue(0.5); // 2.0 -> b
    expect(pickWeighted(entries)).toBe("b");
  });

  it("überspringt Einträge mit Gewicht 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(
      pickWeighted([
        { item: "a", weight: 0 },
        { item: "b", weight: 2 },
      ]),
    ).toBe("b");
  });
});

describe("getRecord", () => {
  it("liefert einen leeren Datensatz für unbekannte Namen", () => {
    expect(getRecord({}, "Neu")).toEqual({
      name: "Neu",
      presented: false,
      credit: 0,
      attempts: 0,
    });
  });
});

describe("applyRoundResult", () => {
  it("markiert den Gewinner als vorgetragen und gibt den übrigen Meldern Guthaben", () => {
    const next = applyRoundResult(
      {},
      {
        winnerName: "Alice",
        volunteerNames: ["Alice", "Bob", "Cara"],
        difficulty: 2,
      },
    );

    expect(next["alice"]).toMatchObject({ presented: true, credit: 0 });
    expect(next["bob"]).toMatchObject({ credit: 2, attempts: 1, presented: false });
    expect(next["cara"]).toMatchObject({ credit: 2, attempts: 1 });
  });

  it("skaliert das Guthaben mit der Schwierigkeit und beta", () => {
    const hard = applyRoundResult(
      {},
      { winnerName: "A", volunteerNames: ["A", "B"], difficulty: 3 },
    );
    expect(hard["b"].credit).toBe(3);

    const withBeta = applyRoundResult(
      {},
      { winnerName: "A", volunteerNames: ["A", "B"], difficulty: 2, beta: 0.5 },
    );
    expect(withBeta["b"].credit).toBe(1);
  });

  it("baut auf vorhandenem Guthaben auf", () => {
    const memory: FairnessMemory = {
      bob: { name: "Bob", presented: false, credit: 5, attempts: 2 },
    };
    const next = applyRoundResult(memory, {
      winnerName: "Alice",
      volunteerNames: ["Alice", "Bob"],
      difficulty: 1,
    });
    expect(next["bob"]).toMatchObject({ credit: 6, attempts: 3 });
    // Ursprungsobjekt bleibt unverändert (Immutability)
    expect(memory["bob"].credit).toBe(5);
  });
});

describe("resetPresented", () => {
  it("setzt das presented-Flag zurück", () => {
    const memory: FairnessMemory = {
      a: { name: "A", presented: true, credit: 0, attempts: 0 },
    };
    expect(resetPresented(memory, "A")["a"].presented).toBe(false);
    // unbekannter Name ändert nichts
    expect(resetPresented(memory, "X")).toBe(memory);
  });
});
