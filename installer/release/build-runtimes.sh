#!/bin/sh
# Builds the JavaScript runtimes of every platform (platforms/<platform>/packages/<name>/ with a "build" script:
# synapsis-nest, synapsis-web...): their dist/ is what stage.sh copies into an installation. Run before
# installer/install.sh or installer/release/package.sh on a fresh checkout (a developer's tree already has them built by the check scripts).
set -eu
REPO=$(cd "$(dirname "$0")/../.." && pwd)
for p in "$REPO"/nuclear-synapsis-framework/platforms/*/packages/*/package.json; do
  [ -f "$p" ] && grep -q '"build"' "$p" || continue
  d=$(dirname "$p")
  echo "building $(basename "$d")"
  if [ -f "$d/package-lock.json" ]; then (cd "$d" && npm ci --no-audit --no-fund >/dev/null)
  else (cd "$d" && npm install --no-audit --no-fund >/dev/null); fi
  (cd "$d" && npm run --silent build)
done
# nuclear-builder (ADR-platform-0003): the Builder engine of the VS Code extension bundled for node; stage.sh copies it into bin/
if [ -f "$REPO/extensions/vscode/package.json" ]; then
  echo "building nuclear-builder"
  (cd "$REPO/extensions/vscode" && npm ci --no-audit --no-fund >/dev/null && npm run --silent builder >/dev/null)
fi
