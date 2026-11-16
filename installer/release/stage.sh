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
VSCODE="$REPO/extensions/vscode"
GRAPH="$REPO/nuclear-graph-storage"
DEVELOPER="$REPO/nuclear-agents/nuclear_developer"
GENERATORS="$REPO/tools/code_generator/platforms"
MCP="$REPO/tools/mcp"

rm -rf "$DEST"
mkdir -p "$DEST/bin" "$DEST/packages"
for b in "$@"; do cp "$b" "$DEST/bin/"; done
# nuclear-builder (ADR-platform-0003): the Builder engine bundled for node by the VS Code extension (`npm run builder`)
if [ -f "$VSCODE/out/nuclear-builder.js" ]; then
  cp "$VSCODE/out/nuclear-builder.js" "$DEST/bin/"
  printf '#!/bin/sh\nexec node "$(dirname "$(readlink -f "$0")")/nuclear-builder.js" "$@"\n' > "$DEST/bin/nuclear-builder"
  chmod +x "$DEST/bin/nuclear-builder"
  printf '@node "%%~dp0nuclear-builder.js" %%*\r\n' > "$DEST/bin/nuclear-builder.cmd"
fi
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
# set-up (nuclear-builder setup, the editor) makes the environments, downloads the models and starts them.
if [ -f "$GRAPH/pyproject.toml" ] && [ -f "$DEVELOPER/config.nuc" ]; then
  # the same folders as in the working tree (the Developer names the graph by a relative path)
  G="$DEST/ai/nuclear-graph-storage"
  D="$DEST/ai/nuclear-agents/nuclear_developer"
  mkdir -p "$G" "$D"
  # the graph is written in Nuclear: its sources travel, and its set-up builds them (`nuclear build`) before installing
  for f in pyproject.toml nuclear.toml README.md prompts data; do cp -R "$GRAPH/$f" "$G/"; done
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
