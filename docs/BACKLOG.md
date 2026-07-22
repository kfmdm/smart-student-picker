# Smart Student Picker — Backlog & Anforderungen

> Lebendes Dokument. Prof↔Studi-Aufgaben-/Teamverteilung, Leitprinzip **Datensparsamkeit**.
> Reihenfolge über Meilensteine. Status pro Task: `todo` / `wip` / `done`.

## Vision

Ein digitales, faires, datensparsames Werkzeug, mit dem Lehrende in der Vorlesung
Aufgaben vergeben (Einzelauslosung, Sz1) und Teams + Themen bilden (Team-Auslosung, Sz2) —
optisch als „Bewerbungsflug"-Bühne, beamer-tauglich und mobil.

## Prinzipien (gelten für jede Task)

- **P1 – Datensparsamkeit:** Keine personenbezogenen Daten dauerhaft speichern. Namen landen
  **nie** in der DB (beide Modi). Realtime-Namen leben nur flüchtig im Server-RAM-Relay + im
  Prof-Client. Persistenz übers Semester ausschließlich per **CSV** im Frontend.
- **P2 – Design-First:** Jede sichtbare Änderung ist bewusst gestaltet: stimmiges dunkles
  „Space"-Theme, moderne Typo, sinnvolle Animationen/Übergänge, konsistente UI-Primitives.
  `prefers-reduced-motion` wird respektiert; responsive (Handy + Beamer); Fokus/Tastatur ok.
- **P3 – Einfacher Betrieb:** Ein Node-Prozess (`next start`). MariaDB nur für
  **nicht**-personenbezogene Session-Metadaten (`name/type/settings/status`).
- **P4 – Fairness & Nachvollziehbarkeit (Sz1):** Auslosung ist nicht rein zufällig; die
  Gewichtung ist transparent nachvollziehbar.

## Definition of Done (global)

- `npm run build` und `npm run lint` grün, TypeScript strict.
- Keine neuen personenbezogenen DB-Writes.
- UI erfüllt P2 (Theme, Animation + reduced-motion, responsive, Fokus).
- Kurzer manueller E2E-Check notiert (was getestet, was beobachtet).

---

## Meilensteine

| M | Inhalt | Epics |
|---|---|---|
| **M1** | Lauffähig + Relay-Fundament ohne DB-PII | E0, E1 |
| **M2** | Sz1: faire Einzelauslosung + CSV | E2 |
| **M3** | Sz2: Team Lock & Draw | E3 |
| **M4** | Design-System durchgezogen | E4 |
| **M5** | Zugriffsschutz, Tests/CI, Ideen-Pool | E5, E6, E7 |

---

## E0 — Baseline & Betrieb (P0, M1)

- [ ] **T0.1** `.env` + `.env.example`; `DATABASE_URL` mit URL-encodetem Passwort (`^`→`%5E`, `?`→`%3F`).
- [ ] **T0.2** `npm install` (neu: `@dnd-kit/*`) und `npm run build`/`dev` verifizieren → Baseline läuft.
- [ ] **T0.3** Migration `001_add_team_draw.sql` dokumentieren (wie ausführen); Altlast `test`-Tabelle droppen.
- [ ] **T0.4** Repo-Hygiene: `outputs/`-Poster-Binärdateien aus Git nehmen (`.gitignore` + `git rm --cached`), README projektspezifisch statt create-next-app-Default, `layout.tsx`-Metadata setzen.

## E1 — Realtime-Relay-Fundament ohne DB (P0, M1) ← Start

- [ ] **T1.1** `src/lib/liveRelay.ts`: In-Memory-Singleton via `globalThis` (analog `prisma.ts`). `Map<sessionUuid,{subscribers,buffer}>`, `subscribe/publish/snapshot/removeParticipant/clearSession`, Puffer-Cap + TTL. *AK:* mehrere Prof-Tabs erhalten dieselben Live-Events; nichts wird persistiert.
- [ ] **T1.2** `GET /api/sessions/[uuid]/stream`: SSE (`text/event-stream`, `force-dynamic`), sendet Snapshot + Live-Events, Heartbeat, Cleanup via `request.signal`. *AK:* Verbindung bleibt offen, räumt bei Disconnect auf.
- [ ] **T1.3** `POST /api/register/[uuid]`: published Name ins Relay **statt** `INSERT` (beide Typen). Session-Existenz + `status==="active"` weiter aus DB. *AK:* nach Anmeldung **kein** neuer `participants`-Eintrag (per SQL geprüft).
- [ ] **T1.4** Client-Hook `useLiveParticipants(sessionUuid)` (EventSource, Auto-Reconnect, Snapshot) ersetzt das 2s-Polling in `SessionLiveStage`. *AK:* neue Anmeldung erscheint <1s, ohne Polling.
- [ ] **T1.5** Teilnehmer „entfernen" im Prof-Client = lokal + Relay-Broadcast (kein DB-DELETE). Alte participant-DELETE-Route ausmustern.
- [ ] **T1.6** `participants`-Tabelle + zugehörige Routen als PII ausmustern; GET liefert nur Session-Metadaten. Migration zum Droppen der Tabelle vorbereiten.
- [ ] **T1.7** *(Design)* Verbindungsstatus-Indikator (live / reconnecting) + Einflug-Animation neuer Namen aufpoliert, reduced-motion-Fallback.

