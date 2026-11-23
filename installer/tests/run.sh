#!/bin/sh
# The installer's failure tests on this machine (spec 018): each case of docs/04-specs/018-failure-matrix that a
# fake HOME can hold, against the archive of this tree in installer/dist/ (installer/release/package.sh first).
#
#   installer/tests/run.sh            every case, one after the other
#   installer/tests/run.sh E4 D2      only those
#
# OUT1 renders what a terminal shows (util-linux `script`, python3: installer/tests/screen.py) and reads it as the user
# does; UPD1 downloads the previous published release (network: "skipped (offline)" without it, which
# installer/release/delivery.sh refuses unless --offline-ok). PRJ1 makes projects with the previous release (a fastapi
# and a nestjs backend, a react app: the toolchains this machine has), updates, and runs them with this tree's nuclear
# (the network for the release and the projects' packages; pip and npm use this user's caches; about 1.5 minutes, 350 MB
# in TMPDIR). NUCLEAR_PREVIOUS=<version> takes that release as the previous one. PS1 parses install.ps1 in a PowerShell container (one at a time, 1 CPU, 1 GB: this machine has limits).
#
# Never the real HOME: every test runs in a new empty folder with HOME and every XDG folder inside it, and the AI
# services are skipped (--no-ai), so nothing is registered at login and no port is taken.
set -u

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DIST="$ROOT/installer/dist"
INSTALLER="$ROOT/installer/release/install.sh"
[ -f "$DIST/latest" ] || { echo "no archive: run installer/release/package.sh first"; exit 2; }
WORK=$(mktemp -d "${TMPDIR:-/tmp}/nuclear-installer-tests.XXXXXX")
SERVERS=""
# a server PRJ1 started, and anything a fake machine left running (a `nuclear update --when-idle`), go with the folder
trap 'for p in $SERVERS; do kill_tree "$p"; done; pkill -f "$WORK/" 2>/dev/null; rm -rf "$WORK"' EXIT
trap 'exit 130' INT TERM HUP  # a signal still runs the EXIT trap: no server and no folder stays
# the work folders of runs that were killed before this rule
find "${TMPDIR:-/tmp}" -maxdepth 1 -name 'nuclear-installer-tests.*' ! -path "$WORK" -mmin +180 -exec rm -rf {} + 2>/dev/null || true
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

P1() {  # the local profiles are on standby (ADR-platform-0013): asked or remembered, they become remote, silently
  machine P1; mkdir -p "$H/.config/nuclearlang"; printf 'NUCLEAR_AI_PROFILE=hard\n' > "$H/.config/nuclearlang/ai.env"
  install
  check 'nuclear_runs && ! grep -q -i -e "ADR-" -e "standby" -e "not hard" "$H/out"' "a remembered local profile: the install goes on and says nothing of it"
  install_with --profile lite --no-vscode
  check 'nuclear_runs && ! grep -q -i -e "ADR-" -e "standby" "$H/out"' "an asked one too"
  check '[ "$(grep -c "Write only the logic" "$H/out")" -le 1 ]' "the sign and the motto are shown once"
}

OUT1() {  # what the user reads: the installer in a terminal of 80 and of 60 columns, with colors, as the screen shows it
  if ! script -qec true /dev/null < /dev/null > /dev/null 2>&1; then echo "  - OUT1 skipped (no util-linux script)"; return; fi
  machine OUT1
  check 'python3 "$ROOT/installer/tests/screen.py" --self-test > "$H/out" 2>&1' "the screen renderer passes its self-test"
  for c in 80 60; do
    machine "OUT1-$c"
    env -i PATH="$PATH" HOME="$H" XDG_CONFIG_HOME="$H/.config" XDG_CACHE_HOME="$H/.cache" \
      XDG_STATE_HOME="$H/.local/state" XDG_DATA_HOME="$H/.local/share" TERM=xterm-256color COLORTERM=truecolor \
      NUCLEAR_DOWNLOAD="file://$DIST" script -qec "stty cols $c rows 40; sh '$INSTALLER' --no-ai --no-vscode" "$H/tty" \
      < /dev/null > /dev/null 2>&1
    python3 "$ROOT/installer/tests/screen.py" "$c" "$H/tty" > "$H/screen" 2> "$H/out"
    check '[ ! -s "$H/out" ]' "$c columns: every box's right border at its column or absent, no box line wrapped, no frame of the sign left"
    cp "$H/screen" "$H/out"
    check '! grep -q -i -e "ADR-" -e "spec 0" -e "standby" -e "TODO" "$H/screen"' "$c columns: no internal text (ADR ids, specs, standby, TODO)"
    check '[ "$(grep -c "Write only the logic" "$H/screen")" = 1 ]' "$c columns: the sign and its motto once"
    check '[ ! -e "$H/.local/state/synapsis/intro_seen" ] && grep -q "is installed" "$H/screen"' "$c columns: no nuclear intro, and the summary"
  done
}

