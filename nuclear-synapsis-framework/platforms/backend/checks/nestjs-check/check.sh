#!/bin/sh
# Builds the nestjs example (examples/examples-backend/tasks_api) and checks the generated TypeScript: tsc --strict,
# its tests in Nuclear (node:test) and an end-to-end run (smoke.mjs). Needs nuclearlang/tools/node (npm install
# there; this script installs the runtime into it after building it).
set -e
# `here` is this platform's folder, `root` the working tree (or NUCLEAR_ROOT)
here=$(cd "$(dirname "$0")/../.." && pwd)
root=${NUCLEAR_ROOT:-$(cd "$here/../../.." && pwd)}
nm="$root/nuclearlang/tools/node/node_modules"
# build the runtime, then copy it fresh (npm keeps an old copy of the same version; a `--no-save` install also
# prunes the other runtime linked the same way)
(cd "$here/packages/synapsis-nest" && node "$nm/typescript/bin/tsc" -p tsconfig.json)
rm -rf "$nm/synapsis-nest"
(cd "$root/nuclearlang/tools/node" && npm install --no-save --no-audit --no-fund --install-links "$here/packages/synapsis-nest" >/dev/null 2>&1)
p="$here/examples/examples-backend/tasks_api"
rm -rf "$p/build"
(cd "$root" && cargo run -q -p nuclear-cli -- build "$p")
ln -sfn "$nm" "$p/build/node_modules"
cd "$p/build"
node "$nm/typescript/bin/tsc" -p tsconfig.json && echo "tsc --strict: 0 errors"
tests() { out=$(node --test "$@" 2>&1) || { echo "$out"; exit 1; }; echo "$out" | grep -E '^ℹ (pass|fail)'; }
tests --import ./dist/src/test_env.js "dist/test/**/*.js"
node "$here/checks/nestjs-check/smoke.mjs" "$p/build"
# ADR-backend-0001: the migrations of the example, made from its entities and applied to a fresh SQLite; then nothing is
# left to make
m=$(mktemp -d)
export DATABASE="$m/fresh.sqlite"
migrate() { node node_modules/synapsis-nest/dist/migrate.js "$@" --dir "$m/migrations"; }
migrate make "first" >/dev/null && migrate up >/dev/null && migrate make "again" | grep -q "no changes"
unset DATABASE
rm -rf "$m"
echo "migrations: made, applied, nothing left"
cd "$here/packages/synapsis-nest" && node "$nm/typescript/bin/tsc" -p tsconfig.test.json && tests "dist-test/test/**/*.js"
