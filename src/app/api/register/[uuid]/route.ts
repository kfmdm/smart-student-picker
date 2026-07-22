import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { addParticipant } from "@/lib/liveRelay";

type SessionRow = {
  uuid: string;
  status: "inactive" | "active" | "closed";
};

export async function GET() {
  return NextResponse.json(
    { message: "Diese Route unterstützt nur POST." },
    { status: 405 },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ uuid: string }> },
) {
  const { uuid: sessionUuid } = await context.params;
  const body = await request.json();

  const name = String(body.name ?? "").trim();

  if (!name) {
    return NextResponse.json(
      { message: "Name ist erforderlich." },
      { status: 400 },
    );
  }

  // Session-Metadaten kommen weiter aus der DB (kein personenbezogener Inhalt).
  const sessions = await prisma.$queryRaw<SessionRow[]>`
    SELECT uuid, status
    FROM sessions
    WHERE uuid = ${sessionUuid}
    LIMIT 1
  `;

  const session = sessions[0];

  if (!session) {
    return NextResponse.json(
      { message: "Session wurde nicht gefunden." },
      { status: 404 },
    );
  }

  if (session.status !== "active") {
    return NextResponse.json(
      { message: "Diese Session ist aktuell nicht aktiv." },
      { status: 400 },
    );
  }

  // Prinzip P1: Name wird NICHT in der DB gespeichert, sondern nur ins
  // flüchtige In-Memory-Relay gelegt und an verbundene Prof-Clients gepusht.
  const participant = addParticipant(sessionUuid, name);

  if (!participant) {
    return NextResponse.json(
      { message: "Anmeldung konnte nicht verarbeitet werden." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      uuid: participant.uuid,
      sessionUuid,
      name: participant.name,
    },
    { status: 201 },
  );
}
