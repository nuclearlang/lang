# Changelog

All notable changes to nuclear are written here; versions follow [Semantic Versioning](https://semver.org).

## Unreleased

- Any package of the target is used through Nuclear (ADR-lang-0008). A name called like its package is imported by name
  (`from tqdm import tqdm`, `import { nanoid } from 'nanoid'`; before, as the package itself); `index.json` has
  `defaults`, a package's default export (`import dayjs from 'dayjs'`), which `gen.js` now describes; `config.nuc`
  takes a name that is not an identifier (`"date-fns@^4.1.0"`); `[project.manifest.advice]`; `nuclear defs` reads the
  packages of the project it runs in; `gen.py --distribution` and `gen.js --package`; `defs.dart` skips the library of
  a plugin the app has not enabled (it failed every `flutter add` there). A member of a module (`np.max(list)` after
  `use numpy as np`) or of a library's function or object (`lodash.map(...)`) is the library's own: it was rewritten
  as the member of Nuclear's library with that name (`_max(np)`).
- First public version.
- `STATUS.md` holds only what is left to do (half done, untested, pending) and keeps no log: what a task did is written in the documentation of its area, and no file is made to hold history (`AGENTS.md` rule 6, `docs/context/workflow.md`); the start hook (`tools/context/check.sh session`) warns when the file is over 40 KB.
- `nuclear agent hook` checks a project with its own type definitions (`<project>/defs`), as `nuclear check` does: it reported every name of them as an error after each edit.
- The `try` template gets `catch_used` (the block names the caught value): the `python` dialect writes `except Exception:` when it does not, since a name nothing reads is an error of pyright's strict mode (`spec/python.md` §3.12).
- ADR-graph-0002: the planner of the Smart Graph runs an exact query only when its question is closer than the closest card; ADR-graph-0001: the graph's search is exact; ADR-installer-0002: a service that starts at login waits for the keyring.
- ADR-graph-0001: the Smart Graph is a library of typed, linked, versioned rows; the definition of done includes the knowledge base (`nuclear-graph knowledge build | check`, `ingest`) and the end-of-turn hook (`tools/context/check.sh stop`) runs the check.
- `[[generators]]` and `[gen]` in a platform's contract (`Dialect.generators`, `gen_values`); a facade alias named like its use case's field gets the field `<name>Instance` (ADR-codegen-0001).
- `nuclear_transpile::map::shape`: a declaration of a project as its source writes it (its file, its header's parameters, each method's parameters, return type and whether it awaits), which `dragonfly gen usecase` reads; the `usecase` generator and whole-member merges in `spec/dialects.md` (ADR-codegen-0001).
- `docs/ai/mcp.md`: the MCP server's page (how to add it to each client, the order a model works in, every tool by group, what to do when one fails); the Loop page links to it.
- ADR-developer-0001: a strategy for each kind of request (a whole system, one screen, a rename, a failing test...), as rows of the Smart Graph that the analyst and the Loop follow; `docs/ai/loop.md` (the strategy of a request) and `docs/ai/mcp.md` (`graph_strategy`); the skill names it.
- ADR-installer-0002: the AI services come with the installer. Every release archive carries the code of the Smart Graph and the Nuclear Developer with its knowledge base (`ai/`, `tools/release/stage.sh`); the installers end with their set-up (`nuclear-loop setup`: a profile for the machine, the services at every login), bring a machine already set up to date without questions, and take `--no-ai` and `--profile <id>` (`-NoAi`, `-AiProfile` on Windows); `--uninstall` removes the services; `./install.sh --ai` is the same set-up over the working tree. `docs/ai/setup.md`; the release workflow clones the three AI repositories.
- `[project] package` in `nuclear.toml`: the package a project's files are emitted into (`build/<package>/...`; imports between the project's files are relative to it, `{{package}}` in a dialect's `project_import`); the `python` dialect uses it, so a Nuclear project is a Python package another tool can package (`spec/projects.md`, `spec/python.md`).
- ADR-graph-0002: questions with one right answer are answered from exact facts (SQLite, in the memory of the graph) by a query planner that asks no model; the Smart Graph is written in Nuclear (the `python` dialect), `tools/release/stage.sh` carries its `.nuc` sources and the set-up builds them; rule 12 of `AGENTS.md`: Nuclear and Dragonfly first for every new development.
- ADR-platform-0003: any step, stage or run of the Loop runs again (`nuclear-loop retry <run> --step <id>`, `nuclear-loop restart <run>`), each step keeps the decisions it took and why, the run is drawn as a graph, and the acceptance criteria are held against what the run left (`docs/ai/loop.md`).
