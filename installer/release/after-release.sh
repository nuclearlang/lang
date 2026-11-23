#!/bin/sh
# After the tag v<version> is pushed: the release is checked where the user gets it (root rule 10).
#
#   installer/release/after-release.sh 0.84.0
#
# 1. Every workflow of the tag's commit and of the tag (release, ci, website, platform-*, the extensions') finishes
#    and succeeds: it waits for them (AFTER_RELEASE_WAIT minutes, default 90).
# 2. The GitHub release has every asset .github/workflows/release.yml publishes (the list below follows its matrices).
# 3. https://nuclearlang.github.io/install.sh and install.ps1 are byte-identical to installer/release/ of the tag
#    (retried for AFTER_RELEASE_SITE minutes, default 10: the site publishes after the website workflow).
# 4. The real user's path, in a fake HOME (never the real one; the AI services skipped): the public one-liner installs
#    this version, and the previous release, installed by its own installer, is updated by the public installer as
#    `nuclear update` runs it, with `nuclear` through its link finding its installation.
# Any failure stops it in red: the release is not finished until this passes.
set -u
REPO=$(cd "$(dirname "$0")/../.." && pwd)
V=${1:?usage: installer/release/after-release.sh <version>}; V=${V#v}
GH_REPO=nuclearlang/nuclearlang; SITE=https://nuclearlang.github.io
WAIT=${AFTER_RELEASE_WAIT:-90}; SITE_WAIT=${AFTER_RELEASE_SITE:-10}
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  RED=$(printf '\033[31m'); GREEN=$(printf '\033[32m'); BOLD=$(printf '\033[1m'); OFF=$(printf '\033[0m')
else RED=""; GREEN=""; BOLD=""; OFF=""; fi
WORK=$(mktemp -d "${TMPDIR:-/tmp}/nuclear-after-release.XXXXXX")
trap 'rm -rf "$WORK"' EXIT
trap 'exit 130' INT TERM HUP  # a signal still runs the EXIT trap: the work folder never stays
# the work folders of runs that were killed before this rule (1.3 GB each on a shared tmpfs)
find "${TMPDIR:-/tmp}" -maxdepth 1 -name 'nuclear-after-release.*' ! -path "$WORK" -mmin +180 -exec rm -rf {} + 2>/dev/null || true
fail() { echo ""; echo "${RED}${BOLD}After the release of $V: FAILED: $1${OFF}"; [ -n "${2:-}" ] && echo "${RED}How to fix:${OFF} $2"; exit 1; }
ok() { echo "  ${GREEN}✓${OFF} $*"; }

sha=$(git -C "$REPO" rev-list -n 1 "v$V" 2>/dev/null) || fail "no tag v$V here" "git fetch --tags"

# --- 1. the workflows ---
echo "the workflows of v$V ($sha)"
deadline=$(($(date +%s) + WAIT * 60))
retried=""
wait_runs() {
while :; do
  runs=$(gh run list -R "$GH_REPO" --commit "$sha" --limit 50 --json name,status,conclusion,databaseId \
    -q '.[] | "\(.name)\t\(.status)\t\(.conclusion)\t\(.databaseId)"') || fail "gh run list did not answer" "gh auth status"
  absent=""
  for need in release ci website; do printf '%s\n' "$runs" | grep -q "^$need	" || absent="$absent $need"; done
  pending=$(printf '%s\n' "$runs" | awk -F '\t' 'NF && $2 != "completed"' | wc -l | tr -d ' ')
  [ -z "$absent" ] && [ "$pending" = 0 ] && break
  if [ "$(date +%s)" -ge "$deadline" ]; then
    [ -n "$absent" ] && fail "the workflow(s)$absent never ran for $sha" "a tag pushed from a commit of main: git push origin main, then the tag"
    fail "$pending workflow(s) still running after $WAIT minutes" "gh run list -R $GH_REPO --commit $sha"
  fi
  sleep 30
done
}
wait_runs
# a job GitHub never gave a runner (macOS runners short of capacity: "not acquired by Runner", cancelled with no
# step) is not a failure of the release: its run is tried again once, then judged
if [ -z "$retried" ]; then
  for id in $(printf '%s\n' "$runs" | awk -F '\t' '$3 == "cancelled" || $3 == "failure" { print $4 }'); do
    if gh run view "$id" -R "$GH_REPO" --json jobs -q '.jobs[] | select(.conclusion == "cancelled" and (.steps | length) == 0) | .name' 2>/dev/null | grep -q .; then
      echo "  a job of run $id never got a runner: tried again"; gh run rerun "$id" -R "$GH_REPO" --failed >/dev/null && retried=1
    fi
  done
  if [ -n "$retried" ]; then sleep 20; deadline=$(($(date +%s) + WAIT * 60)); wait_runs; fi
fi
bad=$(printf '%s\n' "$runs" | awk -F '\t' '$3 != "success" && $3 != "skipped" { print $1 " (" $3 "): gh run view " $4 " -R '"$GH_REPO"' --log-failed" }')
[ -z "$bad" ] || fail "a workflow did not succeed:
$bad" "fix it, then a PATCH release (a failed website means the site still serves the previous installer)"
# the stores never stop a release (the job goes on on error): what did not reach one is said, not hidden
rel=$(printf '%s\n' "$runs" | awk -F '\t' '$1 == "release" { print $4; exit }')
stores=$(gh run view "$rel" -R "$GH_REPO" --json jobs -q '.jobs[] | select(.name == "marketplaces") | .steps[] | select(.conclusion == "failure") | .name' 2>/dev/null | paste -sd, -)
[ -z "$stores" ] || echo "  ${RED}!${OFF} the extension did not reach: $stores (gh run view $rel -R $GH_REPO --log-failed)"
ok "every workflow succeeded: $(printf '%s\n' "$runs" | cut -f 1 | sort -u | tr '\n' ' ')"

# --- 2. the assets: what release.yml publishes (the archive matrix, the AI matrix, the extension, the vectors) ---
want="install.sh install.ps1 nuclearlang-$V.vsix nuclearlang-$V.vsix.sha256 nuclearlang-embeddings-$V.npz nuclearlang-embeddings-$V.npz.sha256"
for t in linux-x86_64.tar.gz linux-aarch64.tar.gz macos-x86_64.tar.gz macos-aarch64.tar.gz windows-x86_64.zip windows-aarch64.zip; do
  want="$want nuclearlang-$V-$t nuclearlang-$V-$t.sha256"
done
for t in linux-x86_64.tar.gz linux-aarch64.tar.gz macos-aarch64.tar.gz windows-x86_64.zip; do
  want="$want nuclearlang-ai-$V-$t nuclearlang-ai-$V-$t.sha256"
done
have=$(gh release view "v$V" -R "$GH_REPO" --json assets -q '.assets[].name') || fail "no GitHub release v$V" "the release workflow's job publish"
missing=""
for a in $want; do printf '%s\n' "$have" | grep -qx "$a" || missing="$missing $a"; done
[ -z "$missing" ] || fail "the release v$V lacks:$missing" "gh run list -R $GH_REPO --workflow release: the job that builds it"
ok "the release has its $(echo $want | wc -w | tr -d ' ') assets"

# --- 3. the site serves this release's installers ---
for f in install.sh install.ps1; do
  git -C "$REPO" show "v$V:installer/release/$f" > "$WORK/$f.tag"
  deadline=$(($(date +%s) + SITE_WAIT * 60))
  until curl -fsSL --max-time 30 "$SITE/$f?v=$(date +%s)" -o "$WORK/$f.site" 2>/dev/null && cmp -s "$WORK/$f.tag" "$WORK/$f.site"; do
    [ "$(date +%s)" -ge "$deadline" ] && fail "$SITE/$f is not installer/release/$f of v$V after $SITE_WAIT minutes" \
      "the website workflow and nuclearlang.github.io's own (gh run list -R nuclearlang/nuclearlang.github.io)"
    sleep 20
  done
  ok "$SITE/$f is the one of v$V"
done

# --- 4. the user's path, in a fake HOME ---
H="$WORK/home"
in_home() {
  env -i PATH="/usr/bin:/bin:/usr/local/bin" HOME="$H" XDG_CONFIG_HOME="$H/.config" XDG_CACHE_HOME="$H/.cache" \
    XDG_STATE_HOME="$H/.local/state" XDG_DATA_HOME="$H/.local/share" NO_COLOR=1 "$@" < /dev/null
}
mkdir -p "$H"
in_home sh -c "curl -fsSL $SITE/install.sh | sh -s -- --no-ai --no-vscode" > "$WORK/one-liner.log" 2>&1
grep -qx "$V" "$H/.local/share/nuclearlang/.version" 2>/dev/null && in_home "$H/.local/bin/nuclear" dialect list > /dev/null 2>&1 ||
  { tail -n 20 "$WORK/one-liner.log"; fail "the public one-liner did not install $V"; }
ok "the public one-liner installs $V and nuclear runs"

prev=$(gh release list -R "$GH_REPO" --limit 30 --json tagName -q '.[].tagName' | sed 's/^v//' | { cat; echo "$V"; } |
  sort -t . -k1,1n -k2,2n -k3,3n -u | sed -n "/^$V\$/{x;p;q;};h")
if [ -n "$prev" ]; then
  rm -rf "$H"; mkdir -p "$H"
  curl -fsSL "https://github.com/$GH_REPO/releases/download/v$prev/install.sh" -o "$WORK/install-$prev.sh" ||
    fail "cannot download the installer of $prev"
  in_home sh "$WORK/install-$prev.sh" --version "$prev" --no-ai --no-vscode > "$WORK/previous.log" 2>&1
  grep -qx "$prev" "$H/.local/share/nuclearlang/.version" 2>/dev/null || { tail -n 20 "$WORK/previous.log"; fail "the previous release $prev did not install"; }
  # what `nuclear update` runs (tools/cli/src/update.rs), with --no-ai: the AI services stay out of a test
  in_home env NUCLEAR_INSTALL="$H/.local/share/nuclearlang" NUCLEAR_UPDATE=1 \
    sh -c "curl -fsSL $SITE/install.sh | sh -s -- --no-ai" > "$WORK/update.log" 2>&1
  grep -qx "$V" "$H/.local/share/nuclearlang/.version" && in_home "$H/.local/bin/nuclear" dialect list > /dev/null 2>&1 ||
    { tail -n 20 "$WORK/update.log"; fail "the update from $prev to $V did not finish"; }
  # the dry run prints what it would run; a binary before it says that it is the latest release: either way it found it
  in_home env NUCLEAR_UPDATE_DRYRUN=1 "$H/.local/bin/nuclear" update > "$WORK/dry.log" 2>&1 && ! grep -q "was not installed" "$WORK/dry.log" || { cat "$WORK/dry.log"; fail "nuclear update through its link does not find its installation"; }
  ok "an update from $prev to $V, and nuclear update through the link finds the installation"
else echo "  - no release before $V: no update to try"; fi

echo ""
echo "${GREEN}${BOLD}The release $V is delivered${OFF}: workflows green, every asset, the site serves its installers, the one-liner and an update work."
