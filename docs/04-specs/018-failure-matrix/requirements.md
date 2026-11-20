---
status: draft
owner: Julian Molina
updated: 2026-11-20
related: [design.md, tasks.md, ../../../installer/docs/01-product/roadmap.md, ../../../installer/docs/08-guides/ai-setup.md]
---
# Spec 018: Every machine, every state, fail-safe — Requirements

## Goal

NuclearLang is installed, upgraded, run and removed on any machine a user may have, in any state that machine may
be in, and it never leaves the user stuck: every case below either works or stops with a message that says what
happened and what to do, and a new run goes on from there. Each case has a test that proves it, run by the CI
where a runner can host it and by a written manual pass where none can.

## Fail-safe rules (every case is held to them)

1. **Never half done.** A run that stops leaves the previous working installation, or a state a new run resumes.
2. **Never silent.** A failure says what it was doing, why, and the one action that fixes it; exit code non-zero.
3. **Never stuck.** There is always a way forward without the source tree: run the installer again,
   `--reinstall`, `--uninstall`, `nuclear update`, `nuclear doctor`, `nuclear-builder setup --status`.
4. **Never the user's things.** What was on the machine before (an Ollama, a Flutter, an editor's settings, an AI
   client's configuration, another program's port) stays as it was.
5. **Degrade, don't fail.** What is optional (an editor, a toolchain, local agents) missing makes its feature say
   so; the rest works.

## The cases

State: **handled** (code exists and was tried), **written** (code exists, never tried on that system), **gap**
(nothing handles it), **verify** (not known).

### A. The machine

| ID | Case | Expected | State |
|---|---|---|---|
| A1 | Linux x86_64: Ubuntu/Debian, Fedora, Arch, openSUSE | installs, services at login (systemd user) | handled (clean machine: Debian-based only) |
| A2 | Linux aarch64 (Raspberry Pi, ARM servers, Asahi) | the same | written |
| A3 | Alpine / musl | NuclearLang installed; the AI services said to need glibc; install ends incomplete with that reason | written |
| A4 | NixOS (no FHS), immutable distros (Silverblue) | static `nuclear` runs; the AI Python may not: said, not a crash | verify |
| A5 | Linux without a systemd user session (WSL, containers, Void) | services as processes, said at the end | written |
| A6 | WSL2 next to a Windows install | each side its own installation; the Windows editor sees the WSL one only through Remote-WSL | verify |
| A7 | macOS Apple silicon | installs, launch agents | handled (once, 2026-11-19) |
| A8 | macOS Intel | NuclearLang installed; no AI archive: said | written |
| A9 | macOS Apple silicon under Rosetta (an x86 terminal) | the arm64 archive is chosen | written |
| A10 | Windows 10/11 x64, PowerShell 5.1 and 7 | installs, Startup script | handled by `installer-windows.yml` (no AI profile with local agents) |
| A11 | Windows on ARM | arm64 core, x64 AI archive | handled by `installer-windows.yml` |
| A12 | A user name with spaces or non-ASCII (`C:\Users\José María`, `/home/josé`) | every path quoted; services start | gap (never tried) |
| A13 | Shells: bash, zsh, fish, nushell, PowerShell profile | `nuclear` on the PATH in a new terminal | handled for bash/zsh/fish/profile; nushell gap |
| A14 | `/home` or `/tmp` mounted `noexec`, SELinux enforcing | said which folder cannot run programs | gap |
| A15 | The disk fills during the download or the knowledge base load | stops, says the space needed, the previous install works | verify |
| A16 | No internet, a proxy (`HTTPS_PROXY`), GitHub blocked or rate-limited | says it, offers `NUCLEAR_DOWNLOAD` (a mirror) | partly (`curl` reads the proxy; no message names a mirror) |
| A17 | Antivirus quarantines `nuclear.exe` (Defender, SmartScreen); macOS Gatekeeper | says the binary was blocked and how to allow it | partly (Windows message after the install; macOS verify) |
| A18 | A wrong clock (TLS fails) | says to fix the clock | gap |

### B. The platforms' toolchains

| ID | Case | Expected | State |
|---|---|---|---|
| B1 | No Flutter | `nuclear doctor` and the editor say it; `nuclear setup` installs it; backend and web unaffected | handled |
| B2 | Flutter on the PATH (any channel), from snap, from fvm | found and used; its version checked | partly (PATH yes; snap/fvm verify) |
| B3 | Flutter too old for the dialect, or a broken Flutter (`flutter doctor` fails) | said with the version needed | verify |
| B4 | No Android SDK / no Xcode | mobile builds for the other targets work; the missing one said | written |
| B5 | No Node.js / Python, an old one, one from nvm/pyenv/asdf | Nuclear's own toolchain (ADR-cli-0004) or the user's, never a mix | written |

### C. The editors

