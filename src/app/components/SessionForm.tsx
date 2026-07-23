"use client";

import { FormEvent, useState } from "react";
import {
  DEFAULT_SESSION_TYPE,
  DEFAULT_TEAM_SIZE,
  MAX_TEAM_SIZE,
  MIN_TEAM_SIZE,
  SESSION_TYPES,
  clampTeamSize,
  normalizeSessionSettings,
  type SessionSettings,
  type SessionType,
} from "@/lib/sessionTypes";

export type SessionStatus = "inactive" | "active" | "closed";

export type SessionFormValues = {
  name: string;
  type: SessionType;
  status: SessionStatus;
  settings: SessionSettings;
};

type SessionFormProps = {
  title: string;
  submitLabel: string;
  initialValues?: SessionFormValues;
  onSubmit: (values: SessionFormValues) => Promise<void>;
  onCancel?: () => void;
};

const defaultValues: SessionFormValues = {
  name: "",
  type: DEFAULT_SESSION_TYPE,
  status: "active",
  settings: {},
};

const fieldClass =
  "rounded-lg border border-white/15 bg-black/25 px-4 py-2.5 text-white outline-none transition placeholder:text-white/35 focus:border-cyan-200";

export default function SessionForm({
  title,
  submitLabel,
  initialValues = defaultValues,
  onSubmit,
  onCancel,
}: SessionFormProps) {
  const [values, setValues] = useState<SessionFormValues>(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof SessionFormValues>(
    field: K,
    value: SessionFormValues[K],
  ) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  }

  function updateType(type: SessionType) {
    setValues((currentValues) => ({
      ...currentValues,
      type,
      settings: normalizeSessionSettings(type, currentValues.settings),
    }));
  }

  function updateTeamSize(teamSize: number) {
    setValues((currentValues) => ({
      ...currentValues,
      settings: {
        ...currentValues.settings,
        teamSize: clampTeamSize(teamSize),
      },
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);

    try {
      await onSubmit(values);
      setValues(defaultValues);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/12 bg-white/5 p-6 shadow-2xl backdrop-blur"
    >
      <h2 className="text-lg font-semibold text-white">{title}</h2>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
        <input
          className={`${fieldClass} md:col-span-2`}
          value={values.name}
          onChange={(event) => updateField("name", event.target.value)}
          placeholder="Session-Name"
        />

        <select
          className={fieldClass}
          value={values.type}
          onChange={(event) => updateType(event.target.value as SessionType)}
        >
          {SESSION_TYPES.map((sessionType) => (
            <option
              key={sessionType.value}
              value={sessionType.value}
              className="bg-slate-900"
            >
              {sessionType.label}
            </option>
          ))}
        </select>

        {values.type === "team_draw" && (
          <input
            className={fieldClass}
            type="number"
            min={MIN_TEAM_SIZE}
            max={MAX_TEAM_SIZE}
            value={values.settings.teamSize ?? DEFAULT_TEAM_SIZE}
            onChange={(event) => updateTeamSize(Number(event.target.value))}
            placeholder="Teamgröße"
          />
        )}

        <select
          className={fieldClass}
          value={values.status}
          onChange={(event) =>
            updateField("status", event.target.value as SessionStatus)
          }
        >
          <option value="inactive" className="bg-slate-900">
            inactive
          </option>
          <option value="active" className="bg-slate-900">
            active
          </option>
          <option value="closed" className="bg-slate-900">
            closed
          </option>
        </select>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-cyan-200 px-5 py-2.5 font-bold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Speichern…" : submitLabel}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-white/80 transition hover:bg-white/10"
            >
              Abbrechen
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
