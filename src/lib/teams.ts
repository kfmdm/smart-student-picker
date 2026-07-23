import { clampTeamSize } from "./sessionTypes";

// Reine, testbare Team-Verteilungslogik für die Team-Auslosung (Sz2).

export type Participant = {
  uuid: string;
  name: string;
  created_at: string | null;
};

export type Topic = {
  id: string;
  title: string;
};

export type Team = {
  id: string;
  members: Participant[];
  topic?: Topic;
  locked: boolean;
};

export function shuffleItems<T>(items: T[]): T[] {
  const shuffledItems = [...items];

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffledItems[index], shuffledItems[swapIndex]] = [
      shuffledItems[swapIndex],
      shuffledItems[index],
    ];
  }

  return shuffledItems;
}

export function createLocalId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Verteilt die freien Personen auf freie Plätze und lässt gesperrte Teams sowie
// fixierte Mitglieder unangetastet ("Lock & Draw Remainder").
export function distributeTeams(
  previousTeams: Team[],
  participants: Participant[],
  fixedIds: Set<string>,
  teamSize: number,
): Team[] {
  const size = clampTeamSize(teamSize);
  const liveIds = new Set(participants.map((participant) => participant.uuid));

  // Gesperrte Teams bleiben komplett; bei offenen Teams nur Fixierte behalten.
  const keptTeams = previousTeams.map((team) => {
    if (team.locked) {
      return team;
    }
    return {
      ...team,
      members: team.members.filter(
        (member) => fixedIds.has(member.uuid) && liveIds.has(member.uuid),
      ),
    };
  });

  const assigned = new Set(
    keptTeams.flatMap((team) => team.members.map((member) => member.uuid)),
  );
  const freePool = shuffleItems(
    participants.filter((participant) => !assigned.has(participant.uuid)),
  );

  // Offene Teams bis zur Teamgröße auffüllen.
  const filledTeams = keptTeams.map((team) => {
    if (team.locked) {
      return team;
    }
    const need = Math.max(0, size - team.members.length);
    const additions = freePool.splice(0, need);
    return { ...team, members: [...team.members, ...additions] };
  });

  // Restlichen Pool in neue Teams aufteilen.
  const newTeams: Team[] = [];
  for (let index = 0; index < freePool.length; index += size) {
    newTeams.push({
      id: createLocalId(`team-${filledTeams.length + newTeams.length + 1}`),
      members: freePool.slice(index, index + size),
      locked: false,
    });
  }

  // Einzelne übrig gebliebene Person sinnvoll unterbringen.
  if (newTeams.length > 0) {
    const lastTeam = newTeams[newTeams.length - 1];
    if (lastTeam.members.length === 1) {
      if (newTeams.length > 1) {
        newTeams[newTeams.length - 2].members.push(...lastTeam.members);
        newTeams.pop();
      } else {
        const target = [...filledTeams]
          .reverse()
          .find((team) => !team.locked && team.members.length > 0);
        if (target) {
          target.members.push(...lastTeam.members);
          newTeams.pop();
        }
      }
    }
  }

  // Leere, offene Teams ohne Thema entfernen (Aufräumen nach dem Auslosen).
  const cleanedTeams = filledTeams.filter(
    (team) => team.locked || team.members.length > 0 || Boolean(team.topic),
  );

  return [...cleanedTeams, ...newTeams];
}
