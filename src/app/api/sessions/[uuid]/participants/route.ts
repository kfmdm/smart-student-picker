import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type SessionRow = {
  uuid: string;
  name: string;
  type: string;
  status: string;
};

type ParticipantRow = {
  uuid: string;
  name: string;
  created_at: Date | string | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await context.params;

  const sessions = await prisma.$queryRaw<SessionRow[]>`
    SELECT uuid, name, type, status
    FROM sessions
    WHERE uuid = ${uuid}
    LIMIT 1
  `;

  const session = sessions[0];

  if (!session) {
    return NextResponse.json(
      { message: "Session wurde nicht gefunden." },
      { status: 404 },
    );
  }

  const participants = await prisma.$queryRaw<ParticipantRow[]>`
    SELECT uuid, name, created_at
    FROM participants
    WHERE session_uuid = ${uuid}
    ORDER BY created_at ASC, id ASC
  `;

  return NextResponse.json(
    {
      session,
      participants: participants.map((participant) => ({
        ...participant,
        created_at: participant.created_at
          ? new Date(participant.created_at).toISOString()
          : null,
      })),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
