import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  COOKIE_MAX_AGE,
  expectedToken,
  verifyPassword,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const password = String(body.password ?? "");

  if (!verifyPassword(password)) {
    return NextResponse.json({ message: "Falsches Passwort." }, { status: 401 });
  }

  const token = expectedToken();
  const response = NextResponse.json({ success: true });

  if (token) {
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  return response;
}

// Logout
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
