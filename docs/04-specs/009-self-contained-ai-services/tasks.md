---
status: in-progress
owner: Julian Molina
updated: 2026-11-17
related: [requirements.md, design.md]
---
# Spec 009 — Tasks

## Phase 1: the ports (done 2026-11-17)

- [x] T1.1 The set-up checks each port can be listened on and takes the next free one (`choosePort`, a test).
- [x] T1.2 The graph, the MCP server and the editor read the chosen port from `ai.env`.
- [x] T1.3 The compiler reads a map from a call with a lookup (`Conf.all()["k"]` was a `KeyError` in Python when the
      key was absent: the MCP server failed to start on a machine with no `ai.env`).

## Phase 2: the runtime in the release (done 2026-11-17)

- [x] T2.1 `installer/release/ai-runtime.sh <target>`: python-build-standalone, the four projects built and
      installed from their locks, the launchers, the archive and its `.sha256`.
- [x] T2.2 A job of `release.yml` per target, with the smoke test on its runner.
- [x] T2.3 `release/install.sh` and `install.ps1` download and unpack the AI archive (unless `--no-ai`);
      `installer/install.sh --ai` builds it from the tree.
- [x] T2.4 `--uninstall` removes `ai/`.
- [x] T2.5 Tried in `release/clean-machine/` (no Python, no uv, no Node.js): install, set-up, services, a reboot.
      It found the graph installed as a link to the checkout (the MCP server's editable source): `ai-runtime.sh`
      installs with `--no-sources` and fails when a `.pth` points into the checkout.

## Phase 3: Nuclear Builder in Nuclear

- [x] T3.1a The set-up (was `aiSetup.ts`) and the `nuclear-builder` command as a Nuclear project of the `python`
      dialect (`extensions/tools/nuclear-builder`: `setup.nuc`, `cli.nuc`, `setup.json`), with its tests; the
      compiler fixes it needed (a typed value of a file, `...(c ? a : b)`, `a?.b ?? c`, the type of a list with
      spreads, a local or a member importing another file, `for k, v in m ?? {}`, `print`'s named arguments, a
      constant of a file seen by the other files of the project).
- [ ] T3.1b The engine (`src/engine.ts`, `src/safety.ts`, the pipeline of `src/cli.ts`, about 2,400 lines) with its
      tests.
- [x] T3.2a The VS Code set-up and settings pages run `nuclear-builder setup` as a process; their pages stay.
- [ ] T3.2b The Builder's page and the JetBrains tool window run the engine in Nuclear.
- [x] T3.3a `nuclear-builder` from the AI archive: the installers' set-up needs no Node.js.
- [ ] T3.3b Node.js no longer needed outside the editor (the pipeline, after T3.1b).

## Phase 4: the welcome page

- [ ] T4.1 The set-up page becomes the welcome page (design: *The welcome page*): Ollama and the models are the
      user's, one button per model.
- [ ] T4.2 The set-up no longer installs Ollama nor pulls a model by itself; the guide (`installer/docs/08-guides/
      ai-setup.md`) says so.
