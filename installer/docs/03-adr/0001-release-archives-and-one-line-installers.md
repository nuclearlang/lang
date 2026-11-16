---
status: accepted
date: 2026-11-10
deciders: Julian Molina
---
# ADR-0001: A release is one archive per system, installed by a one-line installer into the user's folders

## Context and problem
NuclearLang was installed only from its source tree, with Rust on the machine. The user asked to install it with
one command on Linux, macOS and Windows, as Claude Code or Ollama do. An installation is more than binaries: the
dialects, the platforms' contracts and documents, the runtime packages, the definitions generator and the agents'
skill travel with them, and the binaries find them from their own location.

## Decision
1. **One layout.** `installer/release/stage.sh` assembles an installation; the installer from source
   (`installer/install.sh`) and the release archives use the same script, so both give the same folders.
2. **One archive per system and architecture.** `installer/release/package.sh` makes
   `nuclearlang-<version>-<os>-<arch>.tar.gz` (`.zip` for Windows) with its `.sha256`.
3. **One-line installers.** `install.sh` (`curl … | sh`) and `install.ps1` (`irm … | iex`) download the release of
   the system from GitHub, check the SHA-256, install into the user's folders (no sudo, no administrator), set the
   PATH, copy the agents' skill and the VS Code extension, and uninstall.
4. **The release is a workflow.** `.github/workflows/release.yml` builds Linux (musl: static binaries for any
   distribution; x86_64 and aarch64), macOS (x86_64, arm64) and Windows (x86_64, arm64) on a tag `v<version>` and
   publishes the archives, the extension and both installers in the GitHub release.
5. **The website serves both installers at its root.**

## Options considered
1. A package manager per system (Homebrew, winget, apt) first: three formats to maintain before there is a
   release; they can wrap the same archives later.
2. `cargo install`: it needs Rust on the user's machine and does not ship the dialects, the runtimes or the skill.
3. Archives of one layout and a script per shell. Chosen.

## Consequences
- Positive: one command installs NuclearLang on the three systems, with no rights beyond the user's; a mirror
  (`NUCLEAR_DOWNLOAD`) serves the same files, which is also how an installer is tested.
- Negative: the installers work only once a release exists (a tag `v<version>` built by the workflow); six targets
  are built for every release.

## References
- Decided together with running and debugging a project from the dialect's data: `ADR-cli-0001`, which the command
  line tools keep; this ADR holds its installers.
- The AI services the installers set up at their end: ADR-installer-0002.
