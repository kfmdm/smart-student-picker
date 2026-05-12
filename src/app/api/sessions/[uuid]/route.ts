import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type SessionType = "standard";
type SessionStatus = "inactive" | "active" | "closed";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await context.params;
  const body = await request.json();

  const name = String(body.name ?? "").trim();
  const type: SessionType = body.type ?? "standard";
  const status: SessionStatus = body.status ?? "active";

  if (!name) {
    return NextResponse.json(
      { message: "Name ist erforderlich." },
      { status: 400 },
    );
  }

  await prisma.$executeRaw`
    UPDATE sessions
    SET name = ${name}, type = ${type}, status = ${status}
    WHERE uuid = ${uuid}
  `;

  return NextResponse.json({ uuid, name, type, status });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await context.params;

  await prisma.$executeRaw`
    DELETE FROM sessions
    WHERE uuid = ${uuid}
  `;

  return NextResponse.json({ success: true });
}
