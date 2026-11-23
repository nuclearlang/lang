#!/bin/sh
# An app built with each backend dialect, run as a user runs it: what it logs, how it answers hostile requests and
# how it holds a load. The same Nuclear projects (examples/examples-backend/store_api with the probe routes of
# probes/, and tasks_api for the guards and the WebSocket), built by `nuclear`, never target code written here.
#
#   logs         build, checker, `nuclear migrate`, the app in development and in production mode driven by the
#                database check's scenario, the project's tests: every line each step prints is read by logs.py and
#                must be on its allow-list; no secret may be in any of them
#   security     security.py sends the same hostile requests to both dialects, on SQLite and on PostgreSQL, and
#                compares the answers; the advisories of the dependencies (audit.py)
#   performance  performance.py: the same load on each dialect, one at a time, on PostgreSQL; the SQL statements of
#                a request counted in the server's statement log
#
# A finding that is known and not fixed yet is a line of known.txt: the check fails on a finding that is not there
# and on a line of it that no longer happens (fixed: delete the line).
#
#   check.sh                       everything, both dialects
#   check.sh logs security         only those stages (any of logs, security, performance)
#   SERVE=1 check.sh security      starts the apps of the security stage, prints where, and waits for <work>/stop
#
# Needs Docker (one PostgreSQL in a throwaway container, removed when the script ends), what the other backend
# checks need (nuclearlang/tools/python/.venv, nuclearlang/tools/node) and, for the advisories, the network.
here=$(cd "$(dirname "$0")/../.." && pwd)
root=${NUCLEAR_ROOT:-$(cd "$here/../../.." && pwd)}
self="$here/checks/app-check"
dbcheck="$here/checks/database-check"
V="$root/nuclearlang/tools/python/.venv/bin"
nm="$root/nuclearlang/tools/node/node_modules"
py="$V/python"
dialects="fastapi nestjs"

stages=""
for a in "$@"; do
  case $a in
    logs|security|performance) stages="$stages $a" ;;
    *) echo "usage: check.sh [logs] [security] [performance]" >&2; exit 2 ;;
  esac
done
stages=${stages:-logs security performance}
has() { case " $stages " in *" $1 "*) return 0 ;; esac; return 1; }

