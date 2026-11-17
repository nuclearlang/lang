# The installers and the release

How NuclearLang gets onto a machine: an installer from the source tree, the release archives of every system, the
one-line installers that download them (`curl … | sh`, `irm … | iex`), the workflow that publishes a release, and
the set-up of the AI services the installers call at their end.

## Stack

- POSIX `sh` scripts and one PowerShell script (5.1 or 7); no dependency but `curl` or `wget`, `tar`, a SHA-256 tool.
- GitHub Actions for the release (`.github/workflows/release.yml`); static Linux binaries (musl).
- The AI set-up is not code of this folder: it is `nuclear-builder setup`, written in Nuclear
  (`extensions/tools/nuclear-builder/setup.nuc`, profiles in `setup.json`), which the editors run as a process. The services themselves come in the AI archive
  (`release/ai-runtime.sh`): a Python of their own with the Smart Graph, the MCP server and the Nuclear Developer,
  unpacked as the installation's `ai/` (ADR-installer-0003).

## Commands

```sh
installer/install.sh                     # from source into ~/.local (PREFIX=/usr/local for another prefix)
installer/install.sh --no-vscode | --no-zed | --no-agent | --ai | --uninstall
installer/release/build-runtimes.sh      # a fresh checkout: the JavaScript runtimes' dist/ and nuclear-builder
installer/release/package.sh [<rust target>]   # the archive of one target in installer/dist/, with its .sha256
installer/release/ai-runtime.sh          # the AI services' archive of this machine, beside it
nuclear-builder setup [--profile <id> --yes | --status | --remove]   # the AI services
```

The public one-liners (they need a published release):

```sh
curl -fsSL https://nuclearlang.github.io/install.sh | sh
irm https://nuclearlang.github.io/install.ps1 | iex
```

## Folders

- `install.sh`: the installer from the source tree (builds `nuclear` and `nuclear-lsp`, stages, links `nuclear`,
  `nuclear-builder` and `nuclear-lsp`, installs the skill and the editor extensions).
- `release/stage.sh`: assembles an installation in a folder: the layout the binaries expect. Used by `install.sh`
  and `package.sh`.
- `release/package.sh`: the release archive of one target. `release/build-runtimes.sh`: what must be built before.
- `release/ai-runtime.sh`: the AI archive of this machine, built and tried before it is packed.
- `release/install.sh`, `release/install.ps1`: the public installers (Linux and macOS; Windows).
- `release/clean-machine/`: a Docker image of a clean Linux machine with systemd, to try an install as a new user.
- `dist/`: what `package.sh` writes (ignored by git).
- `docs/`: this project's documents (the table below).

## Rules

1. **One layout, one script.** An installation is what `release/stage.sh` assembles, from source or from an
   archive; a new file an installed binary needs is added there, never in one installer only.
2. **No sudo, no administrator**: everything goes into the user's folders, and `--uninstall` removes exactly what
   an install created (the definitions cache, Ollama, its models and the graph's data stay: they are the user's).
3. **Nothing is downloaded before the user chooses**: the AI set-up asks, and without a terminal (CI) nothing is
   asked or downloaded (ADR-installer-0002).
4. **Never run `--uninstall` or a public installer against the real `HOME` while testing**: use a fake `HOME` and a
   mirror ([the runbook](docs/06-runbooks/release.md)).
5. **`docs/08-guides/ai-setup.md` is held to the profiles by a test** (`extensions/tools/nuclear-builder/tests/test_setup.nuc`
   against `setup.json`): what a profile says of itself is changed in the data, then in the guide.
6. **The user runs the installed binaries**: after a change to a binary, a dialect, a platform, a runtime package
   or the skill, `installer/install.sh` again.
7. A change to an installer's options updates its own header comment (it is its `--help`), the guide and these
   documents.

## Documents

| Read | When |
|---|---|
| [docs/01-product/roadmap.md](docs/01-product/roadmap.md) | You look for what is half done or untested: the first release, macOS and Windows, the AI profiles |
| [docs/02-architecture/overview.md](docs/02-architecture/overview.md) | You change a script: what each one does, the layout of an installation, the folders and variables, how the AI services are installed |
| [docs/03-adr/README.md](docs/03-adr/README.md) | You need why the release is archives and one-line installers, or why the AI services come with the installer and how their set-up is shaped |
| [docs/06-runbooks/release.md](docs/06-runbooks/release.md) | You publish a release, build an archive by hand, or test an installer without touching your machine |
| [docs/08-guides/ai-setup.md](docs/08-guides/ai-setup.md) | You need what a user reads about the AI services: the steps, the profiles, where things are, update, remove, failures |

Elsewhere:

- The skill the installers copy and the files a project gets:
  [the CLI's agent support](../tools/cli/docs/02-architecture/agent-support.md).
- The services the set-up installs: [the Smart Graph](../nuclear-graph-storage/AGENTS.md),
  [the agents](../nuclear-agents/AGENTS.md); the MCP server: [tools/mcp](../tools/mcp/AGENTS.md).
- The wizard of the editor and `nuclear-builder`: [the extensions](../extensions/AGENTS.md).
