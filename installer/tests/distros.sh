#!/bin/sh
# The public installer on each Linux distribution (spec 018 A1, A3), one container at a time (1 CPU, 1 GB, never
# --privileged: this machine has limits and a privileged container can crash its desktop), against the archive of
# this tree in installer/dist/ (installer/release/package.sh first).
#
#   installer/tests/distros.sh                 every distribution
#   installer/tests/distros.sh alpine fedora   only those
#
# In each: a new user (no sudo), the installer from the mirror without the AI services, then `nuclear new` of a
# backend and `nuclear check` of it, and the installer's summary when it fails.
set -u

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DIST="$ROOT/installer/dist"
[ -f "$DIST/latest" ] || { echo "no archive: run installer/release/package.sh first"; exit 2; }

# the image and how it gets what the installer needs (curl or wget, tar, a SHA-256 tool, a user)
image() {
  case $1 in
    debian) echo "debian:12|apt-get update -qq && apt-get install -y -qq curl ca-certificates >/dev/null" ;;
    ubuntu) echo "ubuntu:24.04|apt-get update -qq && apt-get install -y -qq curl ca-certificates >/dev/null" ;;
    fedora) echo "fedora:41|dnf install -y -q tar gzip shadow-utils util-linux >/dev/null" ;;
    arch) echo "archlinux:latest|pacman -Sy --noconfirm --quiet tar gzip >/dev/null" ;;
    opensuse) echo "opensuse/leap:15.6|zypper -q -n install tar gzip curl shadow >/dev/null" ;;
    alpine) echo "alpine:3.20|apk add -q curl tar" ;;
    *) return 1 ;;
  esac
}

PASS=0; FAIL=0; FAILED=""
for d in ${*:-debian ubuntu fedora arch opensuse alpine}; do
  spec=$(image "$d") || { echo "unknown distribution: $d"; exit 2; }
  img=${spec%%|*}; prepare=${spec#*|}
  printf '%-9s ' "$d"
  out=$(timeout 900 docker run --rm --memory 1g --cpus 1 -v "$DIST:/mirror:ro" -v "$ROOT/installer/release/install.sh:/install.sh:ro" \
    "$img" sh -c "$prepare && (useradd -m dev 2>/dev/null || adduser -D dev) && su dev -c '
      NUCLEAR_DOWNLOAD=file:///mirror sh /install.sh --no-ai --no-vscode > /tmp/install.log 2>&1
      ~/.local/bin/nuclear dialect list > /dev/null || { tail -n 15 /tmp/install.log; exit 1; }
      cd ~ && ~/.local/bin/nuclear new demo -p backend > /dev/null && cd demo && ~/.local/bin/nuclear check . && echo INSTALLED-AND-CHECKED
    '" 2>&1)
  if printf '%s' "$out" | grep -q INSTALLED-AND-CHECKED; then
    PASS=$((PASS + 1)); echo "✓ installed, nuclear new + check"
  else
    FAIL=$((FAIL + 1)); FAILED="$FAILED $d"; echo "✗"; printf '%s\n' "$out" | tail -n 12 | sed 's/^/    /'
  fi
done
echo ""
echo "$PASS passed, $FAIL failed${FAILED:+:$FAILED}"
[ "$FAIL" = 0 ]
