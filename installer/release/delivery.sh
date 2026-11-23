#!/bin/sh
# The delivery gate: everything that must pass before `git tag v<version>` is pushed (root rule 10). One step after
# the other, in this order; the first that fails stops it with what failed and how to fix it.
#
#   installer/release/delivery.sh 0.84.0                  every step
#   installer/release/delivery.sh 0.84.0 --offline-ok     an installer test that needs the network may be skipped
#   installer/release/delivery.sh 0.84.0 --only rust,website   only those steps (to try one; never before a tag)
#
# The steps: version (every project at the version, the knowledge base built at it), rust (cargo test), clippy
# (--all-targets, 0 warnings), nuclear (this tree's nuclear staged in a temporary installation, first on PATH: the
# later steps run it, never the one installed in the user's HOME), vscode (npm run compile, npm test: the Spanish of
# every text, no local-model setting), builder (Nuclear Builder: nuclear check, build, pytest), mcp (nuclear check,
# build, pytest), runtimes (synapsis-py pytest, synapsis-nest npm test), website (as .github/workflows/website.yml:
# content.mjs without UPDATE_EXAMPLES, so an onboarding example that is no longer what `nuclear new` writes fails here;
# nuclear build, install, test, the bundle), knowledge (nuclear-graph knowledge check clean), installer (package.sh,
# then installer/tests/run.sh: every case, OUT1 what the user reads, UPD1 an update from the previous published
# release and PRJ1 the projects that release made and installed, run after the update, included; a case skipped
# offline fails the gate unless --offline-ok).
#
# It never touches the real HOME's installation: no installer/install.sh, the installer tests in fake HOMEs. After the
# tag is pushed: installer/release/after-release.sh <version>.
set -u
REPO=$(cd "$(dirname "$0")/../.." && pwd)
VERSION=""; OFFLINE_OK=0; ONLY=""
while [ $# -gt 0 ]; do
  case $1 in
    --offline-ok) OFFLINE_OK=1 ;;
    --only) ONLY=",${2:?--only needs steps},"; shift ;;
    -h|--help) sed -n '2,/^set -u/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) VERSION=${1#v} ;;
  esac
  shift
done
[ -n "$VERSION" ] || { echo "usage: installer/release/delivery.sh <version> [--offline-ok] [--only <step>,...]" >&2; exit 2; }

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  RED=$(printf '\033[31m'); GREEN=$(printf '\033[32m'); BOLD=$(printf '\033[1m'); DIM=$(printf '\033[2m'); OFF=$(printf '\033[0m')
else RED=""; GREEN=""; BOLD=""; DIM=""; OFF=""; fi

WORK=$(mktemp -d "${TMPDIR:-/tmp}/nuclear-delivery.XXXXXX")
trap 'rm -rf "$WORK"' EXIT
trap 'exit 130' INT TERM HUP  # a signal still runs the EXIT trap: the work folder never stays
# the work folders of runs that were killed before this rule (1.3 GB each on a shared tmpfs)
find "${TMPDIR:-/tmp}" -maxdepth 1 -name 'nuclear-delivery.*' ! -path "$WORK" -mmin +180 -exec rm -rf {} + 2>/dev/null || true
LOGS="$REPO/target/delivery"; rm -rf "$LOGS"; mkdir -p "$LOGS"
DONE=""

# --- the steps: each a function; its output goes to target/delivery/<step>.log ---

step_version() { "$REPO/installer/release/version.sh" --check "v$VERSION"; }
fix_version="installer/release/version.sh $VERSION, then nuclear-graph knowledge build (and check, ingest)"

step_rust() { cd "$REPO" && cargo test; }
fix_rust="a golden file: UPDATE_GOLDEN=1 cargo test and review the difference; else fix the failing test"

step_clippy() { cd "$REPO" && cargo clippy --all-targets -- -D warnings; }
fix_clippy="fix every warning cargo clippy --all-targets prints"

# this tree's nuclear, staged as an installation (the layout the binaries expect), first on PATH for what follows
step_nuclear() {
  cd "$REPO" && installer/release/build-runtimes.sh && cargo build --release -p nuclear-cli -p nuclear-lsp &&
    installer/release/stage.sh "$WORK/nuclearlang" target/release/nuclear target/release/nuclear-lsp &&
    "$WORK/nuclearlang/bin/nuclear" dialect list
}
fix_nuclear="cargo build --release -p nuclear-cli -p nuclear-lsp and installer/release/stage.sh must work"
staged_path() { [ -x "$WORK/nuclearlang/bin/nuclear" ] || step_nuclear > "$LOGS/nuclear.log" 2>&1; PATH="$WORK/nuclearlang/bin:$PATH"; export PATH; }

step_vscode() {
  cd "$REPO/extensions/vscode" && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm run compile && npm test
}
fix_vscode="in extensions/vscode: npm run compile and npm test (a text without Spanish: add it to package.nls.es.json, l10n/bundle.l10n.es.json or the page's dictionary)"

