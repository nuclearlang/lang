---
status: accepted
owner: Julian Molina
updated: 2026-11-17
related: [installer/docs/08-guides/ai-setup.md, installer/docs/06-runbooks/release.md, extensions/tools/nuclear-builder/setup.json]
---
# Roadmap of the installers and the release

The pending work of the installers, the release and the set-up of the AI services. A done item is deleted.

## Half done

- **An interrupted install goes on** (the step log, overview § The public installers). Done in `install.sh`, tried
  with a download cut by Ctrl+C and with a run cut after its first steps. Left: the same in `install.ps1` (its state in
  `%LOCALAPPDATA%\nuclearlang\install.state`, its downloads continued with a `Range` request).

- **The AI services ready to run from the installer** (ADR-installer-0003,
  [spec 009](../../../docs/04-specs/009-self-contained-ai-services/tasks.md)). Done: the ports are checked and
  chosen; the AI archive (`release/ai-runtime.sh`, the `ai` job of `release.yml`), downloaded and checked by both
  installers, removed by `--uninstall`, tried on the clean machine (no Python, no uv, no Node.js: install with `lite`,
  the set-up in Nuclear, services, a reboot, `--uninstall`). Left: nothing while the local models are on standby (the
  item below).

  The set-up is Nuclear's and comes in the archive; only Nuclear Builder's pipeline still runs on node
  (its roadmap).

- **The first release.** The installers and the release workflow are written (ADR-installer-0001): binaries for
  Linux, macOS and Windows and a one-command installer. They work once a tag `v*` exists. Left: the first release
  tag `v0.1.0`; `release.yml` never ran, and the public one-line installer fails without a release.
- **The extension in the stores.** The job `marketplaces` of `release.yml` publishes the `.vsix`
  ([the runbook](../06-runbooks/release.md)); both stores have 0.86.0. The Open VSX namespace `nuclearlang` is verified
  (EclipseFdn/open-vsx.org#16010, 2026-11-20); the job publishes with Trusted Publishing as soon as `OVSX_PAT` is gone.
  Left, for the user: register the trusted publisher on open-vsx.org (the namespace's settings: GitHub, repository
  nuclearlang/nuclearlang, workflow release.yml), delete the secret `OVSX_PAT`, and remove the Open VSX administrator from the
  Marketplace publisher's Members.
- **The AI services built into the installer** (ADR-installer-0002; [the guide](../08-guides/ai-setup.md)). Left:
  - Android Studio has no wizard (`nuclear-builder setup`).
- **Local models on standby** ([ADR-platform-0013](../../../docs/03-adr/0013-local-models-on-standby.md)): the
  installers run `nuclear-builder setup --profile remote --yes` only, and a local profile asked or kept becomes
  `remote` (`tests/run.sh` case `P1`). Turning them on again needs: the switch `localModels` of Nuclear Builder's
  `setup.json`; the installers' profile choice back (`--profile`, `-AiProfile`, the remembered profile, the question
  on a terminal, the summary's line); the guide's profiles table with their measures; and their own tests on each
  system (Ollama's install and removal on Linux, macOS, Windows; a pull; the Developer's service). Kept for that day:
  - the welcome page where the user installs Ollama and the models;
  - the profiles: see *To decide with the user*; then `setup.json` is written
    (`extensions/tools/nuclear-builder/tests/test_setup.nuc` holds the guide to it);
  - a GPU other than NVIDIA's and Apple silicon is not recognised (the development machine's Radeon 890M runs the
    models and Ollama says "100% GPU", while the set-up says no GPU with memory of its own);
  - the memory figures of the profiles (`ram`, `minRam`) come from the models' loaded size and the development
    machine's behaviour, not from runs on 8 and 32 GB machines.

## Untested

- **A new run on Windows** (`install.ps1`: `.version`, `-Reinstall` while the services run, `Stop-Under`): written
  without a Windows at hand; `installer-windows.yml` runs it again and with `-Reinstall` on every case.
- **`nuclear setup flutter|node` on a clean macOS** (the editor's second choice, marked there as not tried).

- Tried on the clean machine on 2026-11-18 (spec 016), Linux x86_64 from a local mirror, profile `remote`: the
  install, the `clients` step (OpenCode and Gemini CLI written), `nuclear help start` and the atlas, the MCP server
  over stdio (`nuclear_start`, `nuclear_doc`), `nuclear new` of a backend and of a mobile app with its context
  documents, `nuclear setup` (Flutter) then `nuclear analyze`. Not tried there: a local profile (Ollama and the
  models), the VS Code extension (no `.vsix` in the mirror, and the extension is on no marketplace), Codex,
  Claude Code.

- The public installers (ADR-installer-0001): `install.sh` ran on macOS Apple silicon (2026-11-19, from the
  release) and on Linux x86_64; not tried: macOS Intel, the Rosetta detection, Linux aarch64. `install.ps1` is run on
  Windows by `installer-windows.yml` after each release (x64 with PowerShell 5.1 and 7, arm64); not tried there: the
  editors' extension (the runners have no editor).
- The AI set-up (ADR-installer-0002):
  - macOS (launch agents) and Windows (the Startup script) are written and never ran;
  - an update of a machine set up with a local profile, on a real machine (the `standby` step: the Developer's
    service, the models and Ollama taken away);
  - a machine without uv;
  - the public one-liner with a real release;
  - a login after a real reboot of a desktop (the clean machine's reboot has no keyring; the wait for it is proved by
    a test only);
  - `installer/install.sh --ai` on a clean machine;
  - the AI archive of Windows (macOS Apple silicon and Linux arm64 are built and tried by the release; installed only
    from Linux x86_64);
  - `nuclear-builder` from a release archive on Windows (`nuclear-builder.cmd`).

## To decide with the user

- **The profiles of the AI set-up** (on standby, ADR-platform-0013: only when the local models come back). Every measurement is in `nuclear-agents/nuclear_developer/README.md`, "Models
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

## Pending
- The delivery gate does not build and try the AI archive (`ai` jobs of the release workflow): 0.94.0 passed the gate and failed there, on a model of the AI services the new backend runtime could not make (found 2026-11-22). Wanted: the gate imports the AI services with the tree's runtimes before a tag.
- **The editor end-to-end check** (the user chose it on 2026-11-23, after a port change broke their app while every suite was green): VS Code with the extension, a real workspace of a backend, a web app and a mobile app, run as the user does (Serve, the Synapsis device), screenshots checked that the web and the device show the backend's data, Serve/Stop work, switching tools keeps the layout; in the delivery gate and before a change is called done. Not built yet: next, after the fix of the port registry is proved.
