---
status: accepted
date: 2026-11-18
deciders: Julian Molina
---
# ADR-0004: The toolchains of a fresh machine: Python comes with NuclearLang, Node.js and Flutter on a yes

## Context and problem
On a machine where only the installer ran, `nuclear install` of a `fastapi` project failed with `python3: not found`
(a `nestjs` or `react` one would fail on Node.js), and `nuclear doctor` checked only Flutter (spec 016's clean
machine). A user who just installed NuclearLang, and an agent with no context, must get a working project without
knowing which language runs underneath (root rule 14).

## Decision
1. **Python comes with the installation.** The AI services' archive already carries a relocatable Python
   (`<installation>/ai/python`); `nuclear` uses it for a `fastapi` project without asking. A system without that
   archive (an Intel Mac, Windows on arm) gets Nuclear's own on a yes: `nuclear setup python`.
2. **Node.js and Flutter do not come.** The user is asked; on a yes Nuclear installs its own: `nuclear setup node`
   (the latest LTS from nodejs.org into `<installation>/toolchains/node`), `nuclear setup flutter` (as `nuclear setup`
   did). Nuclear's copies are only Nuclear's: no administrator rights, nothing else on the machine changes, checked
   against their sha256.
3. **The user's own wins.** Lookup, for each toolchain: the variable (`NUCLEAR_PYTHON`, `NUCLEAR_NODE`: the
   executable, what the editor's settings pass; `FLUTTER`, `FLUTTER_ROOT` for Flutter), the installation's (included,
   then `toolchains/`), the PATH.
4. **A dialect names the toolchain it needs** (`[toolchain] needs = "python" | "node"`), never the CLI. Before a
   toolchain command `nuclear` finds it and puts its folder first in the PATH of that command; when it is missing it
   offers to install it in a terminal and says what to do otherwise. `nuclear doctor` shows each toolchain and where
   it was found.

## Consequences
- A `fastapi` project works right after the installer, with nothing else installed.
- `nuclear setup node|python` works on Linux and macOS; on Windows the user installs them and names them with the
  variables (tools/cli roadmap).
- The editor's onboarding asks for each toolchain (mine, install it, later) and passes the paths as the variables.
