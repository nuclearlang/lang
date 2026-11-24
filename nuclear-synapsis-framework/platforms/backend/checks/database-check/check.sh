#!/bin/sh
# The same Nuclear project (examples/examples-backend/store_api) on real databases, with every backend dialect:
# for each dialect (fastapi, nestjs) and each database (sqlite, postgres, mysql, mariadb) it builds the project with
# that connection, runs the target's strict checker, the migrations (migrations.py: every kind of schema change made,
# applied and reverted with the real command, `nuclear migrate`, the real schema and the rows read back after each;
# a rename with `make --rename`; a text longer than a VARCHAR holds; a failing migration; the rules of the history), the app over HTTP with one scenario (scenario.py), the project's
# tests, and the same project with `createTables` on an empty database (tables.py: its tables are the ones the first
# migration makes); then it compares the answers (the same bytes in every dialect on every database) and says where
# the schemas of the dialects differ. On SQLite it also makes a project with `nuclear new` and migrates it.
#
#   check.sh                     everything, one pair after another
#   check.sh fastapi postgres    only those dialects and databases (any of each)
#   check.sh --parallel [...]    every pair at the same time, each in its own folder and containers (this machine,
#                                before a tag: installer/release/delivery.sh), then the comparisons over all of them
#   OUT=<dir> check.sh ...       also keeps the answers and the schemas in <dir> (one CI job per pair)
#   check.sh --compare <dir>...  only the comparisons, over what the runs kept: every pair must be there
#
# Needs Docker (the databases run in throwaway containers, removed when the script ends) and what the other two
# checks need: nuclearlang/tools/python/.venv and nuclearlang/tools/node (npm install there).
here=$(cd "$(dirname "$0")/../.." && pwd)
root=${NUCLEAR_ROOT:-$(cd "$here/../../.." && pwd)}
self="$here/checks/database-check"
V="$root/nuclearlang/tools/python/.venv/bin"
nm="$root/nuclearlang/tools/node/node_modules"
py="$V/python"

dialects="" databases="" parallel="" compare=""
while [ $# -gt 0 ]; do
  case $1 in
    fastapi|nestjs) dialects="$dialects $1" ;;
    sqlite|postgres|mysql|mariadb) databases="$databases $1" ;;
    --parallel) parallel=1 ;;
    --compare) shift; [ -d "${1:-}" ] || { echo "--compare needs a folder" >&2; exit 2; }; compare=$(cd "$1" && pwd) ;;
    *) echo "usage: check.sh [--parallel | --compare <dir>] [fastapi|nestjs]... [sqlite|postgres|mysql|mariadb]..." >&2; exit 2 ;;
  esac
  shift
done
dialects=${dialects:-fastapi nestjs}
databases=${databases:-sqlite postgres mysql mariadb}

work=${compare:-$(mktemp -d "${TMPDIR:-/tmp}/nuclear-dbcheck.XXXXXX")}
prefix="nuclear-dbcheck-$$"
app_pid=""
failed=0
cleanup() {
  [ -n "$app_pid" ] && kill "$app_pid" 2>/dev/null
  ids=$(docker ps -aq --filter "name=$prefix-" 2>/dev/null)
  [ -n "$ids" ] && docker rm -f -v $ids >/dev/null 2>&1
  [ -n "$compare" ] && return
  [ -n "$KEEP" ] && echo "kept: $work" || rm -rf "$work"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# one line per stage: `ok` with the stage's last line, or `FAIL` with the end of its output
report() { printf '%-4s %-7s %-8s %-11s %s\n' "$1" "$2" "$3" "$4" "$5"; }
stage() { # stage <name> <command...>: runs it for the current pair; 1 when it failed
  name=$1; shift
  if out=$("$@" 2>&1); then
    report ok "$dialect" "$database" "$name" "$(echo "$out" | tail -1)"
  else
    report FAIL "$dialect" "$database" "$name" ""
    echo "$out" | tail -60 | cut -c1-600 | sed 's/^/     | /'
    failed=1
    return 1
  fi
}

# --- the databases: one throwaway container each, on a free port of this machine only
free_port() { "$py" -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])'; }
start_database() { # start_database <database>: its container, healthy
  name="$prefix-$1"
  case $1 in
    postgres) docker run -d --name "$name" -p 127.0.0.1::5432 --tmpfs /var/lib/postgresql/data -e POSTGRES_PASSWORD=nuclear \
        --health-cmd 'pg_isready -h 127.0.0.1 -U postgres' --health-interval 1s --health-retries 120 postgres:16-alpine >/dev/null || return 1 ;;
    mysql) docker run -d --name "$name" -p 127.0.0.1::3306 --tmpfs /var/lib/mysql -e MYSQL_ROOT_PASSWORD=nuclear \
        --health-cmd 'mysqladmin ping -h 127.0.0.1 -uroot -pnuclear --silent' --health-interval 1s --health-retries 120 mysql:8.0 >/dev/null || return 1 ;;
    mariadb) docker run -d --name "$name" -p 127.0.0.1::3306 --tmpfs /var/lib/mysql -e MARIADB_ROOT_PASSWORD=nuclear \
        --health-cmd 'healthcheck.sh --connect --innodb_initialized' --health-interval 1s --health-retries 120 mariadb:11 >/dev/null || return 1 ;;
  esac
  i=0
  until [ "$(docker inspect -f '{{.State.Health.Status}}' "$name" 2>/dev/null)" = healthy ]; do
    i=$((i + 1))
    [ "$i" -gt 240 ] && { docker logs "$name" 2>&1 | tail -20; return 1; }
    sleep 0.5
  done
}
create_database() { # create_database <database> <name>: an empty database for one pair
  case $1 in
    postgres) docker exec "$prefix-postgres" psql -q -U postgres -c "CREATE DATABASE $2" ;;
    mysql) docker exec "$prefix-mysql" mysql -uroot -pnuclear -e "CREATE DATABASE $2" 2>/dev/null ;;
    mariadb) docker exec "$prefix-mariadb" mariadb -uroot -pnuclear -e "CREATE DATABASE $2" ;;
  esac
}

