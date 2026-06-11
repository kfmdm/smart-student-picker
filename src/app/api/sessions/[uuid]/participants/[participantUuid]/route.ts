import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type ParticipantRow = {
  uuid: string;
};

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ uuid: string; participantUuid: string }> },
) {
  const { uuid, participantUuid } = await context.params;

  const participants = await prisma.$queryRaw<ParticipantRow[]>`
    SELECT uuid
    FROM participants
    WHERE session_uuid = ${uuid} AND uuid = ${participantUuid}
    LIMIT 1
  `;

  if (!participants[0]) {
    return NextResponse.json(
      { message: "Teilnehmer wurde nicht gefunden." },
      { status: 404 },
    );
  }

  await prisma.$executeRaw`
    DELETE FROM participants
    WHERE session_uuid = ${uuid} AND uuid = ${participantUuid}
  `;

  return NextResponse.json({ success: true });
}
