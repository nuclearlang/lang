#!/bin/sh
# Builds Nuclear Chat's UI as the embedded bundle the editors carry (ADR-synapsis-0009):
# nuclear-chat/ui/build/app/dist-embed/embed.js. The same way the web platform's check builds its examples: `nuclear`
# from the tree, the runtime and the node tools of nuclearlang/tools/node (npm ci there and
# installer/release/build-runtimes.sh first, on a fresh checkout). `root` is the working
# tree (or NUCLEAR_ROOT).
set -e
here=$(cd "$(dirname "$0")" && pwd)
root=${NUCLEAR_ROOT:-$(cd "$here/../.." && pwd)}
nm="$root/nuclearlang/tools/node/node_modules"
web="$root/nuclear-synapsis-framework/platforms/web/packages/synapsis-web"
test -d "$nm" || { echo "build-embed: run 'npm ci' in nuclearlang/tools/node first" >&2; exit 1; }
# the runtime, built and copied fresh (npm keeps an old copy of the same version)
(cd "$web" && node "$nm/typescript/bin/tsc" -p tsconfig.json)
rm -rf "$nm/synapsis-web"
(cd "$root/nuclearlang/tools/node" && npm install --no-save --no-audit --no-fund --install-links "$web" >/dev/null 2>&1)
rm -rf "$here/build"
(cd "$root" && cargo run -q --release -p nuclear-cli -- build "$here")
ln -sfn "$nm" "$here/build/app/node_modules"
cd "$here/build/app"
node "$nm/vite/bin/vite.js" build -c vite.embed.config.ts --logLevel error
test -s dist-embed/embed.js && echo "nuclear-chat ui: embedded bundle: ok"