# --- what each dialect runs (the commands of its [toolchain], over the shared tools of the checks)
checker() {
  if [ "$dialect" = fastapi ]; then "$V/pyright" --pythonpath "$py"
  else node "$nm/typescript/bin/tsc" -p tsconfig.json && echo "tsc --strict: 0 errors"; fi
}
build() { # the project → build/, compiled when the dialect compiles
  (cd "$root" && cargo run -q -p nuclear-cli -- build "$project") || return 1
  # what the dialect's [toolchain] runs in build/: the shared tools of the checks, in place of `nuclear install`
  if [ "$dialect" = fastapi ]; then ln -sfn "$root/nuclearlang/tools/python/.venv" "$project/build/.venv"
  else ln -sfn "$nm" "$project/build/node_modules"; fi
}
unit_tests() {
  if [ "$dialect" = fastapi ]; then "$py" -m pytest -q -p no:warnings
  else
    out=$(node --import ./dist/src/test_env.js --test "dist/test/**/*.js" 2>&1) || { echo "$out"; return 1; }
    echo "$out" | grep -E '^ℹ (tests|pass|fail)' | tr '\n' ' '
  fi
}
migrations() { # every scenario of migrations.py, with the real command: `nuclear migrate` of the tree's build
  rm -f "$work/migrations-$dialect-$database.log"
  "$py" "$self/migrations.py" "$dialect" "$database" "$url" "$project" "$work"
}
fresh() { # a project made now, with `nuclear new` and `nuclear gen`: its migrations with the real command
  rm -rf "$work/new-$dialect" && mkdir "$work/new-$dialect" && cd "$work/new-$dialect" || return 1
  nuclear new shop_api -p backend -d "$dialect" >/dev/null 2>&1 || { echo "nuclear new failed"; return 1; }
  project="$work/new-$dialect/shop_api"
  cd "$project" && nuclear gen resource shop Product --fields "id:int name:string price:double" --source db >/dev/null 2>&1 || { echo "nuclear gen failed"; return 1; }
  build >/dev/null 2>&1 || { echo "the new project does not build"; return 1; }
  url="$work/new-$dialect/shop.sqlite"; DATABASE="$url"; export DATABASE
  nuclear migrate status 2>&1 | grep -q "^no migrations in " || { echo "status of a project without migrations"; return 1; }
  nuclear migrate make "the products" 2>&1 | grep -q "^wrote .*_the_products\." || { echo "make wrote no migration"; return 1; }
  nuclear migrate 2>&1 | grep -q "^applied [0-9]*_the_products$" || { echo "up did not apply it"; return 1; }
  nuclear migrate make "again" 2>&1 | grep -q "^no changes" || { echo "a second make wrote a migration"; return 1; }
  [ "$("$py" "$self/db.py" scalar "$url" "SELECT COUNT(*) FROM products")" = 0 ] || { echo "no table products"; return 1; }
  nuclear migrate status 2>&1 | grep -q "^applied  [0-9]*_the_products$" || { echo "status does not say applied"; return 1; }
  nuclear migrate down 2>&1 | grep -q "^reverted [0-9]*_the_products$" || { echo "down did not revert it"; return 1; }
  nuclear migrate status 2>&1 | grep -q "^pending  [0-9]*_the_products$" || { echo "status does not say pending"; return 1; }
  echo "nuclear new, gen resource, migrate status / make / up / make (no changes) / status / down / status"
}
start_app() { # the built app of the current folder, answering on $http
  http=$(free_port)
  if [ "$dialect" = fastapi ]; then "$py" -m uvicorn app.main:app --port "$http" --log-level warning >"$work/app.log" 2>&1 &
  else PORT=$http node dist/src/main.js >"$work/app.log" 2>&1 & fi
  app_pid=$!
  i=0
  until curl -fs -o /dev/null "http://127.0.0.1:$http/tags?page=1"; do
    i=$((i + 1))
    if [ "$i" -gt 120 ] || ! kill -0 "$app_pid" 2>/dev/null; then echo "the app did not start:"; cat "$work/app.log"; app_pid=""; return 1; fi
    sleep 0.25
  done
}
stop_app() { kill "$app_pid" 2>/dev/null; wait "$app_pid" 2>/dev/null; app_pid=""; }
integration() {
  start_app || return 1
  "$py" "$self/scenario.py" "http://127.0.0.1:$http" "$url" "$work/answers-$dialect-$database.json"
  code=$?
  stop_app
  [ "$code" -eq 0 ] || { echo "--- the app's log:"; tail -40 "$work/app.log"; }
  return "$code"
}
tables() { # the same project with createTables on an empty database: the app makes the tables, tables.py reads them
  project="$work/$dialect-$database-made"
  mkdir -p "$project" && cp -r "$here/examples/examples-backend/store_api/." "$project" && rm -rf "$project/build" "$project/migrations"
  sed -i "s/dialect = \"[a-z]*\"/dialect = \"$dialect\"/; s/^plugins(sqlite = true)/plugins($database = true)/" "$project/config.nuc"
  if [ "$database" = sqlite ]; then url="$project/store.sqlite"; export DATABASE="$url"
  else
    create_database "$database" "made_$dialect" || { echo "no database made_$dialect"; return 1; }
    url="${url%/*}/made_$dialect"; export DATABASE_URL="$url"
  fi
  sed -i "s|^    SQLite(.*|    ${connection%)}, createTables = true),|" "$project/config/project_config.nuc"
  # a text longer than a VARCHAR holds on MySQL and MariaDB: createTables and the first migration make its text type
  sed -i "s/@column(length = 2000)/@column(length = 100000)/" "$project/components/store/data/entities/order.nuc"
  grep -qF "length = 100000" "$project/components/store/data/entities/order.nuc" || { echo "the long note was not written"; return 1; }
  grep -qF "createTables = true" "$project/config/project_config.nuc" || { echo "the connection was not written"; return 1; }
  build >/dev/null 2>&1 || { echo "the project with createTables does not build"; return 1; }
  cd "$project/build" || return 1
  [ "$dialect" = fastapi ] || node "$nm/typescript/bin/tsc" -p tsconfig.json || return 1
  start_app || return 1
  stop_app
  "$py" "$self/tables.py" "$dialect" "$database" "$url" "$project" "$work"
}

