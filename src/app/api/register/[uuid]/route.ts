import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

type SessionRow = {
  uuid: string;
  status: "inactive" | "active" | "closed";
};

export async function GET() {
  return NextResponse.json(
    { message: "Diese Route unterstützt nur POST." },
    { status: 405 }
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ uuid: string }> }
) {
  const { uuid: sessionUuid } = await context.params;
  const body = await request.json();

  const name = String(body.name ?? "").trim();

  if (!name) {
    return NextResponse.json({ message: "Name ist erforderlich." }, { status: 400 });
  }

  const sessions = await prisma.$queryRaw<SessionRow[]>`
    SELECT uuid, status
    FROM sessions
    WHERE uuid = ${sessionUuid}
    LIMIT 1
  `;

  const session = sessions[0];

  if (!session) {
    return NextResponse.json({ message: "Session wurde nicht gefunden." }, { status: 404 });
  }

  if (session.status !== "active") {
    return NextResponse.json({ message: "Diese Session ist aktuell nicht aktiv." }, { status: 400 });
  }

  const participantUuid = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO participants (uuid, session_uuid, name)
    VALUES (${participantUuid}, ${sessionUuid}, ${name})
  `;

  return NextResponse.json(
    {
      uuid: participantUuid,
      sessionUuid,
      name,
    },
    { status: 201 }
  );
}