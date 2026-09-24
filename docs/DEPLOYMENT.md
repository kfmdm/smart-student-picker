# Deployment & Betrieb

## Datenbank-Schema

Prisma wird hier nur als typisierter Client für rohes SQL genutzt; das Schema liegt
**nicht** in `schema.prisma`, sondern als SQL-Migration vor.

- Tabellen `sessions` und `participants` (Basis) – aus dem initialen Setup.
- `database/migrations/001_add_team_draw.sql` – erweitert `sessions.type` um `team_draw`
  und ergänzt die `settings`-JSON-Spalte.

Schema einspielen (neue Umgebung):

```bash
# Basis-Tabellen (idempotent)
mysql -h <host> -u <user> -p <database> < database/schema.sql
# optionale Migration (falls von einem älteren Stand migriert wird)
mysql -h <host> -u <user> -p <database> < database/migrations/001_add_team_draw.sql
```

> Hinweis: Die `participants`-Tabelle wird seit Einführung des In-Memory-Relays
> **nicht mehr beschrieben** (Namen bleiben flüchtig, Prinzip P1). Sie kann bestehen
> bleiben oder später per Migration entfernt werden. Eine evtl. vorhandene `test`-Tabelle
> ist eine Altlast und kann gefahrlos gedroppt werden.

## Review-Deployment (Docker + Plesk)

Das Review läuft als Docker-Container hinter dem Plesk-Nginx-Reverse-Proxy.

```bash
# .env mit DATABASE_URL anlegen (Host = host.docker.internal für den Container)
docker compose up -d --build
```

- **Bridge-Netz**, App lauscht intern auf **Port 80**, veröffentlicht als `32801->80`.
- **DB-Anbindung:** `host.docker.internal` (via `extra_hosts: host-gateway`) → Host-MariaDB
  (`0.0.0.0:3306`, User mit `@%`-Grant). Secrets liegen nur in der ungetrackten `.env`.
- **Plesk:** Docker-Reverse-Proxy der Subdomain auf **Container-Port 80** (wie die übrigen
  Subdomains). Für die Live-Funktion (SSE) in den *Additional nginx directives* der
  Subdomain ergänzen:

  ```nginx
  proxy_buffering off;
  proxy_read_timeout 3600s;
  ```

## Redeploy nach Änderungen

```bash
docker compose up -d --build
```

## Admin-Passwort auf dem HSRM-Server ändern

Das Deployment liegt auf `eorl.local.cs.hs-rm.de` unter
`/opt/smart-student-picker`. Dieser einzelne Befehl fragt das neue Passwort
verdeckt ab, speichert es in `/opt/smart-student-picker/.env.production` und
startet die Anwendung neu:

```bash
ssh -t admin@eorl.local.cs.hs-rm.de /opt/smart-student-picker/deploy/change-admin-password.py
```

Nach der Änderung sind bestehende Admin-Anmeldungen ungültig. Weil die
Teilnehmerliste nur im Arbeitsspeicher liegt, sollte das Passwort nicht während
einer laufenden Auslosung geändert werden.
