#!/usr/bin/env python3
"""Change the production admin password and restart the app container."""

from __future__ import annotations

import getpass
import os
from pathlib import Path
import subprocess
import sys


PROJECT_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_DIR / ".env.production"
COMPOSE_FILE = PROJECT_DIR / "docker-compose.production.yml"


def compose_quote(value: str) -> str:
    escaped = (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("$", "$$")
        .replace("\r", "\\r")
        .replace("\n", "\\n")
    )
    return f'"{escaped}"'


def main() -> int:
    password = getpass.getpass("Neues Admin-Passwort: ")
    confirmation = getpass.getpass("Passwort wiederholen: ")

    if not password:
        print("Das Passwort darf nicht leer sein.", file=sys.stderr)
        return 1
    if password != confirmation:
        print("Die Passwörter stimmen nicht überein.", file=sys.stderr)
        return 1

    original = ENV_FILE.read_text(encoding="utf-8")
    replacement = f"ADMIN_PASSWORD={compose_quote(password)}"
    lines = original.splitlines()

    for index, line in enumerate(lines):
        if line.startswith("ADMIN_PASSWORD="):
            lines[index] = replacement
            break
    else:
        lines.append(replacement)

    temporary = ENV_FILE.with_suffix(".production.tmp")
    temporary.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.chmod(temporary, 0o600)
    temporary.replace(ENV_FILE)

    command = [
        "sudo",
        "docker",
        "compose",
        "-f",
        str(COMPOSE_FILE),
        "up",
        "-d",
        "--no-deps",
        "--force-recreate",
        "app",
    ]
    result = subprocess.run(command, cwd=PROJECT_DIR, check=False)
    if result.returncode != 0:
        ENV_FILE.write_text(original, encoding="utf-8")
        os.chmod(ENV_FILE, 0o600)
        print(
            "Der Neustart ist fehlgeschlagen; die bisherige Konfiguration wurde wiederhergestellt.",
            file=sys.stderr,
        )
        return result.returncode

    print("Admin-Passwort geändert und Anwendung neu gestartet.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
