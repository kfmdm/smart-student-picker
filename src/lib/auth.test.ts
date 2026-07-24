import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expectedToken, verifyPassword, verifyToken } from "@/lib/auth";

const original = process.env.ADMIN_PASSWORD;

afterEach(() => {
  if (original === undefined) {
    delete process.env.ADMIN_PASSWORD;
  } else {
    process.env.ADMIN_PASSWORD = original;
  }
});

describe("Auth mit gesetztem Passwort", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "geheim123";
  });

  it("akzeptiert nur das korrekte Passwort", () => {
    expect(verifyPassword("geheim123")).toBe(true);
    expect(verifyPassword("falsch")).toBe(false);
    expect(verifyPassword("")).toBe(false);
    expect(verifyPassword("geheim123 ")).toBe(false);
  });

  it("erzeugt einen stabilen Token und verifiziert ihn", () => {
    const token = expectedToken();
    expect(token).toBeTruthy();
    expect(expectedToken()).toBe(token); // deterministisch
    expect(verifyToken(token)).toBe(true);
    expect(verifyToken("falscher-token")).toBe(false);
    expect(verifyToken(undefined)).toBe(false);
    expect(verifyToken(null)).toBe(false);
  });

  it("bindet den Token ans Passwort (anderes Passwort => anderer Token)", () => {
    const tokenA = expectedToken();
    process.env.ADMIN_PASSWORD = "anderes-passwort";
    expect(expectedToken()).not.toBe(tokenA);
    // alter Token wird nicht mehr akzeptiert
    expect(verifyToken(tokenA)).toBe(false);
  });
});

describe("Auth ohne Passwort (fail-closed)", () => {
  beforeEach(() => {
    delete process.env.ADMIN_PASSWORD;
  });

  it("verweigert jeden Zugang, wenn kein Passwort konfiguriert ist", () => {
    expect(verifyPassword("egal")).toBe(false);
    expect(expectedToken()).toBeNull();
    expect(verifyToken("egal")).toBe(false);
  });
});
