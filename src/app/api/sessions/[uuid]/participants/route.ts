import { prisma } from "@/lib/prisma";
import {
  isSessionType,
  normalizeSessionSettings,
  parseSessionSettings,
  type SessionSettings,
} from "@/lib/sessionTypes";
import { snapshot } from "@/lib/liveRelay";
import { NextResponse } from "next/server";

type SessionRow = {
  uuid: string;
  name: string;
  type: string;
  settings: SessionSettings | string | null;
  status: string;
};

// Liefert die Session-Metadaten (aus der DB) plus den aktuellen Teilnehmer-
// Snapshot aus dem flüchtigen Relay (Prinzip P1: Namen nie aus der DB).
export async function GET(
  _request: Request,
  context: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await context.params;

  const sessions = await prisma.$queryRaw<SessionRow[]>`
    SELECT uuid, name, type, settings, status
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

  return NextResponse.json(
    {
      session: {
        ...session,
        type: isSessionType(session.type) ? session.type : "single_draw",
        settings: normalizeSessionSettings(
          isSessionType(session.type) ? session.type : "single_draw",
          parseSessionSettings(session.settings),
        ),
      },
      participants: snapshot(uuid),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
