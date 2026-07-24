import { describe, expect, it, vi } from "vitest";
import {
  addParticipant,
  clearParticipants,
  removeParticipant,
  snapshot,
  subscribe,
  type RelayParticipant,
} from "@/lib/liveRelay";

// Eindeutige Session-ID je Test (globaler Singleton-State im Relay).
function sessionId(): string {
  return `test-${Math.random().toString(36).slice(2)}`;
}

describe("liveRelay – Teilnehmer", () => {
  it("fügt Teilnehmer hinzu und liefert sie im Snapshot (kein DB-Zugriff)", () => {
    const sid = sessionId();
    const participant = addParticipant(sid, "Anna");

    expect(participant).not.toBeNull();
    expect(participant?.name).toBe("Anna");
    expect(participant?.uuid).toBeTruthy();

    const snap = snapshot(sid);
    expect(snap.map((p) => p.name)).toEqual(["Anna"]);
  });

  it("weist leere Namen ab und trimmt/kürzt lange Namen", () => {
    const sid = sessionId();
    expect(addParticipant(sid, "   ")).toBeNull();
    expect(snapshot(sid)).toHaveLength(0);

    const trimmed = addParticipant(sid, "  Ben  ");
    expect(trimmed?.name).toBe("Ben");

    const long = addParticipant(sid, "x".repeat(300));
    expect(long?.name.length).toBe(120);
  });

  it("entfernt einzelne Teilnehmer", () => {
    const sid = sessionId();
    const a = addParticipant(sid, "A");
    addParticipant(sid, "B");

    expect(removeParticipant(sid, a!.uuid)).toBe(true);
    expect(removeParticipant(sid, "unbekannt")).toBe(false);
    expect(snapshot(sid).map((p) => p.name)).toEqual(["B"]);
  });

  it("leert alle Teilnehmer (Export-Reset)", () => {
    const sid = sessionId();
    addParticipant(sid, "A");
    addParticipant(sid, "B");
    clearParticipants(sid);
    expect(snapshot(sid)).toHaveLength(0);
  });
});

describe("liveRelay – Broadcast", () => {
  it("benachrichtigt Subscriber bei Änderungen und stoppt nach dem Abmelden", () => {
    const sid = sessionId();
    const listener = vi.fn<(participants: RelayParticipant[]) => void>();

    const unsubscribe = subscribe(sid, listener);

    addParticipant(sid, "Anna");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.lastCall?.[0].map((p) => p.name)).toEqual(["Anna"]);

    addParticipant(sid, "Ben");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    addParticipant(sid, "Cara");
    expect(listener).toHaveBeenCalledTimes(2); // keine weitere Benachrichtigung
  });
});
