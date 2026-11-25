# Changelog

All notable changes to the `nuclear` command (its framework commands too) are written here; versions follow [Semantic Versioning](https://semver.org).

## Unreleased

- `nuclear new` writes the oracle's rule into a project's `docs/README.md` and `AGENTS.md` (Nuclear is the MCP server's, the architecture the project's); `nuclear agent init` adds it to an older project's `docs/README.md`, what the user wrote kept (spec 025).
- Fix: a mobile app whose packages an earlier release fetched failed with `Couldn't resolve the package 'decimal'` (the `synapsis` runtime of 0.100 needs it, and `pub get` ran again only when the app's own pubspec changed): `nuclear build` runs `pub get` again when another version of the platform made the last one.
- A project's development port never moves by itself: the dialect's, or the `PORT` of the project's `.env` files (`nuclear env set PORT <port>`); the registry of projects records it and never assigns another (it moved a workspace's backend to 8008 while its apps called 8000). `nuclear run` refuses a port another process holds and says which one (`lsof`) and which project of the registry has it. The registry holds only the person's projects: a temporary folder, Nuclear's installation and the folders of Nuclear's source tree stay out, and are pruned from an existing file on read. A web or mobile app of a workspace gets its backend's address from the backend's own files (not the registry), also when its `.env` value equals the code's default.
- `nuclear projects [--json]`: every Nuclear project of the machine, whatever its workspace, and its development address, from the registry `projects.json` of the user's data folder (`NUCLEAR_PROJECTS` names another file), written by `new`, `build` and `run`; a project whose folder is gone leaves it. Each project's address is the dialect's `url` / `web_url` with its own `PORT` (the entry above): `nuclear run` fills `{{url}}`/`{{port}}` with it and gives a backend `PORT`, `NUCLEAR_ENV` and `NUCLEAR_DEV_ORIGINS` (its CORS in development), a mobile app `--web-port <port> --web-hostname 127.0.0.1` (unless given), the editor's launches the same address. A web or mobile app of a workspace built in `development` without an `API_URL` gets the workspace's backend address; `nuclear new` of a web app in a workspace writes it in its `.env`. The flutter dialect has `web_url` (127.0.0.1:8080); fastapi and nestjs answer at `127.0.0.1`.
- Fix: `nuclear build` of a nestjs project installed by an earlier release installs its packages again before compiling (it compiled against the old runtime: `no exported member 'RequiredPipe'`); found by the new upgrade check of the delivery gate.
- Fix: `nuclear run` installs a project's packages again when another version of the platform installed them (`build/.nuclear-installed`): a backend project installed before 0.96 failed with `No module named synapsis.server`, since its runtime stayed the old one.
- `nuclear dialect check` (and the bundle check) warn of a plugin the dialect does not bring yet (N0305); a build no longer prints that warning on every project, and a project that enables such a plugin gets an error instead.
- `nuclear make` and `nuclear gen` (and the MCP server's generators) refuse a name that is not snake_case or is a reserved word of Nuclear or of the project's target (`_global`, `users_`, `if`, `global` with `fastapi`): such a name was written as a folder (`components/_global`).
- `nuclear migrate make "<message>" --rename <table>=<new table>` and `--rename <table>.<column>=<new column>` (any number, the database's names): the migration renames in place and keeps the rows, where `make` would write a drop and an add. The command checks the shape of each rename; the dialect's tool refuses one that is not there.
- The automatic update: a newer release (looked for once a day while you use NuclearLang) installs itself when you stop working, 30 minutes without a use, or within 12 hours, in the background (`nuclear update --when-idle`); every command, VS Code and the MCP server count as a use (`nuclear update --touch`). `nuclear update --check [--json]`, `--auto on|off`, `NUCLEAR_AUTO_UPDATE=0`; never in CI or under sudo. It replaces the question before a command.
- Workspaces (spec 022): `nuclear workspace new|add|remove|rename|edit|list|show|find [--workspace <dir>] [--json]`.
  A workspace is a folder with `.workspace/workspace.nuc` (`workspace(name, description)` and an `app(folder,
  platform)` per app), read by the compiler's parser as `config.nuc` is. `add` is `nuclear new` in the workspace's
  folder; `nuclear new` anywhere inside a workspace makes the project in its folder and registers it; `remove`
  deletes the folder only with `--delete` (never one outside the workspace); `rename` moves the folder (`--project-name`:
  also `app(name)`). `--json` prints `{root, name, description, apps: [{name, folder, platform, dialect, exists}]}`
  (`find`: or `null`; `{error}` on a refusal). `nuclear check` in a workspace's folder checks every app; `nuclear
  doctor` there says the workspace's apps. The atlas's topic `workspace` is now this guide; the editor's workspace
  panel is `editor-workspace`.

- `NUCLEAR_UPDATE_DRYRUN=1 nuclear update` prints the installation it found and what it would run, and runs nothing (the installer's test `UPD1` and `after-release.sh`).

- `nuclear update` with the latest release already here says so and runs nothing (it ran the whole installer again); `nuclear update --reinstall` installs it all the same (`NUCLEAR_REINSTALL=1` for the installers).
- Fix (macOS): `nuclear update` said "this nuclear was not installed by the NuclearLang installer", and the update question never showed, because macOS gives the path of the installer's link (`~/.local/bin/nuclear`) and the installation was looked for beside it; the link is now resolved first.
- The local models are on standby (ADR-platform-0013): `nuclear help start` no longer offers the local developer
  (`developer_*`) among the MCP server's tools, and the atlas's `ai-setup` says the local models are on standby. The
  MCP server registers no `developer_*` tool while its `LOCAL_MODELS` (held to Nuclear Builder's `localModels`) is
  false, and `nuclear_start`'s work cycle never sends an agent to the local Developer.
- Fix: the update question shows on the first command after a newer release is out, the first run after an install included, as Flutter and oh-my-zsh do: the check is asked at most once a day and waits at most 3 seconds (offline the command goes on). Before, the first run only started the check in the background and asked nothing until a later run.

## 0.82.0

- Environments (spec 021): `nuclear env list|set|unset|envs|use` (`--json`, `--env`, `--local`, `--secret`; a secret's
  value from stdin, kept in the system's keyring, never printed; without a keyring, `.env.<env>.local` and a message);
  `--env <name>` on `run`, `build`, `test`, `check` (else `NUCLEAR_ENV`, else the active one, else `development`;
  tests: `test`); the dotenv files `.env` < `.env.<env>` < `.env.local` < `.env.<env>.local` < the keyring < the
  process. `run` passes the values to the app and refuses a required variable without one; `build` writes the
  backend's `build/.env` (no secret) or a client's values (a secret read by it: N0311); `check --env` reports N0312.
  `nuclear new` writes a `.env` with the code's defaults and a `.gitignore` with `.env*.local`; a new web project's
  backend is `env("API_URL", ...)`. The MCP server's `nuclear_env` (a secret is never set through it).
- Security (spec 018): a name given to `make` or `gen` that leaves the project (`/`, `..`) is refused before anything
  is written; each argument after `--` is one shell word; on Windows every value is quoted for `cmd` (`"`, `%`, `&`
  can no longer end it or start another command).
- The update question is one key, `[Y]es / [n]o / [l]ater` (a day): no key in 15 s goes on, never inside `make`, an
  npm script or under `sudo`; the check falls back to `wget`; an update keeps the choices of the last install.

- `nuclear add <package>[@version]... [--module <m>]` and `nuclear remove <package>...` on every platform
  (ADR-lang-0008): a backend or web project installs the package with its dialect's package manager, writes it in
  `config.nuc` and generates its type definitions into `defs/` (`dependencies.rs`); a mobile app goes through
  `flutter add`. `nuclear install` generates the definitions a package of `config.nuc` lacks. A section of
  `config.nuc` written in one line is edited.
- First public version.
- `nuclear gen inspect|component|resource` (ADR-codegen-0001): a resource's finished code from `--fields`, `--from-json` or `--from-spec`, for the three platforms.
- `nuclear gen usecase <component> <Name> [--calls <Repository>.<method>] [--route "POST orders/{id}/cancel"]` (ADR-codegen-0001): a use case wired into its component (its alias in the facade; backend: its route in the controller of the route's prefix), its signature read from the project; with `--calls` the use case is written too. A `merge` piece adds whole members (a route keeps its decorator and its body), and a name another file declares also stops a new `merge` file.
- `docs/08-guides/generators.md`: the generators' guide (every option, what each platform gets, a use case written and wired step by step, the refusals, the MCP tool of each command, what is not generated yet).
- `nuclear gen resource` on a resource that exists finishes what it adds: a new action also gets the repository's method and the controller's route (it left a use case calling a method nobody had). `--source db --actions search` is refused: which column is searched is a decision (a query of the repository, wired with `gen usecase --calls`). ADR-developer-0001.

## 0.80.0

- The platform's one version (ADR-platform-0011): every project of NuclearLang carries the same version and a release is one snapshot of all of them (`installer/release/version.sh`).
- `nuclear update`: installs the latest release (the public installer run again for this installation, the AI
  services included). In a terminal, every command asks `Update now? [Y/n]` when a newer release is out; the check
  runs in the background once a day, never in editors, agents, pipes or CI (`NUCLEAR_NO_UPDATE_CHECK=1` turns it
  off), and a build from source is never updated (`update.rs`).

