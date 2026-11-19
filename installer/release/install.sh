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
# terminal, the AI services: their archive (a Python of their own with the Smart Graph, the MCP server and the Nuclear
# Developer, about 160 MB; nothing is needed on the machine) and their set-up (`nuclear-builder setup`: it reads this
# machine, suggests a profile and asks before anything else is downloaded). A machine already set up gets them again
# for the new version, without questions.
#
# Options (or environment): --version <v> (NUCLEAR_VERSION, default: the latest), --no-modify-path
# (NUCLEAR_NO_MODIFY_PATH=1), --no-vscode, --no-agent, --no-ai, --profile remote|lite|medium|hard (NUCLEAR_AI_PROFILE:
# that profile, no questions), --uninstall (everything the install made: the AI services' models, Ollama when it
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
case ${cols:-} in ''|*[!0-9]*) cols=80 ;; esac
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
    A) echo ".##. #..# #### #..# #..#" ;; E) echo "#### #... ###. #... ####" ;; I) echo "#### .##. .##. .##. ####" ;;
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
editors() {
  for cli in code code-insiders cursor codium windsurf; do command -v "$cli" 2>/dev/null; done
  for app in "Visual Studio Code:code" "Visual Studio Code - Insiders:code-insiders" "Cursor:cursor" \
    "VSCodium:codium" "Windsurf:windsurf"; do
    for dir in /Applications "$HOME/Applications"; do
      cli="$dir/${app%%:*}.app/Contents/Resources/app/bin/${app##*:}"
      [ -x "$cli" ] && printf '%s\n' "$cli"
    done
  done | awk -F/ '!seen[$NF]++'
}

tmp=$(mktemp -d)
# Ctrl+C: the running task stops, the cursor comes back
trap '[ -n "$TASK_PID" ] && kill "$TASK_PID" 2>/dev/null; [ -n "$esc" ] && printf "%s" "$esc[?25h" >&2; rm -rf "$tmp"' EXIT
trap 'say ""; say "  Stopped."; exit 130' INT TERM

UNINSTALL=0
while [ $# -gt 0 ]; do
  case $1 in
    --version) VERSION=${2:?--version needs a value}; shift ;;
    --no-modify-path) MODIFY_PATH=0 ;;
    --no-vscode) VSCODE=0 ;;
    --no-agent) AGENT=0 ;;
    --no-ai) AI=0 ;;
    --profile) PROFILE=${2:?--profile needs a value}; shift ;;
    --uninstall) UNINSTALL=1 ;;
    -h|--help) sed -n '2,22p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) say "unknown option: $1"; exit 2 ;;
  esac
  shift
done

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
    rm -rf "${XDG_CACHE_HOME:-$HOME/.cache}/nuclearlang" "${XDG_CONFIG_HOME:-$HOME/.config}/nuclearlang"
    for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile" "$HOME/.config/fish/conf.d/nuclearlang.fish"; do
      if [ -f "$rc" ] && grep -q "$MARK" "$rc"; then grep -v "$MARK" "$rc" > "$rc.nuclear" && mv "$rc.nuclear" "$rc"; fi
    done
  }
  must "Removing NuclearLang" "NuclearLang removed" "Remove $(short "$INSTALL") by hand, then run the uninstaller again." \
    "The commands, the installation, the agents' skill, the caches and the PATH lines" remove_core
  for cli in $(editors); do
    if task "Editor extension: $(basename "$cli")" "Taken out of the editor" "$cli" --uninstall-extension nuclearlang.nuclearlang; then
      ok "Editor extension removed from $(basename "$cli")"
    fi
  done
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
  read_url() { curl -fsSL --retry 3 "$1"; }
  # the size of a file to download, for its bar (0 when the server does not say)
  size_of() { curl -fsSLI "$1" 2>/dev/null | tr -d '\r' | awk 'tolower($1) == "content-length:" { n = $2 } END { print n + 0 }'; }
elif command -v wget >/dev/null 2>&1; then
  get() { wget -q "$1" -O "$2"; }
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

