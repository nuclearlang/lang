#!/usr/bin/env bash
# The backward-compatibility battery before a release (docs/06-runbooks/release.md "Backward compatibility"): the
# fixtures of every earlier stored format, loaded through today's code — the Builder's engine (teams, runs, flat
# specs, the line, an older chat history), Nuclear Chat's service (a history of its first version) and the editors
# (run files on the page, moved settings, saved projects).
#
#   extensions/scripts/compat-check.sh                     the fixtures
#   extensions/scripts/compat-check.sh --real <project>    and, read-only, this machine's teams and that project's
#                                                          runs (the teams are read from a copy: nothing is written)
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
tree="$(cd "$here/.." && pwd)"
builder="$here/tools/nuclear-builder"
chat="$tree/nuclear-chat/nuclear_chat"

echo "== Nuclear Builder: the engine's fixtures"
(cd "$builder" && nuclear check . --json > /dev/null && nuclear build . > /dev/null)
(cd "$builder/build" && ../.venv/bin/pytest -q nuclear_builder/tests/test_compat.py)

echo "== Nuclear Chat: a history of the first service"
(cd "$chat" && nuclear build . > /dev/null)
(cd "$chat/build" && .venv/bin/pytest -q tests/chat_test.py -k first_history)

echo "== The editors: run files on the page, moved settings, saved projects"
(cd "$here/vscode" && npm run -s test:compat > /dev/null && echo "editors: passed")

if [[ "${1:-}" == "--real" ]]; then
  project="${2:?--real <project folder>}"
  home="$(mktemp -d)"
  trap 'rm -rf "$home"' EXIT
  cp -a "${NUCLEAR_FACTORY_HOME:-$HOME/.config/nuclearlang/factory}/." "$home/"
  # the earlier versions kept as .bak load too, as teams of their own (old-<id>)
  for bak in "$home"/teams/*.json.bak; do
    [[ -e "$bak" ]] && python3 -c 'import json,sys; t=json.load(open(sys.argv[1])); t["id"]=sys.argv[3]; json.dump(t, open(sys.argv[2], "w"))' \
      "$bak" "$home/teams/old-$(basename "$bak" .json.bak).json" "old-$(basename "$bak" .json.bak)"
  done
  nb() { NUCLEAR_FACTORY_HOME="$home" PYTHONPATH="$builder/build" "$builder/.venv/bin/python" -c 'import sys; from nuclear_builder.cli import main; sys.exit(main())' "$@"; }
  echo "== This machine's teams (read from a copy) and the runs of $project"
  teams="$(nb team list --json)"
  echo "$teams" | python3 -c 'import json,sys; t=json.load(sys.stdin); print(len(t), "teams:", ", ".join(x["id"] for x in t))'
  for id in $(echo "$teams" | python3 -c 'import json,sys; print(" ".join(x["id"] for x in json.load(sys.stdin)))'); do
    nb team show "$id" --json | python3 -c 'import json,sys; t=json.load(sys.stdin); print(" ", t["id"], len(t["members"]), "members, missing:", t["missing"])'
  done
  (cd "$project" && nb runs --json | python3 -c 'import json,sys; r=json.load(sys.stdin); print(len(r), "runs")')
fi
echo "compat: all passed"
