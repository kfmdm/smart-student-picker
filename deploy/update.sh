#!/usr/bin/env bash
# Install or update the HSRM application from the public repository.
set -Eeuo pipefail

fail() {
    printf 'Fehler: %s\n' "$*" >&2
    exit 1
}

# Keep the update in a function so pulling a new script cannot change commands
# halfway through this invocation.
main() {
    local project_dir branch deployed_commit command proxy_var
    local -a docker_command=(docker)
    local -a build_args=()
    project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
    cd -- "$project_dir"

    for command in git docker flock python3; do
        command -v "$command" >/dev/null || fail "Benötigtes Programm fehlt: $command"
    done
    [[ -d .git ]] || fail "Das Projekt muss ein Git-Checkout sein."

    # Lock inside .git so the lock does not make the working tree dirty.
    exec 9>.git/hsrm-deploy.lock
    flock -n 9 || fail "Es läuft bereits ein Deployment."

    [[ -z "$(git status --porcelain --untracked-files=all)" ]] ||
        fail "Lokale Änderungen vorhanden. Bitte zuerst prüfen und sichern; es wurde nichts überschrieben."
    branch="$(git symbolic-ref --quiet --short HEAD)" ||
        fail "Kein Branch ausgecheckt (detached HEAD). Bitte den gewünschten Deployment-Branch auschecken."
    if (( EUID != 0 )); then
        command -v sudo >/dev/null || fail "sudo fehlt."
        sudo -v
        # BuildKit authenticates to registries in the client process, which also
        # needs HSRM's proxy variables (the daemon has its own proxy settings).
        docker_command=(sudo --preserve-env=HTTP_PROXY,HTTPS_PROXY,NO_PROXY,ALL_PROXY,http_proxy,https_proxy,no_proxy,all_proxy docker)
    fi
    "${docker_command[@]}" info >/dev/null
    # Never invent replacement credentials for an existing database volume.
    if [[ ! -e .env.production && ! -e .env.database ]] &&
        "${docker_command[@]}" volume inspect smart-student-picker_database >/dev/null 2>&1; then
        fail "Ein Datenbank-Volume existiert bereits. Bitte die bisherigen .env.production und .env.database wiederherstellen."
    fi
    docker_command+=(compose -f "$project_dir/docker-compose.production.yml")
    "${docker_command[@]}" version >/dev/null

    printf 'Lade den neuesten Stand von Branch %s …\n' "$branch"
    # HTTPS works without a GitHub account or SSH deploy key, even if origin
    # was originally configured with an SSH URL.
    GIT_TERMINAL_PROMPT=0 git -c pull.rebase=false pull --ff-only \
        https://github.com/kfmdm/smart-student-picker.git "$branch"
    [[ "$(git rev-parse HEAD)" == "$(git rev-parse FETCH_HEAD)" ]] ||
        fail "Der lokale Branch enthält zusätzliche Commits. Kein Deployment; bitte den Branch prüfen."
    deployed_commit="$(git rev-parse --short HEAD)"

    python3 "$project_dir/deploy/setup-production.py"
    # Validate without printing the resolved configuration (it contains secrets).
    "${docker_command[@]}" config --quiet
    printf 'Baue die Anwendung (Commit %s) …\n' "$deployed_commit"
    for proxy_var in HTTP_PROXY HTTPS_PROXY NO_PROXY ALL_PROXY http_proxy https_proxy no_proxy all_proxy; do
        if [[ -n "${!proxy_var:-}" ]]; then
            build_args+=(--build-arg "$proxy_var=${!proxy_var}")
        fi
    done
    "${docker_command[@]}" build "${build_args[@]}" app
    printf 'Starte die Container und warte auf die Healthchecks …\n'
    "${docker_command[@]}" up -d --no-build --wait --wait-timeout 180
    "${docker_command[@]}" ps
    printf 'Deployment erfolgreich: %s (%s).\n' "$branch" "$deployed_commit"
    printf 'Anwendung: https://eorl.local.cs.hs-rm.de\n'
}

trap 'printf "Deployment abgebrochen (Zeile %s). Bitte die Fehlermeldung oben prüfen.\n" "$LINENO" >&2' ERR
main "$@"
