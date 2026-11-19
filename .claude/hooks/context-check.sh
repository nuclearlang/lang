#!/usr/bin/env bash
# Keeps each project's documents in step with its code, across sessions and restarts (docs/README.md).
# It compares contents through git, never file dates: a checkout, a restore or a reboot changes dates, not work.
#   session: at session start, lists the projects whose code differs from the last commit while none of their
#            documents does (work another session finished without recording), and the context documents that grew
#            too long. It keeps a snapshot of what already differed, so `stop` sees only this session's work.
#   stop:    at the end of a turn, blocks once if this session changed a project's code and none of that project's
#            documents (its AGENTS.md or its docs/), or left the knowledge base of the Smart Graph behind the tree.
set -u
root="$(cd "$(dirname "$0")/../.." && pwd)"
input="$(cat)"
sid="$(printf '%s' "$input" | sed -n 's/.*"session_id" *: *"\([^"]*\)".*/\1/p')"
marker="${XDG_RUNTIME_DIR:-/tmp}/nuclear-context-${sid:-none}"
cd "$root" || exit 0

# The projects: every folder with an AGENTS.md (generated folders and the profile's own repository are not).
projects() {
  find . \( -name target -o -name node_modules -o -name build -o -name .dart_tool -o -name .venv -o -name dist \
    -o -name .git -o -name docs -o -path ./github-profile \) -prune -o -name AGENTS.md -print 2>/dev/null |
    sed 's|^\./||; s|/AGENTS\.md$||; s|^AGENTS\.md$|.|' | sort
}

# Every file that differs from the last commit (changed, new or deleted; git ignores what is generated), with the
# hash of its contents ("-" when deleted): "<hash> <path>".
dirty() {
  { git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | sort -u |
    while IFS= read -r f; do
      if [ -f "$f" ]; then echo "$(git hash-object -- "$f") $f"; else echo "- $f"; fi
    done
}

# The paths of $1 (lines of dirty) not in the snapshot $2 with the same contents.
since() {
  awk 'NR == FNR { seen[$0] = 1; next } !($0 in seen) { sub(/^[^ ]+ /, ""); print }' "$2" - <<<"$1"
}

# From changed paths on stdin: "<project>\t<doc|code>\t<path>" for each document or code file, a file belonging to
# the closest project above it. Code is sources, data of the dialects, scripts, manifests; generated folders, type
# definitions and the knowledge base's data are not.
classify() {
  awk -v list="$all" '
    BEGIN { n = split(list, ps, "\n") }
    {
      f = $0; best = "."
      for (i = 1; i <= n; i++) if (ps[i] != "." && index(f, ps[i] "/") == 1 && length(ps[i]) > length(best)) best = ps[i]
      rel = (best == ".") ? f : substr(f, length(best) + 2)
      if (rel == "AGENTS.md" || rel ~ /^docs\//) { print best "\tdoc\t" f; next }
      if (f ~ /(^|\/)(target|node_modules|build|\.dart_tool|\.venv|dist|dist-test|\.pytest_cache|__pycache__|docs|\.nuclear|defs)\//) next
      if (f ~ /^(github-profile|extensions\/vscode\/out|extensions\/vscode\/server|extensions\/vscode\/icon-themes|nuclear-graph-storage\/data)\//) next
      if (f ~ /\/eval\/(.*\/)?results\//) next
      if (f ~ /\.(rs|toml|tpl|nuc|ts|mjs|js|java|py|sh|dart|yml|ps1|json)$/) print best "\tcode\t" f
    }'
}

# The projects of the classified lines on stdin with code and no document: "<project>:" and its first files.
undocumented() {
  awk -F '\t' '
    $2 == "doc" { doc[$1] = 1; next }
    { if (!($1 in code)) order[++n] = $1; code[$1] = code[$1] $3 "\n"; count[$1]++ }
    END {
      for (i = 1; i <= n; i++) {
        p = order[i]; if (p in doc) continue
        printf "%s: %d file(s)\n", p, count[p]
        m = split(code[p], fs, "\n"); for (j = 1; j < m && j <= 6; j++) print "  " fs[j]
      }
    }'
}

all="$(projects)"

case "${1:-}" in
session)
  # the snapshot is taken once: a resumed or compacted session keeps the one of its start
  [ -s "$marker" ] || dirty >"$marker"
  report="$(dirty | sed 's/^[^ ]* //' | classify | undocumented)"
  if [ -n "$report" ]; then
    echo "These projects have code that differs from the last commit while none of their documents does: work that"
    echo "was not recorded. Before reporting or planning, look at it and bring the project's AGENTS.md, its docs/ and"
    echo "its docs/01-product/roadmap.md up to date:"
    printf '%s\n' "$report"
  fi
  # A context document is read in one go (references, guides and plans are as long as their subject).
  long="$(find . \( -name target -o -name node_modules -o -name build -o -name .venv -o -name .git -o -name github-profile -o -name 07-reference -o -name 08-guides -o -name 04-specs -o -name aprende \) -prune \
    -o -type f \( -path '*/docs/*' -o -name AGENTS.md \) -name '*.md' -print 2>/dev/null | xargs -r wc -l 2>/dev/null | awk '$2 != "total" && $1 > 250 {print "  " $1 " lines  " $2}')"
  if [ -n "$long" ]; then
    echo "These context documents are over 250 lines: split each by topic (docs/README.md, \"Short files\")."
    printf '%s\n' "$long" | head -n 12
  fi
  ;;
stop)
  printf '%s' "$input" | grep -q '"stop_hook_active" *: *true' && exit 0
  [ -e "$marker" ] || exit 0
  changed="$(since "$(dirty)" "$marker")"
  [ -n "$changed" ] || exit 0
  report="$(printf '%s\n' "$changed" | classify | undocumented)"
  if [ -n "$report" ]; then
    {
      echo "This session changed code of these projects and none of their documents. Before finishing, for each one:"
      echo "its docs/ say what changed (docs/05-standards/coding.md, \"A change is done when\") and its"
      echo "docs/01-product/roadmap.md is current (done items removed, half-done work recorded):"
      printf '%s\n' "$report"
    } >&2
    exit 2
  fi
  # The knowledge base follows the tree: a session that changed what it is made from leaves it built, reviewed and
  # ingested.
  graph="$root/nuclear-graph-storage/.venv/bin/nuclear-graph"
  sources="$(printf '%s\n' "$changed" |
    grep -E '^(nuclearlang|tools|docs|nuclear-synapsis-framework|extensions|nuclear-graph-storage|nuclear-agents|installer)/|^(README|AGENTS)\.md$' |
    grep -vE '(^|/)(target|node_modules|build|\.dart_tool|\.venv|dist|dist-test|\.pytest_cache|__pycache__|results|out|server)/' |
    grep -E '\.(md|nuc|toml|rs|py|ts|json)$' | head -n 1)"
  if [ -x "$graph" ] && [ -n "$sources" ]; then
    if ! out="$("$graph" knowledge check 2>&1)"; then
      {
        echo "The knowledge base (nuclear-graph-storage/data) is behind the working tree. Before finishing:"
        echo "nuclear-graph knowledge build; update or confirm (knowledge review) the rows it names; nuclear-graph ingest."
        echo "A new tool, error, capability, limit or procedure gets its row (playbook:update-the-knowledge-base):"
        printf '%s\n' "$out" | head -n 20
      } >&2
      exit 2
    fi
  fi
  ;;
esac
exit 0
