# The installers and the release

[![ci](https://github.com/nuclearlang/lang/actions/workflows/ci.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/ci.yml) [![release](https://github.com/nuclearlang/lang/actions/workflows/release.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/release.yml) · [Website](https://nuclearlang.github.io)

How NuclearLang gets onto a machine: an installer from the source tree, a release archive per system, the
one-line installers, and the set-up of the AI services.

## Why

- An installation is more than a binary: dialects, platforms, generators, runtimes and the agents' skill travel with it.
- One command on Linux, macOS and Windows, with no Rust needed.
- No sudo, and no download before the user chooses it.

## How we made it

- **One layout, one script** (`release/stage.sh`), one archive per system, one-line installers that check SHA-256
  ([ADR-installer-0001](docs/03-adr/0001-release-archives-and-one-line-installers.md)).
- **The AI services come with the installer**, set up in steps by machine profile
  ([ADR-installer-0002](docs/03-adr/0002-the-ai-services-come-with-the-installer.md)).
- **POSIX `sh` and PowerShell**, needing only `curl`/`wget`, `tar` and a SHA-256 tool.
- No release is published yet: the public one-liners fail until the first tag ([roadmap](docs/01-product/roadmap.md)).

## Try it

```sh
installer/install.sh                                      # from the source tree
curl -fsSL https://nuclearlang.github.io/install.sh | sh  # Linux, macOS, once released
irm https://nuclearlang.github.io/install.ps1 | iex       # Windows (PowerShell)
nuclear doctor                                            # what the platforms still need
```

## Read next

- [Set up the AI services](docs/08-guides/ai-setup.md)
- [The release runbook](docs/06-runbooks/release.md), [how the scripts work](docs/02-architecture/overview.md)
- [The decisions](docs/03-adr/README.md)
- To change it: [AGENTS.md](AGENTS.md)
