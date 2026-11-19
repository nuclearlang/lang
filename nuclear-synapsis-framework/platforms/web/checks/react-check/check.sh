#!/bin/sh
# Builds the react examples (examples/examples-web/characters, tasks_live) and checks the generated TypeScript: tsc
# --strict, its tests in Nuclear (vitest + jsdom), a production bundle (vite build) and the embedded bundle (vite
# build -c vite.embed.config.ts, ADR-synapsis-0009), then the runtime's own tests (vitest in packages/synapsis-web). `here` is this platform's folder, `root` the working tree (or
# NUCLEAR_ROOT). Needs nuclearlang/tools/node (npm install there).
set -e
here=$(cd "$(dirname "$0")/../.." && pwd)
root=${NUCLEAR_ROOT:-$(cd "$here/../../.." && pwd)}
nm="$root/nuclearlang/tools/node/node_modules"
# build the runtime, then copy it fresh (npm keeps an old copy of the same version; a `--no-save` install also
# prunes the other runtime linked the same way)
(cd "$here/packages/synapsis-web" && node "$nm/typescript/bin/tsc" -p tsconfig.json)
rm -rf "$nm/synapsis-web"
(cd "$root/nuclearlang/tools/node" && npm install --no-save --no-audit --no-fund --install-links "$here/packages/synapsis-web" >/dev/null 2>&1)
for example in characters tasks_live; do
  p="$here/examples/examples-web/$example"
  rm -rf "$p/build"
  (cd "$root" && cargo run -q -p nuclear-cli -- build "$p")
  ln -sfn "$nm" "$p/build/app/node_modules"
  cd "$p/build/app"
  node "$nm/typescript/bin/tsc" -p tsconfig.json && echo "$example: tsc --strict: 0 errors"
  out=$(node "$nm/vitest/vitest.mjs" run 2>&1) || { echo "$out"; exit 1; }
  echo "$out" | grep -E 'Tests|Test Files'
  node "$nm/vite/bin/vite.js" build --logLevel error && echo "$example: vite build: ok"
  node "$nm/vite/bin/vite.js" build -c vite.embed.config.ts --logLevel error && test -s dist-embed/embed.js && echo "$example: embedded bundle: ok"
done
cd "$here/packages/synapsis-web"
out=$(node "$nm/vitest/vitest.mjs" run 2>&1) || { echo "$out"; exit 1; }
echo "$out" | grep -E 'Tests'
