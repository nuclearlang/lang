---
status: draft
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, tasks.md, ../../../installer/docs/06-runbooks/release.md, ../../../.github/workflows/installer-windows.yml]
---
# Spec 018: Every machine, every state, fail-safe — Design

## One harness, four places

| Place | Hosts | Cases |
|---|---|---|
| **Docker matrix** (CI, `installer/release/clean-machine/` grown to one image per distribution) | Debian, Ubuntu, Fedora (SELinux off), Arch, openSUSE, Alpine, NixOS; systemd and without it | A1, A3-A5, A12-A16, A18, B*, D*, E*, F*, G*, I* |
| **GitHub runners** (`installer-<os>.yml`, after each release and by hand) | `ubuntu-24.04-arm`, `macos-13` (Intel), `macos-14` (Apple silicon), `windows-latest`, `windows-11-arm` | A2, A7-A11, A17, C2, C7, C9, D3, D6 on Windows |
| **Editor tests** (`@vscode/test-electron` under `xvfb`, the extension against the installed `nuclear-lsp`) | VS Code stable and the oldest supported, VSCodium | C1-C6, C9, H* |
| **Manual pass** (a checklist in `installer/docs/06-runbooks/`, filled before a minor release) | a real desktop: reboot, keyring, Gatekeeper, SmartScreen, snap/flatpak editors, JetBrains, Zed, WSL2 | A6, A17, C5, C8, G5 |

## The building blocks

- **Two releases in a mirror.** `package.sh` builds the archives of the tree as version N and, with
  `version.sh`, as N+1; served with `NUCLEAR_DOWNLOAD`. Every upgrade, downgrade and stuck-version case runs offline
  against it, so no test needs a published release.
- **A fake `HOME` with every XDG variable redirected** (the rule of the installer: never the real `HOME`).
- **Fault injection**, one helper per fault: hold a port (`nc -l`/`python -m http.server <port>`), kill or crash a
  service, corrupt the store (`truncate` a Chroma file), cut the network (`--network none`, or a proxy that drops
  after N bytes), fill the disk (a small `tmpfs` as `HOME`), `noexec` mounts, a read-only `HOME`, a broken
  `.version`, a state file of a missing version, a client configuration with comments.
- **A pseudo-terminal** (`script -qec`) to answer the questions (the update question, the profile) and to prove that
  without one nothing is asked.

## What each test checks (the same assertions everywhere)

1. The exit code (0 only when everything required is there).
2. The last box: its title and that it names the one action that fixes it.
3. The machine after it: the previous installation runs (`nuclear dialect list`), or a new run resumes and
   finishes; the user's own things untouched (a checksum of their files before and after).
4. After the fix (the action the message gave): the case passes.

## A test per group

- **A (machine):** install from the mirror in each image/runner; `nuclear help start`, `nuclear new` of each
  platform, `nuclear check`; the services answer (`setup --status`); a reboot of the image (systemd) and the services
  are back. A12: a user created as `josé maría`. A16: the same run behind a proxy and with the network cut.
- **B (toolchains):** images with and without Flutter (PATH, fvm, snap where it runs), an old Flutter; `nuclear
  doctor`, `nuclear setup`, `nuclear build apk|web`, the backend and web paths unaffected.
- **C, H (editors, LSP):** the extension test opens a `.nuc`, waits for diagnostics, and for each case: no
  `nuclear-lsp`, an older one, a crashing one (a stub that exits), the PATH of a desktop launch; asserts the message
  and that no message names a path of the source tree.
- **D (versions):** N installed, then N+1 by the installer, by `nuclear update`, by the question answered "y";
  interrupt at every step with `timeout -s INT` and run again; the stuck states injected one by one; downgrade.
- **E (choices):** each option at the first install, then an upgrade: the options kept; a `make` target in a
  pseudo-terminal that calls `nuclear` with a newer release known: it does not block.
- **F (ports):** each port held before the set-up, then held only before a reboot; an older service on the port.
- **G (services):** each service killed, crash-looped, its store corrupted; the MCP tools called through the MCP
  server and their message checked.
- **I (permissions):** the installer and `nuclear update` under root; a read-only `HOME`.

## Order

The gaps that can strand a user come first (C4/H1, E4, E6, F2, I1, D6 on Windows, D7), each fixed with its test;
then the harness grows group by group, and every case that passes moves from the table's *State* to **handled**.
