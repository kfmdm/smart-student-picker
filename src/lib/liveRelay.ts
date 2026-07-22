import { randomUUID } from "crypto";

// Flüchtiges In-Memory-Relay für Live-Teilnehmer (Prinzip P1: keine DB-Persistenz).
// Namen leben nur hier im Server-RAM und in den verbundenen Prof-Clients.

export type RelayParticipant = {
  uuid: string;
  name: string;
  created_at: string;
};

type Listener = (participants: RelayParticipant[]) => void;

type Channel = {
  participants: Map<string, RelayParticipant>;
  listeners: Set<Listener>;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
};

const MAX_PARTICIPANTS_PER_SESSION = 1000;
const MAX_NAME_LENGTH = 120;
// Kanal ohne Subscriber nach dieser Zeit verwerfen (Reconnect-Fenster).
const EMPTY_CHANNEL_TTL_MS = 10 * 60 * 1000;

// Singleton über globalThis, damit der State HMR/mehrere Modul-Instanzen übersteht
// (gleiches Muster wie src/lib/prisma.ts).
const globalForRelay = globalThis as unknown as {
  liveRelayChannels?: Map<string, Channel>;
};

const channels =
  globalForRelay.liveRelayChannels ?? new Map<string, Channel>();

if (!globalForRelay.liveRelayChannels) {
  globalForRelay.liveRelayChannels = channels;
}

function getOrCreateChannel(sessionUuid: string): Channel {
  let channel = channels.get(sessionUuid);

  if (!channel) {
    channel = {
      participants: new Map(),
      listeners: new Set(),
      cleanupTimer: null,
    };
    channels.set(sessionUuid, channel);
  }

  if (channel.cleanupTimer) {
    clearTimeout(channel.cleanupTimer);
    channel.cleanupTimer = null;
  }

  return channel;
}

function snapshotOf(channel: Channel): RelayParticipant[] {
  return Array.from(channel.participants.values());
}

function broadcast(channel: Channel) {
  const currentSnapshot = snapshotOf(channel);

  for (const listener of channel.listeners) {
    try {
      listener(currentSnapshot);
    } catch {
      // Fehlerhafte Listener dürfen den Broadcast nicht abbrechen.
    }
  }
}

function scheduleCleanup(sessionUuid: string, channel: Channel) {
  if (channel.listeners.size > 0 || channel.cleanupTimer) {
    return;
  }

  channel.cleanupTimer = setTimeout(() => {
    const current = channels.get(sessionUuid);

    if (current && current.listeners.size === 0) {
      channels.delete(sessionUuid);
    }
  }, EMPTY_CHANNEL_TTL_MS);
}

export function snapshot(sessionUuid: string): RelayParticipant[] {
  const channel = channels.get(sessionUuid);
  return channel ? snapshotOf(channel) : [];
}

export function subscribe(sessionUuid: string, listener: Listener): () => void {
  const channel = getOrCreateChannel(sessionUuid);
  channel.listeners.add(listener);

  return () => {
    const current = channels.get(sessionUuid);

    if (!current) {
      return;
    }

    current.listeners.delete(listener);
    scheduleCleanup(sessionUuid, current);
  };
}

export function addParticipant(
  sessionUuid: string,
  name: string,
): RelayParticipant | null {
  const trimmedName = name.trim().slice(0, MAX_NAME_LENGTH);

  if (!trimmedName) {
    return null;
  }

  const channel = getOrCreateChannel(sessionUuid);

  if (channel.participants.size >= MAX_PARTICIPANTS_PER_SESSION) {
    return null;
  }

  const participant: RelayParticipant = {
    uuid: randomUUID(),
    name: trimmedName,
    created_at: new Date().toISOString(),
  };

  channel.participants.set(participant.uuid, participant);
  broadcast(channel);

  return participant;
}

export function removeParticipant(
  sessionUuid: string,
  participantUuid: string,
): boolean {
  const channel = channels.get(sessionUuid);

  if (!channel) {
    return false;
  }

  const existed = channel.participants.delete(participantUuid);

  if (existed) {
    broadcast(channel);
  }

  return existed;
}
