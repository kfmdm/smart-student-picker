import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_SESSION_TYPE,
  isSessionType,
  normalizeSessionSettings,
  type SessionType,
} from "@/lib/sessionTypes";
import { isAdminAuthed } from "@/lib/adminAuth";

type SessionStatus = "inactive" | "active" | "closed";

function unauthorized() {
  return NextResponse.json({ message: "Nicht autorisiert." }, { status: 401 });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ uuid: string }> },
) {
  if (!(await isAdminAuthed())) {
    return unauthorized();
  }

  const { uuid } = await context.params;
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
      { status: 400 },
    );
  }

  await prisma.$executeRaw`
    UPDATE sessions
    SET name = ${name}, type = ${type}, settings = ${settingsJson}, status = ${status}
    WHERE uuid = ${uuid}
  `;

  return NextResponse.json({ uuid, name, type, settings, status });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ uuid: string }> },
) {
  if (!(await isAdminAuthed())) {
    return unauthorized();
  }

  const { uuid } = await context.params;

  await prisma.$executeRaw`
    DELETE FROM sessions
    WHERE uuid = ${uuid}
  `;

  return NextResponse.json({ success: true });
}
