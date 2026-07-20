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
    value: SessionFormValues[K]
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
    <form onSubmit={handleSubmit} className="rounded-xl bg-white p-6 shadow">
      <h2 className="text-xl font-semibold">{title}</h2>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
        <input
          className="rounded-lg border border-gray-300 px-4 py-2 md:col-span-2"
          value={values.name}
          onChange={(event) => updateField("name", event.target.value)}
          placeholder="Session Name"
        />

        <select
          className="rounded-lg border border-gray-300 px-4 py-2"
          value={values.type}
          onChange={(event) =>
            updateType(event.target.value as SessionType)
          }
        >
          {SESSION_TYPES.map((sessionType) => (
            <option key={sessionType.value} value={sessionType.value}>
              {sessionType.label}
            </option>
          ))}
        </select>

        {values.type === "team_draw" && (
          <input
            className="rounded-lg border border-gray-300 px-4 py-2"
            type="number"
            min={MIN_TEAM_SIZE}
            max={MAX_TEAM_SIZE}
            value={values.settings.teamSize ?? DEFAULT_TEAM_SIZE}
            onChange={(event) => updateTeamSize(Number(event.target.value))}
            placeholder="Teamgröße"
          />
        )}

        <select
          className="rounded-lg border border-gray-300 px-4 py-2"
          value={values.status}
          onChange={(event) =>
            updateField("status", event.target.value as SessionStatus)
          }
        >
          <option value="inactive">inactive</option>
          <option value="active">active</option>
          <option value="closed">closed</option>
        </select>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-black px-5 py-2 text-white disabled:opacity-50"
          >
            {isSubmitting ? "Speichern..." : submitLabel}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg bg-gray-200 px-5 py-2"
            >
              Abbrechen
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
