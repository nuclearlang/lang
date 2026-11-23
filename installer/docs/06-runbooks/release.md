---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [installer/release/delivery.sh, installer/release/after-release.sh, installer/tests/screen.py, installer/release/package.sh, installer/release/clean-machine/Dockerfile, .github/workflows/release.yml, installer/docs/02-architecture/overview.md]
---
# Release, and test an installer

## Publish a release

1. One version for the whole platform (`version` of `[workspace.package]` in the root `Cargo.toml` and every other
   manifest), raised by Semantic Versioning: a fix
   PATCH, a new feature MINOR, a breaking change MAJOR (MINOR while it is `0.x`) ([coding.md](../../../docs/05-standards/coding.md#git)).
   A release is one snapshot ([ADR-platform-0011](../../../docs/03-adr/0011-one-version-one-release.md)):
   `installer/release/version.sh <version>` writes it into every project and lock file, then
   `nuclear-graph knowledge build` (the knowledge base names each component's version), `knowledge check`, `ingest`;
   `installer/release/version.sh --check v<version>` must say *every project is at <version>*. The CI checks it on
   every push and the job `snapshot` of the release before anything is built.
2. **The delivery gate**: `installer/release/delivery.sh <version>` must pass; no tag before it. It runs, in order and
   stopping at the first failure (its log in `target/delivery/<step>.log`, with how to fix it): `version.sh --check
   v<version>`; `cargo test`; `cargo clippy --all-targets -- -D warnings`; this tree's `nuclear` staged in a temporary
   installation and put first on `PATH`; `extensions/vscode` `npm run compile` and `npm test` (every text has its
   Spanish, no local-model setting); Nuclear Builder (`nuclear check`, `nuclear build`, pytest); the MCP server
   (`nuclear check`, build, pytest); the backend runtimes (synapsis-py pytest, synapsis-nest `npm test`); the website
   exactly as `.github/workflows/website.yml` (`node tools/content.mjs` without `UPDATE_EXAMPLES`, so an onboarding
   example that is no longer what `nuclear new` writes fails here, then `nuclear build`, `install`, `test`, the bundle);
   `nuclear-graph knowledge check` clean; `package.sh` and every case of `installer/tests/run.sh`. Among them `OUT1`,
   what the user reads (the installer in a pseudo-terminal of 80 and 60 columns with colors, rendered by
   `installer/tests/screen.py`: no `ADR-`, `spec 0`, `standby` or `TODO`, the motto once, no `nuclear intro`, every
   box's right border at its column or absent, no box line wrapped, no frame of the turning sign left), and `UPD1`, an
   update from the previous published release with `nuclear` through its link (`NUCLEAR_UPDATE_DRYRUN=1 nuclear
   update`). `UPD1` needs the network: skipped offline, the gate fails unless `--offline-ok`. `--only <step>,...` runs
   some steps, to try them; never before a tag. Each check was added after a release that shipped without it: a
   website that had failed three releases (the site kept an old `install.sh`), a tag with a failing `cargo test`,
   internal text and cut boxes in the installer's output, `nuclear update` broken on macOS by the installer's link.
3. Push the tag `v<version>`. `.github/workflows/release.yml` builds the six archives, the AI archives, the VS Code
   extension and the vectors of the knowledge base (`nuclearlang-embeddings-<version>.npz`, one file for every system:
   the job `embeddings` runs `nuclear-graph embeddings --reuse` with the previous release's file, so only the texts
   that changed are computed, ADR-graph-0003), and publishes them, with `install.sh` and
   `install.ps1`, in the GitHub release of that tag. It can also be started
   by hand (`workflow_dispatch`).
4. The job `marketplaces` publishes the same `.vsix` on the Visual Studio Marketplace (Trusted Publishing: no token;
   the publisher `nuclearlang` has a policy for owner `nuclearlang`, repository `lang`, workflow `release.yml`, no
   environment) and on Open VSX (namespace `nuclearlang`, verified: Trusted Publishing with the trusted publisher
   nuclearlang/lang, `release.yml`, registered on open-vsx.org; the secret `OVSX_PAT`, a token scoped to the namespace
   with *Publishing only*, is used instead only while it exists). The stores read the `version` of
   `extensions/vscode/package.json`: bump it for the release, or that store skips the upload. A failure there does not
   stop the GitHub release.
5. The public one-liners download from that release: without a release they fail with a clear error.
6. Once the release is published, `.github/workflows/installer-windows.yml` installs it on a real Windows (Windows
   PowerShell 5.1 with the AI services' profile `remote`, PowerShell 7, and arm64), checks that `nuclear` runs and the
   Smart Graph answers, and uninstalls it leaving nothing. By hand: `gh workflow run installer-windows -R
   nuclearlang/lang -f version=<version>`.

7. **After the tag**: `installer/release/after-release.sh <version>` waits for every workflow of the tag and its
   commit (release, ci, website, platform-*, the extensions') and fails when one did not succeed (a run with a job
   GitHub never gave a runner, cancelled with no step, as macOS runners short of capacity do, is run again once
   first); says which store the extension did not reach (the job `marketplaces` never fails a release); checks that the
   GitHub release has every asset `release.yml` publishes (the six archives, the four AI archives, each `.sha256`, the
   `.vsix` and its `.sha256` (the extension checks a copy it downloads against it), the vectors, `install.sh`, `install.ps1`); that `https://nuclearlang.github.io/install.sh` and `install.ps1`
   are byte-identical to the tag's (retried for 10 minutes: the site publishes after the website workflow); and runs
   the user's path in a fake `HOME`: the public one-liner, and the previous release installed by its own installer and
   updated as `nuclear update` does. The release is done only when it passes; a failure is fixed by a PATCH release.
   `AFTER_RELEASE_WAIT` and `AFTER_RELEASE_SITE` change the minutes it waits.
8. **On a real Mac and a real Linux** (the services cannot start in a fake `HOME`): the public one-liner on a machine
   that never had NuclearLang, again on the same machine, and an update over the previous release; after each,
   `installer/tests/stack.sh` must pass: one job and one process of each service (the Smart Graph, Nuclear Chat), each
   answering on the port of `ai.env`, the MCP server in an AI client, the editor extension installed.

The workflow `installer-windows.yml` has never run ([roadmap](../01-product/roadmap.md)).

## Build an archive by hand

```sh
installer/release/build-runtimes.sh                        # only on a fresh checkout
installer/release/package.sh                               # this machine
installer/release/package.sh x86_64-unknown-linux-musl     # another target (rustup target add it first)
```

It prints the archive's path: `installer/dist/nuclearlang-<version>-<os>-<arch>.tar.gz` (`.zip` for Windows), with
its `.sha256` and `installer/dist/latest`.

## Test an installer without touching your machine

**Never run `--uninstall` or a public installer against your real `HOME`.** First `installer/tests/run.sh`: the
failure cases of spec 018 (fresh, same version, an update keeping the choices, the lock, sudo, interrupted, a broken
binary, uninstall), what the user reads (`OUT1`) and an update from the previous release (`UPD1`), in a minute, against `package.sh`'s archive; and `installer/tests/distros.sh`, the installer on
six distributions one container at a time, against `package.sh x86_64-unknown-linux-musl` (the release's static
build: a plain `package.sh` links this machine's glibc and does not run on an older distribution). Then, for the AI services, two ways:

- **A fake `HOME` and a mirror.** Serve `installer/dist/` over HTTP on this machine and run the installer with
  `HOME=<an empty folder>` and `NUCLEAR_DOWNLOAD=<the url of that server>`: it reads `latest`, the archive and the
  checksum from there instead of a GitHub release.
- **A clean machine in Docker** (`installer/release/clean-machine/`): nothing of NuclearLang inside, a user `dev`
  who can sudo, systemd as on a real machine (so the AI set-up registers its services the usual way), git as on any developer's machine, and no Python and no Node.js (the AI services and their set-up bring their own
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

- **The clean machine with an editor** (`clean-machine/editor.Dockerfile`, on top of the image above): VS Code and a
  virtual display, the public installer from the internet; the extension is driven over VS Code's debugging port,
  published to the host through `socat` (Electron listens only on the container's own `127.0.0.1`). Start Electron
  itself (`/usr/share/code/code`, not the `code` launcher, which returns and takes `xvfb-run`'s display with it), and
  set `"security.workspace.trust.enabled": false` and `"window.dialogStyle": "custom"` before it starts (the trust
  question and VS Code's dialogs are native windows a debugging port cannot reach).

  ```sh
  docker build -t nuclear-clean-editor -f installer/release/clean-machine/editor.Dockerfile installer/release/clean-machine
  docker run -d --name nuclear-editor --cgroupns=private --security-opt writable-cgroups=true --cpus 2 --memory 4g \
    --tmpfs /run --tmpfs /run/lock --tmpfs /tmp -p 127.0.0.1:9444:9444 nuclear-clean-editor
  docker exec nuclear-editor su - dev -c 'curl -fsSL https://nuclearlang.github.io/install.sh | sh'
  docker exec -d nuclear-editor su - dev -c 'xvfb-run -a -s "-screen 0 1600x1000x24" /usr/share/code/code \
    --no-sandbox --disable-gpu --remote-debugging-port=9443 ~/projects'
  docker exec -d nuclear-editor socat TCP-LISTEN:9444,fork,reuseaddr TCP:127.0.0.1:9443   # apt-get install socat first
  ```

## After a change in the tree

`installer/install.sh` again: the user runs the installed binaries (`~/.local/bin/{nuclear,nuclear-lsp,nuclear-builder}`,
files in `~/.local/share/nuclearlang`). `cargo install` puts binaries in `~/.cargo/bin`, which is not on the user's
PATH. After a change to a service's code on Linux: `systemctl --user restart nuclear-chat` (or
`nuclear-graph`); its output: `journalctl --user -u nuclear-chat -n 50`.