work=$(mktemp -d "${TMPDIR:-/tmp}/nuclear-appcheck.XXXXXX")
logs="$work/logs"; mkdir -p "$logs"
prefix="nuclear-appcheck-$$"
# the secrets of this run: none of them may ever be in a log
db_password="appcheck-db-secret-$$"
tasks_token="appcheck-tasks-secret-$$"
owner_token="appcheck-owner-secret-$$"
pids=""
failed=0
: >"$work/findings"
cleanup() {
  for p in $pids; do kill -- "-$p" 2>/dev/null; done
  ids=$(docker ps -aq --filter "name=$prefix-" 2>/dev/null)
  [ -n "$ids" ] && docker rm -f -v $ids >/dev/null 2>&1
  [ -n "$KEEP" ] && echo "kept: $work" || rm -rf "$work"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

report() { printf '%-4s %-7s %-11s %s\n' "$1" "$2" "$3" "$4"; }
fail() { report FAIL "$1" "$2" "$3"; failed=1; }
free_port() { # free_port [low]: a free port of this machine; low: below 6553, so the port <port><digit> exists (security.py)
  "$py" -c 'import random, socket, sys
while True:
    s = socket.socket()
    try:
        s.bind(("127.0.0.1", random.randint(2000, 6500) if sys.argv[1:] else 0))
    except OSError:
        continue
    print(s.getsockname()[1])
    break' $1
}

# --- one PostgreSQL, on a free port of this machine only, its data in memory
start_postgres() {
  docker run -d --name "$prefix-postgres" -p 127.0.0.1::5432 --tmpfs /var/lib/postgresql/data -e POSTGRES_PASSWORD="$db_password" \
    --health-cmd 'pg_isready -h 127.0.0.1 -U postgres' --health-interval 1s --health-retries 120 \
    postgres:16-alpine -c log_line_prefix='%d ' -c max_connections=100 >/dev/null || return 1
  i=0
  until [ "$(docker inspect -f '{{.State.Health.Status}}' "$prefix-postgres" 2>/dev/null)" = healthy ]; do
    i=$((i + 1)); [ "$i" -gt 240 ] && return 1; sleep 0.5
  done
  pg_port=$(docker port "$prefix-postgres" | head -1 | sed 's/.*://')
}
psql() { docker exec "$prefix-postgres" psql -q -U postgres "$@"; }

# --- a project: a copy of an example with only its dialect and its connection changed
project_of() { # project_of <name> <example> <dialect> <sqlite|postgres> [createTables]: sets $project
  project="$work/$1"
  mkdir -p "$project" && cp -r "$here/examples/examples-backend/$2/." "$project" && rm -rf "$project/build" "$project/migrations"
  sed -i "s/dialect = \"[a-z]*\"/dialect = \"$3\"/" "$project/config.nuc"
  [ "$2" = store_api ] || return 0
  made=""; [ -n "$5" ] && made=", createTables = true"
  if [ "$4" = postgres ]; then
    sed -i "s/^plugins(sqlite = true)/plugins(postgres = true)/" "$project/config.nuc"
    sed -i "s|^    SQLite(.*|    Postgres(url = env(\"DATABASE_URL\")$made),|" "$project/config/project_config.nuc"
  else
    sed -i "s|^    SQLite(.*|    SQLite(file = env(\"DATABASE\", \"app.sqlite\")$made),|" "$project/config/project_config.nuc"
  fi
  # the column the scenario of the database check expects after its migrations
  sed -i "s/^  credit: double = 0.0$/  credit: double = 0.0\n  points: int = 7/" "$project/components/store/data/entities/customer.nuc"
  # one web origin may call the API (the CORS probes)
  [ "$4" = postgres ] && printf '  origins: string[] = ["http://localhost:5173"]\n' >>"$project/config/project_config.nuc"
  # the probe routes: Nuclear of probes/, wired by the generator
  cp "$self/probes/probe_repository.nuc" "$project/components/store/data/repositories/"
  (cd "$project" && for u in "ProbeSorted sorted" "ProbeNamed named" "ProbeAmong among" "ProbeRanged ranged"; do
    set -- $u
    nuclear gen usecase store "$1" --calls "ProbeRepository.$2" --route "GET probe/$2" >/dev/null 2>&1 || exit 1
  done)
}
build() { # build <dialect>: $project → build/, compiled; everything it prints is on stdout
  (cd "$project" && nuclear build . 2>&1) || return 1
  # what the dialect's [toolchain] installs in build/: the shared tools of the checks, in place of `nuclear install`
  if [ "$1" = fastapi ]; then ln -sfn "$root/nuclearlang/tools/python/.venv" "$project/build/.venv"
  else ln -sfn "$nm" "$project/build/node_modules"; (cd "$project/build" && node "$nm/typescript/bin/tsc" -p tsconfig.json 2>&1) || return 1; fi
}
checker() {
  if [ "$1" = fastapi ]; then (cd "$project/build" && "$V/pyright" --pythonpath "$py" 2>&1)
  else (cd "$project/build" && node "$nm/typescript/bin/tsc" -p tsconfig.json --noEmit 2>&1 && echo "tsc --strict: 0 errors"); fi
}
# what `nuclear run` starts (development: the dialect's [toolchain] run) and what a deployment starts (production:
# the same server without the reloader: `python -m synapsis.server`, `npm start`). The shared tools stand for the project's own.
start_app() { # start_app <dialect> <dev|prod> <log file> [NAME=value...]: sets $http and $app_pid
  d=$1 mode=$2 log=$3; shift 3
  http=$(free_port $port_kind)
  case $d-$mode in
    fastapi-dev) set -- "$@" "$project/build/.venv/bin/python" -m synapsis.server --reload --port "$http" ;;
    fastapi-prod) set -- "$@" "$project/build/.venv/bin/python" -m synapsis.server --port "$http" ;;
    nestjs-dev) set -- "$@" PORT="$http" node --enable-source-maps --watch dist/src/main.js ;;
    nestjs-prod) set -- "$@" PORT="$http" node dist/src/main.js ;;
  esac
  started=$(date +%s%N)
  (cd "$project/build" && exec setsid env "$@" >>"$log" 2>&1) &
  app_pid=$!
  pids="$pids $app_pid"
  i=0
  until curl -s -o /dev/null "http://127.0.0.1:$http/.nuclear/contract.json"; do
    i=$((i + 1))
    if [ "$i" -gt 600 ] || ! kill -0 "$app_pid" 2>/dev/null; then echo "the app did not start:"; tail -20 "$log"; return 1; fi
    sleep 0.05
  done
  startup_ms=$(( ($(date +%s%N) - started) / 1000000 ))
}
stop_app() { kill -- "-$1" 2>/dev/null; wait "$1" 2>/dev/null; }