| ID | Case | Expected | State |
|---|---|---|---|
| C1 | No editor | install completes; the summary says how to add one later | handled |
| C2 | One or several of VS Code, Insiders, Cursor, VSCodium, Windsurf | the extension in each | handled (Linux); macOS written |
| C3 | The extension already there, older or newer than NuclearLang | the extension says the versions differ and offers `nuclear update` | written (0.80.0, `snapshotCheck.ts`) |
| C4 | The extension from a store, NuclearLang never installed | the extension offers the installer, never a path of the source tree | handled (*Install NuclearLang*; `test/fresh-machine.test.ts`) |
| C5 | VS Code from snap or flatpak (sandboxed, another PATH) | the extension finds `nuclear-lsp` by its installation path | verify |
| C6 | The editor launched from the desktop (a PATH without `~/.local/bin`) | the same | handled (`toolchains.ts`) |
| C7 | The editor's CLI not on the PATH (macOS `code`) | found inside the app | written |
| C8 | JetBrains, Zed | the plugin/extension finds the LSP | verify |
| C9 | The editor open during an upgrade | Linux/macOS: the LSP restarts on the new binary; Windows: closed and restarted, said | verify |

### D. Versions and lifecycle

| ID | Case | Expected | State |
|---|---|---|---|
| D1 | A fresh install | everything required, the summary | handled |
| D2 | The same version again | kept, nothing downloaded | handled |
| D3 | Upgrade N → N+1 (installer, `nuclear update`, the question) | replaced, profile kept, services restarted at the new version | written (the "yes" path never run) |
| D4 | Upgrade across many versions (0.1.x → 0.80.0; binaries without `nuclear update`) | the installer run by hand works the same | verify |
| D5 | Downgrade (`--version` older) | allowed, said; data of a newer graph either read or rebuilt | gap |
| D6 | Interrupted at each step (Ctrl+C, closed terminal, lost connection, reboot) | a new run resumes | handled on Linux/macOS (`run.sh D6`, the first step only); **gap** on Windows (roadmap) |
| D7 | Stuck version ("punto muerto"): the state file names a release that no longer exists, `.version` present but the binary broken, the core new and `ai/` old | the next run detects it and replaces what is broken; `--reinstall` always gets out | partly |
| D8 | A release missing the asset of this system | says it, the previous install untouched | handled (message) |
| D9 | The store's extension updated before the release's archives exist | the extension waits, says the release is on its way | verify |
| D10 | Source install over a public one, and the reverse | one installation on the PATH; `nuclear update` never replaces a source build | verify (`.version` left behind?) |
| D11 | Two installations (another `NUCLEAR_INSTALL`/PREFIX) | `nuclear doctor` names both and which one runs | gap |
| D12 | A project made with an older version opened with a newer one | builds, or says what to run (`nuclear repair`) | verify |
| D13 | Uninstall, then install again | a clean install | handled (Linux, `run.sh D13`) |
| D14 | Two installs at once (two terminals, two updates) | the second says so and stops; a lock of a dead run is taken over | handled on Linux (`run.sh LOCK`); written in `install.ps1` |

### E. What the user chose

| ID | Case | Expected | State |
|---|---|---|---|
| E1 | Declined local agents | `remote`; nothing of Ollama downloaded | handled |
| E2 | `--no-ai`, or stopped at a question | ends incomplete, says the one command that finishes | handled |
| E3 | No terminal (`curl … \| sh` in CI) | nothing asked, profile `remote` | handled |
| E4 | `--no-vscode`, `--no-agent`, `--no-modify-path` at the first install | a later update keeps those choices | handled on Linux (`.options`, `installer/tests/run.sh E4`); written in `install.ps1` |
| E5 | Declined the update question | the command runs; asked again (or later) | handled |
| E6 | A script or `make` in a terminal | never blocked by the update question | handled (one key, 15 s, `MAKELEVEL`/npm; tried in a pseudo-terminal) |
| E7 | An Ollama the user had before; an uninstall | Ollama and its models stay | handled |

### F. Ports and other programs

| ID | Case | Expected | State |
|---|---|---|---|
| F1 | 7878 / 7879 / 7880 held by another program at the set-up | the next free port, written in `ai.env`, read by every tool | handled |
| F2 | The port free at the set-up, taken at a later login | the service picks a free one again, or says which program holds it | **gap** (the port is chosen once) |
| F3 | The port held by a Nuclear service of an older version | stopped and replaced by the new one | verify |
| F4 | Ollama's 11434 held by another program, an Ollama not running, a remote Ollama | said; `ollamaUrl` taken from the settings | partly |
| F5 | `localhost` resolving to IPv6 only, or a firewall prompt (Windows) | services bound where clients look | verify |
| F6 | Two users on one machine | each user's own ports | verify (F1 covers it if the second user's set-up runs after the first) |

### G. Our services

| ID | Case | Expected | State |
|---|---|---|---|
| G1 | The Smart Graph down / crashing at start | the MCP tools say it and how to start it; `setup --status` shows it | handled (message) |
| G2 | The Developer down, a model missing | said with `setup --status` | handled |
| G3 | Nuclear Chat down | the editor says it | verify |
| G4 | The graph's store damaged, or written by another version | rebuilt from the release's knowledge base, said | gap |
| G5 | No keyring (headless Linux, a locked Keychain) | the services wait or say it | written (a test only) |
| G6 | The MCP server registered in a client, then the installation moved/upgraded | the client's entry still works | verify |
| G7 | A client's configuration file the user wrote by hand (comments, invalid JSON) | never broken: kept, said | verify |
| G8 | A service in a crash loop | stops restarting, says where its log is | verify |

