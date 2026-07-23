"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(data.message ?? "Anmeldung fehlgeschlagen.");
        return;
      }

      router.push("/");
      router.refresh();
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

      <div className="winner-reveal relative w-full max-w-sm rounded-2xl border border-white/15 bg-white/10 p-7 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-cyan-100">
          <Sparkles size={18} />
          Admin-Bereich
        </div>

        <h1 className="mt-4 text-3xl font-black leading-tight">Anmeldung</h1>
        <p className="mt-2 text-white/70">
          Bitte das Dozenten-Passwort eingeben.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/25 px-3 focus-within:border-cyan-200">
            <KeyRound size={18} className="shrink-0 text-white/50" />
            <input
              type="password"
              className="w-full bg-transparent py-3 text-white outline-none placeholder:text-white/35"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Passwort"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !password}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-200 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isSubmitting ? "Anmelden…" : "Anmelden"}
          </button>
        </form>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-300/30 bg-red-500/20 p-4 text-sm text-red-50">
            {errorMessage}
          </div>
        )}
      </div>
    </main>
  );
}
