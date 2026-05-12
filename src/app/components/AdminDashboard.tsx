"use client";

import { useEffect, useState } from "react";
import SessionForm, {
    SessionFormValues,
    SessionStatus,
    SessionType,
} from "./SessionForm";
import QRCodeButton from "./QRCodeButton";
type Session = {
    id: number;
    uuid: string;
    name: string;
    type: SessionType;
    status: SessionStatus;
    created_at: string;
    updated_at: string;
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
        loadSessions();
    }, []);

    async function createSession(values: SessionFormValues) {
        await fetch("/api/sessions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
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
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(values),
        });

        setEditingSession(null);
        await loadSessions();
    }

    async function deleteSession(uuid: string) {
        await fetch(`/api/sessions/${uuid}`, {
            method: "DELETE",
        });

        await loadSessions();
    }

    return (
        <main className="min-h-screen bg-gray-50 p-10">
            <div className="mx-auto max-w-5xl">
                <h1 className="text-3xl font-bold">Smart Student Picker</h1>

                <p className="mt-2 text-gray-600">
                    Admin Dashboard für Professor-Sessions
                </p>

                <div className="mt-8">
                    {editingSession ? (
                        <SessionForm
                            key={editingSession.uuid}
                            title="Session bearbeiten"
                            submitLabel="Speichern"
                            initialValues={{
                                name: editingSession.name,
                                type: editingSession.type,
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

                <div className="mt-8 rounded-xl bg-white p-6 shadow">
                    <h2 className="text-xl font-semibold">Sessions</h2>

                    <div className="mt-4">
                        {/* Desktop Table */}
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b">
                                        <th className="py-3">Name</th>
                                        <th className="py-3">Type</th>
                                        <th className="py-3">Status</th>
                                        <th className="py-3">UUID</th>
                                        <th className="py-3 text-right">Aktionen</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {sessions.map((session) => (
                                        <tr key={session.uuid} className="border-b">
                                            <td className="py-3">{session.name}</td>

                                            <td className="py-3">{session.type}</td>

                                            <td className="py-3">{session.status}</td>

                                            <td className="max-w-[220px] truncate py-3 text-sm text-gray-500">
                                                {session.uuid}
                                            </td>

                                            <td className="py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <QRCodeButton uuid={session.uuid} />
                                                    <button
                                                        onClick={() => setEditingSession(session)}
                                                        className="rounded bg-blue-600 px-3 py-2 text-white"
                                                    >
                                                        Ändern
                                                    </button>

                                                    <button
                                                        onClick={() => deleteSession(session.uuid)}
                                                        className="rounded bg-red-600 px-3 py-2 text-white"
                                                    >
                                                        Löschen
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {sessions.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-6 text-center text-gray-500">
                                                Noch keine Sessions vorhanden.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="space-y-4 md:hidden">
                            {sessions.map((session) => (
                                <div
                                    key={session.uuid}
                                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                                >
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">
                                                Name
                                            </p>

                                            <p className="mt-1 text-base font-semibold">
                                                {session.name}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-sm font-medium text-gray-500">
                                                UUID
                                            </p>

                                            <p className="mt-1 break-all text-sm">
                                                {session.uuid}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-sm font-medium text-gray-500">
                                                Type
                                            </p>

                                            <p className="mt-1">
                                                {session.type}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-sm font-medium text-gray-500">
                                                Status
                                            </p>

                                            <p className="mt-1">
                                                {session.status}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-5 flex flex-col gap-2">
                                        <QRCodeButton uuid={session.uuid} />
                                        <button
                                            onClick={() => setEditingSession(session)}
                                            className="rounded-lg bg-blue-600 px-4 py-2 text-white"
                                        >
                                            Ändern
                                        </button>

                                        <button
                                            onClick={() => deleteSession(session.uuid)}
                                            className="rounded-lg bg-red-600 px-4 py-2 text-white"
                                        >
                                            Löschen
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {sessions.length === 0 && (
                                <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
                                    Noch keine Sessions vorhanden.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}