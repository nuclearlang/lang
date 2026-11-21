#!/usr/bin/env sh
# Installs NuclearLang from this repository: the `nuclear` command with its dialects, type
# definitions, specs and the Synapsis runtime packages, the language server (nuclear-lsp, used by Zed), `nuclear-builder` (the
# Builder without the editor, ADR-platform-0003, with the set-up of the AI services: needs uv from source), plus the VS Code extension (which bundles its own copy of the LSP) and the Zed
# extension. With --ai also the AI services, step by step (ADR-installer-0002): the Smart Graph and Nuclear Chat, profile
# remote (the local models, Ollama and the Nuclear Developer are on standby, ADR-platform-0013: an earlier set-up's are
# taken away).
#
#   installer/install.sh                  install into ~/.local (PREFIX=/usr/local for another prefix)
#   installer/install.sh --no-vscode      without the VS Code extension
#   installer/install.sh --no-zed         without the Zed extension
#   installer/install.sh --no-agent       without the `nuclear` skill for AI agents
#   installer/install.sh --ai             then `nuclear-builder setup --profile remote --yes`: the services at every login
#   installer/install.sh --ai-runtime     the AI services as a release brings them (ADR-installer-0003): a Python of their own
#                                         built from this tree (installer/release/ai-runtime.sh, needs uv), then the set-up;
#                                         without it they are this tree's folders, the graph installed editable
#   installer/install.sh --uninstall      remove what an install created
#
# Layout: $PREFIX/share/nuclearlang/{bin,dialects,platforms,docs,packages/{synapsis,synapsis_genkit,synapsis-py,synapsis-nest,synapsis-web},tools/defs} (release/stage.sh) and links in $PREFIX/bin.
# Definitions generated for projects go to ~/.cache/nuclearlang/defs (kept by --uninstall).
# The binaries find their files from their own location (nuclear_dialect::install_dir).
set -eu

PREFIX=${PREFIX:-$HOME/.local}
HOME_DIR=$PREFIX/share/nuclearlang
BIN_DIR=$PREFIX/bin
REPO=$(cd "$(dirname "$0")/.." && pwd)
VSCODE=1
ZED=1
AGENT=1
AI=0
RUNTIME=0
# where agents look for skills: Claude Code (also read by Cursor and OpenCode), the open .agents folder (Codex,
# Cursor, OpenCode) and Codex's own
SKILL_DIRS="$HOME/.claude/skills $HOME/.agents/skills $HOME/.codex/skills"

for arg in "$@"; do
  case $arg in
    --no-vscode) VSCODE=0 ;;
    --no-zed) ZED=0 ;;
    --no-agent) AGENT=0 ;;
    --ai) AI=1 ;;
    --ai-runtime) AI=1; RUNTIME=1 ;;
    --uninstall)
      # the AI services first (what starts them at login, the graph's tool): their set-up takes them away
      [ -x "$BIN_DIR/nuclear-builder" ] && NUCLEAR_INSTALL="$HOME_DIR" NUCLEAR_BIN="$BIN_DIR" "$BIN_DIR/nuclear-builder" setup --remove >/dev/null 2>&1 || true
      command -v uv >/dev/null 2>&1 && uv tool uninstall nuclear-builder >/dev/null 2>&1 || true
      command -v uv >/dev/null 2>&1 && uv tool uninstall nuclear-chat-system >/dev/null 2>&1 || true
      rm -f "$BIN_DIR/nuclear" "$BIN_DIR/nuclear-lsp" "$BIN_DIR/nuclear-builder" "$BIN_DIR/nuclear-developer" "$BIN_DIR/nuclear-chat"
      command -v uv >/dev/null 2>&1 && { uv tool uninstall nuclear-graph; uv tool uninstall nuclear-mcp; } >/dev/null 2>&1 || true
      rm -rf "${XDG_DATA_HOME:-$HOME/.local/share}/zed/extensions/installed/nuclearlang"
      rm -rf "$HOME_DIR"
      for d in $SKILL_DIRS; do rm -rf "$d/nuclear"; done
      rm -rf "${XDG_STATE_HOME:-$HOME/.local/state}/synapsis"   # the intro shows again on the next install
      command -v code >/dev/null 2>&1 && code --uninstall-extension nuclearlang.nuclearlang >/dev/null 2>&1 || true
      echo "NuclearLang uninstalled from $PREFIX"
      exit 0 ;;
    -h|--help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

command -v cargo >/dev/null 2>&1 || { echo "cargo is required: https://rustup.rs" >&2; exit 1; }

echo "building nuclear (release)..."
cargo build --release --quiet --manifest-path "$REPO/Cargo.toml" -p nuclear-cli -p nuclear-lsp

echo "installing into $HOME_DIR"
mkdir -p "$BIN_DIR"
EXE=""
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) EXE=".exe" ;; esac
"$REPO/installer/release/stage.sh" "$HOME_DIR" "$REPO/target/release/nuclear$EXE" "$REPO/target/release/nuclear-lsp$EXE"
ln -sf "$HOME_DIR/bin/nuclear" "$BIN_DIR/nuclear"
ln -sf "$HOME_DIR/bin/nuclear-lsp" "$BIN_DIR/nuclear-lsp"