# --- NuclearLang ---
section "NuclearLang $VERSION"
verify() {
  get "$2" "$1.sha256"
  want=$(cut -d ' ' -f 1 < "$1.sha256")
  if command -v sha256sum >/dev/null 2>&1; then got=$(sha256sum "$1" | cut -d ' ' -f 1)
  else got=$(shasum -a 256 "$1" | cut -d ' ' -f 1); fi
  [ "$want" = "$got" ] || { echo "the file does not match the release's checksum (SHA-256): it was damaged on the way"; exit 1; }
}
install_core() {
  tar -xzf "$tmp/$name" -C "$tmp"
  rm -rf "$INSTALL"
  mkdir -p "$(dirname "$INSTALL")" "$BIN"
  mv "$tmp/nuclearlang" "$INSTALL"
  for b in nuclear nuclear-lsp; do ln -sf "$INSTALL/bin/$b" "$BIN/$b"; done
  "$BIN/nuclear" dialect list > /dev/null || { echo "the installed nuclear does not run on this system"; exit 1; }
}
must "Downloading NuclearLang $VERSION" "Downloaded NuclearLang $VERSION" "Check your connection and run the installer again; it starts from the beginning." \
  "The compiler, the language server and the standard library, for $where" \
  --file "$tmp/$name" "$(size_of "$base/$name")" get "$base/$name" "$tmp/$name"
must "Verifying the download" "Verified ${DIM}(SHA-256)${OFF}" "Run the installer again: the file is downloaded anew." \
  "The file is compared with the release's SHA-256, so nothing was changed on the way" verify "$tmp/$name" "$base/$name.sha256"
must "Installing" "Installed in $(short "$INSTALL")" "Check that $(short "$(dirname "$INSTALL")") can be written, then run the installer again." \
  "Unpacked, with the commands nuclear and nuclear-lsp linked in $(short "$BIN")" install_core

if [ "$AGENT" = 1 ]; then
  for d in $SKILL_DIRS; do
    mkdir -p "$d" && rm -rf "$d/nuclear" && cp -R "$INSTALL/agents/skills/nuclear" "$d/"
  done
  ok "The ${BOLD}nuclear${OFF} skill for Claude Code, Codex, Cursor and OpenCode ${DIM}(what Nuclear is, for your agent)${OFF}"
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
  if task "Downloading the editor extension" "Syntax, diagnostics, the device, the AI panels: one extension for every editor" \
    get "$base/$vsix" "$tmp/$vsix"; then
    for cli in $(editors); do
      ename=$(basename "$cli")
      if task "Adding the extension to $ename" "Installed with the editor's own command" "$cli" --install-extension "$tmp/$vsix" --force; then
        ok "The extension in ${BOLD}$ename${OFF}"; printf '%s ' "$ename" >> "$tmp/editors"
      else warn "The extension did not install in $ename: ${DIM}$cli --install-extension $base/$vsix${OFF}"; fi
    done
  else
    warn "The editor extension of $VERSION could not be downloaded: install it later from $base/$vsix"
  fi
fi

# --- the AI services (ADR-installer-0002, ADR-installer-0003) ---
# They live inside the installation: a machine already set up gets them again for this version, with the profile it
# had. A new one is asked, in the terminal; nothing is downloaded before the user chooses.
MACHINE="${XDG_CONFIG_HOME:-$HOME/.config}/nuclearlang/ai.env"
[ -n "$PROFILE" ] || PROFILE=$(sed -n 's/^NUCLEAR_AI_PROFILE=//p' "$MACHINE" 2>/dev/null || true)
ai_note=""
tty=0
[ -z "${CI:-}" ] && (: < /dev/tty) 2>/dev/null && tty=1
if [ "$AI" = 1 ]; then section "The AI services"; fi
if [ "$AI" = 1 ] && [ -z "$PROFILE" ]; then
  if [ "$tty" = 1 ]; then
    box_top "What they are"
    box_line "${BOLD}The Smart Graph${OFF}  what agents know of NuclearLang, searched by meaning"
    box_line "${BOLD}The MCP server${OFF}   the generators, the compiler and the graph, for agents"
    box_line "${BOLD}Local agents${OFF}     optional: small models on this machine that write code"
    box_line ""
    box_line "${DIM}About 160 MB now. The set-up then asks before any model is downloaded.${OFF}"
    box_end
    printf '\n  %sDownload them?%s %s[Y/n]%s ' "$BOLD" "$OFF" "$YELLOW" "$OFF" >&2
    read -r answer < /dev/tty || answer=n
    case $answer in [nN]*) AI=0; ai_note="The AI services are not installed: run this installer again when you want them." ;; esac
  else
    AI=0
    ai_note="The AI services are not installed (no terminal here): run this installer in a terminal, or with --profile."
  fi
