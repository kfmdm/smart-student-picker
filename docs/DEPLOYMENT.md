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

## Review-Redeploy nach Änderungen

```bash
docker compose up -d --build
```

## HSRM-Server: klonen, starten und aktualisieren

### Erstinstallation: ein Befehl nach dem Klonen

Auf dem vorbereiteten HSRM-Server als normaler Benutzer ausführen:

```bash
git clone --branch develop https://github.com/kfmdm/smart-student-picker.git
cd smart-student-picker
./deploy/update.sh
```

Das Skript fragt das neue Admin-Passwort zweimal verdeckt ab. Datenbank- und
Root-Passwort werden zufällig erzeugt; die beiden Konfigurationsdateien werden
mit Dateirechten `600` angelegt. Eine leere Datenbank erhält ihre Tabellen beim
ersten Start automatisch aus `database/schema.sql`. Danach wird die Anwendung
gebaut und gestartet. Der Branch `develop` enthält den aktuellen HSRM-Stand.

Voraussetzung ist ein vorbereiteter Linux-Server mit Docker/Compose und Nginx/TLS
(auf HSRM bereits vorhanden). Das Skript installiert diese Systemdienste nicht.
Es betreibt eine Installation pro Server mit dem Compose-Projektnamen
`smart-student-picker` und dem lokalen Port `32801`. Bei einer vorhandenen
Installation deren Checkout und Konfigurationsdateien weiterverwenden.

### Spätere Updates

Die bestehende Installation unter <https://eorl.local.cs.hs-rm.de> liegt in
`/opt/smart-student-picker`. Für ein Update genügt vom eigenen Rechner:

```bash
ssh -t admin@eorl.local.cs.hs-rm.de /opt/smart-student-picker/deploy/update.sh
```

Alternativ direkt auf dem Server:

```bash
cd /opt/smart-student-picker
./deploy/update.sh
```

`admin` gegebenenfalls durch den eigenen SSH-Benutzernamen ersetzen. Das Skript
als Besitzer des Checkouts ausführen; es verwendet `sudo` nur für Docker und
fragt bei Bedarf das sudo-Passwort ab. Voraussetzungen sind Bash, Git, Python 3, `flock`
(unter Linux im Paket `util-linux`), Docker mit laufendem Daemon und einem
Compose-v2-Plugin mit Unterstützung für `--wait` und `--wait-timeout`.
Der Benutzer benötigt Schreibrechte im Checkout und sudo-Rechte für Docker.

### Was das Update macht

1. Prüft auf lokale Änderungen (auch nicht ignorierte neue Dateien) und verhindert
   parallele Aufrufe des Update-Skripts.
2. Lädt den neuesten Stand des **aktuell ausgecheckten Branches** per
   `git pull --ff-only` von `https://github.com/kfmdm/smart-student-picker.git`.
   Der Branch wird nicht gewechselt. Die öffentliche HTTPS-Adresse benötigt weder
   einen GitHub-Account noch einen SSH-Deploy-Key; die vorhandene `origin`-Adresse
   bleibt unverändert. Bei auseinanderlaufenden Branches oder zusätzlichen lokalen
   Commits wird nicht deployt.
3. Erstellt bei der Erstinstallation die Konfiguration und fragt das Admin-Passwort
   ab. Bei bestehenden Dateien bleiben die Zugangsdaten erhalten; nur ein fehlendes
   oder leeres Admin-Passwort wird abgefragt. Prüft `docker-compose.production.yml`
   und baut das App-Image. Erst nach einem
   erfolgreichen Build werden die Container mit dieser Produktionskonfiguration
   gestartet bzw. aktualisiert.
4. Wartet bis zu 180 Sekunden auf die Healthchecks und zeigt anschließend Status,
   Branch und Commit an. Danach die Website öffnen und den Login prüfen; die
   Container-Healthchecks prüfen nicht den externen HTTPS-Reverse-Proxy.

