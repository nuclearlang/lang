---
status: draft
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, design.md]
---
# Spec 018: Every machine, every state, fail-safe — Tasks

## Phase 1: the gaps that strand a user (each with its test)

- [x] C4/H1: the extension without `nuclear-lsp` offers the installer, no path of the source tree (extensions/vscode).
- [x] E4: the public installers remember the first install's options (`.options` beside `.version`); `nuclear update`
      and a new run read them.
- [x] E6: the update question never blocks a script: one key in raw mode, no key in 15 s goes on, never inside
      `make` or an npm script, a "later" answer (24 h) (tools/cli `update.rs`).
- [x] I1: `nuclear update` and `install.sh` refuse to run under sudo (root's own install, a container, is allowed).
- [x] Two updates at once: a lock in the installers' state folder.
- [x] `nuclear update` with `wget` when there is no `curl`; the message of a half-done update says the real version.
- [ ] F2: a service whose port is taken at login picks a free one and writes it to `ai.env`, or says which program
      holds it (nuclear-builder).
- [ ] D6 on Windows: `install.ps1` resumes an interrupted install (installer roadmap).
- [ ] D7: a stuck installation (broken binary under a `.version`, a state of a missing release, core and `ai/` of
      different versions) is detected and repaired by a new run.

## Phase 1b: security (group M), each fix with its test

- [ ] M8 depth limit in the parser; M7 names checked in `make`/`gen`; M4/M5 no shell for arguments.
- [ ] M1/M2 the extension: machine-scope server path, restricted configurations, no command from `build/`.
- [ ] M3 project-local dialects asked once; M6 escaping per target format; M9 the Developer's token and checks.
- [ ] M10/M11 signed releases verified by the installers and by `nuclear update`; M12 actions pinned.

## Phase 2: the harness

- [ ] Two releases in a mirror (N and N+1) from the tree, for every upgrade test.
- [ ] The fault-injection helpers and the four assertions (design.md).
- [x] `installer/tests/run.sh`: the fake-HOME cases on this machine (D1, D2, D6, D7, D13, D14, E4, I1).
- [ ] Docker images per distribution (A1, A3-A5), run one at a time on this machine (it has limits), then in the CI.
- [ ] The single-board computers (J): Orange Pi Zero 3W, Raspberry Pi 4B 8 GB, Orange Pi 5 Max, over SSH.
- [ ] `installer-linux-arm.yml` and `installer-macos.yml` (Intel and Apple silicon) like `installer-windows.yml`.
- [ ] The extension test under `xvfb` (C, H).

## Phase 3: every group to *handled*

- [ ] A, B, D, E, F, G, I through the Docker matrix and the runners.
- [ ] The manual pass checklist in `installer/docs/06-runbooks/` (A6, A17, C5, C8, G5), filled before a minor release.
- [ ] Each case that passes changes its *State* in requirements.md; the spec is done when none is gap or verify.