# the comparisons: the answers the same in every dialect on every database, the schemas the same in every dialect
compare_results() {
  # every pair asked for left its answers: a missing one is a failure, never a smaller comparison
  for database in $databases; do for dialect in $dialects; do
    [ -f "$work/answers-$dialect-$database.json" ] || { report FAIL "$dialect" "$database" answers "none kept"; failed=1; }
  done; done
  first=""
  for f in "$work"/answers-*.json; do
    [ -f "$f" ] || continue
    name=$(basename "$f" .json | sed 's/^answers-//')
    if [ -z "$first" ]; then first=$f; first_name=$name; continue; fi
    if cmp -s "$first" "$f"; then
      report ok "${name%%-*}" "${name#*-}" answers "the same bytes as $first_name"
    else
      report FAIL "${name%%-*}" "${name#*-}" answers "not what $first_name answered:"
      diff "$first" "$f" | head -60 | cut -c1-400 | sed 's/^/     | /'
      failed=1
    fi
  done
  # the schemas the migrations and createTables left: the same in every dialect on each database, step by step
  # (ADR-backend-0002)
  differences=$("$py" "$self/db.py" compare "$work")
  if [ -n "$differences" ]; then
    echo "FAIL the schemas of the dialects differ in:"; echo "$differences" | sed 's/^/     ~ /'; failed=1
  elif ls "$work"/schema-fastapi-* >/dev/null 2>&1 && ls "$work"/schema-nestjs-* >/dev/null 2>&1; then
    echo "ok   the schemas of the dialects are the same on every database, after every step"
  fi
}
finish() {
  [ "$failed" -eq 0 ] && echo "database-check: every dialect on every database ok" || echo "database-check: FAILED"
  exit "$failed"
}
if [ -n "$compare" ]; then compare_results; finish; fi