Die lokalen Dateien `.env.production` und `.env.database` sind von Git und vom
Docker-Build ausgeschlossen. Vorhandene Zugangsdaten und das bestehende
Datenbank-Volume bleiben erhalten. Falls nur eine Konfigurationsdatei vorhanden
ist oder beide fehlen, obwohl das Datenbank-Volume bereits existiert, bricht das
Skript ab: Dann die bisherigen Dateien aus der Sicherung wiederherstellen.
Der HSRM-Nginx leitet HTTPS an `127.0.0.1:32801` weiter; die Vorlage liegt in
`deploy/eorl.nginx.conf`. Das Skript richtet Nginx/TLS nicht ein. Das Basisschema
wird nur für eine leere Datenbank automatisch eingespielt, nicht bei Updates.
Erforderliche Schemaänderungen
sind vor dem Update anhand der jeweiligen Änderung zu prüfen und separat auszuführen.

**Updates außerhalb laufender Auslosungen durchführen:** Beim Neustart gehen die
Teilnehmerlisten im Arbeitsspeicher verloren. Ergebnisse vorher exportieren.
Der Build kann einige Minuten dauern; beim Containerwechsel ist die App kurz
nicht erreichbar. Es gibt keinen automatischen Rollback. Bei einem Buildfehler
bleiben die laufenden Container unverändert, der Git-Checkout ist aber bereits
aktualisiert. Bei einem Start- oder Healthcheck-Fehler den Zustand prüfen:

```bash
cd /opt/smart-student-picker
sudo docker compose -f docker-compose.production.yml ps
sudo docker compose -f docker-compose.production.yml logs --tail=100 app db
```

Nach Beheben der Ursache `./deploy/update.sh` erneut ausführen. Lokale Änderungen
bei einem Git-Abbruch zuerst prüfen und sichern; das Skript verwirft sie nicht.

### Einmalig: Update-Skript auf einen älteren Checkout holen

Falls `deploy/update.sh` auf dem Server noch fehlt, zunächst als Besitzer des
Checkouts anmelden und den Branch prüfen. Bei lokalen Änderungen erst diese sichern:

```bash
ssh admin@eorl.local.cs.hs-rm.de
cd /opt/smart-student-picker
git status --short
git branch --show-current
git pull --ff-only https://github.com/kfmdm/smart-student-picker.git "$(git branch --show-current)"
./deploy/update.sh
```

Der gewählte Branch muss die neue Skriptdatei bereits enthalten. Falls die
bestehende Installation bisher nur eine Dateikopie ohne `.git` ist: zuerst den
alten Ordner sichern, das Repository klonen und die bisherigen `.env.production`
und `.env.database` mit ihren Dateirechten in den neuen Checkout übernehmen.
Das vorhandene Datenbank-Volume darf dabei nicht gelöscht werden.

## Admin-Passwort auf dem HSRM-Server ändern

Das Deployment liegt auf `eorl.local.cs.hs-rm.de` unter
`/opt/smart-student-picker`. Dieser einzelne Befehl fragt das neue Passwort
verdeckt ab, speichert es in `/opt/smart-student-picker/.env.production` und
startet die Anwendung neu:

```bash
ssh -t admin@eorl.local.cs.hs-rm.de /opt/smart-student-picker/deploy/change-admin-password.py
```

Alternativ direkt auf dem Server:

```bash
cd /opt/smart-student-picker
./deploy/change-admin-password.py
```

Voraussetzungen sind Python 3, Schreibrechte auf `.env.production` und sudo-Rechte
für Docker. Das Skript fragt das neue Passwort zweimal verdeckt ab; ein leeres
Passwort oder unterschiedliche Eingaben werden abgelehnt. Das Passwort wird nicht
als Kommandozeilenargument übergeben. Die Datei erhält Dateirechte `600` (nur der
Besitzer darf lesen und schreiben). Nur der App-Container wird neu erstellt, die
Datenbank wird dabei nicht neu gestartet. Bei einem fehlgeschlagenen Compose-Aufruf
wird die bisherige Konfigurationsdatei wiederhergestellt; den Containerstatus dann
mit den obigen Diagnosebefehlen prüfen.

Nach der Änderung sind bestehende Admin-Anmeldungen ungültig. Weil die
Teilnehmerliste nur im Arbeitsspeicher liegt, sollte das Passwort nicht während
einer laufenden Auslosung geändert werden. Passwortwechsel und Deployment
nacheinander ausführen. Anschließend auf der Website mit dem neuen Passwort anmelden.