# --- logs: everything a user sees from `nuclear build` to the running app, per dialect
logs_stage() {
  d=$1; L="$logs/$d"; mkdir -p "$L"
  project_of "logs-$d" store_api "$d" sqlite
  build "$d" >"$L/build.log" 2>&1 || { fail "$d" logs "the project does not build"; cat "$L/build.log"; return 1; }
  checker "$d" >"$L/checker.log" 2>&1 || { fail "$d" logs "the checker refuses the generated code"; tail -20 "$L/checker.log"; return 1; }
  for mode in dev prod; do
    export DATABASE="$work/logs-$d-$mode.sqlite"
    (cd "$project" && { nuclear migrate status; nuclear migrate make "first $mode"; nuclear migrate; nuclear migrate make again
      nuclear migrate status; nuclear migrate down; nuclear migrate; }) >>"$L/migrate.log" 2>&1
    start_app "$d" "$mode" "$L/$mode.log" || { fail "$d" logs "the app did not start in $mode mode"; return 1; }
    "$py" "$dbcheck/scenario.py" "http://127.0.0.1:$http" "$DATABASE" "$work/answers-$d-$mode.json" >"$L/scenario-$mode.log" 2>&1 \
      || { fail "$d" logs "the scenario failed in $mode mode"; tail -5 "$L/scenario-$mode.log"; }
    # a request that carries what must never be logged: a token, a body, and a 500
    curl -s -o /dev/null -X POST "http://127.0.0.1:$http/customers" -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $owner_token" -d '{"email":"canary@example.com","name":"appcheck-body-canary"}'
    curl -s -o /dev/null "http://127.0.0.1:$http/customers/draft?email=nope"
    stop_app "$app_pid"
    unset DATABASE
  done
  if [ "$d" = fastapi ]; then (cd "$project/build" && .venv/bin/python -m pytest -q) >"$L/tests.log" 2>&1
  else (cd "$project/build" && node --import ./dist/src/test_env.js --test "dist/test/**/*.js") >"$L/tests.log" 2>&1; fi
  [ $? -eq 0 ] || { fail "$d" logs "the project's tests fail"; tail -20 "$L/tests.log"; }
  report ok "$d" logs "build, checker, migrate, dev and prod runs, tests: $(cat "$L"/*.log | wc -l) lines kept"
}

