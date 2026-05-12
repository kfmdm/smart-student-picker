"use client";

import { FormEvent, useState } from "react";

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
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">Zur Session anmelden</h1>

        <p className="mt-2 text-gray-600">
          Geben Sie Ihren Namen ein, um an der Auslosung teilzunehmen.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            className="w-full rounded-lg border border-gray-300 px-4 py-3"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ihr Name"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-black px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {isSubmitting ? "Registriere..." : "Registrieren"}
          </button>
        </form>

        {successMessage && (
          <div className="mt-4 rounded-lg bg-green-100 p-4 text-green-800">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-lg bg-red-100 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        <p className="mt-6 break-all text-xs text-gray-400">
          Session UUID: {sessionUuid}
        </p>
      </div>
    </main>
  );
}