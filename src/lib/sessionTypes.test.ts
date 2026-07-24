import { describe, expect, it } from "vitest";
import {
  clampTeamSize,
  isSessionType,
  normalizeSessionSettings,
  parseSessionSettings,
} from "@/lib/sessionTypes";

describe("clampTeamSize", () => {
  it("begrenzt auf den erlaubten Bereich 2..20", () => {
    expect(clampTeamSize(1)).toBe(2);
    expect(clampTeamSize(0)).toBe(2);
    expect(clampTeamSize(25)).toBe(20);
    expect(clampTeamSize(6)).toBe(6);
  });

  it("rundet und akzeptiert Zahlen als String", () => {
    expect(clampTeamSize(3.6)).toBe(4);
    expect(clampTeamSize("5")).toBe(5);
  });

  it("faellt bei ungueltigen Werten auf den Standard (2) zurueck", () => {
    expect(clampTeamSize("abc")).toBe(2);
    expect(clampTeamSize(undefined)).toBe(2);
    expect(clampTeamSize(NaN)).toBe(2);
  });
});

describe("isSessionType", () => {
  it("erkennt gueltige Typen", () => {
    expect(isSessionType("single_draw")).toBe(true);
    expect(isSessionType("team_draw")).toBe(true);
  });
  it("weist ungueltige Werte ab", () => {
    expect(isSessionType("standard")).toBe(false);
    expect(isSessionType("")).toBe(false);
    expect(isSessionType(42)).toBe(false);
    expect(isSessionType(null)).toBe(false);
  });
});

describe("normalizeSessionSettings", () => {
  it("liefert fuer team_draw eine begrenzte Teamgroesse", () => {
    expect(normalizeSessionSettings("team_draw", { teamSize: 3 })).toEqual({
      teamSize: 3,
    });
    expect(normalizeSessionSettings("team_draw", { teamSize: 99 })).toEqual({
      teamSize: 20,
    });
    expect(normalizeSessionSettings("team_draw", {})).toEqual({ teamSize: 2 });
  });

  it("liefert fuer single_draw keine Team-Settings", () => {
    expect(normalizeSessionSettings("single_draw", { teamSize: 5 })).toEqual({});
  });
});

describe("parseSessionSettings", () => {
  it("parst JSON-Strings", () => {
    expect(parseSessionSettings('{"teamSize":4}')).toEqual({ teamSize: 4 });
  });
  it("gibt Objekte unveraendert zurueck", () => {
    expect(parseSessionSettings({ teamSize: 7 })).toEqual({ teamSize: 7 });
  });
  it("ist robust gegen ungueltige Eingaben", () => {
    expect(parseSessionSettings("kein json")).toEqual({});
    expect(parseSessionSettings(null)).toEqual({});
    expect(parseSessionSettings(undefined)).toEqual({});
  });
});