# --- security: both dialects up at once, the same requests to each
security_apps() { # security_apps <sqlite|postgres>: the two store apps on that database; writes $work/urls-<database>
  : >"$work/urls-$1"
  for d in $dialects; do
    project_of "sec-$d-$1" store_api "$d" "$1" createTables
    build "$d" >"$logs/$d/security-build-$1.log" 2>&1 || { fail "$d" security "the project does not build"; return 1; }
    if [ "$1" = postgres ]; then
      psql -c "CREATE DATABASE sec_$d" || return 1
      url="postgres://postgres:$db_password@127.0.0.1:$pg_port/sec_$d"
      start_app "$d" prod "$logs/$d/security-$1.log" "DATABASE_URL=$url" || return 1
    else
      url="$work/sec-$d.sqlite"
      start_app "$d" prod "$logs/$d/security-$1.log" "DATABASE=$url" || return 1
    fi
    echo "$d http://127.0.0.1:$http $app_pid $url" >>"$work/urls-$1"
    eval "sec_pid_${d}_$1=$app_pid"
  done
}
tasks_apps() { # the two tasks_api (guards, WebSocket), on SQLite; writes $work/urls-tasks
  : >"$work/urls-tasks"
  for d in $dialects; do
    project_of "tasks-$d" tasks_api "$d" sqlite
    build "$d" >"$logs/$d/tasks-build.log" 2>&1 || { fail "$d" security "tasks_api does not build"; return 1; }
    port_kind=low
    start_app "$d" prod "$logs/$d/tasks.log" "DATABASE=$work/tasks-$d.sqlite" "TASKS_TOKEN=$tasks_token" "OWNER_TOKEN=$owner_token" || return 1
    port_kind=""
    echo "$d http://127.0.0.1:$http $app_pid" >>"$work/urls-tasks"
    eval "tasks_pid_$d=$app_pid"
  done
}
security_stage() {
  for d in $dialects; do mkdir -p "$logs/$d"; done
  tasks_apps || { fail - security "the tasks apps did not start"; return 1; }
  for database in sqlite postgres; do
    security_apps "$database" || { fail - security "the store apps did not start on $database"; return 1; }
  done
  if [ -n "$SERVE" ]; then
    echo "serving: $work (urls-sqlite, urls-postgres, urls-tasks); touch $work/stop to end"
    until [ -f "$work/stop" ]; do sleep 1; done
  fi
  "$py" "$self/security.py" "$work" "$tasks_token" "$owner_token" && report ok - security "the same probes sent to both dialects" || failed=1
  for d in $dialects; do
    for database in sqlite postgres; do eval "stop_app \$sec_pid_${d}_$database"; done
    eval "stop_app \$tasks_pid_$d"
  done
  "$py" "$self/audit.py" "$work" "$root" && report ok - advisories "the advisories of the dependencies read" || failed=1
}

# --- performance: one dialect at a time, production mode, PostgreSQL
performance_stage() {
  for d in $dialects; do
    mkdir -p "$logs/$d"
    project_of "perf-$d" store_api "$d" postgres createTables
    build "$d" >"$logs/$d/performance-build.log" 2>&1 || { fail "$d" performance "the project does not build"; return 1; }
    psql -c "CREATE DATABASE perf_$d" || return 1
    url="postgres://postgres:$db_password@127.0.0.1:$pg_port/perf_$d"
    start_app "$d" prod "$logs/$d/performance.log" "DATABASE_URL=$url" || { fail "$d" performance "the app did not start"; return 1; }
    "$py" "$self/performance.py" run "$d" "http://127.0.0.1:$http" "$app_pid" "$startup_ms" "$prefix-postgres" "perf_$d" "$work" \
      || fail "$d" performance "the load failed"
    stop_app "$app_pid"
  done
  "$py" "$self/performance.py" compare "$work" && report ok - performance "no error under load, the statements per request and the ratio within their bounds" || failed=1
}

# --- the tools: the runtime of the nestjs dialect built and copied fresh as the nestjs check does, the tree's `nuclear`
(cd "$here/packages/synapsis-nest" && node "$nm/typescript/bin/tsc" -p tsconfig.json) || exit 1
rm -rf "$nm/synapsis-nest"
(cd "$root/nuclearlang/tools/node" && npm install --no-save --no-audit --no-fund --install-links "$here/packages/synapsis-nest" >/dev/null 2>&1) || exit 1
(cd "$root" && cargo build -q -p nuclear-cli) || exit 1
PATH="$root/target/debug:$PATH"; export PATH

if has security || has performance; then
  start_postgres || { fail - postgres "the container did not become healthy"; exit 1; }
  report ok - postgres "postgres:16-alpine on port $pg_port"
fi
if has logs; then for d in $dialects; do logs_stage "$d"; done; fi
has security && security_stage
has performance && performance_stage
# every log of every stage is read: the lines allowed, the secrets absent, what a request logs in each dialect
"$py" "$self/logs.py" "$logs" "$db_password" "$tasks_token" "$owner_token" "$work/findings" || failed=1
# the findings of this run against the known ones
"$py" "$self/known.py" "$self/known.txt" "$work/findings" "$stages" || failed=1
[ "$failed" -eq 0 ] && echo "app-check: ok" || echo "app-check: FAILED"
exit "$failed"
