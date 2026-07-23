import { createHash, timingSafeEqual } from "crypto";

// Einfacher, gemeinsamer Admin-Zugang über ADMIN_PASSWORD (Prof-Login).
// Kein User-Store; das Cookie trägt einen vom Passwort abgeleiteten Token.

export const ADMIN_COOKIE = "ssp_admin";
export const COOKIE_MAX_AGE = 60 * 60 * 12; // 12 Stunden

function adminPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  return password && password.length > 0 ? password : null;
}

// Token = sha256("ssp:" + Passwort). Nur der Server kann ihn erzeugen/prüfen.
export function expectedToken(): string | null {
  const password = adminPassword();
  if (!password) {
    return null;
  }
  return createHash("sha256").update(`ssp:${password}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

export function verifyPassword(input: string): boolean {
  const password = adminPassword();
  if (!password) {
    return false;
  }
  return safeEqual(input, password);
}

export function verifyToken(token: string | undefined | null): boolean {
  const expected = expectedToken();
  if (!expected || !token) {
    return false;
  }
  return safeEqual(token, expected);
}
