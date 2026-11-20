---
status: draft
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, design.md]
---
# Spec 018: Every machine, every state, fail-safe — Tasks

## Phase 1: the gaps that strand a user (each with its test)

- [ ] C4/H1: the extension without `nuclear-lsp` offers the installer, no path of the source tree (extensions/vscode).
- [ ] E4: the public installers remember the first install's options (`.options` beside `.version`); `nuclear update`
      and a new run read them.
- [ ] E6: the update question never blocks a script: asked only when the parent is an interactive shell, with a
      "later" answer (24 h) (tools/cli `update.rs`).
- [ ] I1: `nuclear update` and the installers refuse to run as root.
- [ ] Two updates at once: a lock in the installers' state folder.
- [ ] `nuclear update` with `wget` when there is no `curl`; the message of a half-done update says the real version.
- [ ] F2: a service whose port is taken at login picks a free one and writes it to `ai.env`, or says which program
      holds it (nuclear-builder).
- [ ] D6 on Windows: `install.ps1` resumes an interrupted install (installer roadmap).
- [ ] D7: a stuck installation (broken binary under a `.version`, a state of a missing release, core and `ai/` of
      different versions) is detected and repaired by a new run.

## Phase 2: the harness

- [ ] Two releases in a mirror (N and N+1) from the tree, for every upgrade test.
- [ ] The fault-injection helpers and the four assertions (design.md).
- [ ] Docker images per distribution (A1, A3-A5) in the CI.
- [ ] `installer-linux-arm.yml` and `installer-macos.yml` (Intel and Apple silicon) like `installer-windows.yml`.
- [ ] The extension test under `xvfb` (C, H).

## Phase 3: every group to *handled*

- [ ] A, B, D, E, F, G, I through the Docker matrix and the runners.
- [ ] The manual pass checklist in `installer/docs/06-runbooks/` (A6, A17, C5, C8, G5), filled before a minor release.
- [ ] Each case that passes changes its *State* in requirements.md; the spec is done when none is gap or verify.