# the runtime of the nestjs dialect, built and copied fresh as the nestjs check does (see its comments); once, before
# the pairs of --parallel start (they share node_modules)
[ -n "$DBCHECK_PREPARED" ] || case " $dialects " in *" nestjs "*)
  (cd "$here/packages/synapsis-nest" && node "$nm/typescript/bin/tsc" -p tsconfig.json) || exit 1
  rm -rf "$nm/synapsis-nest"
  (cd "$root/nuclearlang/tools/node" && npm install --no-save --no-audit --no-fund --install-links "$here/packages/synapsis-nest" >/dev/null 2>&1) || exit 1 ;;
esac
[ -n "$DBCHECK_PREPARED" ] || { (cd "$root" && cargo build -q -p nuclear-cli) || exit 1; }
# `nuclear migrate` runs `nuclear build .`: the tree's build is the `nuclear` of this script
PATH="$root/target/debug:$PATH"; export PATH

if [ -n "$parallel" ]; then
  # each pair is a run of its own (its folder, its containers, its ports); its lines are printed when it ends
  pids=""
  for database in $databases; do for dialect in $dialects; do
    DBCHECK_PREPARED=1 OUT="$work" sh "$0" "$dialect" "$database" >"$work/log-$dialect-$database" 2>&1 &
    pids="$pids $!:$dialect-$database"
  done; done
  for p in $pids; do
    wait "${p%%:*}" || failed=1
    grep -v '^database-check: ' "$work/log-${p#*:}"
  done
  compare_results
  finish
fi

for database in $databases; do
  dialect="-"
  if [ "$database" != sqlite ]; then
    if ! out=$(start_database "$database" 2>&1); then
      report FAIL - "$database" database "the container did not become healthy"
      echo "$out" | sed 's/^/     | /'
      failed=1
      continue
    fi
    database_port=$(docker port "$prefix-$database" | head -1 | sed 's/.*://')
    report ok - "$database" database "$(docker inspect -f '{{.Config.Image}}' "$prefix-$database") on port $database_port"
  fi
  for dialect in $dialects; do
    [ "$database" = sqlite ] && { stage new fresh; cd "$work" || exit 1; unset DATABASE; }
    project="$work/$dialect-$database"
    mkdir -p "$project" && cp -r "$here/examples/examples-backend/store_api/." "$project" && rm -rf "$project/build" "$project/migrations"
    # the dialect, the plugin and the connection: the only lines that change (a project with migrations has no createTables)
    sed -i "s/dialect = \"[a-z]*\"/dialect = \"$dialect\"/; s/^plugins(sqlite = true)/plugins($database = true)/" "$project/config.nuc"
    case $database in
      sqlite) connection='SQLite(file = env("DATABASE", "app.sqlite"))'; url="$project/store.sqlite"; export DATABASE="$url" ;;
      postgres) connection='Postgres(url = env("DATABASE_URL"))' ;;
      mysql) connection='MySQL(url = env("DATABASE_URL"))' ;;
      mariadb) connection='MariaDB(url = env("DATABASE_URL"))' ;;
    esac
    if [ "$database" != sqlite ]; then
      create_database "$database" "store_$dialect" || { report FAIL "$dialect" "$database" database "no database store_$dialect"; failed=1; continue; }
      url="$database://$([ "$database" = postgres ] && echo postgres || echo root):nuclear@127.0.0.1:$database_port/store_$dialect"
      export DATABASE_URL="$url"
    fi
    sed -i "s|^    SQLite(.*|    $connection,|" "$project/config/project_config.nuc"
    grep -qF "$connection" "$project/config/project_config.nuc" || { report FAIL "$dialect" "$database" build "the connection was not written"; failed=1; continue; }
    stage build build || continue
    cd "$project/build" || exit 1
    stage checker checker || continue
    stage migrations migrations
    [ -f "$work/migrations-$dialect-$database.log" ] && sed 's/^/     + /' "$work/migrations-$dialect-$database.log"
    stage integration integration
    stage tests unit_tests
    stage tables tables
    cd "$work" || exit 1
    unset DATABASE DATABASE_URL
  done
  [ "$database" != sqlite ] && docker rm -f -v "$prefix-$database" >/dev/null 2>&1
done

# what a run keeps for the comparisons of several runs (--parallel, the CI's job of the comparisons)
if [ -n "$OUT" ]; then
  mkdir -p "$OUT" && cp "$work"/answers-*.json "$work"/schema-*.json "$OUT"/ 2>/dev/null
fi
compare_results
finish
