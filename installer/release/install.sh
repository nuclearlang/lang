#!/bin/sh
# NuclearLang installer for Linux and macOS:
#
#   curl -fsSL https://nuclearlang.github.io/install.sh | sh
#   curl -fsSL https://nuclearlang.github.io/install.sh | sh -s -- --version 0.2.0
#   curl -fsSL https://nuclearlang.github.io/install.sh | sh -s -- --uninstall
#
# It downloads the release of this system and architecture (Linux x86_64/aarch64, any distribution: the binaries are
# static; macOS Intel/Apple silicon) from GitHub, checks its SHA-256, installs it in ~/.local/share/nuclearlang with
# `nuclear` and `nuclear-lsp` linked in ~/.local/bin, puts that folder in the PATH of your shells, gives
# the AI agents the `nuclear` skill and installs the editor extension in every editor of the VS Code family it finds
# (VS Code, Insiders, Cursor, VSCodium, Windsurf; on macOS inside their apps too). No sudo. Then, asked in a
# required Smart Graph and MCP server: their archive (a Python of their own with the Smart Graph, the MCP server and
# the Nuclear Developer, about 160 MB; nothing is needed on the machine) and their set-up (`nuclear-builder setup`: the
# graph's own embeddings model, the MCP server in the AI clients, the services at every login; it asks whether to add
# local agents, whose Ollama models are downloaded only for a local profile, `remote` adds none). A machine already set
# up keeps its profile; without a terminal the profile is `remote`.
#
# Run it again at any time: what is already there (the same version of NuclearLang, of the AI services) is kept and not
# downloaded again, an interrupted run goes on from its step, and what is missing is added (an editor installed since).
# Required: NuclearLang, the Smart Graph, the MCP server, the skill (a missing one ends the install with an error,
# and a new run goes on). Added when possible: the editor extension. Asked: the local agents. A
# platform's toolchain (Flutter for mobile, Node.js for web and NestJS) is never installed here: the summary and the
# editor say what each platform needs and how to install it.
#
# One install runs at a time (a second one says so and stops); under sudo it stops (it needs no administrator);
# `nuclear update` runs it with NUCLEAR_UPDATE=1, which keeps the choices of the last install (--no-vscode,
# --no-agent, --no-modify-path, NUCLEAR_BIN).
#
# Options (or environment): --version <v> (NUCLEAR_VERSION, default: the latest), --no-modify-path
# (NUCLEAR_NO_MODIFY_PATH=1), --no-vscode, --no-agent, --no-ai (tests only: skips the required Smart Graph and MCP server, the install ends incomplete),
# --profile remote|lite|medium|hard (NUCLEAR_AI_PROFILE:
# that profile, no questions), --reinstall (download and replace even what is already
# there), --uninstall (everything the install made: the AI services' models, Ollama when it
# installed it, their data and secrets, the caches, the editors' extension). NUCLEAR_INSTALL and NUCLEAR_BIN change the folders; NUCLEAR_REPO the
# repository (owner/name) and NUCLEAR_DOWNLOAD the base url of the files (a mirror).
set -eu

REPO=${NUCLEAR_REPO:-nuclearlang/lang}
VERSION=${NUCLEAR_VERSION:-latest}
INSTALL=${NUCLEAR_INSTALL:-$HOME/.local/share/nuclearlang}
BIN=${NUCLEAR_BIN:-$HOME/.local/bin}
MODIFY_PATH=${NUCLEAR_NO_MODIFY_PATH:+0}
MODIFY_PATH=${MODIFY_PATH:-1}
VSCODE=1
AGENT=1
AI=1
PROFILE=${NUCLEAR_AI_PROFILE:-}
SKILL_DIRS="$HOME/.claude/skills $HOME/.agents/skills $HOME/.codex/skills"
MARK="# added by the NuclearLang installer"


say() { printf '%s\n' "$*" >&2; }

# --- the look: the colors and the sign of `nuclear`'s own header (tools/cli/src/framework/landing.rs) ---
# Only on a terminal and without NO_COLOR; 24-bit color where the terminal says so (COLORTERM), else the closest of
# the 256 (macOS Terminal). Without a terminal every step is one plain line.
if [ -t 2 ] && [ -z "${NO_COLOR:-}" ] && [ "${TERM:-dumb}" != dumb ]; then
  esc=$(printf '\033')
  case ${COLORTERM:-} in
    truecolor|24bit) rgb() { printf '%s' "$esc[38;2;$1;$2;$3m"; }; YELLOW=$(rgb 253 216 63); PURPLE=$(rgb 176 84 255)
      GREEN=$(rgb 120 230 150); RED=$(rgb 255 95 95); SLATE=$(rgb 96 125 139); TC=1 ;;
    *) YELLOW="$esc[38;5;220m"; PURPLE="$esc[38;5;135m"; GREEN="$esc[38;5;114m"; RED="$esc[38;5;203m"
      SLATE="$esc[38;5;66m"; TC=0 ;;
  esac
  BOLD="$esc[1m"; DIM="$esc[2m"; OFF="$esc[0m"
else
  YELLOW=""; PURPLE=""; GREEN=""; RED=""; SLATE=""; BOLD=""; DIM=""; OFF=""; TC=0; esc=""
fi
# the boxes' width: the terminal's, at most 76
cols=$( (stty size < /dev/tty) 2>/dev/null | cut -d ' ' -f 2 || true)
# a pseudo-terminal may say 0 columns (`script`): as a terminal of 80
case ${cols:-} in ''|*[!0-9]*|0) cols=80 ;; esac
BOXW=$((cols - 4)); [ "$BOXW" -gt 76 ] && BOXW=76; [ "$BOXW" -lt 40 ] && BOXW=40

