---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, ../06-runbooks/release.md]
---
# How an extension finds the language server

The server is `nuclear-lsp`, built from `nuclearlang/crates/nuclear-lsp` (`cargo build --release -p nuclear-lsp` at
the tree's root → `target/release/nuclear-lsp`). Each extension runs it as an external binary. Its modules and its
behaviour are documented in [the language project](../../../nuclearlang/docs/02-architecture/language-server.md).

## Where each one looks, in order

| Editor | Order | Code |
|---|---|---|
| VS Code | the setting `nuclear.server.path` → `server/nuclear-lsp` inside the extension → a development build beside the extension (`../target/release`, then `../target/debug`) → the `PATH` | `findServer` in `vscode/src/extension.ts` |
| Android Studio / IntelliJ | *Settings → Tools → NuclearLang* (server path) → `server/nuclear-lsp` inside the plugin → the `PATH` | `NuclearSettings.findServer` |
| Zed | `lsp.nuclear-lsp.binary.path` → the `PATH` → `~/.local/bin/nuclear-lsp` | `zed/src/lib.rs` |

Zed has no bundle: its server is the one `installer/install.sh` installs, which finds its dialects and type
definitions in `share/nuclearlang`.

## The bundle of VS Code and JetBrains

`vscode/scripts/bundle-server.mjs` (`npm run server`) and `jetbrains/build.sh` build the server and copy, next to
it:

- `server/nuclear-lsp`
- `server/dialects/`: every dialect of the tree (`nuclearlang/dialects/`, each language with its frameworks and type
  definitions; a dialect's `docs/` stays behind)
- `server/platforms/<platform>/platform.toml`: the contract of each platform
  (`nuclear-synapsis-framework/platforms/`)

Both end with `nuclear-lsp --check-bundle`, which loads each bundled dialect without the tree and fails on any
error (N0213, for example); a warning (a platform plugin a dialect does not bring yet) is printed and does not fail. The server finds the dialects next to its binary; it also searches
`nuclear_dialect::install_dir()` (the installed copy).

## Dialects of the user

A project is checked with the dialect its manifest names. `nuclear.dialectPaths` adds folders with dialects, and
`<workspace>/dialects` is always searched. Zed passes `lsp.nuclear-lsp.settings` as `{ nuclear: ... }`.

## The server's life

- VS Code stops the server 5 minutes after the last `.nuc` closes (`watchIdle`); the server also exits when its
  stdin closes.
- The JetBrains IDE manages the server's process itself.
