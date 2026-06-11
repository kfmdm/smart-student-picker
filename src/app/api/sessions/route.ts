import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "../../../lib/prisma";
import {
  DEFAULT_SESSION_TYPE,
  isSessionType,
  type SessionType,
} from "@/lib/sessionTypes";

type SessionStatus = "inactive" | "active" | "closed";

export async function GET() {
  const sessions = await prisma.$queryRaw`
    SELECT id, uuid, name, type, status, created_at, updated_at
    FROM sessions
    ORDER BY created_at DESC
  `;

  return NextResponse.json(sessions);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const name = String(body.name ?? "").trim();
  const typeValue = body.type ?? DEFAULT_SESSION_TYPE;
  const type: SessionType = isSessionType(typeValue)
    ? typeValue
    : DEFAULT_SESSION_TYPE;
  const status: SessionStatus = body.status ?? "active";

  if (!name) {
    return NextResponse.json(
      { message: "Name ist erforderlich." },
      { status: 400 }
    );
  }

  const uuid = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO sessions (uuid, name, type, status)
    VALUES (${uuid}, ${name}, ${type}, ${status})
  `;

  return NextResponse.json({ uuid, name, type, status }, { status: 201 });
}