# A path as the user reads it: the home folder as ~.
short() { case $1 in "$HOME"/*) printf '~%s' "${1#"$HOME"}" ;; *) printf '%s' "$1" ;; esac; }
ok() { say "  ${GREEN}✓${OFF} $*"; }
warn() { say "  ${YELLOW}!${OFF} $*"; }
line_of() { printf '%*s' "$1" '' | sed "s/ /$2/g"; }
# A section: its title and a faint rule.
section() { say ""; say "  ${YELLOW}◆${OFF} ${BOLD}$1${OFF} ${DIM}$(line_of $((BOXW - ${#1} - 4)) ─)${OFF}"; }
# A box: a title (ASCII), lines, a bottom. On a terminal the right border is placed by column, so colored text keeps
# it straight.
box_top() { say "  ${2:-$DIM}╭─${OFF} ${BOLD}$1${OFF} ${2:-$DIM}$(line_of $((BOXW - ${#1} - 5)) ─)╮${OFF}"; }
# (a narrow terminal leaves the right border out rather than draw it over the text)
RIGHT=""; [ -n "$esc" ] && [ "$BOXW" -ge 76 ] && RIGHT=1
box_line() { say "  ${2:-$DIM}│${OFF} $1${RIGHT:+$esc[$((BOXW + 2))G${2:-$DIM}│$OFF}"; }
box_end() { say "  ${1:-$DIM}╰$(line_of $((BOXW - 2)) ─)╯${OFF}"; }
# Plain text wrapped to the box.
box_text() { printf '%s\n' "$1" | fold -s -w $((BOXW - 4)) | while IFS= read -r l; do box_line "$l" "${2:-}"; done; }

# The NuclearLang sign (the radiation trefoil, as `nuclear` draws it: 16 × 12 pixels, two per cell, ▀ and ▄).
SIGN=".....yyyyyy..... ...yyyssssyyy... ..yyyssssssyyyy. .yyyyyssssyyyyy. yyyyyyyyyyyyyyyy yyyyyyssssyyyyyy
yyssssssssssssyy yysssssyysssssyy .yysssyyyysssyy. ..yysyyyyyysyyy. ...yyyyyyyyyy... .....yyyyyy....."
# The title in pixel letters (4 × 5, two per cell): the header's banner.
glyph() {
  case $1 in
    A) echo ".##. #..# #### #..# #..#" ;; D) echo "###. #..# #..# #..# ###." ;; Y) echo "#..# #..# .##. .##. .##." ;; E) echo "#### #... ###. #... ####" ;; I) echo "#### .##. .##. .##. ####" ;;
    L) echo "#... #... #... #... ####" ;; N) echo "#..# ##.# #.## #..# #..#" ;; R) echo "###. #..# ###. #.#. #..#" ;;
    S) echo ".### #... .##. ...# ###." ;; T) echo "#### .##. .##. .##. .##." ;; U) echo "#..# #..# #..# #..# .##." ;;
  esac
}
# The header: the sign and, beside it, the title in pixel letters, the names and the version, in a box.
banner() {
  word=$1; detail=$2
  if [ -z "$esc" ]; then
    say ""; say "  NuclearLang $word · $detail"; say "  Write only the logic; transpilers do the rest."; say ""; return
  fi
  rows=""
  for r in 1 2 3 4 5; do
    row=""
    for ch in $(printf '%s' "$word" | sed 's/./& /g'); do row="$row$(glyph "$ch" | cut -d ' ' -f "$r")."; done
    rows="$rows $row"
  done
  say ""
  box_top "NuclearLang" "$SLATE"
  { printf '%s\n' $SIGN; echo "--"; printf '%s\n' $rows; } | awk -v e="$esc" -v tc="$TC" \
    -v t4="${BOLD}${YELLOW}NuclearLang${OFF}  ${DIM}·${OFF}  ${BOLD}${PURPLE}Synapsis${OFF}" \
    -v t5="${DIM}Write only the logic; transpilers do the rest.${OFF}" -v t6="${DIM}$detail${OFF}" \
    -v right="$((BOXW + 2))" -v border="${SLATE}│${OFF}" '
    function col(c, layer) { return c == "y" ? (tc ? layer ";2;253;216;63" : layer ";5;220") : (tc ? layer ";2;55;71;79" : layer ";5;239") }
    function half(t, b) {
      if (t == "." && b == ".") return " "
      if (t != ".") return e "[0;" col(t, 38) (b != "." ? ";" col(b, 48) : "") "m▀" e "[0m"
      return e "[0;" col(b, 38) "m▄" e "[0m"
    }
    /^--$/ { word = 1; next }
    { if (word) txt[++n] = $0; else px[++m] = $0 }
    END {
      for (row = 0; row < 6; row++) {
        line = ""
        for (i = 1; i <= 16; i++) line = line half(substr(px[row * 2 + 1], i, 1), substr(px[row * 2 + 2], i, 1))
        line = line "    "
        if (row < 3) {
          for (i = 1; i <= length(txt[1]); i++) {
            t = substr(txt[row * 2 + 1], i, 1); b = (row * 2 + 2 <= 5) ? substr(txt[row * 2 + 2], i, 1) : "."
            line = line (t == "#" && b == "#" ? e "[0;" col("y", 38) "m█" e "[0m" : t == "#" ? e "[0;" col("y", 38) "m▀" e "[0m" : b == "#" ? e "[0;" col("y", 38) "m▄" e "[0m" : " ")
          }
        } else line = line (row == 3 ? t4 : row == 4 ? t5 : t6)
        printf "  %s %s%s[%dG%s\n", border, line, e, right, border
      }
    }' >&2
  box_end "$SLATE"
}

# The loading icon: the sign turning, drawn in braille (14 × 12 dots, 12 frames of 10°: the trefoil repeats every 120°).
SPIN1="⠀⠀⠻⣿⠟⠀⠀ ⠀⠀⠘⣿⡿⠂⠀ ⠀⠀⠀⢿⣿⠆⠀ ⢀⡀⠀⢸⣿⡦⠀ ⢀⣄⠀⢀⣿⣦⡀ ⢀⣤⡀⠀⣼⣦⡀ ⢀⣴⣄⠀⣠⣦⡀ ⢀⣴⣧⠀⢀⣤⡀ ⢀⣴⣿⡀⠀⣠⡀ ⠀⢴⣿⡇⠀⢀⡀ ⠀⠰⣿⡿⠀⠀⠀ ⠀⠐⢿⣿⠃⠀⠀"
SPIN2="⢠⣤⣄⠶⣠⣤⡄ ⢰⣶⣄⠶⣠⣀⡀ ⢸⣷⡆⠶⣁⡀⠀ ⢸⣿⠆⠶⣉⠀⠀ ⢸⡿⠇⠶⡉⠁⠀ ⠸⠿⠋⠶⠙⠉⠁ ⠘⠛⠋⠶⠙⠛⠃ ⠈⠉⠋⠶⠙⠿⠇ ⠀⠈⢉⠶⠸⢿⡇ ⠀⠀⣉⠶⠰⣿⡇ ⠀⢀⣈⠶⢰⣾⡇ ⢀⣀⣄⠶⣠⣶⡆"
SPIN3="⠈⠻⠋⠀⠙⠟⠁ ⠈⠛⠁⠀⢻⠟⠁ ⠈⠋⠀⠈⣿⠟⠁ ⠈⠁⠀⢸⣿⠗⠀ ⠀⠀⠀⣾⣿⠆⠀ ⠀⠀⢠⣿⣷⠄⠀ ⠀⠀⣴⣿⣦⠀⠀ ⠀⠠⣾⣿⡄⠀⠀ ⠀⠰⣿⣷⠀⠀⠀ ⠀⠺⣿⡇⠀⠈⠁ ⠈⠻⣿⠁⠀⠙⠁ ⠈⠻⡟⠀⠈⠛⠁"
TASK_PID=""
# a size for people: 25.8 MB
human() { awk -v b="$1" 'BEGIN { if (b >= 1048576) printf "%.1f MB", b / 1048576; else printf "%d KB", b / 1024 }'; }
# A bar of `width` cells, `pct` full.
bar() { f=$(($1 * $2 / 100)); printf '%s%s%s%s%s' "$YELLOW" "$(line_of "$f" █)" "$DIM" "$(line_of $(($2 - f)) ░)" "$OFF"; }
# What failed, in a red box: what was being done, the command's last lines and what to do.
failure() {
  title=$1; log=$2; todo=$3
  say ""
  box_top "Could not finish: $title" "$RED"
  [ -s "$log" ] && tail -n 6 "$log" | while IFS= read -r l; do box_text "$l" "$RED"; done
  box_line "" "$RED"
  # a file the release does not have is not the connection's fault
  if grep -q "error: 404" "$log" 2>/dev/null; then
    todo="This file is not published for this version and system. The releases: https://github.com/$REPO/releases"
  fi
  box_text "$todo" "$RED"
  box_end "$RED"
  say ""
  exit 1
}
# A task: its title, what it does, and the command that does it, run in the background while the sign turns.
# `--file <path> <bytes>`: a download, whose bar is the file's size against the bytes expected.
task() {
  title=$1; about=$2; shift 2
  file=""; total=0
  if [ "$1" = "--file" ]; then file=$2; total=${3:-0}; shift 3; fi
  log="$tmp/task.log"; : > "$log"
  "$@" > "$log" 2>&1 &
  TASK_PID=$!
  if [ -n "$esc" ]; then
    printf '%s' "$esc[?25l" >&2
    say ""; say ""; say ""
    i=0; start=$(date +%s)
    while kill -0 "$TASK_PID" 2>/dev/null; do
      f=$((i % 12 + 1)); i=$((i + 1))
      secs=$(($(date +%s) - start))
      if [ -n "$file" ]; then
        have=0; [ -f "$file" ] && have=$(wc -c < "$file" | tr -d ' '); have=${have:-0}
        if [ "$total" -gt 0 ]; then
          pct=$((have * 100 / total)); [ "$pct" -gt 100 ] && pct=100
          detail="$(bar "$pct" 24)  ${BOLD}$pct%${OFF}  ${DIM}$(human "$have") of $(human "$total") · ${secs} s${OFF}"
        else detail="${DIM}$(human "$have") · ${secs} s${OFF}"; fi
      else
        detail="${DIM}${secs} s${OFF}"
      fi
      printf '%s' "$esc[3A$(printf '\r')" >&2
      say "$esc[2K  ${YELLOW}$(echo "$SPIN1" | cut -d ' ' -f "$f")${OFF}   ${BOLD}$title${OFF}"
      say "$esc[2K  ${YELLOW}$(echo "$SPIN2" | cut -d ' ' -f "$f")${OFF}   ${DIM}$about${OFF}"
      say "$esc[2K  ${YELLOW}$(echo "$SPIN3" | cut -d ' ' -f "$f")${OFF}   $detail"
      sleep 0.1
    done
    cr=$(printf '\r')
    printf '%s' "$esc[3A$cr$esc[2K$esc[1B$esc[2K$esc[1B$esc[2K$esc[2A$cr$esc[?25h" >&2
  else
    say "  ... $title"
  fi
  code=0; wait "$TASK_PID" || code=$?
  TASK_PID=""
  return "$code"
}
# A task that must succeed: what it is doing, what it says once done, what to do if it fails, then as `task`.
must() {
  doing=$1; done_=$2; todo=$3; shift 3
  if task "$doing" "$@"; then ok "$done_"; else failure "$doing" "$tmp/task.log" "$todo"; fi
}

# The command line of every editor of the VS Code family on this machine, one per line: on the PATH, or inside its app
# on macOS (where `code` is on the PATH only after "Shell Command: Install 'code' command in PATH").
# The name a person knows an editor by, from its command.
editor_name() {
  case $1 in
    code) echo "VS Code" ;; code-insiders) echo "VS Code Insiders" ;; cursor) echo "Cursor" ;;
    codium) echo "VSCodium" ;; windsurf) echo "Windsurf" ;; *) echo "$1" ;;
  esac
}
# One per editor (the same command found twice, on the PATH and in its app, counts once); a path may hold spaces
# ("Visual Studio Code.app"), so it is read a line at a time (`each_editor`), never split as words.
editors() {
  {
    for cli in code code-insiders cursor codium windsurf; do command -v "$cli" 2>/dev/null || true; done
    for app in "Visual Studio Code:code" "Visual Studio Code - Insiders:code-insiders" "Cursor:cursor" \
      "VSCodium:codium" "Windsurf:windsurf"; do
      for dir in /Applications "$HOME/Applications"; do
        cli="$dir/${app%%:*}.app/Contents/Resources/app/bin/${app##*:}"
        if [ -x "$cli" ]; then printf '%s\n' "$cli"; fi
      done
    done
  } | awk -F/ '!seen[$NF]++'
}

tmp=$(mktemp -d)
# Ctrl+C: the running task stops, the cursor comes back
# a step runs in the background (its spinner meanwhile) and ignores Ctrl+C there: on any exit it is stopped with every
# process under it (curl, tar), or an interrupted download would go on writing the file a new run continues
kill_tree() { for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" 2>/dev/null || true; }
LOCK=""
trap '[ -n "$TASK_PID" ] && kill_tree "$TASK_PID"; [ -n "$esc" ] && printf "%s" "$esc[?25h" >&2; rm -rf "$tmp"; [ -n "$LOCK" ] && rm -rf "$LOCK"' EXIT
trap 'say ""; say "  Stopped."; exit 130' INT TERM

UNINSTALL=0
REINSTALL=0
while [ $# -gt 0 ]; do
  case $1 in
    --version) VERSION=${2:?--version needs a value}; shift ;;
    --no-modify-path) MODIFY_PATH=0 ;;
    --no-vscode) VSCODE=0 ;;
    --no-agent) AGENT=0 ;;
    --no-ai) AI=0 ;;
    --profile) PROFILE=${2:?--profile needs a value}; shift ;;
    --uninstall) UNINSTALL=1 ;;
    --reinstall) REINSTALL=1 ;;
    -h|--help) sed -n '2,/^set -eu/p' "$0" 2>/dev/null | sed '$d' | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) say "unknown option: $1"; exit 2 ;;
  esac
  shift
done

# sudo would leave files of root in the user's folders (no sudo is needed, ADR-installer-0005); root's own install
# (a container) is allowed
if [ "$(id -u)" = 0 ] && [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != root ]; then
  say "Run the installer without sudo: it installs into your own folders and needs no administrator."; exit 2
fi
# an update (`nuclear update`) keeps the choices of the last install
if [ "${NUCLEAR_UPDATE:-}" = 1 ] && [ -f "$INSTALL/.options" ]; then
  while IFS='=' read -r k v; do
    case "$k=$v" in
      VSCODE=[01]|AGENT=[01]|MODIFY_PATH=[01]) eval "$k=$v" ;;
      BIN=/*) BIN=$v ;;
    esac
  done < "$INSTALL/.options"
fi

# --- uninstall: everything the install made, and only that (ADR-installer-0005) ---
if [ "$UNINSTALL" = 1 ]; then
  banner "UNINSTALL" "Takes away everything NuclearLang installed and made"
  section "Uninstalling"
  # the AI services first, with everything their set-up installed and made (the models it downloaded, Ollama when it
  # installed it, the graph's and the chat's data and secrets, the MCP server in each AI client)
  if [ -x "$INSTALL/ai/bin/nuclear-builder" ]; then
    task "The AI services" "The services at login, the MCP server in each AI client, the models and data the set-up made" \
      env NUCLEAR_INSTALL="$INSTALL" NUCLEAR_BIN="$BIN" NO_COLOR=1 "$INSTALL/ai/bin/nuclear-builder" setup --remove --all \
      && ok "The AI services" || warn "The AI services: $(tail -n 1 "$tmp/task.log")"
  fi
  remove_core() {
    rm -f "$BIN/nuclear-developer" "$BIN/nuclear" "$BIN/nuclear-lsp" "$BIN/nuclear-builder"
    rm -rf "$INSTALL"
    for d in $SKILL_DIRS; do rm -rf "$d/nuclear"; done
    # the compiler's cache of type definitions and the folder of the machine's choices
    rm -rf "${XDG_CACHE_HOME:-$HOME/.cache}/nuclearlang" "${XDG_CONFIG_HOME:-$HOME/.config}/nuclearlang" \
      "${XDG_STATE_HOME:-$HOME/.local/state}/nuclearlang"
    # the PATH line goes with the empty line written before it; a file left with nothing (the .profile the install
    # made) goes too, and fish's file is the install's own
    for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
      if [ -f "$rc" ] && grep -q "$MARK" "$rc"; then
        awk -v m="$MARK" 'index($0, m) { held = 0; next } { if (held) { print ""; held = 0 } } /^$/ { held = 1; next } { print } END { if (held) print "" }' "$rc" > "$rc.nuclear" && mv "$rc.nuclear" "$rc"
        if ! grep -q '[^[:space:]]' "$rc"; then rm -f "$rc"; fi
      fi
    done
    rm -f "$HOME/.config/fish/conf.d/nuclearlang.fish"
    # the folders the install made, when nothing else is in them (rmdir never removes one that holds something)
    for d in $SKILL_DIRS; do rmdir "$d" "$(dirname "$d")" 2>/dev/null || true; done
    rmdir "$BIN" "$(dirname "$INSTALL")" "${XDG_STATE_HOME:-$HOME/.local/state}" "$HOME/.local" 2>/dev/null || true
  }
  must "Removing NuclearLang" "NuclearLang removed" "Remove $(short "$INSTALL") by hand, then run the uninstaller again." \
    "The commands, the installation, the agents' skill, the caches and the PATH lines" remove_core
  editors > "$tmp/editor-list"
  # on fd 3: an editor's command that reads stdin cannot take the rest of the list
  while IFS= read -r cli <&3; do
    if task "Editor extension: $(basename "$cli")" "Taken out of the editor" "$cli" --uninstall-extension nuclearlang.nuclearlang; then
      ok "Editor extension removed from $(basename "$cli")"
    fi
  done 3< "$tmp/editor-list"
  # an editor may only mark the extension removed and delete its folder at its next start (Cursor): it goes now
  for d in .vscode .vscode-insiders .cursor .vscode-oss .windsurf; do rm -rf "$HOME/$d/extensions/nuclearlang.nuclearlang-"*; done
  say ""
  box_top "Uninstalled" "$GREEN"
  box_line "${GREEN}${BOLD}NuclearLang is uninstalled.${OFF}" "$GREEN"
  box_line "${DIM}What was on this machine before the install stays.${OFF}" "$GREEN"
  box_end "$GREEN"
  say ""
  exit 0
fi

# --- this system ---
case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=macos ;;
  MINGW*|MSYS*|CYGWIN*) say "On Windows, run in PowerShell: irm https://nuclearlang.github.io/install.ps1 | iex"; exit 1 ;;
  *) say "This system is not supported: $(uname -s) (Linux, macOS and Windows are)."; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64|amd64) arch=x86_64 ;;
  aarch64|arm64) arch=aarch64 ;;
  *) say "This processor is not supported: $(uname -m) (x86_64 and aarch64 are)."; exit 1 ;;
esac
# a Mac with Apple silicon running this shell under Rosetta still gets the native build
if [ "$os" = macos ] && [ "$arch" = x86_64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then
  arch=aarch64
fi
case $os-$arch in
  macos-aarch64) where="macOS · Apple silicon" ;; macos-x86_64) where="macOS · Intel" ;; *) where="Linux · $arch" ;;
esac

if command -v curl >/dev/null 2>&1; then
  get() { curl -fsSL --retry 3 "$1" -o "$2"; }
  # a download that goes on from what an interrupted run left (`-C -`); a file already whole is fetched again
  resume_get() { curl -fsSL --retry 3 -C - "$1" -o "$2" || { rm -f "$2"; get "$1" "$2"; }; }
  read_url() { curl -fsSL --retry 3 "$1"; }
  # the size of a file to download, for its bar (0 when the server does not say)
  size_of() { curl -fsSLI "$1" 2>/dev/null | tr -d '\r' | awk 'tolower($1) == "content-length:" { n = $2 } END { print n + 0 }'; }
elif command -v wget >/dev/null 2>&1; then
  get() { wget -q "$1" -O "$2"; }
  resume_get() { wget -q -c "$1" -O "$2" || { rm -f "$2"; get "$1" "$2"; }; }
  read_url() { wget -qO- "$1"; }
  size_of() { wget -q --spider -S "$1" 2>&1 | awk 'tolower($1) == "content-length:" { n = $2 } END { print n + 0 }'; }
else
  say "curl or wget is needed to download NuclearLang: install one of them and run this installer again."; exit 1
fi
command -v tar >/dev/null 2>&1 || { say "tar is needed to unpack NuclearLang: install it and run this installer again."; exit 1; }

# --- which release ---
if [ "$VERSION" = latest ]; then
  if [ -n "${NUCLEAR_DOWNLOAD:-}" ]; then
    VERSION=$(read_url "$NUCLEAR_DOWNLOAD/latest" | tr -d '[:space:]')
  else
    # the latest release's tag: from the redirect of /releases/latest (no API limit), else from the API
    tag=""
    if command -v curl >/dev/null 2>&1; then
      tag=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest" 2>/dev/null || true)
      case $tag in */releases/tag/*) tag=${tag##*/} ;; *) tag="" ;; esac
    fi
    [ -n "$tag" ] || tag=$(read_url "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n 1)
    VERSION=$tag
  fi
  VERSION=${VERSION#v}
  if [ -z "$VERSION" ] || [ "$VERSION" = latest ]; then
    say "Could not find the latest release of $REPO: check your connection and run the installer again."; exit 1
  fi
fi
name="nuclearlang-$VERSION-$os-$arch.tar.gz"
base=${NUCLEAR_DOWNLOAD:-https://github.com/$REPO/releases/download/v$VERSION}

banner "INSTALLER" "Version $VERSION for $where"

# --- an interrupted install goes on (the step log) ---
# Each finished step is written to the state file, the downloads are kept in the cache: a run cut short (Ctrl+C, a
# closed terminal, a lost connection) is resumed by running the installer again, from the step it reached. A run of
# another version starts anew. A finished install removes both.
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/nuclearlang"
STATE="$STATE_DIR/install.state"
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/nuclearlang/downloads"
state_get() { sed -n "s/^$1=//p" "$STATE" 2>/dev/null | tail -n 1; }
done_step() { grep -qx "step=$1" "$STATE" 2>/dev/null; }
mark() { printf 'step=%s\n' "$1" >> "$STATE"; }
remember() { printf '%s=%s\n' "$1" "$2" >> "$STATE"; }
mkdir -p "$STATE_DIR"
# one install at a time: a second one (another terminal, two updates) waits for nothing and says so
if mkdir "$STATE_DIR/install.lock" 2>/dev/null; then LOCK="$STATE_DIR/install.lock"; echo $$ > "$LOCK/pid"
elif kill -0 "$(cat "$STATE_DIR/install.lock/pid" 2>/dev/null || echo 0)" 2>/dev/null; then
  say "Another NuclearLang install is running (process $(cat "$STATE_DIR/install.lock/pid")): wait for it to end, then run this again."; exit 1
else
  # a lock of a run that died: taken over
  rm -rf "$STATE_DIR/install.lock"; mkdir "$STATE_DIR/install.lock"; LOCK="$STATE_DIR/install.lock"; echo $$ > "$LOCK/pid"
fi
if [ -f "$STATE" ] && [ "$(state_get version)" = "$VERSION" ]; then
  # the same version: what it finished and what it downloaded stay
  if ! grep -q '^step=' "$STATE"; then
    ok "Going on with the install started $(state_get started) ${DIM}(its download continues where it stopped)${OFF}"
  else
  box_top "Resuming the install started $(state_get started)" "$YELLOW"
  box_line "${DIM}An earlier run of this installer stopped before the end. What it finished stays:${OFF}" "$YELLOW"
  for st in $(sed -n 's/^step=//p' "$STATE" | tr ' ' '_'); do box_line "${GREEN}✓${OFF} $(printf '%s' "$st" | tr '_-' '  ')" "$YELLOW"; done
  box_line "${DIM}It goes on from there. A download continues where it stopped.${OFF}" "$YELLOW"
  box_end "$YELLOW"
  fi
else
  rm -rf "$CACHE"
  printf 'version=%s\nstarted=%s\n' "$VERSION" "$(date '+%Y-%m-%d %H:%M')" > "$STATE"
fi
mkdir -p "$CACHE"
# done before (a resumed run): said, not done again
again() { ok "$1 ${DIM}(done before)${OFF}"; }

# --- NuclearLang ---
section "NuclearLang $VERSION"
verify() {
  get "$2" "$1.sha256"
  want=$(cut -d ' ' -f 1 < "$1.sha256")
  if command -v sha256sum >/dev/null 2>&1; then got=$(sha256sum "$1" | cut -d ' ' -f 1)
  else got=$(shasum -a 256 "$1" | cut -d ' ' -f 1); fi
  [ "$want" = "$got" ] || { echo "the file does not match the release's checksum (SHA-256): it was damaged on the way"; exit 1; }
}
verify_or_drop() {
  if ! verify "$1" "$2"; then rm -f "$1" "$1.sha256"; sed -i.bak '/^step=downloaded$/d' "$STATE" 2>/dev/null; rm -f "$STATE.bak"; exit 1; fi
}
install_core() {
  tar -xzf "$CACHE/$name" -C "$tmp"
  # the AI services already there are kept (their running services use them; a new version of them replaces them later)
  if [ -d "$INSTALL/ai" ]; then mv "$INSTALL/ai" "$tmp/nuclearlang/ai"; fi
  rm -rf "$INSTALL"
  mkdir -p "$(dirname "$INSTALL")" "$BIN"
  mv "$tmp/nuclearlang" "$INSTALL"
  link_core
  "$BIN/nuclear" dialect list > /dev/null || { echo "the installed nuclear does not run on this system: the archive is not the one of $where (a local build linked to another C library?)"; exit 1; }
  # what a new run reads to keep it
  printf '%s\n' "$VERSION" > "$INSTALL/.version"
}
link_core() { for b in nuclear nuclear-lsp; do ln -sf "$INSTALL/bin/$b" "$BIN/$b"; done; }
# this version, already installed and running: a new run keeps it (--reinstall replaces it)
if [ "$REINSTALL" = 0 ] && [ "$(cat "$INSTALL/.version" 2>/dev/null)" = "$VERSION" ] && "$INSTALL/bin/nuclear" dialect list > /dev/null 2>&1; then
  mkdir -p "$BIN"; link_core
  ok "NuclearLang $VERSION is already installed in $(short "$INSTALL") ${DIM}(kept: nothing downloaded)${OFF}"
else
if done_step downloaded && [ -s "$CACHE/$name" ]; then again "Downloaded NuclearLang $VERSION"; else
  must "Downloading NuclearLang $VERSION" "Downloaded NuclearLang $VERSION" "Check your connection and run the installer again: the download goes on from where it stopped." \
    "The compiler, the language server and the standard library, for $where" \
    --file "$CACHE/$name" "$(size_of "$base/$name")" resume_get "$base/$name" "$CACHE/$name"
  mark downloaded
fi
if done_step verified; then again "Verified"; else
  # a damaged file is not kept: the next run downloads it anew
  must "Verifying the download" "Verified ${DIM}(SHA-256)${OFF}" "Run the installer again: the file is downloaded anew." \
    "The file is compared with the release's SHA-256, so nothing was changed on the way" verify_or_drop "$CACHE/$name" "$base/$name.sha256"
  mark verified
fi
if done_step installed && "$BIN/nuclear" dialect list > /dev/null 2>&1; then again "Installed in $(short "$INSTALL")"; else
  must "Installing" "Installed in $(short "$INSTALL")" "Check that $(short "$(dirname "$INSTALL")") can be written, then run the installer again." \
    "Unpacked, with the commands nuclear and nuclear-lsp linked in $(short "$BIN")" install_core
  mark installed
fi
fi
# the choices of this install, kept by the next update
printf 'VSCODE=%s\nAGENT=%s\nMODIFY_PATH=%s\nBIN=%s\n' "$VSCODE" "$AGENT" "$MODIFY_PATH" "$BIN" > "$INSTALL/.options"

if [ "$AGENT" = 1 ]; then
  for d in $SKILL_DIRS; do
    mkdir -p "$d" && rm -rf "$d/nuclear" && cp -R "$INSTALL/agents/skills/nuclear" "$d/"
  done
  ok "The ${BOLD}nuclear${OFF} skill for Claude Code, Codex, Cursor, Grok Build and OpenCode ${DIM}(what Nuclear is, for your agent)${OFF}"
fi

# --- the PATH ---
case ":$PATH:" in
  *":$BIN:"*) on_path=1 ;;
  *) on_path=0 ;;
esac
if [ "$on_path" = 0 ] && [ "$MODIFY_PATH" = 1 ]; then
  line="export PATH=\"$BIN:\$PATH\" $MARK"
  for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
    if [ -f "$rc" ] || [ "$rc" = "$HOME/.profile" ]; then
      grep -q "$MARK" "$rc" 2>/dev/null || printf '\n%s\n' "$line" >> "$rc"
    fi
  done
  if command -v fish >/dev/null 2>&1; then
    mkdir -p "$HOME/.config/fish/conf.d"
    echo "fish_add_path $BIN $MARK" > "$HOME/.config/fish/conf.d/nuclearlang.fish"
  fi
  ok "$(short "$BIN") in the PATH of your shells ${DIM}(a new terminal sees it)${OFF}"
fi

# --- the editors ---
if [ "$VSCODE" = 1 ] && [ -n "$(editors)" ]; then
  section "Editors"
  vsix="nuclearlang-$VERSION.vsix"
  if [ -s "$CACHE/$vsix" ] || task "Downloading the editor extension" "Syntax, diagnostics, the device, the AI panels: one extension for every editor" \
    resume_get "$base/$vsix" "$CACHE/$vsix"; then
    editors > "$tmp/editor-list"
    while IFS= read -r cli <&3; do
      ename=$(basename "$cli")
      if done_step "editor-$ename"; then again "The extension in ${BOLD}$(editor_name "$ename")${OFF}"; editor_name "$ename" >> "$tmp/editors"; continue; fi
      if task "Adding the extension to $ename" "Installed with the editor's own command" "$cli" --install-extension "$CACHE/$vsix" --force; then
        ok "The extension in ${BOLD}$(editor_name "$ename")${OFF}"; editor_name "$ename" >> "$tmp/editors"; mark "editor-$ename"
      else warn "The extension did not install in $ename: ${DIM}$cli --install-extension $base/$vsix${OFF}"; fi
    done 3< "$tmp/editor-list"
  else
    warn "The editor extension of $VERSION could not be downloaded: install it later from $base/$vsix"
  fi
fi

# --- the Smart Graph and the MCP server: required (ADR-installer-0006, ADR-installer-0003) ---
# They come in the AI archive, inside the installation, and are always installed: no question. Only the local agents
# are asked, by the set-up (a profile with Ollama's models, or `remote`: no local model, only the graph's own). A
# machine already set up keeps its profile; without a terminal the profile is `remote`. `--no-ai` (tests) skips them
# and the install ends incomplete.
MACHINE="${XDG_CONFIG_HOME:-$HOME/.config}/nuclearlang/ai.env"
[ -n "$PROFILE" ] || PROFILE=$(sed -n 's/^NUCLEAR_AI_PROFILE=//p' "$MACHINE" 2>/dev/null || true)
ai_note=""
tty=0
[ -z "${CI:-}" ] && (: < /dev/tty) 2>/dev/null && tty=1
if [ "$AI" = 0 ]; then
  ai_note="--no-ai: the Smart Graph and the MCP server, which are required, were not installed. Run the installer without it."
else
  section "The Smart Graph and the MCP server"
  if [ -z "$PROFILE" ] && [ "$tty" = 0 ]; then PROFILE=remote; fi
fi
if [ "$AI" = 1 ]; then
  # their archive: a Python of their own with the services in it, unpacked as the installation's ai/
  ai_name="nuclearlang-ai-$VERSION-$os-$arch.tar.gz"
  unpack_ai() {
    rm -rf "$INSTALL/ai"
    tar -xzf "$CACHE/$ai_name" -C "$INSTALL"
    # a Linux without glibc (Alpine, musl) runs nuclear but not the services' Python
    "$INSTALL/ai/bin/nuclear-graph" --help > /dev/null 2>&1 || { rm -rf "$INSTALL/ai"; echo "nolibc"; exit 3; }
    printf '%s\n' "$VERSION" > "$INSTALL/ai/.version"
  }
  got_ai=0
  if [ "$REINSTALL" = 0 ] && [ "$(cat "$INSTALL/ai/.version" 2>/dev/null)" = "$VERSION" ] && "$INSTALL/ai/bin/nuclear-graph" --help > /dev/null 2>&1; then
    ln -sf "$INSTALL/ai/bin/nuclear-builder" "$BIN/nuclear-builder"
    ok "The AI services of $VERSION are already here ${DIM}(kept: nothing downloaded)${OFF}"
  else
  if done_step ai-downloaded && [ -s "$CACHE/$ai_name" ]; then again "Downloaded the AI services"; got_ai=0
  else
    got_ai=0
    task "Downloading the AI services" "A Python of their own with the Smart Graph, the MCP server and the local agents" \
      --file "$CACHE/$ai_name" "$(size_of "$base/$ai_name")" resume_get "$base/$ai_name" "$CACHE/$ai_name" || got_ai=$?
    if [ "$got_ai" = 0 ]; then ok "Downloaded the AI services"; mark ai-downloaded; fi
  fi
  if [ "$got_ai" = 0 ]; then
    if done_step ai-verified; then again "Verified the AI services"; else
      must "Verifying the AI services" "Verified ${DIM}(SHA-256)${OFF}" "Run the installer again: the file is downloaded anew." \
        "The file is compared with the release's SHA-256" verify_or_drop "$CACHE/$ai_name" "$base/$ai_name.sha256"
      mark ai-verified
    fi
    if done_step ai-unpacked && "$INSTALL/ai/bin/nuclear-graph" --help > /dev/null 2>&1; then
      again "The AI services, unpacked"; ln -sf "$INSTALL/ai/bin/nuclear-builder" "$BIN/nuclear-builder"
    elif task "Unpacking the AI services" "Into the installation: nothing else is needed on this machine" unpack_ai; then
      # nuclear-builder is the archive's from now on: `nuclear-builder setup` works before the set-up ran
      ln -sf "$INSTALL/ai/bin/nuclear-builder" "$BIN/nuclear-builder"
      ok "The AI services, unpacked ${DIM}(their own Python)${OFF}"
      mark ai-unpacked
    else
      AI=0
      ai_note="The Smart Graph and the MCP server do not run on this system (their Python needs a Linux with glibc, not musl/Alpine). NuclearLang itself is installed."
    fi
  else
    AI=0
    if [ "$os-$arch" = macos-x86_64 ]; then
      # onnxruntime (the graph's model runtime) publishes no wheel for an Intel Mac: no AI archive is built for it
      ai_note="The Smart Graph and the MCP server do not run on an Intel Mac yet (their model runtime, onnxruntime, is not published for it). NuclearLang itself is installed."
    else ai_note="The Smart Graph and the MCP server of $VERSION could not be downloaded for $where: check the connection and run the installer again."; fi
  fi
  fi
fi
# the set-up is the AI archive's own nuclear-builder: it needs nothing on the machine
builder="$INSTALL/ai/bin/nuclear-builder"
# its heavy part (the knowledge base's first load, the models) at a low priority: a busy machine stays usable, the
# set-up only goes slower (spec 018 K1); best effort, never idle, so a busy disk does not stop it
gently() {
  if command -v ionice >/dev/null 2>&1; then nice -n 10 ionice -c 2 -n 7 "$@"
  elif command -v nice >/dev/null 2>&1; then nice -n 10 "$@"
  else "$@"; fi
}
if [ "$AI" = 1 ]; then
  if [ ! -x "$builder" ]; then
    ai_note="The AI archive has no set-up: run this installer again."
  elif [ -n "$PROFILE" ]; then
    section "Set-up · profile $PROFILE"
    gently env NUCLEAR_INSTALL="$INSTALL" NUCLEAR_BIN="$BIN" "$builder" setup --profile "$PROFILE" --yes >&2 \
      || ai_note="The Smart Graph and the MCP server are not fully set up: run the installer again; it goes on from the step that failed."
  elif [ "$tty" = 1 ]; then
    section "Set-up"
    gently env NUCLEAR_INSTALL="$INSTALL" NUCLEAR_BIN="$BIN" "$builder" setup < /dev/tty >&2 \
      || ai_note="The Smart Graph and the MCP server are not fully set up: run the installer again; it goes on from the step that failed."
  else
    ai_note="The Smart Graph and the MCP server are not set up: run \`nuclear-builder setup --profile remote --yes\`."
  fi
fi

# --- finished: the step log and the downloads go (a set-up that did not end keeps them, so a new run resumes it) ---
# (an incomplete install keeps them, so the next run goes on)
if [ -z "$ai_note" ]; then rm -f "$STATE"; rm -rf "$CACHE"; fi

# --- the end: nuclear's own intro (the mushroom cloud), then the summary ---
# (a release before 0.1.6 has no `intro`)
if [ -n "$esc" ] && [ "$cols" -ge 80 ] && "$BIN/nuclear" help 2>&1 | grep -q '^  intro '; then
  say ""
  "$BIN/nuclear" intro < /dev/null || true
fi
say ""
# the editors that got the extension: said big, with how to start in them
if [ -s "$tmp/editors" ]; then
  names=$(awk 'NR > 1 { printf " · " } { printf "%s", $0 }' "$tmp/editors")
  if [ "$os" = macos ]; then key=Cmd; quit="Cmd+Q"; else key=Ctrl; quit="close every window"; fi
  banner "READY" "The extension is in ${BOLD}$names${OFF}"
  box_top "Your editor" "$YELLOW"
  box_line "${BOLD}1${OFF}  Open ${BOLD}$names${OFF} ${DIM}(already open: $quit, then open it again)${OFF}" "$YELLOW"
  box_line "${BOLD}2${OFF}  The trefoil in the left bar opens ${BOLD}Nuclear: Workspace${OFF}: projects, devices, AI" "$YELLOW"
  box_line "${BOLD}3${OFF}  A new project: ${YELLOW}nuclear new my_app${OFF}, then open its folder ${DIM}(File › Open Folder)${OFF}" "$YELLOW"
  box_line "${BOLD}4${OFF}  A ${BOLD}.nuc${OFF} file gets colours, errors as you type, completion and ${BOLD}Run${OFF}" "$YELLOW"
  box_line "${BOLD}5${OFF}  The theme: ${YELLOW}$key+K $key+T${OFF} › ${BOLD}Chernobyl Soft${OFF} ${DIM}(or Chernobyl, brighter)${OFF}" "$YELLOW"
  if [ "$AI" = 1 ] && [ -z "$ai_note" ]; then
    box_line "${BOLD}6${OFF}  Your agent (Claude Code, Cursor, Codex) has the ${BOLD}nuclear${OFF} MCP server: ask it for an app" "$YELLOW"
  fi
  box_end "$YELLOW"
  say ""
fi
box_top "NuclearLang $VERSION is installed" "$GREEN"
box_line "${DIM}Command${OFF}       $(short "$BIN")/nuclear" "$GREEN"
box_line "" "$GREEN"
# what is on this machine: required, added when it can be, and each platform's toolchain (never installed here)
box_line "${BOLD}Required${OFF}" "$GREEN"
box_line "  ${GREEN}✓${OFF} NuclearLang ${DIM}the compiler, the language server, the standard library${OFF}" "$GREEN"
if [ "$AI" = 1 ] && [ -z "$ai_note" ]; then
  box_line "  ${GREEN}✓${OFF} The Smart Graph ${DIM}with its own embeddings model, started at every login${OFF}" "$GREEN"
  box_line "  ${GREEN}✓${OFF} The MCP server ${DIM}in your AI clients · nuclear-builder setup --status${OFF}" "$GREEN"
else box_line "  ${RED}✗${OFF} The Smart Graph and the MCP server ${DIM}(below)${OFF}" "$GREEN"; fi
if [ "$AGENT" = 1 ]; then box_line "  ${GREEN}✓${OFF} The nuclear skill ${DIM}for Claude Code, Codex, Cursor, Grok Build, OpenCode${OFF}" "$GREEN"; fi
box_line "${BOLD}Added when possible${OFF}" "$GREEN"
if [ -s "$tmp/editors" ]; then box_line "  ${GREEN}✓${OFF} The editor extension ${DIM}$names${OFF}" "$GREEN"
elif [ "$VSCODE" = 0 ]; then box_line "  ${DIM}○ The editor extension: not asked (--no-vscode)${OFF}" "$GREEN"
else box_line "  ${DIM}○ The editor extension: no VS Code, Cursor, VSCodium or Windsurf here; search NuclearLang in its extensions${OFF}" "$GREEN"; fi
box_line "${BOLD}Optional, asked${OFF}" "$GREEN"
chosen=$(sed -n 's/^NUCLEAR_AI_PROFILE=//p' "$MACHINE" 2>/dev/null || true)
case $chosen in
  lite|medium|hard) box_line "  ${GREEN}✓${OFF} Local agents ${DIM}profile $chosen: Ollama's models on this machine${OFF}" "$GREEN" ;;
  *) box_line "  ${DIM}○ Local agents: not chosen (remote: no local model) · nuclear-builder setup to add them${OFF}" "$GREEN" ;;
