#!/bin/sh
# One version for the whole platform (ADR-platform-0011): the compiler, the language server, the devices, the
# dialects' runtimes, the Smart Graph, the MCP server, the Builder, the chat, the agents, the editors' extensions.
# A release is one snapshot: every project carries the version of Cargo.toml [workspace.package], and a change to
# any of them raises it for all.
#
#   installer/release/version.sh                 print the version
#   installer/release/version.sh 0.81.0          write it into every project (and its lock files)
#   installer/release/version.sh --check         exit 1 when a project carries another version, or the knowledge base
#                                                (nuclear-graph-storage/data) was not built at this version
#   installer/release/version.sh --check v0.81.0 the same, and the tag must be that version (the release workflow)
set -eu
REPO=$(cd "$(dirname "$0")/../.." && pwd)
cd "$REPO"

# the projects and how each file names its version: toml (the first `version = "..."`), json (the first
# `"version": "..."`), xml (`<version>`), nuc (the `version = "..."` of `app(...)` in a config.nuc), yaml (`version:`)
FILES='toml nuclearlang/base/nuclear.toml
toml extensions/tools/nuclear-builder/nuclear.toml
toml extensions/tools/nuclear-builder/pyproject.toml
toml nuclear-agents/roles/nuclear.toml
toml nuclear-chat/system/nuclear.toml
toml nuclear-chat/system/pyproject.toml
toml nuclear-graph-storage/nuclear.toml
toml nuclear-graph-storage/pyproject.toml
toml tools/mcp/nuclear.toml
toml tools/mcp/pyproject.toml
toml nuclear-synapsis-framework/platforms/backend/packages/synapsis-py/pyproject.toml
json nuclear-synapsis-framework/platforms/backend/packages/synapsis-nest/package.json
json nuclear-synapsis-framework/platforms/web/packages/synapsis-web/package.json
json extensions/vscode/package.json
xml extensions/jetbrains/resources/META-INF/plugin.xml
toml extensions/zed/extension.toml
toml extensions/zed/Cargo.toml
nuc nuclear-agents/nuclear_developer/config.nuc
nuc nuclear-chat/nuclear_chat/config.nuc
nuc nuclear-chat/ui/config.nuc
yaml nuclear-synapsis-framework/platforms/mobile/packages/synapsis/pubspec.yaml
yaml nuclear-synapsis-framework/platforms/mobile/packages/synapsis_genkit/pubspec.yaml'

# the lock files that hold a project of the platform at its version (an editable or path dependency)
LOCKS='extensions/tools/nuclear-builder/uv.lock
nuclear-graph-storage/uv.lock
tools/mcp/uv.lock
extensions/zed/Cargo.lock'
OURS='nuclear-builder nuclear-graph nuclear-mcp nuclear-chat-system synapsis-py zed-nuclearlang'

workspace() { sed -n '/^\[workspace.package\]/,/^\[/s/^version = "\(.*\)"/\1/p' Cargo.toml | head -n 1; }

read_version() { # <kind> <file>
  case $1 in
    toml) sed -n 's/^version = "\(.*\)"/\1/p' "$2" | head -n 1 ;;
    json) sed -n 's/^  "version": "\(.*\)",*/\1/p' "$2" | head -n 1 ;;
    xml) sed -n 's/.*<version>\(.*\)<\/version>.*/\1/p' "$2" | head -n 1 ;;
    nuc) sed -n 's/^app(.*version = "\([^"]*\)".*/\1/p' "$2" | head -n 1 ;;
    yaml) sed -n 's/^version: *\(.*\)/\1/p' "$2" | head -n 1 ;;
  esac
}

# the version line after `name = "<one of ours>"` (uv.lock, Cargo.lock), printed as "<name> <version>" or rewritten
lock() { # <file> [<new version>]
  awk -v ours=" $OURS " -v new="${2:-}" '
    /^name = "/ { n = $0; sub(/^name = "/, "", n); sub(/".*/, "", n); take = index(ours, " " n " ") > 0 }
    take && /^version = "/ { if (new == "") { v = $0; sub(/^version = "/, "", v); sub(/".*/, "", v); print n " " v } else $0 = "version = \"" new "\""; take = 0 }
    new != "" { print }
  ' "$1"
}

