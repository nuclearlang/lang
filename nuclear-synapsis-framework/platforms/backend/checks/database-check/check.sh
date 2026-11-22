#!/bin/sh
# The same Nuclear project (examples/examples-backend/store_api) on real databases, with every backend dialect:
# for each dialect (fastapi, nestjs) and each database (sqlite, postgres, mysql, mariadb) it builds the project with
# that connection, runs the target's strict checker, the migrations (made, applied, the real schema read back, a
# column added to a table with rows, reverted, applied again), the app over HTTP with one scenario (scenario.py) and
# the project's tests; then it compares the answers: the same bytes in every dialect on every database.
#
#   check.sh                     everything
#   check.sh fastapi postgres    only those dialects and databases (any of each)
#
# Needs Docker (the databases run in throwaway containers, removed when the script ends) and what the other two
# checks need: nuclearlang/tools/python/.venv and nuclearlang/tools/node (npm install there).
here=$(cd "$(dirname "$0")/../.." && pwd)
root=${NUCLEAR_ROOT:-$(cd "$here/../../.." && pwd)}
self="$here/checks/database-check"
V="$root/nuclearlang/tools/python/.venv/bin"
nm="$root/nuclearlang/tools/node/node_modules"
py="$V/python"

dialects="" databases=""
for a in "$@"; do
  case $a in
    fastapi|nestjs) dialects="$dialects $a" ;;
    sqlite|postgres|mysql|mariadb) databases="$databases $a" ;;
    *) echo "usage: check.sh [fastapi|nestjs]... [sqlite|postgres|mysql|mariadb]..." >&2; exit 2 ;;
  esac
done
dialects=${dialects:-fastapi nestjs}
databases=${databases:-sqlite postgres mysql mariadb}

work=$(mktemp -d "${TMPDIR:-/tmp}/nuclear-dbcheck.XXXXXX")
prefix="nuclear-dbcheck-$$"
app_pid=""
failed=0
cleanup() {
  [ -n "$app_pid" ] && kill "$app_pid" 2>/dev/null
  ids=$(docker ps -aq --filter "name=$prefix-" 2>/dev/null)
  [ -n "$ids" ] && docker rm -f -v $ids >/dev/null 2>&1
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
migrate() {
  if [ "$dialect" = fastapi ]; then "$py" -m synapsis.migrate "$@" --dir "$project/migrations"
  else node node_modules/synapsis-nest/dist/migrate.js "$@" --dir "$project/migrations"; fi
}
build() { # the project → build/, compiled when the dialect compiles
  (cd "$root" && cargo run -q -p nuclear-cli -- build "$project") || return 1
  [ "$dialect" = fastapi ] && return 0
  ln -sfn "$nm" "$project/build/node_modules"
}
unit_tests() {
  if [ "$dialect" = fastapi ]; then "$py" -m pytest -q -p no:warnings
  else
    out=$(node --import ./dist/src/test_env.js --test "dist/test/**/*.js" 2>&1) || { echo "$out"; return 1; }
    echo "$out" | grep -E '^ℹ (tests|pass|fail)' | tr '\n' ' '
  fi
}
migrations() {
  made=$(migrate make "first") || { echo "$made"; return 1; }
  migrate up || return 1
  migrate make "again" | grep -q "no changes" || { echo 'a second `make` with nothing changed wrote a migration'; return 1; }
  "$py" "$self/db.py" schema "$url" >"$work/schema-$dialect-$database.json" || { cat "$work/schema-$dialect-$database.json"; return 1; }
  "$py" "$self/db.py" seed "$url" || return 1
  # a field with a default added to an entity whose table has rows
  sed -i 's/^  credit: double = 0.0$/&\n  points: int = 7/' "$project/components/store/data/entities/customer.nuc"
  grep -q 'points: int = 7' "$project/components/store/data/entities/customer.nuc" || { echo "the entity was not edited"; return 1; }
  build && checker >/dev/null || { echo "the project with the new field does not build"; return 1; }
  migrate make "points of a customer" || return 1
  migrate up && "$py" "$self/db.py" points "$url" present || return 1
  migrate down && "$py" "$self/db.py" points "$url" absent || return 1
  migrate up && "$py" "$self/db.py" points "$url" present || return 1
  "$py" "$self/db.py" schema "$url" --points >/dev/null || return 1
  echo "made, applied, nothing left to make, the schema read back, a column added to a table with rows, reverted, applied again"
}
integration() {
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
  "$py" "$self/scenario.py" "http://127.0.0.1:$http" "$url" "$work/answers-$dialect-$database.json"
  code=$?
  kill "$app_pid" 2>/dev/null; wait "$app_pid" 2>/dev/null; app_pid=""
  [ "$code" -eq 0 ] || { echo "--- the app's log:"; tail -40 "$work/app.log"; }
  return "$code"
}

# the runtime of the nestjs dialect, built and copied fresh as the nestjs check does (see its comments)
case " $dialects " in *" nestjs "*)
  (cd "$here/packages/synapsis-nest" && node "$nm/typescript/bin/tsc" -p tsconfig.json) || exit 1
  rm -rf "$nm/synapsis-nest"
  (cd "$root/nuclearlang/tools/node" && npm install --no-save --no-audit --no-fund --install-links "$here/packages/synapsis-nest" >/dev/null 2>&1) || exit 1 ;;
esac
(cd "$root" && cargo build -q -p nuclear-cli) || exit 1

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
    stage integration integration
    stage tests unit_tests
    cd "$work" || exit 1
    unset DATABASE DATABASE_URL
  done
  [ "$database" != sqlite ] && docker rm -f -v "$prefix-$database" >/dev/null 2>&1
done

# --- the answers: the same in every dialect on every database
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
[ "$failed" -eq 0 ] && echo "database-check: every dialect on every database ok" || echo "database-check: FAILED"
exit "$failed"
