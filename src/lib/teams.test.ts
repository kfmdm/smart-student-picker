import { describe, expect, it } from "vitest";
import { distributeTeams, type Participant, type Team } from "@/lib/teams";

function makeParticipants(count: number): Participant[] {
  return Array.from({ length: count }, (_, index) => ({
    uuid: `p${index + 1}`,
    name: `P${index + 1}`,
    created_at: null,
  }));
}

function allMemberIds(teams: Team[]): string[] {
  return teams.flatMap((team) => team.members.map((member) => member.uuid));
}

describe("distributeTeams – Grundverhalten", () => {
  it("teilt alle Personen genau einmal zu", () => {
    const participants = makeParticipants(7);
    const teams = distributeTeams([], participants, new Set(), 3);
    const ids = allMemberIds(teams).sort();

    expect(ids).toEqual(["p1", "p2", "p3", "p4", "p5", "p6", "p7"]);
    // keine Person doppelt
    expect(new Set(ids).size).toBe(7);
  });

  it("erzeugt keine Einzelperson-Teams (Singleton wird untergebracht)", () => {
    const teams = distributeTeams([], makeParticipants(7), new Set(), 3);
    expect(teams.every((team) => team.members.length >= 2)).toBe(true);
  });

  it("hält sich bei glatter Teilung an die Teamgröße", () => {
    const teams = distributeTeams([], makeParticipants(6), new Set(), 3);
    expect(teams).toHaveLength(2);
    expect(teams.every((team) => team.members.length === 3)).toBe(true);
  });
});

describe("distributeTeams – Lock & Fix", () => {
  it("lässt gesperrte Teams komplett unangetastet", () => {
    const [p1, p2, p3, p4, p5] = makeParticipants(5);
    const locked: Team = {
      id: "L",
      members: [p1, p2],
      locked: true,
    };

    const teams = distributeTeams(
      [locked],
      [p1, p2, p3, p4, p5],
      new Set(),
      2,
    );

    const lockedResult = teams.find((team) => team.id === "L");
    expect(lockedResult?.members.map((m) => m.uuid)).toEqual(["p1", "p2"]);
    // p1/p2 tauchen nirgends sonst auf
    expect(allMemberIds(teams).filter((id) => id === "p1")).toHaveLength(1);
    expect(allMemberIds(teams).sort()).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
    ]);
  });

  it("hält fixierte Mitglieder in ihrem Team und füllt den Rest auf", () => {
    const participants = makeParticipants(6);
    const [p1, p2] = participants;
    const teamA: Team = { id: "A", members: [p1, p2], locked: false };

    const teams = distributeTeams(
      [teamA],
      participants,
      new Set(["p1"]),
      3,
    );

    const a = teams.find((team) => team.id === "A");
    expect(a?.members.some((m) => m.uuid === "p1")).toBe(true);
    expect(a?.members).toHaveLength(3);
    expect(allMemberIds(teams).sort()).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
    ]);
  });

  it("verwirft beim erneuten Auslosen weder Gesperrtes noch Fixiertes", () => {
    const participants = makeParticipants(6);
    const [p1] = participants;
    const first = distributeTeams(
      [{ id: "A", members: [p1], locked: false }],
      participants,
      new Set(["p1"]),
      3,
    );
    // Ein Team sperren und erneut auslosen
    const locked = first.map((team, index) =>
      index === 1 ? { ...team, locked: true } : team,
    );
    const lockedIds = locked[1].members.map((m) => m.uuid);

    const second = distributeTeams(
      locked,
      participants,
      new Set(["p1"]),
      3,
    );

    // p1 bleibt in A
    const a = second.find((team) => team.id === "A");
    expect(a?.members.some((m) => m.uuid === "p1")).toBe(true);
    // gesperrtes Team unverändert
    const lockedAfter = second.find((team) => team.id === locked[1].id);
    expect(lockedAfter?.members.map((m) => m.uuid)).toEqual(lockedIds);
    // weiterhin vollständig
    expect(allMemberIds(second).sort()).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
    ]);
  });
});

describe("distributeTeams – fachliche Kernszenarien", () => {
  it("Halb-Team: 2 fixierte Personen bleiben zusammen und das Team wird auf die Teamgröße aufgefüllt", () => {
    // Genau der Wunschfall: 2 wollen zusammen, Team braucht 6.
    const participants = makeParticipants(10);
    const [p1, p2] = participants;
    const halfTeam: Team = { id: "H", members: [p1, p2], locked: false };

    const teams = distributeTeams(
      [halfTeam],
      participants,
      new Set(["p1", "p2"]),
      6,
    );

    const h = teams.find((team) => team.id === "H");
    expect(h?.members.map((m) => m.uuid)).toContain("p1");
    expect(h?.members.map((m) => m.uuid)).toContain("p2");
    expect(h?.members).toHaveLength(6);
    // alle 10 genau einmal
    expect(allMemberIds(teams).sort()).toEqual(
      makeParticipants(10).map((p) => p.uuid).sort(),
    );
  });

  it("kein Team wird größer als die Teamgröße (außer der Singleton-Zusammenlegung)", () => {
    // 9 Personen, Größe 4 -> [4,4,1] -> Singleton in vorletztes -> [4,5]
    const teams = distributeTeams([], makeParticipants(9), new Set(), 4);
    expect(teams.every((team) => team.members.length <= 5)).toBe(true);
    // ohne Singleton-Fall exakt Größe eingehalten
    const clean = distributeTeams([], makeParticipants(8), new Set(), 4);
    expect(clean.every((team) => team.members.length <= 4)).toBe(true);
  });

  it("respektiert mehrere fixierte Personen in verschiedenen Teams gleichzeitig", () => {
    const participants = makeParticipants(8);
    const [p1, , p3] = participants;
    const teamA: Team = { id: "A", members: [p1], locked: false };
    const teamB: Team = { id: "B", members: [p3], locked: false };

    const teams = distributeTeams(
      [teamA, teamB],
      participants,
      new Set(["p1", "p3"]),
      2,
    );

    expect(teams.find((t) => t.id === "A")?.members.some((m) => m.uuid === "p1")).toBe(true);
    expect(teams.find((t) => t.id === "B")?.members.some((m) => m.uuid === "p3")).toBe(true);
    expect(allMemberIds(teams).sort()).toEqual(
      makeParticipants(8).map((p) => p.uuid).sort(),
    );
  });
});

describe("distributeTeams – Themen & leere Teams", () => {
  it("behält zugewiesene Themen über das Auslosen hinweg", () => {
    const participants = makeParticipants(4);
    const [p1, p2] = participants;
    const teamA: Team = {
      id: "A",
      members: [p1, p2],
      topic: { id: "t1", title: "Thema X" },
      locked: false,
    };

    const teams = distributeTeams([teamA], participants, new Set(), 2);
    const a = teams.find((team) => team.id === "A");
    expect(a?.topic).toEqual({ id: "t1", title: "Thema X" });
  });

  it("entfernt leere, offene Teams ohne Thema, behält sie aber mit Thema", () => {
    const emptyNoTopic = distributeTeams(
      [{ id: "A", members: [], locked: false }],
      [],
      new Set(),
      2,
    );
    expect(emptyNoTopic).toHaveLength(0);

    const emptyWithTopic = distributeTeams(
      [
        {
          id: "A",
          members: [],
          topic: { id: "t1", title: "X" },
          locked: false,
        },
      ],
      [],
      new Set(),
      2,
    );
    expect(emptyWithTopic).toHaveLength(1);
  });
});
