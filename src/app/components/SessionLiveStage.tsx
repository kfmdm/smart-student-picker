"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Crown,
  Minus,
  Plus,
  Rocket,
  SatelliteDish,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_SESSION_TYPE, getSessionTypeLabel } from "@/lib/sessionTypes";

type Participant = {
  uuid: string;
  name: string;
  created_at: string | null;
};

type Session = {
  uuid: string;
  name: string;
  type: string;
  status: string;
};

type LiveStageResponse = {
  session: Session;
  participants: Participant[];
};

type SessionLiveStageProps = {
  sessionUuid: string;
};

const starPositions = Array.from({ length: 72 }, (_, index) => ({
  id: index,
  left: `${(index * 37 + 11) % 100}%`,
  top: `${(index * 53 + 17) % 100}%`,
  size: index % 9 === 0 ? 3 : index % 4 === 0 ? 2 : 1,
  delay: `${(index % 12) * 0.35}s`,
  duration: `${3 + (index % 6) * 0.45}s`,
}));

export default function SessionLiveStage({ sessionUuid }: SessionLiveStageProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [winner, setWinner] = useState<Participant | null>(null);
  const [pendingWinner, setPendingWinner] = useState<Participant | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [participantWeights, setParticipantWeights] = useState<
    Record<string, number>
  >({});
  const [newParticipantIds, setNewParticipantIds] = useState<Set<string>>(
    () => new Set(),
  );
  const knownParticipantIds = useRef<Set<string>>(new Set());
  const hasLoadedOnce = useRef(false);

  function dismissWinner() {
    setWinner(null);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadParticipants() {
      try {
        const response = await fetch(`/api/sessions/${sessionUuid}/participants`, {
          cache: "no-store",
        });
        const data = (await response.json()) as LiveStageResponse | { message?: string };

        if (!response.ok) {
          throw new Error("message" in data ? data.message : "Session konnte nicht geladen werden.");
        }

        if (!isMounted || !("participants" in data)) {
          return;
        }

        const nextParticipants = data.participants;
        const incomingIds = nextParticipants
          .map((participant) => participant.uuid)
          .filter((uuid) => !knownParticipantIds.current.has(uuid));

        setSession(data.session);
        setParticipants(nextParticipants);
        setErrorMessage("");

        if (hasLoadedOnce.current && incomingIds.length > 0) {
          setNewParticipantIds(new Set(incomingIds));
          window.setTimeout(() => {
            if (isMounted) {
              setNewParticipantIds(new Set());
            }
          }, 2200);
        }

        knownParticipantIds.current = new Set(
          nextParticipants.map((participant) => participant.uuid),
        );
        hasLoadedOnce.current = true;
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Session konnte nicht geladen werden.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadParticipants();
    const intervalId = window.setInterval(loadParticipants, 2000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [sessionUuid]);

  useEffect(() => {
    if (!winner || isDrawing) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dismissWinner();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawing, winner]);

  const visibleParticipants = useMemo(
    () => participants.slice(-18),
    [participants],
  );
  const stageParticipants = useMemo(() => {
    const focusParticipant = pendingWinner;

    if (
      !focusParticipant ||
      visibleParticipants.some(
        (participant) => participant.uuid === focusParticipant.uuid,
      )
    ) {
      return visibleParticipants;
    }

    return [...visibleParticipants, focusParticipant];
  }, [pendingWinner, visibleParticipants]);
  const weightedParticipants = useMemo(
    () =>
      participants.flatMap((participant) =>
        Array.from(
          { length: participantWeights[participant.uuid] ?? 1 },
          () => participant,
        ),
      ),
    [participants, participantWeights],
  );

  function updateParticipantWeight(participantUuid: string, change: number) {
    setParticipantWeights((currentWeights) => {
      const currentWeight = currentWeights[participantUuid] ?? 1;
      const nextWeight = Math.max(1, currentWeight + change);

      return {
        ...currentWeights,
        [participantUuid]: nextWeight,
      };
    });
  }

  async function deleteParticipant(participantUuid: string) {
    try {
      const response = await fetch(
        `/api/sessions/${sessionUuid}/participants/${participantUuid}`,
        {
          method: "DELETE",
        },
      );
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "Teilnehmer konnte nicht gelöscht werden.");
      }

      setParticipants((currentParticipants) =>
        currentParticipants.filter(
          (participant) => participant.uuid !== participantUuid,
        ),
      );
      setParticipantWeights((currentWeights) => {
        const nextWeights = { ...currentWeights };
        delete nextWeights[participantUuid];
        return nextWeights;
      });
      setNewParticipantIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(participantUuid);
        return nextIds;
      });
      knownParticipantIds.current.delete(participantUuid);

      if (winner?.uuid === participantUuid) {
        setWinner(null);
      }

      if (pendingWinner?.uuid === participantUuid) {
        setPendingWinner(null);
      }

      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Teilnehmer konnte nicht gelöscht werden.",
      );
    }
  }

  function drawWinner() {
    if (weightedParticipants.length === 0 || isDrawing) {
      return;
    }

    setWinner(null);
    setPendingWinner(null);
    setIsDrawing(true);

    const winnerIndex = Math.floor(Math.random() * weightedParticipants.length);
    const selectedWinner = weightedParticipants[winnerIndex];

    setPendingWinner(selectedWinner);

    window.setTimeout(() => {
      setWinner(selectedWinner);
      setPendingWinner(null);
      setIsDrawing(false);
    }, 2300);
  }

  function getRocketStyle(index: number) {
    if (!isDrawing) {
      return { animationDelay: `${(index % 5) * 0.06}s` };
    }

    const direction = index % 2 === 0 ? 1 : -1;
    const spread = 54 + (index % 6) * 17;
    const lift = 38 + (index % 5) * 13;

    return {
      animationDelay: `${(index % 7) * -0.08}s`,
      "--scramble-x1": `${direction * spread}px`,
      "--scramble-y1": `${-lift}px`,
      "--scramble-r1": `${direction * (10 + (index % 4) * 4)}deg`,
      "--scramble-x2": `${direction * -1 * (spread + 28)}px`,
      "--scramble-y2": `${lift * 0.8}px`,
      "--scramble-r2": `${direction * -1 * (12 + (index % 5) * 3)}deg`,
      "--scramble-x3": `${direction * (spread + 46)}px`,
      "--scramble-y3": `${lift + 18}px`,
      "--scramble-r3": `${direction * (16 + (index % 3) * 6)}deg`,
      "--scramble-x4": `${direction * -1 * (spread + 18)}px`,
      "--scramble-y4": `${-lift - 24}px`,
      "--scramble-r4": `${direction * -1 * (18 + (index % 4) * 5)}deg`,
    } as CSSProperties & Record<string, string>;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070815] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(145deg,#070815_0%,#111942_42%,#2b1744_70%,#051d28_100%)]" />
      <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_18%_20%,rgba(111,211,255,0.22),transparent_28%),radial-gradient(circle_at_78%_32%,rgba(255,214,102,0.14),transparent_24%),radial-gradient(circle_at_50%_84%,rgba(255,115,181,0.18),transparent_32%)]" />
      <div className="star-drift absolute inset-0">
        {starPositions.map((star) => (
          <span
            key={star.id}
            className="absolute rounded-full bg-white"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              animationDelay: star.delay,
              animationDuration: star.duration,
            }}
          />
        ))}
      </div>

      <section className="relative z-10 flex min-h-screen flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded border border-white/20 bg-white/10 px-4 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
          >
            <ArrowLeft size={17} />
            Dashboard
          </Link>

          <div className="flex items-center gap-3 rounded border border-white/15 bg-black/20 px-4 py-2 text-sm text-white/80 backdrop-blur">
            <SatelliteDish size={17} className="text-cyan-200" />
            Live alle 2 Sekunden
          </div>
        </header>

        <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 text-sm uppercase tracking-[0.18em] text-cyan-100">
              <Sparkles size={18} />
              Bewerbungsflug
            </div>

            <h1 className="mt-4 max-w-5xl text-balance text-5xl font-black leading-tight sm:text-6xl lg:text-8xl">
              {session?.name ?? "Session wird geladen"}
            </h1>

            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <span className="rounded border border-cyan-200/30 bg-cyan-200/10 px-3 py-1 text-cyan-50">
                Typ: {getSessionTypeLabel(session?.type ?? DEFAULT_SESSION_TYPE)}
              </span>
              <span className="rounded border border-emerald-200/30 bg-emerald-200/10 px-3 py-1 text-emerald-50">
                Status: {session?.status ?? "..."}
              </span>
              <span className="rounded border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-amber-50">
                {participants.length} angemeldet
              </span>
            </div>

            <div className="relative mt-12 h-[44vh] min-h-[320px] overflow-hidden rounded border border-white/15 bg-black/20 backdrop-blur-sm">
              <div className="absolute inset-x-0 top-1/2 mx-auto flex w-full max-w-4xl -translate-y-1/2 flex-wrap justify-center gap-3 px-5">
                {stageParticipants.map((participant, index) => {
                  const isNew = newParticipantIds.has(participant.uuid);

                  return (
                    <div
                      key={participant.uuid}
                      className={`participant-rocket flex items-center gap-2 rounded border border-white/20 bg-white/12 font-semibold shadow-2xl backdrop-blur ${
                        isNew ? "participant-rocket--new" : ""
                      } ${isDrawing ? "participant-rocket--scramble" : ""} ${
                        "max-w-[220px] px-4 py-3 text-sm"
                      }`}
                      style={getRocketStyle(index)}
                    >
                      <Rocket
                        size={20}
                        className={isNew ? "text-amber-200" : "text-cyan-200"}
                      />
                      <span className="truncate">{participant.name}</span>
                    </div>
                  );
                })}

                {participants.length === 0 && !isLoading && (
                  <div className="rounded border border-dashed border-white/25 bg-black/20 px-5 py-4 text-center text-white/70">
                    Noch wartet die Startrampe auf Bewerbungen.
                  </div>
                )}
              </div>

              {isDrawing && (
                <div className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100">
                  Auslosung läuft
                </div>
              )}

              {winner && !isDrawing && (
                <div className="absolute inset-0 z-30 flex items-center justify-center px-5">
                  <div className="winner-reveal relative max-w-[min(560px,92%)]">
                    <button
                      type="button"
                      onClick={dismissWinner}
                      title="Gewinner ausblenden"
                      className="absolute -right-3 -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-xl transition hover:bg-black"
                    >
                      <X size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={dismissWinner}
                      className="flex w-full items-center justify-center gap-3 rounded border border-amber-200/50 bg-[#17120a]/80 px-6 py-5 text-center shadow-2xl shadow-amber-300/20 backdrop-blur transition hover:bg-[#21180d]/90"
                    >
                      <Crown size={46} className="shrink-0 text-amber-200" />
                      <span className="min-w-0 break-words text-3xl font-black leading-tight text-white sm:text-5xl">
                        {winner.name}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="rounded border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white/65">Bewerbungen</p>
                <p className="mt-1 text-4xl font-black">{participants.length}</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded border border-white/20 bg-black/20">
                <Users size={26} className="text-cyan-100" />
              </div>
            </div>

            <button
              type="button"
              onClick={drawWinner}
              disabled={weightedParticipants.length === 0 || isDrawing}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded bg-amber-300 px-4 py-3 font-bold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Crown size={20} />
              {winner ? "Nochmal auslosen" : isDrawing ? "Auslosung..." : "Auslosen"}
            </button>

            <div className="mt-6 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {participants.map((participant) => {
                const weight = participantWeights[participant.uuid] ?? 1;

                return (
                <div
                  key={participant.uuid}
                  className="flex items-center gap-3 rounded border border-white/10 bg-black/20 px-3 py-3"
                >
                  <button
                    type="button"
                    onClick={() => updateParticipantWeight(participant.uuid, -1)}
                    disabled={weight === 1}
                    title="Gewichtung verringern"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/15 bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <Minus size={16} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 flex-1 break-words font-medium leading-snug">
                        {participant.name}
                      </span>
                      <span className="shrink-0 rounded bg-amber-200/15 px-2 py-1 text-center text-xs font-bold text-amber-100">
                        x{weight}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateParticipantWeight(participant.uuid, 1)}
                    title="Gewichtung erhöhen"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteParticipant(participant.uuid)}
                    disabled={isDrawing}
                    title="Teilnehmer löschen"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-red-300/20 bg-red-500/15 text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                );
              })}

              {participants.length === 0 && (
                <p className="rounded border border-dashed border-white/20 p-4 text-sm text-white/65">
                  Sobald jemand den QR-Code nutzt, landet der Name hier.
                </p>
              )}
            </div>

            {errorMessage && (
              <p className="mt-4 rounded border border-red-300/30 bg-red-500/20 p-3 text-sm text-red-50">
                {errorMessage}
              </p>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
