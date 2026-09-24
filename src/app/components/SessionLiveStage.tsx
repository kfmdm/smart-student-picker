"use client";

import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  ArrowLeft,
  Atom,
  BadgeCheck,
  Binary,
  BookOpen,
  Brain,
  Briefcase,
  ChevronDown,
  Code2,
  Crown,
  FlaskConical,
  Gamepad2,
  Gem,
  Globe2,
  GraduationCap,
  HeartHandshake,
  Maximize2,
  Lightbulb,
  Minus,
  Palette,
  Plus,
  Rocket,
  SatelliteDish,
  Shield,
  Sparkles,
  Sprout,
  Target,
  Trash2,
  Trophy,
  Users,
  GripVertical,
  X,
} from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SESSION_TYPE,
  DEFAULT_TEAM_SIZE,
  MAX_TEAM_SIZE,
  MIN_TEAM_SIZE,
  clampTeamSize,
  getSessionTypeLabel,
  type SessionSettings,
} from "@/lib/sessionTypes";
import {
  Check,
  Copy,
  Download,
  Gauge,
  Lock,
  LockOpen,
  Pin,
  PinOff,
  Upload,
  UserPlus,
} from "lucide-react";
import {
  DEFAULT_ALPHA,
  DIFFICULTY_LEVELS,
  applyRoundResult,
  drawWeight,
  getRecord,
  pickWeighted,
  type FairnessMemory,
} from "@/lib/fairness";
import {
  exportFairnessWorkbook,
  parseFairnessWorkbook,
} from "@/lib/xlsx";
import {
  fairnessKey,
  loadJSON,
  participantsKey,
  removeKey,
  saveJSON,
} from "@/lib/clientStore";
import { createLocalId, distributeTeams, shuffleItems } from "@/lib/teams";
import { QRCode } from "react-qrcode-logo";

type Participant = {
  uuid: string;
  name: string;
  created_at: string | null;
};

type Session = {
  uuid: string;
  name: string;
  type: string;
  settings: SessionSettings;
  status: string;
};

type LiveStageResponse = {
  session: Session;
  participants: Participant[];
};

type SessionLiveStageProps = {
  sessionUuid: string;
};

type StageModeProps = {
  session: Session | null;
  sessionUuid: string;
  participants: Participant[];
  newParticipantIds: Set<string>;
  isLoading: boolean;
  errorMessage: string;
  onDeleteParticipant: (participantUuid: string) => Promise<void>;
  onResetParticipants: () => Promise<void>;
};

type Topic = {
  id: string;
  title: string;
};

type Team = {
  id: string;
  members: Participant[];
  topic?: Topic;
  locked: boolean;
};

type ActiveDrag = {
  id: string;
  label: string;
  kind: "topic" | "participant";
};

const starPositions = Array.from({ length: 72 }, (_, index) => ({
  id: index,
  left: `${(index * 37 + 11) % 100}%`,
  top: `${(index * 53 + 17) % 100}%`,
  size: index % 9 === 0 ? 3 : index % 4 === 0 ? 2 : 1,
  delay: `${(index % 12) * 0.35}s`,
  duration: `${3 + (index % 6) * 0.45}s`,
}));

const teamIcons = [
  Rocket,
  Trophy,
  Target,
  Brain,
  Lightbulb,
  GraduationCap,
  BookOpen,
  Code2,
  FlaskConical,
  Globe2,
  Palette,
  Gamepad2,
  Shield,
  Gem,
  HeartHandshake,
  Sprout,
  Atom,
  Briefcase,
  Binary,
  BadgeCheck,
];