# The newest published release older than this tree's version, and its files for this system in $1 (a mirror).
previous_release() {
  current=$(sed -n 's/^version = "\(.*\)"/\1/p' "$ROOT/Cargo.toml" | head -n 1)
  PREV=${NUCLEAR_PREVIOUS:-}
  [ -n "$PREV" ] || PREV=$(curl -fsSL --max-time 15 "https://api.github.com/repos/nuclearlang/nuclearlang/releases?per_page=30" 2>/dev/null \
    | sed -n 's/.*"tag_name": *"v\([0-9.]*\)".*/\1/p' | { cat; echo "$current"; } | sort -t . -k1,1n -k2,2n -k3,3n -u \
    | sed -n "/^$current\$/{x;p;q;};h")
  [ -n "$PREV" ] || return 1
  case $(uname -s) in Darwin) os=macos ;; *) os=linux ;; esac
  case $(uname -m) in arm64|aarch64) arch=aarch64 ;; *) arch=x86_64 ;; esac
  name="nuclearlang-$PREV-$os-$arch.tar.gz"; url="https://github.com/nuclearlang/nuclearlang/releases/download/v$PREV"
  [ -s "$1/$name.sha256" ] && return 0  # UPD1 downloaded it already
  mkdir -p "$1" && echo "$PREV" > "$1/latest" &&
    curl -fsSL --max-time 120 -o "$1/$name" "$url/$name" && curl -fsSL --max-time 30 -o "$1/$name.sha256" "$url/$name.sha256" &&
    curl -fsSL --max-time 30 -o "$1/install.sh" "$url/install.sh"
}

UPD1() {  # an update from the previous published release, as `nuclear update` runs it, and a symlinked nuclear
  machine UPD1
  if ! previous_release "$WORK/previous"; then echo "  - UPD1 skipped (offline: the previous release could not be downloaded)"; return; fi
  env -i PATH="$PATH" HOME="$H" XDG_CONFIG_HOME="$H/.config" XDG_CACHE_HOME="$H/.cache" XDG_STATE_HOME="$H/.local/state" \
    XDG_DATA_HOME="$H/.local/share" NO_COLOR=1 NUCLEAR_DOWNLOAD="file://$WORK/previous" \
    sh "$WORK/previous/install.sh" --no-ai --no-vscode > "$H/out" 2>&1 < /dev/null
  check 'grep -qx "$PREV" "$H/.local/share/nuclearlang/.version"' "the previous release ($PREV) installs with its own installer"
  ENVS="NUCLEAR_UPDATE=1 NUCLEAR_INSTALL=$H/.local/share/nuclearlang" install_with --no-vscode
  check 'grep -qx "$current" "$H/.local/share/nuclearlang/.version" && nuclear_runs' "this installer updates it to $current and nuclear runs"
  check '[ -L "$H/.local/bin/nuclear" ]' "nuclear in ~/.local/bin is the installer's link"
  env -i PATH="$PATH" HOME="$H" XDG_CONFIG_HOME="$H/.config" XDG_CACHE_HOME="$H/.cache" XDG_STATE_HOME="$H/.local/state" \
    XDG_DATA_HOME="$H/.local/share" NO_COLOR=1 NUCLEAR_UPDATE_DRYRUN=1 "$H/.local/bin/nuclear" update > "$H/out" 2>&1 < /dev/null
  check 'grep -q "would run .*NUCLEAR_INSTALL=.*nuclearlang NUCLEAR_UPDATE=1" "$H/out" && ! grep -q "was not installed" "$H/out"' \
    "nuclear update through the link finds its installation"
}

# A process and every process under it (a server with its reloader, npm with node --watch), parent first.
kill_tree() {
  kids=$(pgrep -P "$1" 2>/dev/null); kill "$1" 2>/dev/null
  for kid in $kids; do kill_tree "$kid"; done
}
free_port() { python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])'; }
# The nuclear of machine $H as its user runs it: its link first on PATH (`nuclear run` runs `nuclear build`), never an
# update of its own, and this user's package caches (only downloads are kept there)
hn() {
  env -i PATH="$H/.local/bin:$PATH" HOME="$H" XDG_CONFIG_HOME="$H/.config" XDG_CACHE_HOME="$H/.cache" \
    XDG_STATE_HOME="$H/.local/state" XDG_DATA_HOME="$H/.local/share" NO_COLOR=1 NUCLEAR_AUTO_UPDATE=0 \
    PIP_CACHE_DIR="$PIP_CACHE" npm_config_cache="$NPM_CACHE" ${ENVS:-} "$H/.local/bin/nuclear" "$@"
}
# One step of a project: `nuclear <args>` in it; a failure says the step, with its last lines.
step() {
  what=$1; app=$2; shift 2
  if (cd "$H/projects/$app" && hn "$@") > "$H/out" 2>&1 < /dev/null; then ok "$app: $what"; else no "$app: $what"; return 1; fi
}
# `nuclear run` of a project until a route of its resource answers 200 (2 minutes at most), then stopped. The
# arguments after the route go to `nuclear run`, PORT in them the free port it serves on (PORT is in its environment too).
serve() {
  app=$1; route=$2; shift 2; port=$(free_port); args=$(echo "$*" | sed "s/PORT/$port/g")
  (cd "$H/projects/$app" && ENVS="PORT=$port" hn run $args) > "$H/out" 2>&1 < /dev/null &
  pid=$!; SERVERS="$SERVERS $pid"; code=000
  for _ in $(seq 1 120); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:$port$route" 2>/dev/null)
    [ "$code" = 200 ] && break; kill -0 "$pid" 2>/dev/null || break; sleep 1
  done
  kill_tree "$pid"; wait "$pid" 2>/dev/null
  if [ "$code" = 200 ]; then ok "$app: nuclear run answers 200 on $route, then stops"; else no "$app: nuclear run (GET $route: $code)"; fi
}

