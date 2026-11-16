#!/usr/bin/env bash
# Keeps each project's documents in step with its code, across sessions and restarts (docs/README.md).
#   session: at session start, lists the projects whose code is newer than their documents (work another session
#            finished without recording), and the context documents that grew too long.
#   stop:    at the end of a turn, blocks once if this session changed a project's code after that project's
#            documents (its AGENTS.md or its docs/), or left the knowledge base of the Smart Graph behind the tree.
set -u
root="$(cd "$(dirname "$0")/../.." && pwd)"
input="$(cat)"
sid="$(printf '%s' "$input" | sed -n 's/.*"session_id" *: *"\([^"]*\)".*/\1/p')"
marker="${XDG_RUNTIME_DIR:-/tmp}/nuclear-context-${sid:-none}"
cd "$root" || exit 0

# Generated and vendored folders (type definitions are generated too), and the documents themselves.
skip=(-name target -o -name node_modules -o -name build -o -name .dart_tool -o -name .venv -o -name dist
  -o -name dist-test -o -name .pytest_cache -o -name __pycache__ -o -name .git -o -name docs -o -name .nuclear
  -o -name defs
  -o -path ./github-profile -o -path ./extensions/vscode/out -o -path ./extensions/vscode/server
  -o -path ./extensions/vscode/icon-themes -o -path ./nuclear-graph-storage/data
  -o -path '*/eval/results' -o -path '*/eval/*/results')

# What counts as code: sources, data of the dialects, scripts, manifests.
code=(-name '*.rs' -o -name '*.toml' -o -name '*.tpl' -o -name '*.nuc' -o -name '*.ts' -o -name '*.mjs' -o -name '*.js'
  -o -name '*.java' -o -name '*.py' -o -name '*.sh' -o -name '*.dart' -o -name '*.yml' -o -name '*.ps1' -o -name '*.json')

# The projects: every folder with an AGENTS.md.
projects() {
  find . \( "${skip[@]}" \) -prune -o -name AGENTS.md -print 2>/dev/null | sed 's|/AGENTS\.md$||' | sort
}

# The newest document of project $1: its AGENTS.md or a file of its docs/.
stamp() {
  find "$1/AGENTS.md" "$1/docs" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -n 1 | cut -d' ' -f2-
}

# The code of project $1 (not of a project inside it) newer than its documents; with $2, also newer than $2.
stale() {
  local p="$1" since="${2:-}" doc inner=() q
  doc="$(stamp "$p")"
  [ -n "$doc" ] || return 0
  while IFS= read -r q; do
    [ "$q" != "$p" ] && case "$q" in "$p"/*) inner+=(-o -path "$q") ;; esac
  done <<<"$all"
  # what git ignores is generated (a build's output, a site's content): only the files git keeps count
  find "$p" \( "${skip[@]}" "${inner[@]}" \) -prune -o -type f \( "${code[@]}" \) -newer "$doc" ${since:+-newer "$since"} -print 2>/dev/null |
    git check-ignore --stdin --non-matching --verbose 2>/dev/null | awk -F '\t' '$1 == "::" { print $2 }'
}

# What the knowledge base is made from (sources, documents, dialects, the agents) and was changed after $1.
touched() {
  find nuclearlang tools docs nuclear-synapsis-framework extensions nuclear-graph-storage nuclear-agents installer \
    README.md AGENTS.md \
    \( -name target -o -name node_modules -o -name build -o -name .dart_tool -o -name .venv -o -name dist-test -o -name dist -o -name .pytest_cache -o -name __pycache__ -o -name .git -o -name results -o -name out -o -name server \) -prune \
    -o -type f \( -name '*.md' -o -name '*.nuc' -o -name '*.toml' -o -name '*.rs' -o -name '*.py' -o -name '*.ts' -o -name '*.json' \) -newer "$1" -print -quit 2>/dev/null
}

all="$(projects)"

case "${1:-}" in
session)
  [ -e "$marker" ] || touch "$marker"
  while IFS= read -r p; do
    files="$(stale "$p")"
    if [ -n "$files" ]; then
      echo "${p#./}: $(printf '%s\n' "$files" | wc -l) file(s) are newer than its documents. Before reporting or planning,"
      echo "look at them and bring its AGENTS.md, its docs/ and its docs/01-product/roadmap.md up to date:"
      printf '%s\n' "$files" | head -n 8
    fi
  done <<<"$all"
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
  report=""
  while IFS= read -r p; do
    files="$(stale "$p" "$marker")"
    [ -n "$files" ] && report+="${p#./}:"$'\n'"$(printf '%s\n' "$files" | head -n 6)"$'\n'
  done <<<"$all"
  if [ -n "$report" ]; then
    {
      echo "This session changed code after the last edit of its project's documents. Before finishing, for each"
      echo "project below: its docs/ say what changed (docs/05-standards/coding.md, \"A change is done when\") and its"
      echo "docs/01-product/roadmap.md is current (done items removed, half-done work recorded):"
      printf '%s' "$report"
    } >&2
    exit 2
  fi
  # The knowledge base follows the tree: a session that changed what it is made from leaves it built, reviewed and
  # ingested.
  graph="$root/nuclear-graph-storage/.venv/bin/nuclear-graph"
  if [ -x "$graph" ] && [ -n "$(touched "$marker")" ]; then
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