export default function SessionLiveStage({ sessionUuid }: SessionLiveStageProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "live" | "reconnecting"
  >("connecting");
  const [newParticipantIds, setNewParticipantIds] = useState<Set<string>>(
    () => new Set(),
  );
  const knownParticipantIds = useRef<Set<string>>(new Set());
  const hasLoadedOnce = useRef(false);

  // Bewerber aus dem localStorage wiederherstellen (überlebt einen Refresh,
  // auch wenn das Relay – etwa nach einem Neustart – leer ist).
  useEffect(() => {
    const stored = loadJSON<Participant[]>(participantsKey(sessionUuid), []);
    if (stored.length > 0) {
      // Post-Mount-Hydration aus dem localStorage (externes System) – bewusst.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setParticipants(stored);
      knownParticipantIds.current = new Set(
        stored.map((participant) => participant.uuid),
      );
      hasLoadedOnce.current = true;
    }
  }, [sessionUuid]);

  // Session-Metadaten einmalig laden (Name/Typ/Settings/Status aus der DB).
  useEffect(() => {
    let active = true;

    async function loadSessionMeta() {
      try {
        const response = await fetch(
          `/api/sessions/${sessionUuid}/participants`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as
          | LiveStageResponse
          | { message?: string };

        if (!response.ok) {
          throw new Error(
            "message" in data
              ? data.message
              : "Session konnte nicht geladen werden.",
          );
        }

        if (active && "session" in data) {
          setSession(data.session);
          setErrorMessage("");
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Session konnte nicht geladen werden.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadSessionMeta();

    return () => {
      active = false;
    };
  }, [sessionUuid]);

  // Live-Teilnehmer per Server-Sent-Events (Push statt Polling, kein DB-Read).
  useEffect(() => {
    const source = new EventSource(`/api/sessions/${sessionUuid}/stream`);

    const handleOpen = () => setConnectionStatus("live");
    const handleError = () => setConnectionStatus("reconnecting");
    const handleParticipants = (event: MessageEvent<string>) => {
      setConnectionStatus("live");

      let snapshotParticipants: Participant[] = [];

      try {
        snapshotParticipants = JSON.parse(event.data) as Participant[];
      } catch {
        return;
      }

      const incomingIds = snapshotParticipants
        .map((participant) => participant.uuid)
        .filter((uuid) => !knownParticipantIds.current.has(uuid));

      // Union mit dem bisherigen Stand: einmal gesehene Bewerber bleiben
      // erhalten, auch wenn ein kurzer Reconnect eine leere Momentaufnahme
      // liefert. Entfernt wird nur explizit (Löschen/Export).
      setParticipants((currentParticipants) => {
        const byUuid = new Map(
          currentParticipants.map((participant) => [
            participant.uuid,
            participant,
          ]),
        );
        for (const participant of snapshotParticipants) {
          if (!byUuid.has(participant.uuid)) {
            byUuid.set(participant.uuid, participant);
          }
        }
        const merged = Array.from(byUuid.values());
        saveJSON(participantsKey(sessionUuid), merged);
        return merged;
      });

      if (hasLoadedOnce.current && incomingIds.length > 0) {
        setNewParticipantIds(new Set(incomingIds));
        window.setTimeout(() => {
          setNewParticipantIds(new Set());
        }, 2200);
      }

      knownParticipantIds.current = new Set([
        ...knownParticipantIds.current,
        ...snapshotParticipants.map((participant) => participant.uuid),
      ]);
      hasLoadedOnce.current = true;
    };

    source.addEventListener("open", handleOpen);
    source.addEventListener("error", handleError);
    source.addEventListener(
      "participants",
      handleParticipants as EventListener,
    );

    return () => {
      source.removeEventListener("open", handleOpen);
      source.removeEventListener("error", handleError);
      source.removeEventListener(
        "participants",
        handleParticipants as EventListener,
      );
      source.close();
    };
  }, [sessionUuid]);

  async function deleteParticipant(participantUuid: string) {
    // Optimistisch entfernen; das Relay pusht anschließend die autoritative Liste.
    setParticipants((currentParticipants) => {
      const next = currentParticipants.filter(
        (participant) => participant.uuid !== participantUuid,
      );
      saveJSON(participantsKey(sessionUuid), next);
      return next;
    });

    try {
      const response = await fetch(
        `/api/sessions/${sessionUuid}/participants/${participantUuid}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(
          data.message ?? "Teilnehmer konnte nicht entfernt werden.",
        );
      }

      setNewParticipantIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(participantUuid);
        return nextIds;
      });
      knownParticipantIds.current.delete(participantUuid);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Teilnehmer konnte nicht entfernt werden.",
      );
    }
  }

  // Bewerber + Relay leeren (nach dem Excel-Export).
  async function resetParticipants() {
    setParticipants([]);
    setNewParticipantIds(new Set());
    knownParticipantIds.current = new Set();
    removeKey(participantsKey(sessionUuid));
    try {
      await fetch(`/api/sessions/${sessionUuid}/participants`, {
        method: "DELETE",
      });
    } catch {
      // Relay evtl. nicht erreichbar – der lokale Reset ist bereits erfolgt.
    }
  }

  const modeProps: StageModeProps = {
    session,
    sessionUuid,
    participants,
    newParticipantIds,
    isLoading,
    errorMessage,
    onDeleteParticipant: deleteParticipant,
    onResetParticipants: resetParticipants,
  };

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
            <SatelliteDish
              size={17}
              className={
                connectionStatus === "live"
                  ? "text-cyan-200"
                  : "text-amber-300 motion-safe:animate-pulse"
              }
            />
            {connectionStatus === "live"
              ? "Live verbunden"
              : connectionStatus === "reconnecting"
                ? "Verbindung wird wiederhergestellt…"
                : "Verbinde…"}
          </div>
        </header>

        <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1fr_360px]">
          {session?.type === "team_draw" ? (
            <TeamDrawMode
              key={`${session.uuid}-${session.settings.teamSize ?? DEFAULT_TEAM_SIZE}`}
              {...modeProps}
            />
          ) : (
            <SingleDrawMode {...modeProps} />
          )}
        </div>
      </section>
    </main>
  );
}

function StageTitle({ session }: { session: Session | null }) {
  const [linkCopied, setLinkCopied] = useState(false);
  const registerUrl =
    typeof window !== "undefined" && session
      ? `${window.location.origin}/register/${session.uuid}`
      : "";

  const handleCopyLink = async () => {
    if (!registerUrl) return;
    try {
      await navigator.clipboard.writeText(registerUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      // clipboard access can be denied by the browser; button just stays as-is
    }
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3 text-sm uppercase tracking-[0.18em] text-cyan-100">
          <Sparkles size={18} />
          Bewerbungsflug
        </div>

        <h1 className="mt-3 max-w-3xl text-balance text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
          {session?.name ?? "Session wird geladen"}
        </h1>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <span className="rounded border border-cyan-200/30 bg-cyan-200/10 px-3 py-1 text-cyan-50">
            Typ: {getSessionTypeLabel(session?.type ?? DEFAULT_SESSION_TYPE)}
          </span>
          <span className="rounded border border-emerald-200/30 bg-emerald-200/10 px-3 py-1 text-emerald-50">
            Status: {session?.status ?? "..."}
          </span>
        </div>
      </div>

      {registerUrl && (
        <div className="mx-auto flex shrink-0 flex-col items-center gap-2 rounded-2xl border border-cyan-200/20 bg-white p-3 shadow-[0_0_24px_-4px_rgba(103,232,249,0.35)] sm:mx-0">
          <QRCode
            value={registerUrl}
            size={104}
            quietZone={8}
            qrStyle="dots"
            eyeRadius={8}
            fgColor="#0f172a"
            bgColor="#ffffff"
            ecLevel="M"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100"
          >
            {linkCopied ? (
              <Check size={13} className="text-emerald-600" />
            ) : (
              <Copy size={13} />
            )}
            {linkCopied ? "Kopiert" : "Link kopieren"}
          </button>
        </div>
      )}
    </div>
  );
}

function StageShell({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <div className="min-w-0">
      <StageTitle session={session} />
      <div className="relative mt-12 h-[44vh] min-h-[320px] overflow-hidden rounded border border-white/15 bg-black/20 backdrop-blur-sm">
        {children}
      </div>
    </div>
  );
}

function ParticipantSummary({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-white/65">Bewerbungen</p>
        <p className="mt-1 text-4xl font-black">{count}</p>
      </div>
      <div className="flex h-14 w-14 items-center justify-center rounded border border-white/20 bg-black/20">
        <Users size={26} className="text-cyan-100" />
      </div>
    </div>
  );
}

function ParticipantList({
  participants,
  disabled,
  renderControls,
  onDeleteParticipant,
}: {
  participants: Participant[];
  disabled: boolean;
  renderControls?: (participant: Participant) => React.ReactNode;
  onDeleteParticipant: (participantUuid: string) => Promise<void>;
}) {
  return (
    <div className="mt-6 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
      {participants.map((participant) => (
        <div
          key={participant.uuid}
          className="flex items-center gap-3 rounded border border-white/10 bg-black/20 px-3 py-3"
        >
          {renderControls?.(participant)}
          <div className="min-w-0 flex-1">
            <span className="min-w-0 break-words font-medium leading-snug">
              {participant.name}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onDeleteParticipant(participant.uuid)}
            disabled={disabled}
            title="Teilnehmer löschen"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-red-300/20 bg-red-500/15 text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}

      {participants.length === 0 && (
        <p className="rounded border border-dashed border-white/20 p-4 text-sm text-white/65">
          Sobald jemand den QR-Code nutzt, landet der Name hier.
        </p>
      )}
    </div>
  );
}

function ScrambleParticipants({
  participants,
  newParticipantIds,
  isDrawing,
  isLoading,
  layout = "centered",
}: {
  participants: Participant[];
  newParticipantIds: Set<string>;
  isDrawing: boolean;
  isLoading: boolean;
  layout?: "centered" | "scroll";
}) {
  return (
    <div
      className={
        layout === "scroll"
          ? "absolute inset-0 overflow-y-auto px-5 py-6"
          : "absolute inset-x-0 top-1/2 mx-auto flex w-full max-w-4xl -translate-y-1/2 flex-wrap justify-center gap-3 px-5"
      }
    >
      <div
        className={
          layout === "scroll"
            ? "mx-auto flex max-w-5xl flex-wrap justify-center gap-3"
            : "contents"
        }
      >
      {participants.map((participant, index) => {
        const isNew = newParticipantIds.has(participant.uuid);

        return (
          <div
            key={participant.uuid}
            className={`participant-rocket flex max-w-[220px] items-center gap-2 rounded border border-white/20 bg-white/12 px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur ${
              isNew ? "participant-rocket--new" : ""
            } ${isDrawing ? "participant-rocket--scramble" : ""}`}
            style={getRocketStyle(index, isDrawing)}
          >
            <Rocket
              size={20}
              className={isNew ? "text-amber-200" : "text-cyan-200"}
            />
            <span className="truncate">{participant.name}</span>
          </div>
        );
      })}
      </div>

      {participants.length === 0 && !isLoading && (
        <div className="rounded border border-dashed border-white/25 bg-black/20 px-5 py-4 text-center text-white/70">
          Noch wartet die Startrampe auf Bewerbungen.
        </div>
      )}
    </div>
  );
}

function SingleDrawMode({
  session,
  sessionUuid,
  participants,
  newParticipantIds,
  isLoading,
  errorMessage,
  onDeleteParticipant,
  onResetParticipants,
}: StageModeProps) {
  const [winner, setWinner] = useState<Participant | null>(null);
  const [pendingWinner, setPendingWinner] = useState<Participant | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [roundDifficulty, setRoundDifficulty] = useState<number>(2);
  const [roundCommitted, setRoundCommitted] = useState(false);
  // Fairness-Gedächtnis überlebt einen Refresh (localStorage).
  const [fairnessMemory, setFairnessMemory] = useState<FairnessMemory>(() =>
    loadJSON<FairnessMemory>(fairnessKey(sessionUuid), {}),
  );
  const [manualBonus, setManualBonus] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveJSON(fairnessKey(sessionUuid), fairnessMemory);
  }, [sessionUuid, fairnessMemory]);

  function dismissWinner() {
    setWinner(null);
  }

  // Effektives Auslosungsgewicht: Fairness-Guthaben + manueller Override.
  function weightOf(participant: Participant): number {
    const record = getRecord(fairnessMemory, participant.name);
    const base = drawWeight(record, DEFAULT_ALPHA);
    const bonus = manualBonus[participant.uuid] ?? 0;

    return Math.max(0, base + bonus);
  }

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
    if (
      !pendingWinner ||
      visibleParticipants.some(
        (participant) => participant.uuid === pendingWinner.uuid,
      )
    ) {
      return visibleParticipants;
    }

    return [...visibleParticipants, pendingWinner];
  }, [pendingWinner, visibleParticipants]);

  const totalWeight = useMemo(
    () =>
      participants.reduce((sum, participant) => sum + weightOf(participant), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [participants, fairnessMemory, manualBonus],
  );
  const knownCount = Object.keys(fairnessMemory).length;
  const canDraw = totalWeight > 0 && !isDrawing;

  function updateManualBonus(participantUuid: string, change: number) {
    setManualBonus((currentBonus) => ({
      ...currentBonus,
      [participantUuid]: (currentBonus[participantUuid] ?? 0) + change,
    }));
  }

  async function handleDeleteParticipant(participantUuid: string) {
    await onDeleteParticipant(participantUuid);

    setManualBonus((currentBonus) => {
      const nextBonus = { ...currentBonus };
      delete nextBonus[participantUuid];
      return nextBonus;
    });

    if (winner?.uuid === participantUuid) {
      setWinner(null);
    }

    if (pendingWinner?.uuid === participantUuid) {
      setPendingWinner(null);
    }
  }

  function drawWinner() {
    if (isDrawing) {
      return;
    }

    const entries = participants.map((participant) => ({
      item: participant,
      weight: weightOf(participant),
    }));
    const selectedWinner = pickWeighted(entries);

    if (!selectedWinner) {
      return;
    }

    setWinner(null);
    setPendingWinner(selectedWinner);
    setRoundCommitted(false);
    setIsDrawing(true);

    window.setTimeout(() => {
      setWinner(selectedWinner);
      setPendingWinner(null);
      setIsDrawing(false);
    }, 2300);
  }

  // Runde ins Fairness-Gedächtnis übernehmen (Gewinner => Guthaben halbiert,
  // übrige Melder sammeln Guthaben je nach Schwierigkeit).
  function scoreRound() {
    if (!winner || roundCommitted) {
      return;
    }

    const volunteerNames = participants.map((participant) => participant.name);

    setFairnessMemory((currentMemory) =>
      applyRoundResult(currentMemory, {
        winnerName: winner.name,
        volunteerNames,
        difficulty: roundDifficulty,
      }),
    );
    setManualBonus({});
    setRoundCommitted(true);
  }

  async function importFairnessWorkbook(file: File) {
    try {
      setFairnessMemory(await parseFairnessWorkbook(file));
    } catch {
      // Ungültige Datei wird ignoriert.
    }
  }

  // Excel-Export = "Runde abschließen": Datei speichern, danach den lokalen
  // Arbeitsstand (Bewerber + Fairness) leeren, damit ein Refresh nichts mehr
  // versehentlich verliert und die nächste Sitzung sauber startet.
  async function exportFairnessWorkbookAndReset() {
    await exportFairnessWorkbook(
      fairnessMemory,
      `fairness-${session?.name ?? "session"}.xlsx`,
    );

    setFairnessMemory({});
    setManualBonus({});
    setWinner(null);
    setRoundCommitted(false);
    removeKey(fairnessKey(sessionUuid));
    await onResetParticipants();
  }

  const formatWeight = (weight: number) =>
    (Math.round(weight * 10) / 10).toString();

  return (
    <>
      <StageShell session={session}>
        <ScrambleParticipants
          participants={stageParticipants}
          newParticipantIds={newParticipantIds}
          isDrawing={isDrawing}
          isLoading={isLoading}
        />

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
      </StageShell>

      <aside className="rounded border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur">
        <ParticipantSummary count={participants.length} />

        <div className="mt-6">
          <p className="flex items-center gap-2 text-sm font-medium text-white/75">
            <Gauge size={16} className="text-cyan-100" />
            Schwierigkeit dieser Runde
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {DIFFICULTY_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => setRoundDifficulty(level.value)}
                className={`rounded border px-2 py-2 text-sm font-semibold capitalize transition ${
                  roundDifficulty === level.value
                    ? "border-cyan-200/70 bg-cyan-200/20 text-cyan-50"
                    : "border-white/15 bg-black/20 text-white/70 hover:bg-white/10"
                }`}
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={drawWinner}
          disabled={!canDraw}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-amber-300 px-4 py-3 font-bold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Crown size={20} />
          {winner ? "Nochmal auslosen" : isDrawing ? "Auslosung..." : "Auslosen"}
        </button>

        {winner && !isDrawing && (
          <button
            type="button"
            onClick={scoreRound}
            disabled={roundCommitted}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded border border-emerald-200/40 bg-emerald-200/15 px-4 py-2 text-sm font-bold text-emerald-50 transition hover:bg-emerald-200/25 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Check size={17} />
            {roundCommitted
              ? "Runde gewertet"
              : `„${winner.name}" als vorgetragen werten`}
          </button>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded border border-white/15 bg-black/20 px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
          >
            <Upload size={16} /> Excel laden
          </button>
          <button
            type="button"
            onClick={exportFairnessWorkbookAndReset}
            disabled={knownCount === 0}
            title="Excel speichern und den lokalen Stand zurücksetzen"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded border border-white/15 bg-black/20 px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={16} /> Excel export
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void importFairnessWorkbook(file);
              }
              event.target.value = "";
            }}
          />
        </div>
        {knownCount > 0 && (
          <p className="mt-2 text-xs text-white/50">
            {knownCount} Personen im Fairness-Gedächtnis
          </p>
        )}

        <ParticipantList
          participants={participants}
          disabled={isDrawing}
          onDeleteParticipant={handleDeleteParticipant}
          renderControls={(participant) => {
            const record = getRecord(fairnessMemory, participant.name);
            const weight = weightOf(participant);

            return (
              <>
                <button
                  type="button"
                  onClick={() => updateManualBonus(participant.uuid, -1)}
                  disabled={weight <= 1}
                  title="Gewichtung verringern"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/15 bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Minus size={16} />
                </button>
                <span
                  className="shrink-0 rounded bg-amber-200/15 px-2 py-1 text-center text-xs font-bold text-amber-100"
                  title={`Guthaben ${record.credit}, ${record.attempts}× erfolglos gemeldet`}
                >
                  ×{formatWeight(weight)}
                </span>
                <button
                  type="button"
                  onClick={() => updateManualBonus(participant.uuid, 1)}
                  title="Gewichtung erhöhen"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                >
                  <Plus size={16} />
                </button>
              </>
            );
          }}
        />

        {errorMessage && (
          <p className="mt-4 rounded border border-red-300/30 bg-red-500/20 p-3 text-sm text-red-50">
            {errorMessage}
          </p>
        )}
      </aside>
    </>
  );
}

function TeamDrawMode({
  session,
  participants,
  newParticipantIds,
  isLoading,
  errorMessage,
  onDeleteParticipant,
}: StageModeProps) {
  const savedTeamSize = clampTeamSize(
    session?.settings.teamSize ?? DEFAULT_TEAM_SIZE,
  );
  const [teamSizeInput, setTeamSizeInput] = useState(String(savedTeamSize));
  const [teams, setTeams] = useState<Team[]>([]);
  const [fixedIds, setFixedIds] = useState<Set<string>>(() => new Set());
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [openSections, setOpenSections] = useState({
    teamSize: true,
    pool: true,
    topics: false,
    participants: false,
  });
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [animatedTopicIds, setAnimatedTopicIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isDrawing, setIsDrawing] = useState(false);
  const [isTeamsFullscreen, setIsTeamsFullscreen] = useState(false);
  const topicAnimationTimeoutRef = useRef<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const inputTeamSize = Number(teamSizeInput);
  const teamSize =
    teamSizeInput && Number.isFinite(inputTeamSize)
      ? clampTeamSize(inputTeamSize)
      : savedTeamSize;

  const liveIds = useMemo(
    () => new Set(participants.map((participant) => participant.uuid)),
    [participants],
  );
  // Anzeige-Teams: Mitglieder, die die Session verlassen haben, ausblenden.
  // Endgültig aus dem State entfernt werden sie beim nächsten Auslosen.
  const displayTeams = useMemo(
    () =>
      teams.map((team) => ({
        ...team,
        members: team.members.filter((member) => liveIds.has(member.uuid)),
      })),
    [teams, liveIds],
  );

  const assignedIds = useMemo(
    () =>
      new Set(
        displayTeams.flatMap((team) =>
          team.members.map((member) => member.uuid),
        ),
      ),
    [displayTeams],
  );
  const poolParticipants = useMemo(
    () =>
      participants.filter((participant) => !assignedIds.has(participant.uuid)),
    [participants, assignedIds],
  );
  const assignedTopicIds = useMemo(
    () =>
      new Set(
        displayTeams
          .map((team) => team.topic?.id)
          .filter((topicId): topicId is string => Boolean(topicId)),
      ),
    [displayTeams],
  );
  const unassignedTopics = useMemo(
    () => topics.filter((topic) => !assignedTopicIds.has(topic.id)),
    [assignedTopicIds, topics],
  );
  const freeTeamCount = displayTeams.filter((team) => !team.topic).length;

  useEffect(() => {
    return () => {
      if (topicAnimationTimeoutRef.current) {
        window.clearTimeout(topicAnimationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTeamsFullscreen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsTeamsFullscreen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTeamsFullscreen]);

  function toggleSection(section: keyof typeof openSections) {
    setOpenSections((currentSections) => ({
      ...currentSections,
      [section]: !currentSections[section],
    }));
  }

  function drawTeams() {
    if (participants.length === 0 || isDrawing) {
      return;
    }

    const size = clampTeamSize(teamSize);

    setTeamSizeInput(String(size));
    setIsDrawing(true);

    window.setTimeout(() => {
      setTeams((previousTeams) =>
        distributeTeams(previousTeams, participants, fixedIds, size),
      );
      setIsDrawing(false);
    }, 2300);
  }

  function normalizeTeamSizeInput() {
    setTeamSizeInput((currentValue) => {
      if (!currentValue) {
        return String(savedTeamSize);
      }

      return String(clampTeamSize(currentValue));
    });
  }

  function updateTeamSizeInput(value: string) {
    setTeamSizeInput(value);
  }

  function addEmptyTeam() {
    setTeams((previousTeams) => [
      ...previousTeams,
      {
        id: createLocalId(`team-${previousTeams.length + 1}`),
        members: [],
        locked: false,
      },
    ]);
  }

  function deleteTeam(teamId: string) {
    const team = teams.find((currentTeam) => currentTeam.id === teamId);

    setTeams((previousTeams) =>
      previousTeams.filter((currentTeam) => currentTeam.id !== teamId),
    );

    if (team) {
      setFixedIds((previousFixed) => {
        const nextFixed = new Set(previousFixed);
        team.members.forEach((member) => nextFixed.delete(member.uuid));
        return nextFixed;
      });
    }
  }

  function toggleTeamLock(teamId: string) {
    setTeams((previousTeams) =>
      previousTeams.map((team) =>
        team.id === teamId ? { ...team, locked: !team.locked } : team,
      ),
    );
  }

  function toggleFix(participantUuid: string) {
    setFixedIds((previousFixed) => {
      const nextFixed = new Set(previousFixed);
      if (nextFixed.has(participantUuid)) {
        nextFixed.delete(participantUuid);
      } else {
        nextFixed.add(participantUuid);
      }
      return nextFixed;
    });
  }

  async function handleDeleteParticipant(participantUuid: string) {
    await onDeleteParticipant(participantUuid);
  }

  function addTopic() {
    const title = topicInput.trim();

    if (!title) {
      return;
    }

    setTopics((currentTopics) => [
      ...currentTopics,
      {
        id: createLocalId("topic"),
        title,
      },
    ]);
    setTopicInput("");
  }

  function deleteTopic(topicId: string) {
    setTopics((currentTopics) =>
      currentTopics.filter((topic) => topic.id !== topicId),
    );
    setTeams((previousTeams) =>
      previousTeams.map((team) =>
        team.topic?.id === topicId ? { ...team, topic: undefined } : team,
      ),
    );
  }

  function assignTopicToTeam(topicId: string, teamId: string) {
    const topic = topics.find((currentTopic) => currentTopic.id === topicId);

    if (!topic) {
      return;
    }

    setTeams((previousTeams) =>
      previousTeams.map((team) => {
        if (team.id === teamId) {
          return { ...team, topic };
        }

        if (team.topic?.id === topicId) {
          return { ...team, topic: undefined };
        }

        return team;
      }),
    );
  }

  function unassignTopic(topicId: string) {
    setTeams((previousTeams) =>
      previousTeams.map((team) =>
        team.topic?.id === topicId ? { ...team, topic: undefined } : team,
      ),
    );
  }

  function moveParticipantToTeam(participantUuid: string, teamId: string) {
    const participant = participants.find(
      (currentParticipant) => currentParticipant.uuid === participantUuid,
    );

    if (!participant) {
      return;
    }

    setTeams((previousTeams) => {
      const targetTeam = previousTeams.find((team) => team.id === teamId);

      if (!targetTeam || targetTeam.locked) {
        return previousTeams;
      }

      const sourceTeam = previousTeams.find((team) =>
        team.members.some((member) => member.uuid === participantUuid),
      );

      if (sourceTeam?.locked || sourceTeam?.id === teamId) {
        return previousTeams;
      }

      return previousTeams.map((team) => {
        if (team.id === teamId) {
          return { ...team, members: [...team.members, participant] };
        }

        if (team.members.some((member) => member.uuid === participantUuid)) {
          return {
            ...team,
            members: team.members.filter(
              (member) => member.uuid !== participantUuid,
            ),
          };
        }

        return team;
      });
    });
  }

  function returnParticipantToPool(participantUuid: string) {
    setTeams((previousTeams) =>
      previousTeams.map((team) =>
        team.locked
          ? team
          : {
              ...team,
              members: team.members.filter(
                (member) => member.uuid !== participantUuid,
              ),
            },
      ),
    );
    setFixedIds((previousFixed) => {
      if (!previousFixed.has(participantUuid)) {
        return previousFixed;
      }
      const nextFixed = new Set(previousFixed);
      nextFixed.delete(participantUuid);
      return nextFixed;
    });
  }

  function markAnimatedTopics(topicIds: string[]) {
    if (topicAnimationTimeoutRef.current) {
      window.clearTimeout(topicAnimationTimeoutRef.current);
    }

    setAnimatedTopicIds(new Set(topicIds));
    topicAnimationTimeoutRef.current = window.setTimeout(() => {
      setAnimatedTopicIds(new Set());
      topicAnimationTimeoutRef.current = null;
    }, 1500);
  }

  function randomAssignTopics() {
    if (
      teams.length === 0 ||
      unassignedTopics.length === 0 ||
      freeTeamCount === 0
    ) {
      return;
    }

    const shuffledTopics = shuffleItems(unassignedTopics);
    const shuffledFreeTeams = shuffleItems(teams.filter((team) => !team.topic));
    const assignments = shuffledFreeTeams
      .slice(0, shuffledTopics.length)
      .map((team, index) => ({
        teamId: team.id,
        topic: shuffledTopics[index],
      }))
      .filter((assignment) => Boolean(assignment.topic));

    if (assignments.length === 0) {
      return;
    }

    const assignmentByTeamId = new Map(
      assignments.map((assignment) => [assignment.teamId, assignment.topic]),
    );

    setTeams((previousTeams) =>
      previousTeams.map((team) => {
        const topic = assignmentByTeamId.get(team.id);
        return topic ? { ...team, topic } : team;
      }),
    );
    markAnimatedTopics(assignments.map((assignment) => assignment.topic.id));
  }

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);

    if (activeId.startsWith("topic:")) {
      const topicId = activeId.replace("topic:", "");
      const topic = topics.find((currentTopic) => currentTopic.id === topicId);

      if (topic) {
        setActiveDrag({
          id: topic.id,
          label: topic.title,
          kind: "topic",
        });
      }
    }

    if (activeId.startsWith("participant:")) {
      const participantUuid = activeId.replace("participant:", "");
      const participant = participants.find(
        (currentParticipant) => currentParticipant.uuid === participantUuid,
      );

      if (participant) {
        setActiveDrag({
          id: participant.uuid,
          label: participant.name,
          kind: "participant",
        });
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : "";

    setActiveDrag(null);

    if (!overId) {
      return;
    }

    if (activeId.startsWith("topic:")) {
      const topicId = activeId.replace("topic:", "");

      if (overId === "topic-pool") {
        unassignTopic(topicId);
        return;
      }

      if (overId.startsWith("team:")) {
        assignTopicToTeam(topicId, overId.replace("team:", ""));
      }

      return;
    }

    if (activeId.startsWith("participant:")) {
      const participantUuid = activeId.replace("participant:", "");

      if (overId === "member-pool") {
        returnParticipantToPool(participantUuid);
        return;
      }

      if (overId.startsWith("team:")) {
        moveParticipantToTeam(participantUuid, overId.replace("team:", ""));
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <StageShell session={session}>
        {teams.length > 0 && !isDrawing ? (
          <div className="absolute inset-0 overflow-y-auto px-5 py-6">
            <button
              type="button"
              onClick={() => setIsTeamsFullscreen(true)}
              title="Teams im Vollbild anzeigen"
              className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded border border-white/20 bg-black/55 text-white shadow-xl backdrop-blur transition hover:bg-black/75"
            >
              <Maximize2 size={18} />
            </button>
            <TeamGrid
              teams={displayTeams}
              interactive
              fixedIds={fixedIds}
              animatedTopicIds={animatedTopicIds}
              onToggleLock={toggleTeamLock}
              onToggleFix={toggleFix}
              onDeleteTeam={deleteTeam}
            />
          </div>
        ) : (
          <ScrambleParticipants
            participants={participants}
            newParticipantIds={newParticipantIds}
            isDrawing={isDrawing}
            isLoading={isLoading}
            layout="scroll"
          />
        )}

        {isDrawing && (
          <div className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100">
            Teams werden ausgelost
          </div>
        )}
      </StageShell>

      {isTeamsFullscreen && teams.length > 0 && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050716]/95 px-5 py-6 text-white backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <div className="sticky top-0 z-20 -mx-5 mb-5 flex items-center justify-between gap-4 border-b border-white/10 bg-[#050716]/90 px-5 py-4 backdrop-blur">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-cyan-100">
                  Team-Auslosung
                </p>
                <h2 className="mt-1 text-3xl font-black">
                  Alle Teams
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsTeamsFullscreen(false)}
                title="Vollbild schließen"
                className="flex h-10 w-10 items-center justify-center rounded border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
              >
                <X size={20} />
              </button>
            </div>

            <TeamGrid teams={displayTeams} variant="fullscreen" fixedIds={fixedIds} />
          </div>
        </div>
      )}

      <aside className="max-h-[calc(100vh-9rem)] overflow-y-auto rounded border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur">
        <ParticipantSummary count={participants.length} />

        <div className="mt-6 space-y-3">
          <AccordionSection
            title="Teamgröße"
            isOpen={openSections.teamSize}
            onToggle={() => toggleSection("teamSize")}
          >
            <label className="block text-sm font-medium text-white/75">
              Personen pro Team
              <input
                className="mt-2 w-full rounded border border-white/15 bg-black/20 px-3 py-2 text-white outline-none transition focus:border-cyan-200"
                type="number"
                min={MIN_TEAM_SIZE}
                max={MAX_TEAM_SIZE}
                value={teamSizeInput}
                onBlur={normalizeTeamSizeInput}
                onChange={(event) => updateTeamSizeInput(event.target.value)}
              />
            </label>

            <button
              type="button"
              onClick={drawTeams}
              disabled={participants.length === 0 || isDrawing}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-cyan-200 px-4 py-3 font-bold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Users size={20} />
              {teams.length > 0
                ? "Freien Rest neu auslosen"
                : isDrawing
                  ? "Auslosung..."
                  : "Teams auslosen"}
            </button>

            <button
              type="button"
              onClick={addEmptyTeam}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded border border-white/15 bg-black/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              <UserPlus size={17} />
              Leeres Team hinzufügen
            </button>

            <p className="mt-3 text-xs leading-relaxed text-white/50">
              Personen in ein Team ziehen und per Pin fixieren – beim Auslosen
              bleiben Fixierte an ihrem Platz, nur der freie Rest wird verteilt.
              Ganze Teams lassen sich sperren.
            </p>
          </AccordionSection>

          <AccordionSection
            title="Nicht zugeteilt"
            badge={String(poolParticipants.length)}
            isOpen={openSections.pool}
            onToggle={() => toggleSection("pool")}
          >
            <MemberPool participants={poolParticipants} disabled={isDrawing} />
          </AccordionSection>

          <AccordionSection
            title="Themen"
            badge={String(unassignedTopics.length)}
            isOpen={openSections.topics}
            onToggle={() => toggleSection("topics")}
          >
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded border border-white/15 bg-black/20 px-3 py-2 text-white outline-none transition placeholder:text-white/35 focus:border-cyan-200"
                type="text"
                value={topicInput}
                placeholder="Thema hinzufügen"
                onChange={(event) => setTopicInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTopic();
                  }
                }}
              />
              <button
                type="button"
                onClick={addTopic}
                title="Thema hinzufügen"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-cyan-200 text-slate-950 transition hover:bg-cyan-100"
              >
                <Plus size={18} />
              </button>
            </div>

            <button
              type="button"
              onClick={randomAssignTopics}
              disabled={
                teams.length === 0 ||
                unassignedTopics.length === 0 ||
                freeTeamCount === 0 ||
                isDrawing
              }
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded border border-amber-200/40 bg-amber-200/15 px-3 py-2 text-sm font-bold text-amber-50 transition hover:bg-amber-200/25 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Sparkles size={17} />
              Offene Themen zufällig verteilen
            </button>

            <TopicPool
              topics={unassignedTopics}
              disabled={teams.length === 0 || isDrawing}
              onDeleteTopic={deleteTopic}
            />
          </AccordionSection>

          <AccordionSection
            title="Bewerber"
            badge={String(participants.length)}
            isOpen={openSections.participants}
            onToggle={() => toggleSection("participants")}
          >
            <ParticipantList
              participants={participants}
              disabled={isDrawing}
              onDeleteParticipant={handleDeleteParticipant}
            />
          </AccordionSection>
        </div>

        {errorMessage && (
          <p className="mt-4 rounded border border-red-300/30 bg-red-500/20 p-3 text-sm text-red-50">
            {errorMessage}
          </p>
        )}
      </aside>

      <DragOverlay>
        {activeDrag && (
          <div className="flex max-w-[280px] items-center gap-2 rounded border border-white/25 bg-[#10142f]/95 px-3 py-2 text-sm font-bold text-white shadow-2xl">
            <GripVertical size={16} className="text-white/55" />
            {activeDrag.kind === "topic" ? (
              <BookOpen size={16} className="text-amber-100" />
            ) : (
              <Users size={16} className="text-cyan-100" />
            )}
            <span className="min-w-0 break-words">{activeDrag.label}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function TeamGrid({
  teams,
  variant = "stage",
  interactive = false,
  animatedTopicIds = new Set(),
  fixedIds = new Set(),
  onToggleLock,
  onToggleFix,
  onDeleteTeam,
}: {
  teams: Team[];
  variant?: "stage" | "fullscreen";
  interactive?: boolean;
  animatedTopicIds?: Set<string>;
  fixedIds?: Set<string>;
  onToggleLock?: (teamId: string) => void;
  onToggleFix?: (participantUuid: string) => void;
  onDeleteTeam?: (teamId: string) => void;
}) {
  const isFullscreen = variant === "fullscreen";

  return (
    <div
      className={`mx-auto grid gap-3 ${
        isFullscreen
          ? "max-w-7xl sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          : "max-w-5xl sm:grid-cols-2 xl:grid-cols-3"
      }`}
    >
      {teams.map((team, index) => (
        <TeamCard
          key={team.id}
          team={team}
          index={index}
          isFullscreen={isFullscreen}
          interactive={interactive}
          isTopicAnimated={Boolean(
            team.topic && animatedTopicIds.has(team.topic.id),
          )}
          fixedIds={fixedIds}
          onToggleLock={onToggleLock}
          onToggleFix={onToggleFix}
          onDeleteTeam={onDeleteTeam}
        />
      ))}
    </div>
  );
}

function TeamCard({
  team,
  index,
  isFullscreen,
  interactive,
  isTopicAnimated,
  fixedIds,
  onToggleLock,
  onToggleFix,
  onDeleteTeam,
}: {
  team: Team;
  index: number;
  isFullscreen: boolean;
  interactive: boolean;
  isTopicAnimated: boolean;
  fixedIds: Set<string>;
  onToggleLock?: (teamId: string) => void;
  onToggleFix?: (participantUuid: string) => void;
  onDeleteTeam?: (teamId: string) => void;
}) {
  const TeamIcon = teamIcons[index % teamIcons.length];
  const { isOver, setNodeRef } = useDroppable({
    id: `team:${team.id}`,
    disabled: !interactive || team.locked,
  });

  return (
    <div
      ref={setNodeRef}
      className={`team-card-reveal rounded border shadow-2xl backdrop-blur transition ${
        team.locked
          ? "border-amber-200/50 bg-amber-200/5"
          : isOver
            ? "border-cyan-200/80 bg-cyan-200/15"
            : "border-cyan-200/25 bg-cyan-100/10"
      } ${isFullscreen ? "p-5" : "p-4"}`}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className={`flex items-center gap-2 font-bold uppercase tracking-[0.16em] text-cyan-100 ${
            isFullscreen ? "text-base" : "text-sm"
          }`}
        >
          <TeamIcon size={isFullscreen ? 21 : 17} />
          Team {index + 1}
          {team.locked && (
            <Lock size={13} className="text-amber-200" />
          )}
        </div>

        {interactive && (
          <div className="flex items-center gap-1">
            {onToggleLock && (
              <button
                type="button"
                onClick={() => onToggleLock(team.id)}
                title={team.locked ? "Team entsperren" : "Team sperren"}
                className={`flex h-7 w-7 items-center justify-center rounded border transition ${
                  team.locked
                    ? "border-amber-200/50 bg-amber-200/20 text-amber-100"
                    : "border-white/15 bg-white/5 text-white/60 hover:bg-white/15"
                }`}
              >
                {team.locked ? <Lock size={14} /> : <LockOpen size={14} />}
              </button>
            )}
            {onDeleteTeam && !team.locked && (
              <button
                type="button"
                onClick={() => onDeleteTeam(team.id)}
                title="Team auflösen"
                className="flex h-7 w-7 items-center justify-center rounded border border-red-300/20 bg-red-500/15 text-red-100 transition hover:bg-red-500/25"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 min-h-12 rounded border border-amber-200/25 bg-amber-200/10 p-2">
        {team.topic ? (
          <DraggableTopic
            topic={team.topic}
            disabled={!interactive}
            assigned
            isAnimated={isTopicAnimated}
          />
        ) : (
          <div className="flex min-h-9 items-center gap-2 rounded border border-dashed border-white/15 px-3 py-2 text-sm text-white/50">
            <BookOpen size={15} />
            Thema hier ablegen
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {team.members.map((participant) => (
          <DraggableParticipant
            key={participant.uuid}
            participant={participant}
            disabled={!interactive || team.locked}
            isFullscreen={isFullscreen}
            fixed={fixedIds.has(participant.uuid)}
            onToggleFix={
              interactive && !team.locked ? onToggleFix : undefined
            }
          />
        ))}

        {team.members.length === 0 && (
          <div className="rounded border border-dashed border-white/15 px-3 py-3 text-sm text-white/50">
            Keine Mitglieder
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableTopic({
  topic,
  disabled,
  assigned = false,
  isAnimated = false,
  onDeleteTopic,
}: {
  topic: Topic;
  disabled: boolean;
  assigned?: boolean;
  isAnimated?: boolean;
  onDeleteTopic?: (topicId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `topic:${topic.id}`,
      disabled,
    });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 rounded border border-amber-200/25 bg-black/20 px-3 py-2 text-sm font-semibold text-amber-50 shadow-lg transition ${
        isDragging ? "opacity-35" : ""
      } ${isAnimated ? "topic-flight" : ""}`}
    >
      <button
        type="button"
        disabled={disabled}
        title={assigned ? "Thema verschieben" : "Thema ziehen"}
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-amber-100/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={15} />
      </button>
      <BookOpen size={16} className="mt-1 shrink-0 text-amber-100" />
      <span className="min-w-0 flex-1 break-words leading-snug">{topic.title}</span>
      {onDeleteTopic && (
        <button
          type="button"
          onClick={() => onDeleteTopic(topic.id)}
          title="Thema löschen"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-red-300/20 bg-red-500/15 text-red-100 transition hover:bg-red-500/25"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function DraggableParticipant({
  participant,
  disabled,
  isFullscreen,
  fixed = false,
  onToggleFix,
}: {
  participant: Participant;
  disabled: boolean;
  isFullscreen: boolean;
  fixed?: boolean;
  onToggleFix?: (participantUuid: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `participant:${participant.uuid}`,
      disabled,
    });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded px-3 font-semibold transition ${
        fixed ? "bg-amber-300/15 ring-1 ring-amber-200/40" : "bg-black/20"
      } ${isFullscreen ? "py-3 text-lg" : "py-2"} ${
        isDragging ? "opacity-35" : ""
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        title="Teilnehmer verschieben"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-cyan-100/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={15} />
      </button>
      <span className="min-w-0 flex-1 break-words">{participant.name}</span>
      {onToggleFix && (
        <button
          type="button"
          onClick={() => onToggleFix(participant.uuid)}
          title={fixed ? "Fixierung aufheben" : "In diesem Team fixieren"}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border transition ${
            fixed
              ? "border-amber-200/50 bg-amber-200/20 text-amber-100"
              : "border-white/15 bg-white/5 text-white/60 hover:bg-white/15"
          }`}
        >
          {fixed ? <Pin size={14} /> : <PinOff size={14} />}
        </button>
      )}
    </div>
  );
}

function MemberPool({
  participants,
  disabled,
}: {
  participants: Participant[];
  disabled: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: "member-pool",
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-wrap gap-2 rounded border p-2 transition ${
        isOver
          ? "border-cyan-200/70 bg-cyan-200/15"
          : "border-white/10 bg-black/15"
      }`}
    >
      {participants.map((participant) => (
        <DraggableParticipant
          key={participant.uuid}
          participant={participant}
          disabled={disabled}
          isFullscreen={false}
        />
      ))}

      {participants.length === 0 && (
        <p className="w-full rounded border border-dashed border-white/15 p-3 text-center text-sm text-white/55">
          Alle Personen sind einem Team zugeteilt.
        </p>
      )}
    </div>
  );
}

function TopicPool({
  topics,
  disabled,
  onDeleteTopic,
}: {
  topics: Topic[];
  disabled: boolean;
  onDeleteTopic: (topicId: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: "topic-pool",
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={`mt-3 max-h-64 space-y-2 overflow-y-auto rounded border p-2 transition ${
        isOver
          ? "border-amber-200/75 bg-amber-200/15"
          : "border-white/10 bg-black/15"
      }`}
    >
      {topics.map((topic) => (
        <DraggableTopic
          key={topic.id}
          topic={topic}
          disabled={disabled}
          onDeleteTopic={onDeleteTopic}
        />
      ))}

      {topics.length === 0 && (
        <p className="rounded border border-dashed border-white/15 p-3 text-sm text-white/55">
          Noch keine offenen Themen.
        </p>
      )}
    </div>
  );
}

function AccordionSection({
  title,
  badge,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  badge?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-white/10 bg-black/15">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left font-bold text-white"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{title}</span>
          {badge && (
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/75">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-white/65 transition ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && <div className="border-t border-white/10 p-3">{children}</div>}
    </section>
  );
}

function getRocketStyle(index: number, isDrawing: boolean) {
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

// Team-Verteilungslogik (distributeTeams/shuffleItems/createLocalId) liegt jetzt
// testbar in src/lib/teams.ts.
