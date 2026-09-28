#!/usr/bin/env python3
"""Create local production credentials, or fill in a missing admin password."""

from __future__ import annotations

import getpass
import os
from pathlib import Path
import re
import secrets
import sys
import tempfile
import warnings


PROJECT_DIR = Path(__file__).resolve().parent.parent
ADMIN_LINE = re.compile(r"^\s*(?:export\s+)?ADMIN_PASSWORD\s*=\s*(.*)$")


def compose_quote(value: str) -> str:
    escaped = (value.replace("\\", "\\\\").replace('"', '\\"')
               .replace("$", "$$").replace("\r", "\\r").replace("\n", "\\n"))
    return f'"{escaped}"'


def ask_password() -> str:
    # Do not fall back to an echoed prompt when SSH was invoked without a TTY.
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        while True:
            password = getpass.getpass("Neues Admin-Passwort: ")
            confirmation = getpass.getpass("Passwort wiederholen: ")
            if password and password == confirmation:
                return password
            print("Das Passwort darf nicht leer sein und beide Eingaben müssen übereinstimmen.",
                  file=sys.stderr)


def write_private(path: Path, content: str) -> None:
    descriptor, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(content)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def setup(project_dir: Path) -> None:
    app_env = project_dir / ".env.production"
    db_env = project_dir / ".env.database"
    if app_env.exists() != db_env.exists():
        raise ValueError("Nur eine der beiden .env-Dateien ist vorhanden. Bitte die fehlende "
                         "Datei aus der bestehenden Installation wiederherstellen.")

    if not app_env.exists():
        password = ask_password()
        db_password = secrets.token_hex(32)
        root_password = secrets.token_hex(32)
        write_private(db_env, "MARIADB_DATABASE=smart_student_picker\n"
                      "MARIADB_USER=ssp\n"
                      f"MARIADB_PASSWORD={db_password}\n"
                      f"MARIADB_ROOT_PASSWORD={root_password}\n")
        try:
            write_private(app_env,
                          f'DATABASE_URL="mysql://ssp:{db_password}@db:3306/smart_student_picker"\n'
                          f"ADMIN_PASSWORD={compose_quote(password)}\n")
        except BaseException:
            db_env.unlink()
            raise
        print("Produktionskonfiguration erstellt; Datenbank-Passwörter automatisch erzeugt.")
        return

    original = app_env.read_text(encoding="utf-8")
    lines = original.splitlines()
    matches = [(index, ADMIN_LINE.match(line)) for index, line in enumerate(lines)]
    matches = [(index, match) for index, match in matches if match is not None]
    if len(matches) > 1:
        raise ValueError("ADMIN_PASSWORD ist mehrfach definiert. Bitte .env.production prüfen.")
    if matches:
        index, match = matches[0]
        value = match.group(1).strip()
        # Empty quoted values may have an inline comment.
        if value and not re.fullmatch(r'''(?:""|'')\s*(?:#.*)?|#.*''', value):
            print("Vorhandene Produktionskonfiguration und Admin-Passwort bleiben erhalten.")
            return
    replacement = f"ADMIN_PASSWORD={compose_quote(ask_password())}"
    if matches:
        lines[matches[0][0]] = replacement
    else:
        lines.append(replacement)
    write_private(app_env, "\n".join(lines) + "\n")
    print("Fehlendes Admin-Passwort gesetzt.")


def main() -> int:
    try:
        setup(PROJECT_DIR)
    except (OSError, ValueError, EOFError, getpass.GetPassWarning) as error:
        print(f"Konfiguration abgebrochen: {error}", file=sys.stderr)
        print("Für die Passwortabfrage bitte ein Terminal verwenden (bei SSH: ssh -t).", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
