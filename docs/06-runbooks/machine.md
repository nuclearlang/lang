---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: []
---
# This machine

- **Flutter SDK**: `~/develop/flutter` (on the PATH). Older documents say `~/development/flutter`: outdated.
- **The installation**: `installer/install.sh` → `~/.local/bin/{nuclear,dragonfly,nuclear-lsp,nuclear-loop}`,
  files in `~/.local/share/nuclearlang` (`nuclear_dialect::install_dir`, `NUCLEAR_HOME`). Run it again after every
  change the user should get. `cargo install` puts binaries in `~/.cargo/bin`, which is not on the user's PATH.
- **The AI services**: the systemd user units `nuclear-graph` and `nuclear-developer`
  (`systemctl --user restart nuclear-developer` after a change to its code; `journalctl --user -u
  nuclear-developer -n 50`); the machine's choice is `~/.config/nuclearlang/ai.env`
  (`installer/docs/08-guides/ai-setup.md`).
- **The cache of a project's type definitions**: `~/.cache/nuclearlang/defs`.
- **The user's projects outside the tree**: `~/Documents/projects/nuc/` (`flutter/rick_and_morty`,
  `python/nuclear_langgraph_agent`, `react/nuclearlang_website`: the website). When a word of the language or the
  framework changes, they are rewritten too.
- **There is no global `tsc`**: `nuclearlang/tools/node/node_modules/.bin/tsc`.
- **The copy of the tree before the restructure**:
  `~/Documents/projects/nuclearlang-backup-2026-11-16-pre-restructure.tar.gz`.

Testing an installer: with a fake `HOME` and `NUCLEAR_DOWNLOAD=<a local server of installer/dist/>`; never run
`--uninstall` without the fake `HOME`.
