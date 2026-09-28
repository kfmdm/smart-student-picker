# Smart Student Picker

Digitales, faires und **datensparsames** Werkzeug für die Lehre: Aufgaben per
Einzelauslosung vergeben und Teams (+ Themen) bilden – als „Bewerbungsflug"-Bühne,
beamer-tauglich und mobil.

- **Sz1 – Einzelauslosung (`single_draw`):** Studierende melden sich per QR-Code,
  eine Person wird **fair** gezogen (nicht rein zufällig – wer sich meldet und nicht
  drankommt, sammelt Guthaben; schwerere Aufgaben zählen mehr). Persistenz übers
  Semester ausschließlich per CSV-Export/-Import im Browser.
- **Sz2 – Team-Auslosung (`team_draw`):** Teams und Themen getrennt oder zusammen
  auslosen, per Drag & Drop anpassen, **Teams sperren** und **Mitglieder fixieren**
  („Lock & Draw" – nur der freie Rest wird verteilt).

## Prinzip: Datensparsamkeit

Teilnehmernamen werden **nicht** in der Datenbank gespeichert. Sie fließen über ein
flüchtiges In-Memory-Relay (`src/lib/liveRelay.ts`) und werden per **SSE**
(`/api/sessions/[uuid]/stream`) live an den Prof-Client gepusht. Die MariaDB hält nur
nicht-personenbezogene Session-Metadaten (`name/type/settings/status`).

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · Prisma 7 als typisierter Client für
rohes SQL (kein ORM/Schema-Models) · MariaDB · `@dnd-kit` für Drag & Drop.

## Lokal starten

```bash
npm install
cp .env.example .env      # DATABASE_URL eintragen (Sonderzeichen URL-encoden!)
npx prisma generate
npm run dev               # http://localhost:3000
```

## Deployment / Betrieb

Auf dem vorbereiteten HSRM-Server: Repository klonen, Skript starten und beim ersten
Start das gewünschte Admin-Passwort zweimal verdeckt eingeben:

```bash
git clone --branch develop https://github.com/kfmdm/smart-student-picker.git
cd smart-student-picker
./deploy/update.sh
```

Das Skript erzeugt die Datenbank-Zugangsdaten, initialisiert eine neue Datenbank und
startet die Anwendung. Spätere Updates verwenden denselben Befehl und behalten die
vorhandenen Passwörter. Docker/Compose sowie Nginx/TLS sind auf HSRM bereits eingerichtet.

Bestehende Installation in `/opt/smart-student-picker` aus der Ferne aktualisieren:
`ssh -t admin@eorl.local.cs.hs-rm.de /opt/smart-student-picker/deploy/update.sh`.

Die Admin-Anleitung für Updates und Passwortwechsel steht in
[`public/anleitung.html`](public/anleitung.html#hsrm-deployment).
Siehe außerdem [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) (HSRM sowie Docker + Plesk-Reverse-Proxy) und den
Fortschritt/Backlog in [`docs/BACKLOG.md`](docs/BACKLOG.md).
