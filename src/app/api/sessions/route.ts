import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "../../../lib/prisma";
import {
  DEFAULT_SESSION_TYPE,
  isSessionType,
  normalizeSessionSettings,
  parseSessionSettings,
  type SessionSettings,
  type SessionType,
} from "@/lib/sessionTypes";

type SessionStatus = "inactive" | "active" | "closed";
type SessionRow = {
  id: number;
  uuid: string;
  name: string;
  type: string;
  settings: SessionSettings | string | null;
  status: SessionStatus;
  created_at: Date | string;
  updated_at: Date | string;
};

export async function GET() {
  const sessions = await prisma.$queryRaw<SessionRow[]>`
    SELECT id, uuid, name, type, settings, status, created_at, updated_at
    FROM sessions
    ORDER BY created_at DESC
  `;

  return NextResponse.json(
    sessions.map((session) => ({
      ...session,
      type: isSessionType(session.type) ? session.type : DEFAULT_SESSION_TYPE,
      settings: normalizeSessionSettings(
        isSessionType(session.type) ? session.type : DEFAULT_SESSION_TYPE,
        parseSessionSettings(session.settings),
      ),
    })),
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const name = String(body.name ?? "").trim();
  const typeValue = body.type ?? DEFAULT_SESSION_TYPE;
  const type: SessionType = isSessionType(typeValue)
    ? typeValue
    : DEFAULT_SESSION_TYPE;
  const settings = normalizeSessionSettings(type, body.settings);
  const settingsJson = JSON.stringify(settings);
  const status: SessionStatus = body.status ?? "active";

  if (!name) {
    return NextResponse.json(
      { message: "Name ist erforderlich." },
      { status: 400 }
    );
  }

  const uuid = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO sessions (uuid, name, type, settings, status)
    VALUES (${uuid}, ${name}, ${type}, ${settingsJson}, ${status})
  `;

  return NextResponse.json(
    { uuid, name, type, settings, status },
    { status: 201 },
  );
}
