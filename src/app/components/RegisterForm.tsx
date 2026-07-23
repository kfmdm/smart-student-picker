"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Rocket, TriangleAlert } from "lucide-react";

type RegisterFormProps = {
  sessionUuid: string;
};

export default function RegisterForm({ sessionUuid }: RegisterFormProps) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(`/api/register/${sessionUuid}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message ?? "Registrierung fehlgeschlagen.");
        return;
      }

      setSuccessMessage("Sie wurden erfolgreich registriert.");
      setName("");
    } catch {
      setErrorMessage("Es ist ein unerwarteter Fehler aufgetreten.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070815] px-5 py-10 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(145deg,#070815_0%,#111942_42%,#2b1744_70%,#051d28_100%)]" />
      <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_18%,rgba(111,211,255,0.22),transparent_30%),radial-gradient(circle_at_82%_78%,rgba(255,115,181,0.18),transparent_32%)]" />

      <div className="winner-reveal relative w-full max-w-md rounded-2xl border border-white/15 bg-white/10 p-7 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-cyan-100">
          <Rocket size={18} />
          Zur Auslosung anmelden
        </div>

        <h1 className="mt-4 text-3xl font-black leading-tight">
          Bewerbungsflug starten
        </h1>
        <p className="mt-2 text-white/70">
          Gib deinen Namen ein, um an der Auslosung teilzunehmen.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            className="w-full rounded-lg border border-white/15 bg-black/25 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-cyan-200"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Dein Name"
            autoFocus
          />

          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-300 px-5 py-3 font-bold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Rocket size={18} />
            {isSubmitting ? "Wird gesendet…" : "Registrieren"}
          </button>
        </form>

        {successMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200/30 bg-emerald-300/15 p-4 text-emerald-50">
            <CheckCircle2 size={18} className="shrink-0" />
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-300/30 bg-red-500/20 p-4 text-red-50">
            <TriangleAlert size={18} className="shrink-0" />
            {errorMessage}
          </div>
        )}

        <p className="mt-6 break-all text-xs text-white/35">
          Session: {sessionUuid}
        </p>
      </div>
    </main>
  );
}
