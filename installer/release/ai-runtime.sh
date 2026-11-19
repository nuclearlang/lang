#!/bin/sh
# The AI archive of NuclearLang for this machine (ADR-installer-0003): a Python of its own with the Smart Graph, the MCP
# server, the Nuclear Developer, Nuclear Builder's set-up and Nuclear Chat's command installed in it, their launchers, and the knowledge base. Unpacked at
# <installation>/ai/, it needs nothing on the user's machine: no Python, no uv.
#   installer/dist/nuclearlang-ai-<version>-<os>-<arch>.tar.gz   (.zip on Windows)   and its .sha256
#
#   installer/release/ai-runtime.sh                 builds it, then tries it (the launchers, the graph's health)
#   NUCLEAR=<path to nuclear> installer/release/ai-runtime.sh     a nuclear other than the one on the PATH
#   AI_STAGE=<folder> installer/release/ai-runtime.sh             only stages it there (installer/install.sh --ai)
#
# It builds for the machine it runs on (the release runs it on a runner of each system). It needs uv and nuclear; the
# services' code is what `nuclear build` writes from their .nuc, the packages are installed from the graph's uv.lock.
set -eu
REPO=$(cd "$(dirname "$0")/../.." && pwd)
VERSION=$(sed -n 's/^version = "\(.*\)"/\1/p' "$REPO/Cargo.toml" | head -n 1)
NUCLEAR=${NUCLEAR:-nuclear}
# the Python of the services: the newest every package of theirs publishes wheels for, on every system
PYTHON_VERSION=3.13
GRAPH="$REPO/nuclear-graph-storage"
MCP="$REPO/tools/mcp"
DEVELOPER="$REPO/nuclear-agents/nuclear_developer"
RUNTIME="$REPO/nuclear-synapsis-framework/platforms/backend/packages/synapsis-py"
BUILDER="$REPO/extensions/tools/nuclear-builder"
CHAT="$REPO/nuclear-chat/system"
CHAT_SERVICE="$REPO/nuclear-chat/nuclear_chat"

case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=macos ;;
  MINGW*|MSYS*|CYGWIN*) os=windows ;;
  *) echo "ai-runtime: unknown system $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64|amd64) arch=x86_64 ;;
  aarch64|arm64) arch=aarch64 ;;
  *) echo "ai-runtime: unknown architecture $(uname -m)" >&2; exit 1 ;;
esac
command -v uv >/dev/null 2>&1 || { echo "ai-runtime: needs uv (https://docs.astral.sh/uv/)" >&2; exit 1; }

name="nuclearlang-ai-$VERSION-$os-$arch"
dist="$REPO/installer/dist"
work="$dist/$name"
AI=${AI_STAGE:-$work/ai}
rm -rf "$work" "$AI"
mkdir -p "$AI/bin" "$work/tmp"

# 1. the Python: python-build-standalone (relocatable, no system Python), as uv installs it
uv python install --quiet --install-dir "$work/tmp/python" "$PYTHON_VERSION"
src=$(find "$work/tmp/python" -mindepth 1 -maxdepth 1 -type d -name 'cpython-*' | head -n 1)
[ -n "$src" ] || { echo "ai-runtime: uv installed no Python" >&2; exit 1; }
cp -R "$src" "$AI/python"
if [ "$os" = windows ]; then PY="$AI/python/python.exe"; else PY="$AI/python/bin/python3"; fi
# it is ours alone: packages go into it (python-build-standalone marks itself as managed by the system)
find "$AI/python" -name EXTERNALLY-MANAGED -delete

# 2. the services' code, from their .nuc
"$NUCLEAR" build "$GRAPH" >/dev/null 2>&1
"$NUCLEAR" build "$MCP" >/dev/null 2>&1
(cd "$DEVELOPER" && "$NUCLEAR" build >/dev/null 2>&1)
"$NUCLEAR" build "$BUILDER" >/dev/null 2>&1
"$NUCLEAR" build "$CHAT" >/dev/null 2>&1
(cd "$CHAT_SERVICE" && "$NUCLEAR" build >/dev/null 2>&1)

# 3. the packages: the versions the graph's tests ran with (its uv.lock) bind the whole resolution; --no-sources, or
# the MCP server's editable source of the graph would install a link to this checkout instead of the graph itself
uv export --quiet --project "$GRAPH" --frozen --extra server --no-dev --no-emit-project --no-hashes \
  --output-file "$work/tmp/constraints.txt"
uv pip install --quiet --no-sources --python "$PY" --constraints "$work/tmp/constraints.txt" \
  "$GRAPH[server]" "$MCP" "$RUNTIME" "$DEVELOPER/build" "$BUILDER" "$CHAT" "websockets>=13"
# Nuclear Chat's service is a Synapsis app too (its package is `app`, as the Developer's): its code goes in a folder of
# its own, which `nuclear-chat serve` gives uvicorn (`--app-dir`); its packages are the ones above
mkdir -p "$AI/nuclear-chat"
cp -R "$CHAT_SERVICE/build/app" "$AI/nuclear-chat/"

