#!/bin/sh
# The installer's failure tests on this machine (spec 018): each case of docs/04-specs/018-failure-matrix that a
# fake HOME can hold, against the archive of this tree in installer/dist/ (installer/release/package.sh first).
#
#   installer/tests/run.sh            every case, one after the other
#   installer/tests/run.sh E4 D2      only those
#
# PS1 parses install.ps1 in a PowerShell container (one at a time, 1 CPU, 1 GB: this machine has limits).
#
# Never the real HOME: every test runs in a new empty folder with HOME and every XDG folder inside it, and the AI
# services are skipped (--no-ai), so nothing is registered at login and no port is taken.
set -u

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DIST="$ROOT/installer/dist"
INSTALLER="$ROOT/installer/release/install.sh"
[ -f "$DIST/latest" ] || { echo "no archive: run installer/release/package.sh first"; exit 2; }
WORK=$(mktemp -d "${TMPDIR:-/tmp}/nuclear-installer-tests.XXXXXX")
trap 'rm -rf "$WORK"' EXIT
PASS=0; FAIL=0; FAILED=""

# A fresh, empty machine for one test: $H is its HOME.
machine() {
  H="$WORK/$1"; rm -rf "$H"; mkdir -p "$H"
}
# The installer in that machine (NO_COLOR, no terminal): its output in $H/out, its exit code returned.
install() {
  env -i PATH="$PATH" HOME="$H" XDG_CONFIG_HOME="$H/.config" XDG_CACHE_HOME="$H/.cache" \
    XDG_STATE_HOME="$H/.local/state" XDG_DATA_HOME="$H/.local/share" NO_COLOR=1 \
    NUCLEAR_DOWNLOAD="file://$DIST" "$@" sh "$INSTALLER" --no-ai --no-vscode > "$H/out" 2>&1 < /dev/null
}
# `install` with extra options after the defaults
install_with() { opts=$*; set --; INSTALL_OPTS=$opts install_opts; }
install_opts() {
  env -i PATH="$PATH" HOME="$H" XDG_CONFIG_HOME="$H/.config" XDG_CACHE_HOME="$H/.cache" \
    XDG_STATE_HOME="$H/.local/state" XDG_DATA_HOME="$H/.local/share" NO_COLOR=1 \
    NUCLEAR_DOWNLOAD="file://$DIST" ${ENVS:-} sh "$INSTALLER" --no-ai $INSTALL_OPTS > "$H/out" 2>&1 < /dev/null
}
ok() { PASS=$((PASS + 1)); echo "  ✓ $CASE $*"; }
no() { FAIL=$((FAIL + 1)); FAILED="$FAILED $CASE"; echo "  ✗ $CASE $*"; sed 's/^/      /' "$H/out" | tail -n 8; }
check() { if eval "$1"; then ok "$2"; else no "$2 (failed: $1)"; fi; }
nuclear_runs() { "$H/.local/share/nuclearlang/bin/nuclear" dialect list > /dev/null 2>&1; }

# --- the cases ---

D1() {  # a fresh install
  machine D1; install
  check 'nuclear_runs' "a fresh install runs nuclear"
  check '[ -f "$H/.local/share/nuclearlang/.version" ]' "it writes .version"
}

D2() {  # the same version again keeps it
  machine D2; install; install
  check 'grep -q "already installed" "$H/out"' "a second run keeps the same version"
  check 'nuclear_runs' "and nuclear still runs"
}

E4() {  # the choices of the first install are kept by an update
  machine E4; install_with --no-agent --no-modify-path --no-vscode
  check 'grep -qx "AGENT=0" "$H/.local/share/nuclearlang/.options"' "the first install writes its choices"
  ENVS="NUCLEAR_UPDATE=1" install_with --reinstall
  check 'grep -qx "AGENT=0" "$H/.local/share/nuclearlang/.options" && grep -qx "MODIFY_PATH=0" "$H/.local/share/nuclearlang/.options"' \
    "an update keeps them"
  check '[ ! -d "$H/.claude/skills/nuclear" ] && ! grep -qs nuclearlang "$H/.bashrc" "$H/.profile"' \
    "and does not add the skill or the PATH lines the user declined"
  install_with --reinstall
  check 'grep -qx "AGENT=1" "$H/.local/share/nuclearlang/.options"' "a run by hand takes its own options"
}