## E2 — Sz1 Faire Einzelauslosung + CSV (P1, M2)

- [ ] **T2.1** Client-Fairness-Modell: `name → {presented, credit, attempts}`.
- [ ] **T2.2** `src/lib/fairness.ts` (rein): `drawWeight(1+α·credit)`, `pickWeighted`, `applyRoundResult` (Gewinner→presented, Rest→credit+=β·d).
- [ ] **T2.3** Aufgaben/Schwierigkeit: `session.settings.tasks:[{id,label,difficulty 1–3}]` + Aufgabenwahl in `RegisterForm`.
- [ ] **T2.4** `src/lib/csv.ts` Export/Import (`,` und `;`-tolerant, UTF-8) für `name,presented,credit,attempts`.
- [ ] **T2.5** *(Design)* `SingleDrawMode`: Fairness-Gewicht ersetzt manuellen `x`-Regler (mit Override); CSV-Import/-Export-Buttons; „presented" markieren & aus Pool nehmen.
- [ ] **T2.6** *(Design)* Ziehungs-Animation an Gewichtung koppeln; Gewinner-Reveal; „Nochmal"; Pool-Exclusion sichtbar.
- [ ] **T2.7** *(Design)* Transparenz-Panel: zeigt nachvollziehbar, wer welche Chance/Gewicht hat.

## E3 — Sz2 Team Lock & Draw (P1, M3)

- [ ] **T3.1** Team-Modell erweitern: `locked` je Team, `fixed` je Member. Feste Teams vorab anlegbar.
- [ ] **T3.2** „Halbe Teams": leeres/teilbesetztes Team manuell erstellen, Personen reinziehen, fixieren (z.B. 2 von 6 fix zusammen).
- [ ] **T3.3** `createTeams` respektiert gelockte Teams/Members: nur **freie** Personen auf **freie** Plätze auslosen.
- [ ] **T3.4** „Neu auslosen" verwirft gelockte Teile **nicht** — nur der ungelockte Rest wird neu gemischt. *(behebt aktuellen Reset-Bug)*
- [ ] **T3.5** Themen getrennt **und** zusammen auslosbar; gelockte/zugewiesene Themen bleiben.
- [ ] **T3.6** Manuelle Team-Erstellung + Themenzuweisung **vor** der Ziehung (Mix aus fix + Auslosung).
- [ ] **T3.7** *(Design)* Lock-Toggle (Icon + Animation), klare visuelle Trennung „fix" vs „ausgelost", Drag&Drop-Politur, Beamer-Vollbild.

## E4 — Design-System (P1, M4)

- [ ] **T4.1** Zentrale Theme-Tokens (Farben, Radius, Glas/Blur, Schatten) + wiederverwendbare Primitives (Button, Card, Modal, Accordion, Badge).
- [ ] **T4.2** Animations-Utilities (Keyframes, Transitions) zentral + globaler `prefers-reduced-motion`-Fallback.
- [ ] **T4.3** `RegisterForm`/Register-Seite ins gleiche dunkle Theme (aktuell hell/abweichend), mobil-optimiert.
- [ ] **T4.4** Admin-Dashboard-Redesign passend zur Live-Stage.

## E5 — Zugriffsschutz Admin (P2, M5)

- [ ] **T5.1** Simples Prof-Login/Token-Gate für Admin-UI + alle Session-Mutationen (POST/PUT/DELETE).
- [ ] **T5.2** Register-/Live-Seiten bleiben öffentlich (nur per uuid erreichbar).

## E6 — Tests & CI (P2, M5)

- [ ] **T6.1** Unit-Tests: `fairness.ts`, `createTeams` (inkl. Lock-Logik), `csv.ts`.
- [ ] **T6.2** GitHub Actions: `lint` + `build` + `test`.

## E7 — Ideen-Pool (P2/P3, proaktiv)

- [ ] Beamer-Präsentationsmodus: QR groß/Vollbild zum Einscannen.
- [ ] Reveal-Politur: Confetti/Sound beim Gewinner/Teams (opt-out, reduced-motion).
- [ ] „Undo" der letzten Ziehung.
- [ ] Team-Ergebnis als CSV/PDF exportieren.
- [ ] Session „schließen" sperrt Registrierung sichtbar (Register-Seite zeigt Status).
- [ ] Anti-Doppelanmeldung clientseitig (ohne PII, z.B. lokaler Token pro Gerät).
- [ ] Mehrere Aufgaben/Ziehungen pro Runde.
- [ ] i18n (DE/EN); PWA/Offline für den Prof-Client.
