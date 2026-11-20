# Changelog

All notable changes to the `nuclear` command (its framework commands too) are written here; versions follow [Semantic Versioning](https://semver.org).

## Unreleased

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