write() { # <kind> <file> <version>: only the first occurrence
  tmp="$2.version-tmp"
  case $1 in
    toml) awk -v v="$3" '!done && /^version = "/ { $0 = "version = \"" v "\""; done = 1 } { print }' "$2" >"$tmp" ;;
    json) awk -v v="$3" '!done && /^  "version": "/ { sub(/"version": "[^"]*"/, "\"version\": \"" v "\""); done = 1 } { print }' "$2" >"$tmp" ;;
    xml) awk -v v="$3" '!done && /<version>/ { sub(/<version>[^<]*<\/version>/, "<version>" v "</version>"); done = 1 } { print }' "$2" >"$tmp" ;;
    nuc) awk -v v="$3" '!done && /^app\(.*version = "/ { sub(/version = "[^"]*"/, "version = \"" v "\""); done = 1 } { print }' "$2" >"$tmp" ;;
    yaml) awk -v v="$3" '!done && /^version:/ { $0 = "version: " v; done = 1 } { print }' "$2" >"$tmp" ;;
  esac
  mv "$tmp" "$2"
}

json_lock() { # package-lock.json beside a package.json: its own two versions
  f="$(dirname "$1")/package-lock.json"
  [ -f "$f" ] || return 0
  awk -v v="$2" 'NR <= 12 && /^ *"version": "/ && count < 2 { sub(/"version": "[^"]*"/, "\"version\": \"" v "\""); count++ } { print }' "$f" >"$f.version-tmp"
  mv "$f.version-tmp" "$f"
}

V=$(workspace)
case "${1:-}" in
  "")
    echo "$V" ;;
  --check)
    bad=0
    if [ -n "${2:-}" ] && [ "${2#v}" != "$V" ]; then
      echo "the tag $2 is not the workspace's version $V (Cargo.toml [workspace.package])"; bad=1
    fi
    echo "$FILES" | while read -r kind file; do
      got=$(read_version "$kind" "$file")
      [ "$got" = "$V" ] || echo "$file: $got"
    done >"${TMPDIR:-/tmp}/nuclear-version-check.$$"
    echo "$LOCKS" | while read -r file; do
      lock "$file" | while read -r name got; do [ "$got" = "$V" ] || echo "$file ($name): $got"; done
    done >>"${TMPDIR:-/tmp}/nuclear-version-check.$$"
    # the Smart Graph's base names each component's version (assets/tools/components.json): built at another one,
    # it is not this snapshot's (`nuclear-graph knowledge build` after the version changed)
    sed -n 's/^ *"version": "\(.*\)"/\1/p' nuclear-graph-storage/data/assets/tools/components.json | sort -u | while read -r got; do
      [ "$got" = "$V" ] || echo "nuclear-graph-storage/data (the knowledge base, built at $got): nuclear-graph knowledge build"
    done >>"${TMPDIR:-/tmp}/nuclear-version-check.$$"
    if [ -s "${TMPDIR:-/tmp}/nuclear-version-check.$$" ]; then
      echo "not at $V (run installer/release/version.sh $V):"; sed 's/^/  /' "${TMPDIR:-/tmp}/nuclear-version-check.$$"; bad=1
    fi
    rm -f "${TMPDIR:-/tmp}/nuclear-version-check.$$"
    [ "$bad" = 0 ] && echo "every project is at $V"
    exit "$bad" ;;
  -*)
    sed -n '2,10s/^# \{0,1\}//p' "$0"; exit 2 ;;
  *)
    NEW=${1#v}
    case $NEW in *[!0-9.]*|"") echo "not a version: $1"; exit 2 ;; esac
    awk -v v="$NEW" '/^\[workspace.package\]/ { in_ws = 1 } in_ws && /^version = "/ { $0 = "version = \"" v "\""; in_ws = 0 } { print }' Cargo.toml >Cargo.toml.version-tmp
    mv Cargo.toml.version-tmp Cargo.toml
    echo "$FILES" | while read -r kind file; do
      write "$kind" "$file" "$NEW"
      if [ "$kind" = json ]; then json_lock "$file" "$NEW"; fi
    done
    echo "$LOCKS" | while read -r file; do lock "$file" "$NEW" >"$file.version-tmp" && mv "$file.version-tmp" "$file"; done
    command -v cargo >/dev/null && cargo update -w -q --offline
    echo "every project is at $NEW" ;;
esac
