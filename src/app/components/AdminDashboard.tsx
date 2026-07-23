"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Rocket, Sparkles, Trash2 } from "lucide-react";
import {
  getSessionTypeLabel,
  type SessionSettings,
  type SessionType,
} from "@/lib/sessionTypes";
import SessionForm, {
  SessionFormValues,
  SessionStatus,
} from "./SessionForm";
import QRCodeButton from "./QRCodeButton";

type Session = {
  id: number;
  uuid: string;
  name: string;
  type: SessionType;
  settings?: SessionSettings;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
};

const statusStyles: Record<SessionStatus, string> = {
  active: "border-emerald-300/30 bg-emerald-300/15 text-emerald-100",
  inactive: "border-white/15 bg-white/5 text-white/55",
  closed: "border-amber-300/30 bg-amber-300/15 text-amber-100",
};

export default function AdminDashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  async function loadSessions() {
    const response = await fetch("/api/sessions");
    const data = await response.json();
    setSessions(data);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialSessions() {
      const response = await fetch("/api/sessions");
      const data = await response.json();

      if (isMounted) {
        setSessions(data);
      }
    }

    void loadInitialSessions();

    return () => {
      isMounted = false;
    };
  }, []);

  async function createSession(values: SessionFormValues) {
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    await loadSessions();
  }

  async function updateSession(values: SessionFormValues) {
    if (!editingSession) {
      return;
    }

    await fetch(`/api/sessions/${editingSession.uuid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setEditingSession(null);
    await loadSessions();
  }

  async function deleteSession(uuid: string) {
    await fetch(`/api/sessions/${uuid}`, { method: "DELETE" });
    await loadSessions();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070815] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(145deg,#070815_0%,#111942_42%,#2b1744_70%,#051d28_100%)]" />
      <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_15%_15%,rgba(111,211,255,0.18),transparent_30%),radial-gradient(circle_at_85%_80%,rgba(255,115,181,0.14),transparent_32%)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <header>
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-cyan-100">
            <Sparkles size={18} />
            Admin-Dashboard
          </div>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            Smart Student Picker
          </h1>
          <p className="mt-2 text-white/60">
            Sessions anlegen, QR-Codes teilen und die Live-Auslosung starten.
          </p>
        </header>

        <div className="mt-8">
          {editingSession ? (
            <SessionForm
              key={editingSession.uuid}
              title="Session bearbeiten"
              submitLabel="Speichern"
              initialValues={{
                name: editingSession.name,
                type: editingSession.type,
                settings: editingSession.settings ?? {},
                status: editingSession.status,
              }}
              onSubmit={updateSession}
              onCancel={() => setEditingSession(null)}
            />
          ) : (
            <SessionForm
              title="Neue Session erstellen"
              submitLabel="Hinzufügen"
              onSubmit={createSession}
            />
          )}
        </div>

        <div className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Sessions</h2>
            <span className="text-sm text-white/50">
              {sessions.length} gesamt
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <div
                key={session.uuid}
                className="flex flex-col rounded-2xl border border-white/12 bg-white/5 p-5 shadow-2xl backdrop-blur transition hover:border-white/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words text-lg font-bold">
                    {session.name}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusStyles[session.status]}`}
                  >
                    {session.status}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded border border-cyan-200/25 bg-cyan-200/10 px-2 py-1 text-cyan-50">
                    {getSessionTypeLabel(session.type)}
                  </span>
                  {session.type === "team_draw" && (
                    <span className="rounded border border-white/15 bg-white/5 px-2 py-1 text-white/70">
                      {session.settings?.teamSize ?? 2}er-Teams
                    </span>
                  )}
                </div>

                <p className="mt-3 break-all font-mono text-xs text-white/35">
                  {session.uuid}
                </p>

                <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4">
                  <QRCodeButton uuid={session.uuid} />
                  <Link
                    href={`/sessions/${session.uuid}/live`}
                    title="Live-Ansicht öffnen"
                    className="flex items-center justify-center gap-2 rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-200"
                  >
                    <Rocket size={16} />
                    Live
                  </Link>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => setEditingSession(session)}
                      title="Bearbeiten"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/15"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => deleteSession(session.uuid)}
                      title="Löschen"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-300/20 bg-red-500/15 text-red-100 transition hover:bg-red-500/25"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-white/20 p-10 text-center text-white/55">
                Noch keine Sessions vorhanden. Lege oben die erste an.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
