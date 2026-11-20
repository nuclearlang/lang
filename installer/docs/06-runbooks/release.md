---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [installer/release/package.sh, installer/release/clean-machine/Dockerfile, .github/workflows/release.yml, installer/docs/02-architecture/overview.md]
---
# Release, and test an installer

## Publish a release

1. The version is `version` of `[workspace.package]` in the root `Cargo.toml`.
2. Push the tag `v<version>`. `.github/workflows/release.yml` builds the six archives, the AI archives, the VS Code
   extension and the vectors of the knowledge base (`nuclearlang-embeddings-<version>.npz`, one file for every system:
   the job `embeddings` runs `nuclear-graph embeddings`, ADR-graph-0003), and publishes them, with `install.sh` and
   `install.ps1`, in the GitHub release of that tag. It can also be started
   by hand (`workflow_dispatch`).
3. The public one-liners download from that release: without a release they fail with a clear error.
4. Once the release is published, `.github/workflows/installer-windows.yml` installs it on a real Windows (Windows
   PowerShell 5.1 with the AI services' profile `remote`, PowerShell 7, and arm64), checks that `nuclear` runs and the
   Smart Graph answers, and uninstalls it leaving nothing. By hand: `gh workflow run installer-windows -R
   nuclearlang/lang -f version=<version>`.

The workflow has never run ([roadmap](../01-product/roadmap.md)).

## Build an archive by hand

```sh
installer/release/build-runtimes.sh                        # only on a fresh checkout
installer/release/package.sh                               # this machine
installer/release/package.sh x86_64-unknown-linux-musl     # another target (rustup target add it first)
```

It prints the archive's path: `installer/dist/nuclearlang-<version>-<os>-<arch>.tar.gz` (`.zip` for Windows), with
its `.sha256` and `installer/dist/latest`.

## Test an installer without touching your machine

**Never run `--uninstall` or a public installer against your real `HOME`.** Two ways:

- **A fake `HOME` and a mirror.** Serve `installer/dist/` over HTTP on this machine and run the installer with
  `HOME=<an empty folder>` and `NUCLEAR_DOWNLOAD=<the url of that server>`: it reads `latest`, the archive and the
  checksum from there instead of a GitHub release.
- **A clean machine in Docker** (`installer/release/clean-machine/`): nothing of NuclearLang inside, a user `dev`
  who can sudo, systemd as on a real machine (so Ollama's installer and the AI set-up register their services the
  usual way), git as on any developer's machine, and no Python and no Node.js (the AI services and their set-up bring their own
  Python). The installer reads the archive mounted at
  `/mirror` (`NUCLEAR_DOWNLOAD=file:///mirror`).

  ```sh
  installer/release/package.sh x86_64-unknown-linux-musl
  installer/release/ai-runtime.sh
  docker build -t nuclear-clean installer/release/clean-machine
  docker run -d --name nuclear-clean --cgroupns=private --security-opt writable-cgroups=true \
    --tmpfs /run --tmpfs /run/lock --tmpfs /tmp -v "$PWD/installer/dist:/mirror:ro" nuclear-clean
  docker exec -it nuclear-clean su - dev      # a terminal of the new user
  docker rm -f nuclear-clean                  # the machine is gone: run it again for a new one
  ```

  Never `--privileged`, `--cgroupns=host` or a bind of `/sys/fs/cgroup`: the container's systemd then takes the
  host's cgroups, ttys and devices and brings the desktop session down. `writable-cgroups` gives it only its own.

## After a change in the tree

`installer/install.sh` again: the user runs the installed binaries (`~/.local/bin/{nuclear,nuclear-lsp,nuclear-builder}`,
files in `~/.local/share/nuclearlang`). `cargo install` puts binaries in `~/.cargo/bin`, which is not on the user's
PATH. After a change to a service's code on Linux: `systemctl --user restart nuclear-developer` (or
`nuclear-graph`); its output: `journalctl --user -u nuclear-developer -n 50`.