step_builder() {
  cd "$REPO/extensions/tools/nuclear-builder" && nuclear check . --json > /dev/null && nuclear build . && cd build &&
    uv run --quiet --no-project --with httpx --with mcp --with pytest python -m pytest -q nuclear_builder/tests
}
fix_builder="in extensions/tools/nuclear-builder: nuclear check . && nuclear build . && cd build && pytest nuclear_builder/tests"

step_mcp() {
  cd "$REPO/tools/mcp" && nuclear check . && nuclear build . && uv sync --quiet --extra test && .venv/bin/python -m pytest -q
}
fix_mcp="in tools/mcp: nuclear check . && nuclear build . && uv sync --extra test && .venv/bin/python -m pytest -q"

# the environment outside the tree: stage.sh copies the package, and a .venv in it would name this machine's paths
step_runtimes() {
  cd "$REPO/nuclear-synapsis-framework/platforms/backend/packages/synapsis-py" &&
    { [ -f uv.lock ] && lock=1 || lock=0; UV_PROJECT_ENVIRONMENT="$WORK/synapsis-py" uv run --quiet --extra test --extra ai python -m pytest -q; code=$?
      [ "$lock" = 1 ] || rm -f uv.lock; [ "$code" = 0 ]; } &&
    cd ../synapsis-nest && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm test
}
fix_runtimes="the backend runtimes' tests: synapsis-py (uv run --extra test --extra ai pytest), synapsis-nest (npm test)"

# exactly the job of .github/workflows/website.yml: a failure here is a site that would not publish
step_website() {
  cd "$REPO/website" && (cd tools && npm ci --no-audit --no-fund) && env -u UPDATE_EXAMPLES node tools/content.mjs &&
    nuclear build && nuclear install && nuclear test && (cd build/app && npx vite build)
}
fix_website="in website: node tools/content.mjs says what differs; an onboarding example no longer what nuclear new writes: UPDATE_EXAMPLES=1 node tools/content.mjs, review and commit it"

# the installed nuclear-graph (rule 15: the release's machine has the AI services): the knowledge base is what the
# tree gives now, it holds the MCP server's and the Builder's tools (read from them installed), and the running graph
# holds its revision
step_knowledge() {
  command -v nuclear-graph > /dev/null 2>&1 || { echo "nuclear-graph is not installed: uv tool install --editable './nuclear-graph-storage[server]'"; return 1; }
  NUCLEAR_ROOT="$REPO" nuclear-graph knowledge check
}
fix_knowledge="nuclear-graph knowledge build, a row for what has no structured source, knowledge check clean, ingest"

step_installer() {
  cd "$REPO" && installer/release/package.sh && installer/tests/run.sh || return 1
  if grep -q "skipped (offline" "$LOGS/installer.log"; then
    [ "$OFFLINE_OK" = 1 ] && { echo "a case skipped offline: accepted (--offline-ok)"; return 0; }
    echo "a case was skipped offline: the gate needs the network (or --offline-ok)"; return 1
  fi
}
fix_installer="installer/tests/run.sh <case> again: the case's last lines are in the log; OUT1 is what the user reads (installer/tests/screen.py), UPD1 an update from the previous release, PRJ1 its projects run after the update (installer/tests/run.sh PRJ1)"

# --- the gate ---

summary_ok() {
  echo ""
  echo "${GREEN}${BOLD}Delivery gate passed for $VERSION${OFF}:$DONE"
  [ -z "$ONLY" ] && echo "${GREEN}Tag it:${OFF} git tag v$VERSION && git push origin v$VERSION; then installer/release/after-release.sh $VERSION"
}

for s in version rust clippy nuclear vscode builder mcp runtimes website knowledge installer; do
  case $ONLY in ''|*",$s,"*) ;; *) continue ;; esac
  case $s in builder|mcp|website|knowledge) staged_path ;; esac
  start=$(date +%s)
  printf '%s' "  $s ... "
  if ( "step_$s" ) > "$LOGS/$s.log" 2>&1; then
    echo "${GREEN}ok${OFF} ${DIM}($(($(date +%s) - start)) s)${OFF}"
    DONE="$DONE $s"
  else
    echo "${RED}failed${OFF}"
    echo ""
    echo "${RED}${BOLD}Delivery gate FAILED at step \"$s\" for $VERSION: do not tag.${OFF}"
    echo "${RED}Passed before it:${OFF}${DONE:- none}"
    echo "${RED}Its last lines${OFF} (all of it: target/delivery/$s.log):"
    tail -n 25 "$LOGS/$s.log" | sed 's/^/    /'
    eval "echo \"\${RED}How to fix:\${OFF} \$fix_$s\""
    echo "Then run installer/release/delivery.sh $VERSION again."
    exit 1
  fi
done
summary_ok
