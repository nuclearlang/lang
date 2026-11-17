---
status: accepted
owner: Julian Molina
updated: 2026-11-17
related: [installer/install.sh, installer/release/stage.sh, installer/release/package.sh, installer/release/install.sh, installer/release/install.ps1, .github/workflows/release.yml, installer/docs/08-guides/ai-setup.md]
---
# The installers: overview

```
 working tree ──► release/build-runtimes.sh ──► release/stage.sh ──► an installation (a folder)
                                                     ▲      ▲
                          install.sh (from source) ──┘      └── release/package.sh ──► dist/nuclearlang-<v>-<os>-<arch>.tar.gz|zip
                                                                                              │  release.yml (tag v<v>)
                                                                                              ▼
                                           release/install.sh, install.ps1 ◄── a GitHub release (or a mirror)
```

## The layout of an installation (`release/stage.sh <dest> <binary>...`)

The binaries find their files from their own location (`nuclear_dialect::install_dir()`: `$NUCLEAR_HOME`, or the
folder above the binary's `bin/`).

| Folder | Holds | From |
|---|---|---|
| `bin/` | `nuclear`, `nuclear-lsp`; `nuclear-builder.js` with its launchers `nuclear-builder` and `nuclear-builder.cmd` (when `extensions/vscode/out/nuclear-builder.js` is built) | the binaries given; the VS Code extension |
| `dialects/<language>/` | each language with its frameworks, type definitions and docs | `nuclearlang/dialects/` |
| `platforms/<platform>/` | `platform.toml`, `docs/07-reference/`, `docs/08-guides/` | `nuclear-synapsis-framework/platforms/` (each folder with a `platform.toml`; `platforms/docs/` is not one) |
| `generators/<platform>/` | `generators.toml`: what the code generator writes | `tools/code_generator/platforms/` |
| `docs/08-guides/` | the framework's guides | `nuclear-synapsis-framework/docs/08-guides/` |
| `kinds/` | the kind packages of the platforms | `platforms/<platform>/kinds/` |
| `packages/` | every runtime package as it is: `synapsis`, `synapsis_genkit`, `synapsis-py`, `synapsis-nest`, `synapsis-web` | `platforms/<platform>/packages/` |
| `tools/defs/` | the definitions generator `nuclear flutter add` runs (`bin`, `pubspec.yaml`, `pubspec.lock`, `python`, `typescript`) | `nuclearlang/tools/defs/` |
| `agents/skills/` | the `nuclear` skill | `tools/cli/agent-files/skills/` |
| `ai/nuclear-graph-storage`, `ai/nuclear-agents/nuclear_developer`, `ai/tools/mcp` (the folders of the tree, so a relative path between them holds) | the code of the AI services: the graph's `.nuc` sources, `pyproject.toml`, `nuclear.toml`, `prompts`, `data` (the knowledge base); the Developer's `config.nuc`, `components`, `config`, `defs`; the MCP server's `.nuc` sources, `pyproject.toml`, `nuclear.toml`, `defs`, `tests` | `nuclear-graph-storage/`, `nuclear-agents/nuclear_developer/`, `tools/mcp/` |

- A JavaScript package whose `main` is in `dist/` and is not built stops the staging (`npm run build` there, or
  `build-runtimes.sh`).
- What a build or a test leaves inside a package is removed (`build`, `.dart_tool`, `node_modules`, `__pycache__`,
  `.pytest_cache`, `*.egg-info`, `dist-test`, `pubspec.lock`): a stale `build/` would make pip reuse an old wheel.
- A release archive also has `VERSION`. Definitions generated for projects go to `~/.cache/nuclearlang/defs`, not
  into the installation.

## From source (`install.sh`)

1. `cargo build --release -p nuclear-cli -p nuclear-lsp`.
2. The pipeline's engine: `npm run builder` in `extensions/vscode` when its `node_modules` are there; else a note.
3. `stage.sh` into `$PREFIX/share/nuclearlang` (`PREFIX` defaults to `~/.local`), links `nuclear`, `nuclear-lsp` and
   `nuclear-builder` in `$PREFIX/bin`.
4. `ai/nuclear-graph-storage`, `ai/nuclear-agents` and `ai/tools` become links to the tree's own folders, so the
   set-up installs the graph editable and builds the Developer and the MCP server in place. The set-up itself
   (`extensions/tools/nuclear-builder`, Nuclear) is built and installed editable with uv as `nuclear-builder`, in
   place of the node link. With `--ai`: `nuclear-builder setup`. With `--ai-runtime`: the AI archive staged as
   `ai/` and its own `nuclear-builder setup`.
5. The skill copied into `~/.claude/skills`, `~/.agents/skills`, `~/.codex/skills` (`--no-agent` skips it).
6. The VS Code extension: the newest `extensions/vscode/nuclearlang-*.vsix` (`sort -V`), when `code` is on the
   PATH (`--no-vscode`); a note when that package is not the version of `package.json` (it is not built by the
   installer: `npm run package` there). The Zed extension: `extensions/zed/build.sh`, when Zed is installed and the Rust target
   `wasm32-wasip2` is there (`--no-zed`).
7. A check: the installed `nuclear dialect list` must run. A hint when `$PREFIX/bin` is not on the PATH.

`--uninstall`: the AI services first (`nuclear-builder setup --remove`), the links, `uv tool uninstall nuclear-graph` and `nuclear-mcp`, the Zed extension, the installation, the skill,
the intro marker (`$XDG_STATE_HOME/synapsis`), the VS Code extension.

## The release

- `release/build-runtimes.sh`: `npm ci` (or `npm install`) and `npm run build` in every
  `platforms/<platform>/packages/<name>` with a `build` script, then `nuclear-builder` in `extensions/vscode`.
- `release/package.sh [<rust target>]`: builds `nuclear` and `nuclear-lsp` for the target (or this machine), stages them,
  writes `VERSION`, and makes `dist/nuclearlang-<version>-<os>-<arch>.tar.gz` (`.zip` for Windows) with its
  `.sha256`, and `dist/latest` (the version a mirror serves). The version is the workspace's (`Cargo.toml`
  `[workspace.package]`); `os` is `linux`, `macos` or `windows`, `arch` `x86_64` or `aarch64`.
