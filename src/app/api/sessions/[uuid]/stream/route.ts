import { NextRequest } from "next/server";
import { snapshot, subscribe, type RelayParticipant } from "@/lib/liveRelay";

// SSE-Stream der Live-Teilnehmer einer Session. Server-Push, kein Polling.
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await context.params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const sendParticipants = (participants: RelayParticipant[]) => {
        if (closed) {
          return;
        }

        try {
          controller.enqueue(
            encoder.encode(
              `event: participants\ndata: ${JSON.stringify(participants)}\n\n`,
            ),
          );
        } catch {
          closed = true;
        }
      };

      // Initialer Snapshot, danach Live-Updates.
      sendParticipants(snapshot(uuid));
      const unsubscribe = subscribe(uuid, sendParticipants);

      const heartbeat = setInterval(() => {
        if (closed) {
          return;
        }

        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          closed = true;
        }
      }, 15000);

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        clearInterval(heartbeat);
        unsubscribe();

        try {
          controller.close();
        } catch {
          // Controller ist evtl. schon geschlossen.
        }
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // verhindert Buffering hinter nginx/Plesk-Reverse-Proxy
      "X-Accel-Buffering": "no",
    },
  });
}