esac
box_line "${BOLD}Each platform's own${OFF} ${DIM}(only for the platforms you build; the editor guides you)${OFF}" "$GREEN"
doctor=$("$BIN/nuclear" doctor --json < /dev/null 2>/dev/null || true)
toolchain() {
  found=$(printf '%s' "$doctor" | sed -n "s/.*\"$1\":{\"found\":\"\([a-z]*\)\",\"path\":\"\([^\"]*\)\".*/\1 \2/p")
  case ${found%% *} in
    ''|missing|broken) box_line "  ${DIM}○ $2  $3: not found · $4${OFF}" "$GREEN" ;;
    *) box_line "  ${GREEN}✓${OFF} $2  ${DIM}$3 · $(short "${found#* }")${OFF}" "$GREEN" ;;
  esac
}
toolchain flutter "Flutter" "mobile" "docs.flutter.dev/get-started/install"
toolchain node "Node.js" "web, NestJS" "nodejs.org (LTS)"
toolchain python "Python " "FastAPI" "it comes with the AI services, or python.org (3.12+)"
box_line "" "$GREEN"
box_line "${BOLD}Start with${OFF}    ${YELLOW}nuclear new my_app${OFF}  ${DIM}·${OFF}  ${YELLOW}nuclear doctor${OFF}  ${DIM}·${OFF}  ${YELLOW}nuclear help${OFF}" "$GREEN"
box_line "${DIM}Docs          https://nuclearlang.github.io${OFF}" "$GREEN"
box_end "$GREEN"
if [ -n "$ai_note" ]; then
  # a required part is missing: said in red, and the installer ends with an error (NuclearLang itself stays installed)
  box_top "Not complete" "$RED"
  box_line "$ai_note" "$RED"
  box_end "$RED"
fi
if [ "$on_path" = 0 ]; then
  if [ "$MODIFY_PATH" = 1 ]; then warn "Open a new terminal ${DIM}(or run: export PATH=\"$(short "$BIN" | sed 's|^~|$HOME|'):\$PATH\")${OFF}"
  else warn "Add $BIN to your PATH: export PATH=\"$BIN:\$PATH\""; fi
fi
say ""
[ -z "$ai_note" ] || exit 1