- `release/ai-runtime.sh`: the AI archive of this machine (ADR-installer-0003),
  `dist/nuclearlang-ai-<version>-<os>-<arch>.tar.gz` (`.zip` on Windows) and its `.sha256`, unpacked as the
  installation's `ai/`: a python-build-standalone with the graph `[server]`, the MCP server and the Developer
  installed from what `nuclear build` writes, pinned by the graph's `uv.lock` (`uv pip install --no-sources`, or the
  MCP server's editable source of the graph would install a link to the checkout), the launchers `ai/bin/nuclear-graph`,
  `nuclear-mcp`, `nuclear-developer`, and the knowledge base. Before packing it fails if a `.pth` points into the
  checkout, then tries each launcher and the graph's `/v1/health`. `AI_STAGE=<folder>` only stages it
  (`installer/install.sh --ai`).
- `.github/workflows/release.yml`: on a tag `v<version>` (or by hand). Job `archive`: six targets
  (`x86_64-unknown-linux-musl`, `aarch64-unknown-linux-musl`, `x86_64-apple-darwin`, `aarch64-apple-darwin`,
  `x86_64-pc-windows-msvc`, `aarch64-pc-windows-msvc`), each `build-runtimes.sh` then `package.sh`. Job `vscode`:
  the `.vsix` as `nuclearlang-<version>.vsix` (its bundled server is the Linux one). Job `ai`: `ai-runtime.sh` on a runner of each
  system (Linux x86_64 and arm64, macOS Intel and Apple silicon, Windows), so each AI archive is tried where it
  runs. Job `publish`: every archive,
  checksum and `.vsix`, plus both installers, as assets of the GitHub release.
- The website serves both installers at its root (`https://nuclearlang.github.io/install.sh`, `install.ps1`).

## The public installers (`release/install.sh`, `release/install.ps1`)

Both: find the system and the architecture (Linux and macOS: `x86_64` / `aarch64`, an Apple silicon Mac under
Rosetta still gets the native build; Windows: `AMD64` / `ARM64`), find the release (`latest` on Linux and macOS:
the redirect of `/releases/latest`, which has no API limit, else the API; on Windows the API; with a mirror, its
`latest` file), download the archive and its `.sha256`, check it,
replace the installation, link or put `bin` on the PATH, check `nuclear dialect list`, copy the skill, install the
`.vsix` when VS Code is there, then the AI services.

| | Linux, macOS | Windows |
|---|---|---|
| The installation | `~/.local/share/nuclearlang` (`NUCLEAR_INSTALL`) | `%LOCALAPPDATA%\nuclearlang` (`NUCLEAR_INSTALL`) |
| The commands | links in `~/.local/bin` (`NUCLEAR_BIN`) | the installation's `bin` |
| The PATH | a marked line in `.bashrc`, `.zshrc`, `.profile`; a `conf.d` file for fish | the user's `Path` |
| Options | `--version <v>`, `--no-modify-path`, `--no-vscode`, `--no-agent`, `--no-ai`, `--profile <id>`, `--uninstall` | `-Version`, `-NoModifyPath`, `-NoVSCode`, `-NoAgent`, `-NoAi`, `-AiProfile`, `-Uninstall` |

Variables of both: `NUCLEAR_VERSION`, `NUCLEAR_INSTALL`, `NUCLEAR_REPO` (owner/name, default `nuclearlang/lang`),
`NUCLEAR_DOWNLOAD` (the base url of the files: a mirror), `NUCLEAR_AI_PROFILE`; on Linux and macOS also
`NUCLEAR_BIN` and `NUCLEAR_NO_MODIFY_PATH`.

## The AI services at the end of an install

The installers do not install the services: they call the set-up (`nuclear-builder setup`), whose engine is the VS
archive's `ai/bin/nuclear-builder` (`extensions/tools/nuclear-builder/setup.nuc`, written in Nuclear). What a user sees is [the guide](../08-guides/ai-setup.md); why it is shaped so is
ADR-installer-0002.

- The profile is `--profile` / `NUCLEAR_AI_PROFILE`, else the one the machine has (`NUCLEAR_AI_PROFILE=` in
  `~/.config/nuclearlang/ai.env`, `%APPDATA%\nuclearlang\ai.env`).
- With a profile: `nuclear-builder setup --profile <id> --yes`, no questions (an update keeps the choice). Without
  one and with a terminal (not CI): `nuclear-builder setup`, which asks. Without a terminal: nothing, and a note.
- Unpacking the AI archive links `nuclear-builder` to the archive's (`ai/bin/nuclear-builder`; a `.cmd` on Windows),
  so `nuclear-builder setup` works before the set-up ran; its pipeline commands run the installation's
  `bin/nuclear-builder.js` with node.
- The set-up is given the folders through `NUCLEAR_INSTALL` and `NUCLEAR_BIN`.
- On Linux the services are the systemd user units `nuclear-graph` and `nuclear-developer`
  (`systemctl --user restart nuclear-developer` after a change to its code;
  `journalctl --user -u nuclear-developer -n 50`); `nuclear-builder setup --status` says what is installed and running.