# from source the AI services are the working tree's own folders (stage.sh copied them): their set-up installs the
# graph editable (the Developer is on standby: not built); the set-up itself (Nuclear, the python dialect) is this tree's
# extensions/tools/nuclear-builder, installed editable with uv (its line runs the software factory, in Nuclear too)
BUILDER="$BIN_DIR/nuclear-builder"
if [ "$RUNTIME" = 1 ]; then
  echo "building the AI runtime (installer/release/ai-runtime.sh)..."
  NUCLEAR="$HOME_DIR/bin/nuclear$EXE" AI_STAGE="$HOME_DIR/ai" "$REPO/installer/release/ai-runtime.sh" >/dev/null
  BUILDER="$HOME_DIR/ai/bin/nuclear-builder"
else
  if [ -d "$HOME_DIR/ai" ]; then
    for d in nuclear-graph-storage nuclear-agents tools; do
      rm -rf "$HOME_DIR/ai/$d" && ln -s "$REPO/$d" "$HOME_DIR/ai/$d"
    done
  fi
  if command -v uv >/dev/null 2>&1; then
    "$HOME_DIR/bin/nuclear$EXE" build "$REPO/extensions/tools/nuclear-builder" >/dev/null
    UV_TOOL_BIN_DIR="$BIN_DIR" uv tool install --quiet --force --editable "$REPO/extensions/tools/nuclear-builder"
    # `nuclear-chat`: Nuclear Chat's command (the GIF services' keys in the keyring, the pack); its service is not
    # installed until Synapsis guards its routes (spec 014, nuclear-chat/docs/01-product/roadmap.md)
    "$HOME_DIR/bin/nuclear$EXE" build "$REPO/nuclear-chat/system" >/dev/null
    UV_TOOL_BIN_DIR="$BIN_DIR" uv tool install --quiet --force --editable "$REPO/nuclear-chat/system"
  else
    echo "note: without uv the set-up of the AI services (nuclear-builder setup) is not installed: https://docs.astral.sh/uv/"
  fi
fi

if [ "$AI" = 1 ]; then
  if ! "$BUILDER" --help >/dev/null 2>&1; then
    echo "note: --ai needs the set-up (uv, or --ai-runtime); the AI services skipped"
  else
    NUCLEAR_INSTALL="$HOME_DIR" NUCLEAR_BIN="$BIN_DIR" "$BUILDER" setup --profile remote --yes \
      || echo "note: the AI services are not set up; when you want them: nuclear-builder setup --profile remote --yes"
  fi
fi

if [ "$AGENT" = 1 ]; then
  for d in $SKILL_DIRS; do
    rm -rf "$d/nuclear"
    mkdir -p "$d"
    cp -R "$HOME_DIR/agents/skills/nuclear" "$d/"
  done
  echo "skill 'nuclear' for AI agents in: $SKILL_DIRS (per project: nuclear agent init)"
fi

if [ "$VSCODE" = 1 ]; then
  VSIX=$(ls "$REPO"/extensions/vscode/nuclearlang-*.vsix 2>/dev/null | sort -V | tail -n 1)
  if ! command -v code >/dev/null 2>&1; then
    echo "note: 'code' is not in the PATH; VS Code extension skipped"
  elif [ -z "$VSIX" ]; then
    echo "note: no .vsix in extensions/vscode (npm run package there); VS Code extension skipped"
  else
    # a package older than the extension's version is never installed: it would put back an older extension over a
    # newer one (the published one, an update) without anybody seeing it
    WANT=$(sed -n 's/^  "version": "\(.*\)",$/\1/p' "$REPO/extensions/vscode/package.json")
    if [ "$(basename "$VSIX")" = "nuclearlang-$WANT.vsix" ]; then
      code --install-extension "$VSIX" --force >/dev/null && echo "VS Code extension: $(basename "$VSIX")"
    else
      echo "note: the extension is $WANT but its newest package is $(basename "$VSIX"): not installed (npm run package in extensions/vscode, then install again)"
    fi
  fi
fi

if [ "$ZED" = 1 ]; then
  if ! command -v zed >/dev/null 2>&1 && ! command -v zeditor >/dev/null 2>&1; then
    echo "note: Zed is not installed; Zed extension skipped"
  elif ! rustup target list --installed 2>/dev/null | grep -q wasm32-wasip2; then
    echo "note: the Zed extension needs 'rustup target add wasm32-wasip2'; skipped"
  else
    "$REPO/extensions/zed/build.sh" >/dev/null && echo "Zed extension: nuclearlang"
  fi
fi

"$BIN_DIR/nuclear" dialect list >/dev/null || { echo "error: the installed nuclear does not find its dialects" >&2; exit 1; }
echo "done: nuclear in $BIN_DIR"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "add $BIN_DIR to your PATH: export PATH=\"$BIN_DIR:\$PATH\"" ;;
esac
echo "Mobile apps (flutter dialect) need Flutter: set FLUTTER or FLUTTER_ROOT if it is not in the PATH"
