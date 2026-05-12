import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "../../../lib/prisma";

type SessionType = "standard";
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
  const type: SessionType = body.type ?? "standard";
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