LOCK() {  # one install at a time
  machine LOCK; mkdir -p "$H/.local/state/nuclearlang/install.lock"
  sleep 60 & holder=$!; echo "$holder" > "$H/.local/state/nuclearlang/install.lock/pid"
  install; code=$?
  kill "$holder" 2>/dev/null
  check '[ "$code" = 1 ] && grep -q "Another NuclearLang install is running" "$H/out"' "a second install stops and says so"
  check '! nuclear_runs' "and installs nothing"
  install
  check 'nuclear_runs && [ ! -d "$H/.local/state/nuclearlang/install.lock" ]' "a lock left by a dead run is taken over and removed"
}

I1() {  # under sudo
  machine I1; mkdir -p "$H/shim"; printf '#!/bin/sh\necho 0\n' > "$H/shim/id"; chmod +x "$H/shim/id"
  PATH="$H/shim:$PATH" ENVS="SUDO_USER=someone" install_with --no-vscode; code=$?
  check '[ "$code" = 2 ] && grep -q "without sudo" "$H/out"' "under sudo the installer stops with the reason"
}

D6() {  # interrupted, then resumed
  machine D6
  ( install ) & pid=$!
  # stopped as soon as it has started to download
  for _ in $(seq 1 100); do [ -s "$H/.local/state/nuclearlang/install.state" ] && break; sleep 0.05; done
  pkill -INT -P "$pid" 2>/dev/null; kill -INT "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
  install
  check 'nuclear_runs' "a run after an interrupted one finishes the install"
}

D7() {  # stuck: .version of this version but a broken binary
  machine D7; install
  printf 'broken' > "$H/.local/share/nuclearlang/bin/nuclear"
  install
  check 'nuclear_runs' "a broken binary under a .version is replaced by the next run"
}

D13() {  # uninstall, then install again
  machine D13; install
  env -i PATH="$PATH" HOME="$H" XDG_CONFIG_HOME="$H/.config" XDG_CACHE_HOME="$H/.cache" XDG_STATE_HOME="$H/.local/state" \
    XDG_DATA_HOME="$H/.local/share" NO_COLOR=1 sh "$INSTALLER" --uninstall > "$H/out" 2>&1 < /dev/null
  check '[ ! -e "$H/.local/share/nuclearlang" ] && [ ! -e "$H/.local/state/nuclearlang" ] && [ ! -e "$H/.local/bin/nuclear" ]' \
    "the uninstall leaves nothing"
  install
  check 'nuclear_runs' "and a new install works"
}

P1() {  # the local profiles are on standby (ADR-platform-0013): asked or remembered, they become remote
  machine P1; mkdir -p "$H/.config/nuclearlang"; printf 'NUCLEAR_AI_PROFILE=hard\n' > "$H/.config/nuclearlang/ai.env"
  install
  check 'grep -q "on standby (ADR-platform-0013): profile remote, not hard" "$H/out"' "a remembered local profile becomes remote"
  install_with --profile lite --no-vscode
  check 'grep -q "profile remote, not lite" "$H/out" && nuclear_runs' "an asked one too, and the install goes on"
}

PS1() {  # install.ps1 parses (PowerShell in one small container; skipped without Docker)
  machine PS1
  if ! command -v docker >/dev/null 2>&1; then echo "  - PS1 skipped (no docker)"; return; fi
  docker run --rm --memory 1g --cpus 1 -v "$ROOT/installer/release:/r:ro" mcr.microsoft.com/powershell:lts-alpine-3.20 \
    pwsh -NoProfile -Command '$e=$null; $t=$null; [void][System.Management.Automation.Language.Parser]::ParseFile("/r/install.ps1",[ref]$t,[ref]$e); $e | % { "$($_.Extent.StartLineNumber): $($_.Message)" }; exit $e.Count' > "$H/out" 2>&1; code=$?
  check '[ "$code" = 0 ]' "install.ps1 has no syntax errors"
}

ALL="D1 D2 E4 LOCK I1 D6 D7 D13 P1 PS1"
for CASE in ${*:-$ALL}; do
  echo "$CASE"
  "$CASE"
done
echo ""
echo "$PASS passed, $FAIL failed${FAILED:+:$FAILED}"
[ "$FAIL" = 0 ]