# 4. the launchers: the console scripts of pip name the Python by an absolute path, these by their own place
launch() { # <name> <python code that runs it>
  if [ "$os" = windows ]; then
    printf '@"%%~dp0..\\python\\python.exe" -c "%s" %%*\r\n' "$2" > "$AI/bin/$1.cmd"
  else
    printf '#!/bin/sh\nexec "$(dirname "$(readlink -f "$0")")/../python/bin/python3" -c "%s" "$@"\n' "$2" > "$AI/bin/$1"
    chmod +x "$AI/bin/$1"
  fi
}
launch nuclear-graph 'import sys; from nuclear_graph.cli import main; sys.argv[0] = \"nuclear-graph\"; sys.exit(main())'
launch nuclear-mcp 'import sys; from nuclear_mcp.cli import main; sys.argv[0] = \"nuclear-mcp\"; sys.exit(main())'
launch nuclear-builder 'import sys; from nuclear_builder.cli import main; sys.argv[0] = \"nuclear-builder\"; sys.exit(main())'
launch nuclear-chat 'import os, sys; os.environ.setdefault(\"NUCLEAR_CHAT_SERVICE\", os.path.join(sys.prefix, \"..\", \"nuclear-chat\")); from nuclear_chat_system.cli import main; sys.argv[0] = \"nuclear-chat\"; sys.exit(main())'
# the Developer: its port is the machine's (ai.env, read by the set-up's service files), else 7879
launch nuclear-developer 'import os, sys, uvicorn; sys.exit(uvicorn.run(\"app.main:app\", host=\"127.0.0.1\", port=int(os.environ.get(\"NUCLEAR_DEVELOPER_PORT\") or 7879)))'

# 5. the knowledge base the set-up ingests (the prompts, the roles' skills, are inside the graph's package)
mkdir -p "$AI/nuclear-graph-storage"
cp -R "$GRAPH/data" "$AI/nuclear-graph-storage/"
cp "$REPO/LICENSE" "$AI/"
echo "$VERSION" > "$AI/VERSION"
find "$AI" -name __pycache__ -type d -prune -exec rm -rf {} +

# 6. try it before it is packed: nothing in it points into this checkout, each launcher starts, the graph answers on a
# free port of 127.0.0.1
# (direct_url.json only records where a package was installed from: the builder's paths do not travel)
find "$AI/python" -name direct_url.json -path '*.dist-info/*' -delete
if grep -rlsF "$REPO" "$AI/python" --include='*.pth' | grep .; then
  echo "ai-runtime: these files point into $REPO, which a user's machine does not have" >&2; exit 1
fi
run() { # <launcher> <args>: a .cmd is run by cmd.exe
  l=$1; shift
  if [ "$os" = windows ]; then cmd.exe //c "$(cygpath -w "$AI/bin/$l.cmd")" "$@"; else "$AI/bin/$l" "$@"; fi
}
run nuclear-graph --help >/dev/null
run nuclear-mcp tools >/dev/null
run nuclear-builder setup --plan --json >/dev/null
run nuclear-chat pack >/dev/null
(cd "$AI/nuclear-chat" && "$PY" -c "import app.main") >/dev/null
"$PY" -c "import app.main" >/dev/null
port=$("$PY" -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
# the server by the Python itself, so the process stopped below is the server and not a cmd.exe in front of it
NUCLEAR_GRAPH_HOME="$work/tmp/graph" NUCLEAR_GRAPH_NO_KEYRING=1 NUCLEAR_GRAPH_PORT=$port \
  "$PY" -c 'import sys; from nuclear_graph.cli import main; sys.argv = ["nuclear-graph", "serve"]; sys.exit(main())' &
pid=$!
ok=0
for _ in $(seq 1 60); do
  if "$PY" -c "import urllib.request, sys; urllib.request.urlopen('http://127.0.0.1:$port/v1/health', timeout=1)" 2>/dev/null; then ok=1; break; fi
  sleep 1
done
kill "$pid" 2>/dev/null || true
wait "$pid" 2>/dev/null || true
[ "$ok" = 1 ] || { echo "ai-runtime: the graph of the runtime does not answer on 127.0.0.1:$port" >&2; exit 1; }
rm -rf "$work/tmp"

if [ -n "${AI_STAGE:-}" ]; then
  rm -rf "$work"
  echo "$AI"
  exit 0
fi

# 7. the archive and its checksum
cd "$work"
if [ "$os" = windows ]; then
  archive="$name.zip"
  rm -f "../$archive"
  if command -v zip >/dev/null 2>&1; then zip -qr "../$archive" ai
  else powershell -NoProfile -Command "Compress-Archive -Path ai -DestinationPath ../$archive"; fi
else
  archive="$name.tar.gz"
  tar -czf "../$archive" ai
fi
cd "$dist"
rm -rf "$name"
if command -v sha256sum >/dev/null 2>&1; then sha256sum "$archive" > "$archive.sha256"
else shasum -a 256 "$archive" > "$archive.sha256"; fi
echo "$dist/$archive"