### H. The language server

| ID | Case | Expected | State |
|---|---|---|---|
| H1 | `nuclear-lsp` missing | the extension says it and offers the installer | handled (C4) |
| H2 | The LSP and the extension of different versions | said (C3) | written |
| H3 | The LSP crashes on a file | restarted, the file named; the editor stays usable | verify |
| H4 | A large project (thousands of `.nuc`) | answers within the golden rule's limits | verify |
| H5 | The dialects not found (installation moved) | said with the path it looked in | verify |

### I. Users and permissions

| ID | Case | Expected | State |
|---|---|---|---|
| I1 | `sudo` running the installer or `nuclear update` | refused with the reason (no sudo, ADR); root's own install (a container) allowed | handled (`run.sh I1`) |
| I2 | A read-only or network home, a managed corporate machine | said which folder cannot be written | verify |

### J. Machines with few resources (single-board computers: Orange Pi Zero 3W, Raspberry Pi 4B, Orange Pi 5 Max)

| ID | Case | Expected | State |
|---|---|---|---|
| J1 | 1 GB of memory or less, no swap | NuclearLang works; the AI set-up says what this machine cannot run before downloading it, and offers `remote` | verify |
| J2 | A slow SD card or eMMC | the knowledge base load says its time and survives an interruption | verify |
| J3 | A small disk (8-16 GB) | the space needed is said before any download | gap |
| J4 | A 32-bit system (armv7) | said as not supported, nothing half installed | verify |

### K. Machines with resources, saturated

| ID | Case | Expected | State |
|---|---|---|---|
| K1 | CPU at 100 % (a build, a game) | the set-up and the knowledge base load run at low priority (`nice`/`ionice`, a lower Windows priority) and never freeze the desktop | gap |
| K2 | Memory almost full | the services' memory is bounded; a model that does not fit is said, not swapped | verify |
| K3 | The disk busy (another big copy) | downloads and the load go on, slower, without timeouts that break the step | verify |
| K4 | Ollama already busy with another model | said, the user's models untouched | verify |

### L. Firewalls and antivirus

| ID | Case | Expected | State |
|---|---|---|---|
| L1 | The Windows firewall asks when a service listens | it never asks: every service binds `127.0.0.1` only | verify per service |
| L2 | Windows Defender / SmartScreen flags the unsigned binaries or the bundled Python | the binaries are signed; when one is blocked, the message says so | gap (nothing is signed) |
| L3 | macOS Gatekeeper on the binaries | signed and notarized | gap |
| L4 | A corporate firewall, TLS inspection | the download says the certificate failed and offers a mirror | gap |

### M. Security (an audit on 2026-11-20; each fix with its test)

| ID | Case | Expected | State |
|---|---|---|---|
| M1 | A cloned repository sets `nuclear.server.path` in `.vscode/settings.json` | ignored: the setting is machine scope, restricted in an untrusted workspace | handled (machine scope; untrusted folders wait) |
| M2 | A committed `build/*.code-workspace` names the command and environment the extension runs on save | the extension runs only the installed `nuclear`, never a command or environment from the project | handled (`nuclearCommand`, `taskEnv`, a test) |
| M3 | A cloned project's own dialect, kind or `[toolchain]` runs commands on `build`/`run`/`install` | a project-local dialect is asked for once per project; `build` never runs a shell | **gap** |
| M4 | Arguments after `--` (from the MCP server's `nuclear_project`) pasted into a shell | every argument quoted; the MCP refuses `--` | handled (tests in the CLI and the MCP server) |
| M5 | Windows quoting of `nuclear add` package names and messages (`"`, `%`, `&`) | quoted for `cmd` (argv rules, then `^` before every character cmd acts on) | handled (unit test; not run on Windows) |
| M6 | Config values (`app(description = ...)`) pasted raw into JSON, TOML, HTML and YAML | escaped for the target format | handled (filters `json`/`toml`/`html`, the pubspec; tried on the three backends and web) |
| M7 | `nuclear make` / `gen` names with `/` or `..` write outside the project | refused before anything is written (`scaffold::inside`, every generator) | handled (test) |
| M8 | Deep nesting (2,000 parentheses) overflows the parser's stack: `nuclear check` and the LSP abort | N0023 past 200 levels | handled (test on a 2 MB stack) |
| M9 | The Nuclear Developer (7879) has no token, no `Origin` and no `Host` check | the same as the graph and Chat: a token, `Origin` refused, `Host` checked | partly (`Origin` refused with a test, live on this machine; the token and `Host` left) |
| M10 | The checksum comes from the same release as the archive; nothing is signed | a signature verified with a key in the installer | **gap** |
| M11 | `nuclear update` pipes the site's installer into a shell | the installer of the release, verified; PowerShell by its full path | **gap** |
| M12 | CI actions pinned by tag | pinned by commit | gap (low) |
| M13 | String literals in every target (quotes, `$`, `${}`, f-strings, newlines) | escaped | handled (audit) |
