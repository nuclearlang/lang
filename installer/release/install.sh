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
fail() { say "error: $*"; exit 1; }
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

while [ $# -gt 0 ]; do
  case $1 in
    --version) VERSION=${2:?--version needs a value}; shift ;;
    --no-modify-path) MODIFY_PATH=0 ;;
    --no-vscode) VSCODE=0 ;;
    --no-agent) AGENT=0 ;;
    --no-ai) AI=0 ;;
    --profile) PROFILE=${2:?--profile needs a value}; shift ;;
    --uninstall)
      # the AI services first, with everything their set-up installed and made (the models it downloaded, Ollama when
      # it installed it, the graph's and the chat's data and secrets, the MCP server in each AI client)
      [ -x "$INSTALL/ai/bin/nuclear-builder" ] && NUCLEAR_INSTALL="$INSTALL" NUCLEAR_BIN="$BIN" "$INSTALL/ai/bin/nuclear-builder" setup --remove --all >&2 || true
      rm -f "$BIN/nuclear-developer"
      rm -f "$BIN/nuclear" "$BIN/nuclear-lsp" "$BIN/nuclear-builder"
      rm -rf "$INSTALL"
      for d in $SKILL_DIRS; do rm -rf "$d/nuclear"; done
      # the compiler's cache of type definitions and the folder of the machine's choices
      rm -rf "${XDG_CACHE_HOME:-$HOME/.cache}/nuclearlang" "${XDG_CONFIG_HOME:-$HOME/.config}/nuclearlang"
      for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile" "$HOME/.config/fish/conf.d/nuclearlang.fish"; do
        [ -f "$rc" ] && grep -q "$MARK" "$rc" && { grep -v "$MARK" "$rc" > "$rc.nuclear" && mv "$rc.nuclear" "$rc"; }
      done
      editors | while IFS= read -r cli; do "$cli" --uninstall-extension nuclearlang.nuclearlang >/dev/null 2>&1 || true; done
      say "NuclearLang uninstalled."
      exit 0 ;;
    -h|--help) sed -n '2,20p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) fail "unknown option: $1" ;;
  esac
  shift
done

# --- this system ---
case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=macos ;;
  MINGW*|MSYS*|CYGWIN*) fail "on Windows run in PowerShell: irm https://nuclearlang.github.io/install.ps1 | iex" ;;
  *) fail "unsupported system: $(uname -s) (Linux, macOS and Windows are)" ;;
esac
case "$(uname -m)" in
  x86_64|amd64) arch=x86_64 ;;
  aarch64|arm64) arch=aarch64 ;;
  *) fail "unsupported architecture: $(uname -m) (x86_64 and aarch64 are)" ;;