fi
if [ "$AI" = 1 ]; then
  # their archive: a Python of their own with the services in it, unpacked as the installation's ai/
  ai_name="nuclearlang-ai-$VERSION-$os-$arch.tar.gz"
  unpack_ai() {
    rm -rf "$INSTALL/ai"
    tar -xzf "$tmp/$ai_name" -C "$INSTALL"
    # a Linux without glibc (Alpine, musl) runs nuclear but not the services' Python
    "$INSTALL/ai/bin/nuclear-graph" --help > /dev/null 2>&1 || { rm -rf "$INSTALL/ai"; echo "nolibc"; exit 3; }
  }
  if task "Downloading the AI services" "A Python of their own with the Smart Graph, the MCP server and the local agents" \
    --file "$tmp/$ai_name" "$(size_of "$base/$ai_name")" get "$base/$ai_name" "$tmp/$ai_name"; then
    ok "Downloaded the AI services"
    must "Verifying the AI services" "Verified ${DIM}(SHA-256)${OFF}" "Run the installer again: the file is downloaded anew." \
      "The file is compared with the release's SHA-256" verify "$tmp/$ai_name" "$base/$ai_name.sha256"
    if task "Unpacking the AI services" "Into the installation: nothing else is needed on this machine" unpack_ai; then
      # nuclear-builder is the archive's from now on: `nuclear-builder setup` works before the set-up ran
      ln -sf "$INSTALL/ai/bin/nuclear-builder" "$BIN/nuclear-builder"
      ok "The AI services, unpacked ${DIM}(their own Python)${OFF}"
    else
      AI=0
      ai_note="The AI services do not run on this system (a Linux needs glibc); NuclearLang itself is installed."
    fi
  else
    AI=0
    ai_note="The AI services of $VERSION are not published for $where."
  fi
fi
# the set-up is the AI archive's own nuclear-builder: it needs nothing on the machine
builder="$INSTALL/ai/bin/nuclear-builder"
if [ "$AI" = 1 ]; then
  if [ ! -x "$builder" ]; then
    ai_note="The AI archive has no set-up: run this installer again."
  elif [ -n "$PROFILE" ]; then
    section "Set-up · profile $PROFILE"
    NUCLEAR_INSTALL="$INSTALL" NUCLEAR_BIN="$BIN" "$builder" setup --profile "$PROFILE" --yes >&2 \
      || ai_note="The AI services are not fully set up: run \`nuclear-builder setup\`; it goes on from the step that failed."
  elif [ "$tty" = 1 ]; then
    section "Set-up"
    NUCLEAR_INSTALL="$INSTALL" NUCLEAR_BIN="$BIN" "$builder" setup < /dev/tty >&2 \
      || ai_note="The AI services are not fully set up: run \`nuclear-builder setup\`; it goes on from the step that failed."
  else
    ai_note="The AI services are not set up (no terminal here): run \`nuclear-builder setup\`."
  fi
fi

# --- the end: nuclear's own intro (the mushroom cloud), then the summary ---
# (a release before 0.1.6 has no `intro`)
if [ -n "$esc" ] && [ "$cols" -ge 80 ] && "$BIN/nuclear" help 2>&1 | grep -q '^  intro '; then
  say ""
  "$BIN/nuclear" intro < /dev/null || true
fi
say ""
box_top "NuclearLang $VERSION is installed" "$GREEN"
box_line "${DIM}Command${OFF}       $(short "$BIN")/nuclear" "$GREEN"
[ -s "$tmp/editors" ] && box_line "${DIM}Editors${OFF}       $(cat "$tmp/editors")" "$GREEN"
if [ "$AI" = 1 ] && [ -z "$ai_note" ]; then box_line "${DIM}AI services${OFF}   running ${DIM}· nuclear-builder setup --status${OFF}" "$GREEN"; fi
box_line "" "$GREEN"
box_line "${BOLD}Start with${OFF}    ${YELLOW}nuclear new my_app${OFF}  ${DIM}·${OFF}  ${YELLOW}nuclear doctor${OFF}  ${DIM}·${OFF}  ${YELLOW}nuclear help${OFF}" "$GREEN"
box_line "${DIM}Docs          https://nuclearlang.github.io${OFF}" "$GREEN"
box_end "$GREEN"
[ -z "$ai_note" ] || warn "$ai_note"
if [ "$on_path" = 0 ]; then
  if [ "$MODIFY_PATH" = 1 ]; then warn "Open a new terminal ${DIM}(or run: export PATH=\"$(short "$BIN" | sed 's|^~|$HOME|'):\$PATH\")${OFF}"
  else warn "Add $BIN to your PATH: export PATH=\"$BIN:\$PATH\""; fi
fi
say ""
