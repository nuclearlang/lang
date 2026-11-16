---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [installer/docs/08-guides/ai-setup.md, installer/docs/06-runbooks/release.md, extensions/vscode/src/aiSetup.json]
---
# Roadmap of the installers and the release

The pending work of the installers, the release and the set-up of the AI services. A done item is deleted.

## Half done

- **The first release.** The installers and the release workflow are written (ADR-installer-0001): binaries for
  Linux, macOS and Windows and a one-command installer. They work once a tag `v*` exists. Left: the first release
  tag `v0.1.0`; `release.yml` never ran, and the public one-line installer fails without a release.
- **The AI services built into the installer** (ADR-installer-0002; [the guide](../08-guides/ai-setup.md)). Left:
  - The profiles: see *To decide with the user*. Then `aiSetup.json` is written
    (`extensions/vscode/test/setup.test.ts` holds the guide to it).
  - A GPU other than NVIDIA's and Apple silicon is not recognised: the development machine's Radeon 890M runs the
    models and Ollama says "100% GPU", while the set-up says no GPU with memory of its own.
  - Android Studio has no wizard (`nuclear-loop setup`).
  - The memory figures of the profiles (`ram`, `minRam`) come from the models' loaded size and the development
    machine's behaviour, not from runs on 8 and 32 GB machines.

## Untested

- The public installers (ADR-installer-0001): `install.sh` on macOS (Intel, Apple silicon, the Rosetta detection),
  `install.ps1` on Windows, `--version`, the latest-release lookup against GitHub, the VS Code `.vsix` step. Only
  the Linux x86_64 archive from a local mirror ran.
- The `release.yml` workflow never ran: musl, the arm runners, the Windows zip. It was rewritten for one
  repository with the rest of `.github/workflows/`.
- The AI set-up (ADR-installer-0002):
  - macOS (launch agents, Homebrew) and Windows (the Startup script, `winget`, `install.ps1 -AiProfile`,
    `nuclear-developer.cmd`) are written and never ran;
  - a machine without uv or without Ollama;
  - the public one-liner with a real release;
  - a login after a real reboot (the wait for the keyring is proved by a test only);
  - the `lite` profile's download;
  - `installer/install.sh --ai` on a clean machine;
  - a release archive with the graph's `.nuc` sources and the set-up's `nuclear build` step on a machine without
    the working tree;
  - `nuclear-loop` from a release archive on Windows (`nuclear-loop.cmd`).

## To decide with the user

- **The profiles of the AI set-up.** Every measurement is in `nuclear-agents/nuclear_developer/README.md`, "Models
  measured".
  - `medium` (`qwen2.5-coder:3b` for both roles) does not end its chat nor its analyses, and the set-up offers it
    as it is.
  - `lite` is not measured as assistant.
  - Nothing limits the length of an answer, so a call that never ends holds the Developer (that README's "Known
    limits").
  - The machine to choose for is a Core i5 of the 12th generation, 16 GB, no GPU, models up to 7B (the 3B rule of
    `nuclear-agents/nuclear_developer/AGENTS.md` stands until the user changes it).
  - Not run: a round of the evaluation on the CPU alone; `nemotron-3.5-bolt:e4b`; `gemma4:e4b`, `qwen3.5:2b` and
    `4b` as assistant.