PRJ1() {  # projects the previous release made and installed, updated, then checked, built, tested and run
  machine PRJ1
  if ! previous_release "$WORK/previous"; then echo "  - PRJ1 skipped (offline: the previous release could not be downloaded)"; return; fi
  PIP_CACHE=${XDG_CACHE_HOME:-$HOME/.cache}/pip; NPM_CACHE=$HOME/.npm
  env -i PATH="$PATH" HOME="$H" XDG_CONFIG_HOME="$H/.config" XDG_CACHE_HOME="$H/.cache" XDG_STATE_HOME="$H/.local/state" \
    XDG_DATA_HOME="$H/.local/share" NO_COLOR=1 NUCLEAR_AUTO_UPDATE=0 NUCLEAR_DOWNLOAD="file://$WORK/previous" \
    sh "$WORK/previous/install.sh" --no-ai --no-vscode > "$H/out" 2>&1 < /dev/null
  check 'grep -qx "$PREV" "$H/.local/share/nuclearlang/.version"' "the previous release ($PREV) installs"
  grep -qx "$PREV" "$H/.local/share/nuclearlang/.version" || return
  # each project: name:platform:dialect:the route of its resource:how its server takes a port (PORT: the port):more
  # options of its resource (_ is a space)
  apps="api_py:backend:fastapi:/products:--_--port_PORT: api_ts:backend:nestjs:/products::"
  command -v npx > /dev/null 2>&1 && apps="$apps site:web:react:/products:--_--port_PORT:--source_rest:http://127.0.0.1:9" ||
    echo "  - PRJ1 react skipped (no Node.js)"
  ready=""
  mkdir -p "$H/projects"
  for a in $apps; do
    IFS=: read -r app platform dialect route _ more <<EOF2
$a
EOF2
    (cd "$H/projects" && hn new "$app" -p "$platform" -d "$dialect") > "$H/out" 2>&1 < /dev/null &&
      ok "$app: $PREV makes a $dialect project" || { no "$app: nuclear new ($PREV)"; continue; }
    step "$PREV generates a resource" "$app" gen resource catalog Product --fields "id:int name:string" $(echo "$more" | tr _ ' ') &&
      step "$PREV installs it" "$app" install && step "$PREV tests it" "$app" test && ready="$ready $a"
  done
  ENVS="NUCLEAR_UPDATE=1 NUCLEAR_AUTO_UPDATE=0 NUCLEAR_INSTALL=$H/.local/share/nuclearlang" install_with --no-vscode
  check 'grep -qx "$current" "$H/.local/share/nuclearlang/.version"' "this installer updates $PREV to $current"
  grep -qx "$current" "$H/.local/share/nuclearlang/.version" || return
  for a in $ready; do
    IFS=: read -r app platform dialect route args _ <<EOF2
$a
EOF2
    step "check ($current)" "$app" check && step "build ($current)" "$app" build && step "test ($current)" "$app" test &&
      serve "$app" "$route" $(echo "$args" | tr _ ' ')
  done
}

PS1() {  # install.ps1 parses (PowerShell in one small container; skipped without Docker)
  machine PS1
  if ! command -v docker >/dev/null 2>&1; then echo "  - PS1 skipped (no docker)"; return; fi
  docker run --rm --memory 1g --cpus 1 -v "$ROOT/installer/release:/r:ro" mcr.microsoft.com/powershell:lts-alpine-3.20 \
    pwsh -NoProfile -Command '$e=$null; $t=$null; [void][System.Management.Automation.Language.Parser]::ParseFile("/r/install.ps1",[ref]$t,[ref]$e); $e | % { "$($_.Extent.StartLineNumber): $($_.Message)" }; exit $e.Count' > "$H/out" 2>&1; code=$?
  check '[ "$code" = 0 ]' "install.ps1 has no syntax errors"
}

ALL="D1 D2 E4 LOCK I1 D6 D7 D13 P1 OUT1 UPD1 PRJ1 PS1"
for CASE in ${*:-$ALL}; do
  echo "$CASE"
  "$CASE"
done
echo ""
echo "$PASS passed, $FAIL failed${FAILED:+:$FAILED}"
[ "$FAIL" = 0 ]