esac
# a Mac with Apple silicon running this shell under Rosetta still gets the native build
if [ "$os" = macos ] && [ "$arch" = x86_64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then
  arch=aarch64
fi

if command -v curl >/dev/null 2>&1; then
  get() { curl -fsSL --retry 3 "$1" -o "$2"; }
  read_url() { curl -fsSL --retry 3 "$1"; }
elif command -v wget >/dev/null 2>&1; then
  get() { wget -q "$1" -O "$2"; }
  read_url() { wget -qO- "$1"; }
else
  fail "curl or wget is needed"
fi
command -v tar >/dev/null 2>&1 || fail "tar is needed"

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
  [ -n "$VERSION" ] && [ "$VERSION" != latest ] || fail "could not find the latest release of $REPO"
fi
name="nuclearlang-$VERSION-$os-$arch.tar.gz"
base=${NUCLEAR_DOWNLOAD:-https://github.com/$REPO/releases/download/v$VERSION}

# --- download and check ---
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT INT TERM
say "Downloading NuclearLang $VERSION for $os $arch..."
get "$base/$name" "$tmp/$name" || fail "could not download $base/$name"
get "$base/$name.sha256" "$tmp/$name.sha256" || fail "could not download the checksum of $name"
want=$(cut -d ' ' -f 1 < "$tmp/$name.sha256")
if command -v sha256sum >/dev/null 2>&1; then got=$(sha256sum "$tmp/$name" | cut -d ' ' -f 1)
else got=$(shasum -a 256 "$tmp/$name" | cut -d ' ' -f 1); fi
[ "$want" = "$got" ] || fail "the download is damaged (SHA-256 does not match); try again"

# --- install ---
tar -xzf "$tmp/$name" -C "$tmp"
rm -rf "$INSTALL"
mkdir -p "$(dirname "$INSTALL")" "$BIN"
mv "$tmp/nuclearlang" "$INSTALL"
for b in nuclear nuclear-lsp; do ln -sf "$INSTALL/bin/$b" "$BIN/$b"; done
"$BIN/nuclear" dialect list >/dev/null || fail "the installed nuclear does not run on this system"

if [ "$AGENT" = 1 ]; then
  for d in $SKILL_DIRS; do
    mkdir -p "$d" && rm -rf "$d/nuclear" && cp -R "$INSTALL/agents/skills/nuclear" "$d/"
  done
fi

if [ "$VSCODE" = 1 ] && [ -n "$(editors)" ]; then
  vsix="nuclearlang-$VERSION.vsix"
  if get "$base/$vsix" "$tmp/$vsix" 2>/dev/null; then
    editors | while IFS= read -r cli; do
      name=$(basename "$cli")
      if "$cli" --install-extension "$tmp/$vsix" --force >/dev/null 2>&1; then say "Editor extension installed in $name."
      else say "The editor extension did not install in $name: $cli --install-extension $base/$vsix"; fi
    done
  fi
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
fi

# --- the AI services (ADR-installer-0002, ADR-installer-0003) ---
# They live inside the installation: a machine already set up gets them again for this version, with the profile it
# had. A new one is asked, in the terminal; nothing is downloaded before the user chooses.
MACHINE="${XDG_CONFIG_HOME:-$HOME/.config}/nuclearlang/ai.env"
[ -n "$PROFILE" ] || PROFILE=$(sed -n 's/^NUCLEAR_AI_PROFILE=//p' "$MACHINE" 2>/dev/null || true)
ai_note=""
tty=0
[ -z "${CI:-}" ] && (: < /dev/tty) 2>/dev/null && tty=1
if [ "$AI" = 1 ] && [ -z "$PROFILE" ]; then
  if [ "$tty" = 1 ]; then
    say ""
    printf 'The AI services: the Smart Graph (what agents know of NuclearLang), the MCP server and local agents that\nwrite code. Download them (about 160 MB)? [Y/n] ' >&2
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
  say "Downloading the AI services..."
  if get "$base/$ai_name" "$tmp/$ai_name" && get "$base/$ai_name.sha256" "$tmp/$ai_name.sha256"; then
    want=$(cut -d ' ' -f 1 < "$tmp/$ai_name.sha256")
    if command -v sha256sum >/dev/null 2>&1; then got=$(sha256sum "$tmp/$ai_name" | cut -d ' ' -f 1)
    else got=$(shasum -a 256 "$tmp/$ai_name" | cut -d ' ' -f 1); fi
    [ "$want" = "$got" ] || fail "the AI services' download is damaged (SHA-256 does not match); try again"
    rm -rf "$INSTALL/ai"
    tar -xzf "$tmp/$ai_name" -C "$INSTALL"
    # a Linux without glibc (Alpine, musl) runs nuclear but not the services' Python
    if ! "$INSTALL/ai/bin/nuclear-graph" --help >/dev/null 2>&1; then
      rm -rf "$INSTALL/ai"
      AI=0
      ai_note="The AI services do not run on this system (a Linux needs glibc); NuclearLang itself is installed."
    else
      # nuclear-builder is the archive's from now on: `nuclear-builder setup` works before the set-up ran
      ln -sf "$INSTALL/ai/bin/nuclear-builder" "$BIN/nuclear-builder"
    fi
  else
    AI=0
    ai_note="The AI services of $VERSION are not published for $os $arch."
  fi
fi
# the set-up is the AI archive's own nuclear-builder: it needs nothing on the machine
builder="$INSTALL/ai/bin/nuclear-builder"
if [ "$AI" = 1 ]; then
  if [ ! -x "$builder" ]; then
    ai_note="The AI archive has no set-up: run this installer again."
  elif [ -n "$PROFILE" ]; then
    say ""
    say "The AI services, profile $PROFILE..."
    NUCLEAR_INSTALL="$INSTALL" NUCLEAR_BIN="$BIN" "$builder" setup --profile "$PROFILE" --yes >&2 \
      || ai_note="The AI services are not set up: run \`nuclear-builder setup\`."
  elif [ "$tty" = 1 ]; then
    say ""
    say "The AI services: local agents that write the code, and the Smart Graph. You choose what is downloaded."
    NUCLEAR_INSTALL="$INSTALL" NUCLEAR_BIN="$BIN" "$builder" setup < /dev/tty >&2 \
      || ai_note="The AI services are not set up: run \`nuclear-builder setup\` when you want them."
  else
    ai_note="The AI services are not set up (no terminal here): run \`nuclear-builder setup\`."
  fi
fi

say ""
say "NuclearLang $VERSION is installed: nuclear in $BIN."
[ -z "$ai_note" ] || say "$ai_note"
if [ "$on_path" = 0 ]; then
  if [ "$MODIFY_PATH" = 1 ]; then say "Open a new terminal (or run: export PATH=\"$BIN:\$PATH\")."
  else say "Add $BIN to your PATH: export PATH=\"$BIN:\$PATH\""; fi
fi
say "Start with: nuclear help   ·   nuclear new my_app   ·   nuclear doctor"
