#!/bin/sh
# Assembles an installation of NuclearLang in <dest>, the layout the binaries expect (nuclear_dialect::Home::install):
#   bin/  dialects/<language>/  platforms/<platform>/  docs/08-guides/  kinds/  packages/  tools/defs/  agents/skills/  ai/
# from the working tree. Used by installer/install.sh (from source) and by installer/release/package.sh (the archives
# the installers download).
#
#   installer/release/stage.sh <dest> <binary>...      the binaries: nuclear, nuclear-lsp (built before)
set -eu
REPO=$(cd "$(dirname "$0")/../.." && pwd)
DEST=$1
shift
LANGUAGE="$REPO/nuclearlang"
FRAMEWORK="$REPO/nuclear-synapsis-framework"
GRAPH="$REPO/nuclear-graph-storage"
DEVELOPER="$REPO/nuclear-agents/nuclear_developer"
GENERATORS="$REPO/tools/code_generator/platforms"
MCP="$REPO/tools/mcp"

# a sealed installation is read-only (ADR-platform-0016): writable again before it is replaced
[ -d "$DEST" ] && chmod -R u+w "$DEST"
rm -rf "$DEST"
mkdir -p "$DEST/bin" "$DEST/packages"
for b in "$@"; do cp "$b" "$DEST/bin/"; done
# the dialects (each language with its frameworks, definitions and docs) and the framework's guides
cp -R "$LANGUAGE/dialects" "$DEST/dialects"
# what the code generator writes per platform (`<platform>/generators.toml`)
cp -R "$GENERATORS" "$DEST/generators"
mkdir -p "$DEST/docs"
cp -R "$FRAMEWORK/docs/08-guides" "$DEST/docs/"
for r in "$FRAMEWORK"/platforms/*/; do
  r=${r%/}
  [ -f "$r/platform.toml" ] || continue   # platforms/docs/: what is common to the three, not a platform
  name=$(basename "$r")
  # the platform's contract, its reference and guides, its kind packages
  mkdir -p "$DEST/platforms/$name/docs"
  cp "$r/platform.toml" "$DEST/platforms/$name/"
  for d in 07-reference 08-guides; do
    if [ -d "$r/docs/$d" ]; then cp -R "$r/docs/$d" "$DEST/platforms/$name/docs/"; fi
  done
  # the validated examples, their Nuclear only (`nuclear help example/<name>`: what an agent copies the style of)
  if [ -d "$r/examples" ]; then
    (cd "$r/examples" && find . \( -name build -o -name expected -o -name node_modules -o -name .dart_tool -o -name .nuclear \) -prune \
      -o \( -name '*.nuc' -o -name nuclear.toml \) -type f -print) | while read -r f; do
      mkdir -p "$DEST/platforms/$name/examples/$(dirname "$f")"
      cp "$r/examples/$f" "$DEST/platforms/$name/examples/$f"
    done
  fi
  if [ -d "$r/kinds" ]; then mkdir -p "$DEST/kinds"; cp -R "$r/kinds/." "$DEST/kinds/"; fi
  # the runtimes: every package, as it is (a built JavaScript package needs its dist/)
  for p in "$r"/packages/*; do
    [ -d "$p" ] || continue
    if [ -f "$p/package.json" ] && grep -q '"main": *"dist/' "$p/package.json" && [ ! -d "$p/dist" ]; then
      echo "error: $p is not built (npm run build there)" >&2
      exit 1
    fi
    cp -R "$p" "$DEST/packages/"
  done
done
# what a build or a test leaves inside a package is never part of an installation (a stale build/ would also make
# pip reuse an old wheel)
find "$DEST/packages" -depth \( -name build -o -name .dart_tool -o -name node_modules -o -name __pycache__ \
  -o -name .pytest_cache -o -name '*.egg-info' -o -name dist-test \) -type d -exec rm -rf {} +
find "$DEST/packages" -name pubspec.lock -type f -exec rm -f {} +
# the definitions generator `nuclear flutter add` runs (its `dart pub get` happens on first use)
mkdir -p "$DEST/tools/defs"
for f in bin pubspec.yaml pubspec.lock python typescript; do
  if [ -e "$LANGUAGE/tools/defs/$f" ]; then cp -R "$LANGUAGE/tools/defs/$f" "$DEST/tools/defs/"; fi
done
# the skill AI agents read (install.sh and the installers copy it into the agents' folders)
mkdir -p "$DEST/agents"
cp -R "$REPO/tools/cli/agent-files/skills" "$DEST/agents/"
# the AI services (ADR-installer-0002): the code of the Smart Graph with its knowledge base, and of the Nuclear Developer. Their
# set-up (nuclear-builder setup, the editor) makes the environments and starts them. The Developer's code travels but is
# never built nor started while the local models are on standby (ADR-platform-0013): Nuclear Builder's `aiRoot` finds
# the services' folder by its config.nuc.
if [ -f "$GRAPH/pyproject.toml" ] && [ -f "$DEVELOPER/config.nuc" ]; then
  # the same folders as in the working tree (the Developer names the graph by a relative path)
  G="$DEST/ai/nuclear-graph-storage"
  D="$DEST/ai/nuclear-agents/nuclear_developer"
  mkdir -p "$G" "$D"
  # the graph is written in Nuclear: its sources travel, and its set-up builds them (`nuclear build`) before installing
  for f in pyproject.toml nuclear.toml README.md data; do cp -R "$GRAPH/$f" "$G/"; done
  # the roles of the software factory: their skills are the graph's prompts (its package carries them)
  cp -R "$REPO/nuclear-agents/roles" "$DEST/ai/nuclear-agents/"
  # the library of skills and agents beside them (spec 011 requirement 34): what a team attaches and clones
  cp -R "$REPO/nuclear-agents/skills" "$REPO/nuclear-agents/agents" "$DEST/ai/nuclear-agents/"
  # what building and testing the roles leaves (their Python build, the project's card, pytest's cache) does not travel
  rm -rf "$DEST/ai/nuclear-agents/roles/build" "$DEST/ai/nuclear-agents/roles/.nuclear" "$DEST/ai/nuclear-agents/roles/.pytest_cache"
  cp "$GRAPH"/*.nuc "$REPO/LICENSE" "$G/"
  for f in config.nuc components config defs README.md; do cp -R "$DEVELOPER/$f" "$D/"; done
  cp "$REPO/LICENSE" "$D/"
  # the MCP server, a project of its own that names the graph by a relative path (../../nuclear-graph-storage)
  M="$DEST/ai/tools/mcp"
  mkdir -p "$M"
  for f in pyproject.toml nuclear.toml defs tests; do cp -R "$MCP/$f" "$M/"; done
  cp "$MCP"/*.nuc "$REPO/LICENSE" "$M/"
  find "$DEST/ai" -name __pycache__ -type d -exec rm -rf {} +
fi
# nothing installed names this working tree or the home of the machine that staged it (root rule 14, spec 016): an
# agent on the user's machine could not follow it. The binaries are left out (their debug paths are not read).
LEAKS=$(grep -rIlF -e "$REPO" -e "${HOME:-/nonexistent}/" "$DEST" --exclude-dir=bin 2>/dev/null || true)
if [ -n "$LEAKS" ]; then
  echo "error: these staged files name $REPO or $HOME (write a topic name or a relative path instead):" >&2
  echo "$LEAKS" >&2
  exit 1
fi
