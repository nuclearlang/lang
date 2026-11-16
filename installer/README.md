# The installers and the release

How NuclearLang gets onto a machine: an installer from the source tree, one release archive per system, the
one-line installers that download them, the workflow that publishes a release, and the set-up of the AI services
the installers call at their end.

## Why it exists

An installation is more than a binary: the dialects, the platforms' contracts and documents, the generators' data,
the runtime packages, the definitions generator and the agents' skill travel with `nuclear`, and the binaries find
them from their own location. `cargo install` needs Rust on the machine and ships none of that. The goal is one
command on Linux, macOS and Windows, as Claude Code or Ollama have.

What it leaves out on purpose: sudo and administrator rights (everything goes into the user's folders), and any
download before the user chooses it.

## How we made it

- **One layout, one script.** `release/stage.sh` assembles an installation; the installer from source and the
  release archives both use it, so both give the same folders
  ([ADR-installer-0001](docs/03-adr/0001-release-archives-and-one-line-installers.md)).
- **One archive per system and architecture**, `nuclearlang-<version>-<os>-<arch>.tar.gz` (`.zip` for Windows) with
  its `.sha256`, built by `.github/workflows/release.yml` on a tag `v<version>`: Linux (static musl binaries,
  x86_64 and aarch64), macOS (x86_64, arm64), Windows (x86_64, arm64). A package manager per system can wrap the
  same archives later.
- **One-line installers** (`install.sh` for `sh`, `install.ps1` for PowerShell) download the system's archive,
  check its SHA-256, install, set the PATH, copy the agents' skill and the VS Code extension, and uninstall. A
  mirror (`NUCLEAR_DOWNLOAD`) serves the same files, which is also how an installer is tested.
- **The AI services come with the installer**
  ([ADR-installer-0002](docs/03-adr/0002-the-ai-services-come-with-the-installer.md)): every archive carries the
  code of the Smart Graph and the Nuclear Developer; the large parts (the Python packages and the models) are
  downloaded by a set-up in steps that reads the machine, suggests a profile (`remote`, `lite`, `medium`, `hard`)
  and starts the services at every login. Its engine is the editor's (`nuclear-builder setup` in a terminal), not
  code of this folder.
- **Written in POSIX `sh` and PowerShell**, with no dependency but `curl` or `wget`, `tar` and a SHA-256 tool:
  scripts that must run on a machine where nothing of NuclearLang exists yet.

Not done yet: no release has been published (`release.yml` never ran), so the public one-liners fail until the
first tag ([the roadmap](docs/01-product/roadmap.md)).

## Try it

From the source tree:

```sh
installer/install.sh --help          # its options: --no-vscode, --no-zed, --no-agent, --ai, --uninstall
installer/install.sh                 # nuclear, nuclear-lsp, nuclear-builder in ~/.local/bin, the skill, the editors
nuclear doctor                       # what the platforms still need on this machine
nuclear-builder setup --status       # the AI services: profile, Smart Graph, Nuclear Developer, Ollama, at login
```

Once a release exists:

```sh
curl -fsSL https://nuclearlang.github.io/install.sh | sh        # Linux, macOS
irm https://nuclearlang.github.io/install.ps1 | iex             # Windows (PowerShell)
```

Test an installer with a fake `HOME` and a mirror, never against your own: [the runbook](docs/06-runbooks/release.md).

## Where to read next

- [Set up the AI services](docs/08-guides/ai-setup.md): the steps, the profiles, where things are, update, remove.
- [The release runbook](docs/06-runbooks/release.md), [how the scripts work](docs/02-architecture/overview.md),
  [the decisions](docs/03-adr/README.md), [the roadmap](docs/01-product/roadmap.md).
- What it installs: [the `nuclear` command](../tools/cli/README.md), [the MCP server](../tools/mcp/README.md),
  [the Smart Graph](../nuclear-graph-storage/README.md), [the editors](../extensions/AGENTS.md).
- To change it: [AGENTS.md](AGENTS.md).
