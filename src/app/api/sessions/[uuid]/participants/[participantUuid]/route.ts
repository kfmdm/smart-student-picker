import { NextResponse } from "next/server";
import { removeParticipant } from "@/lib/liveRelay";

// Entfernt einen Teilnehmer aus dem flüchtigen Relay (kein DB-Zugriff, P1).
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ uuid: string; participantUuid: string }> },
) {
  const { uuid, participantUuid } = await context.params;

  const existed = removeParticipant(uuid, participantUuid);

  if (!existed) {
    return NextResponse.json(
      { message: "Teilnehmer wurde nicht gefunden." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
