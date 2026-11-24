# Start here: NuclearLang for an agent with no context

Nothing about NuclearLang is in your training data, and it is not TypeScript, Dart nor Python. Everything you need
comes from this installation: the `nuclear` command and the `nuclear` MCP server. Learn from the topics they print;
never search the disk for Nuclear's source code or its documents, and never guess a syntax.

## What it is

- **NuclearLang** (`.nuc`): a minimal language for AI agents and people. Its transpiler turns `.nuc` into
  TypeScript, Dart or Python through **dialects** (TOML and templates), one way only: the `.nuc` is the source, the
  target code is generated and never edited.
- **Synapsis**: its framework. Three **platforms**, each written once in Nuclear and built by its dialects:
  `mobile` (dialect `flutter`), `backend` (`fastapi` = Python, `nestjs` = TypeScript) and `web` (`react`). The
  Nuclear of a platform is the same for every dialect of it: the dialect only changes the language underneath.
- **The golden rule**: generated code as fast as an expert's, instant transpilation, minimal readable Nuclear.

## Rules never broken

1. **Read before writing.** The syntax sheet of your dialect first (`nuclear spec --brief --dialect <dialect>`,
   MCP `nuclear_brief`), then the topic of what you write. Look up a word instead of guessing:
   `nuclear help <word> --dialect <dialect>`; a class or member of the target's libraries:
   `nuclear defs show <Name> --dialect <dialect>`.
2. **A product is made with the tools.** `nuclear new` creates the project, `nuclear gen` writes finished code of a
   resource, `nuclear make` the skeleton of each piece where the platform puts it, `nuclear add` a library. Write by
   hand only what they leave, in Nuclear. Never write target code (`.ts`, `.dart`, `.py`) for a feature, never
   translate code of another language into Nuclear by hand, never edit `build/`. When a tool cannot do something,
   say so.
3. **Nuclear's standard library only** (`nuclear help library`): strings, lists, maps, dates, JSON... never the
   target's names in platform code.
4. **Check after every change.** `nuclear check --json` must print `[]`; fix exactly what each error says (most
   carry a `fix`, and `nuclear fix` applies them). Then `nuclear test`.
5. **The project documents itself.** Its `AGENTS.md` and `docs/` say what it is and how it is made; keep them true
   in the same change (topic `context-docs`). The project's own `docs/README.md` wins over this default.

## The work cycle

0. Size the request before any work (`nuclear help task-size`): count the files and the lines it would change and
   whether it adds a feature (a new screen, endpoint, entity, component, or a changed contract or schema). Small
   (≤ 3 files, ≤ 100 lines, no feature) and medium (≤ 10 files, ≤ 400 lines, no new feature): do it yourself, and say
   what you touched. Large (more, a new feature, or several specs): propose Nuclear Builder (a spec, or several, and
   one run) with your count as the reason, and let the user decide.
1. A new project: `nuclear new <name> -p mobile|backend|web [-d <dialect>]` (mobile: `flutter`; backend: `fastapi`,
   `nestjs`; web: `react`). Inside it, `nuclear help` lists every command of its platform. `nuclear doctor` says
   what this machine lacks for it: a mobile app needs Flutter (`nuclear setup flutter`), a `nestjs` or `react` project
   Node.js (`nuclear setup node`); Python for `fastapi` comes with NuclearLang.
2. Read: the brief of the dialect, the platform's topic (`mobile`, `backend`, `web`), its first-project guide
   (`onboarding-mobile`, `onboarding-backend`, `onboarding-web`) and `nuclear help layout --dialect <dialect>` (where
   each kind's file goes).
3. Generate: `nuclear gen resource <component> <Name> --fields "id:int name:string"` (or `--from-json <url|file>`,
   `--from-spec <spec.md>`) for a model and what is done with it; `nuclear make <kind> ...` for each other piece.
4. Write what is left, following the brief and the style of the generated files.
5. Validate: `nuclear check --json`, `nuclear test`, `nuclear build` (mobile: `nuclear analyze`, `nuclear run`).
   Each project runs on its dialect's port, or the `PORT` it sets (`nuclear env set PORT <port>`); a port never
   moves by itself, and `nuclear run` says which process holds a busy one. `nuclear projects` (MCP `projects_list`)
   shows every project of the machine and its address. A browser app (web, Flutter on Chrome) that says "no connection to the server" is refused by
   CORS: run its backend with `nuclear run` (development lets every local address call it) or list its origin in
   the backend's `origins` for production.

## The tools

| Tool | What it is for |
|---|---|
| `nuclear` | The command: compiler (`build`, `check`, `fix`, `fmt`), projects (`new`, `make`, `gen`, `add`, `run`, `test`), documentation (`help`, `spec`, `defs`) |
| The `nuclear` MCP server | The same as tools for an agent: `nuclear_start` (this text), `nuclear_doc` (any topic), `nuclear_brief`, `nuclear_help`, `nuclear_defs`, `nuclear_check`, `nuclear_build`, the generators (`generate_*`), `project_inspect`; the Smart Graph (`graph_*`); the local developer (`developer_*`) is on standby with the local models (ADR-platform-0013) |
| The Smart Graph | The knowledge base behind the MCP server (local AI services): search by meaning and exact facts of every word, command and error, and the plan of each kind of request (`graph_strategy`) |
| The editor extension | VS Code (also JetBrains, Zed): the language server (errors, completion, hover), the devices, Nuclear Builder, Nuclear Atlas, the settings of the AI services and of each client's MCP entry |

## Where everything is

`nuclear help atlas` (MCP: the atlas in `nuclear_start`) lists every topic by group: the language, the library, each
platform and dialect, the framework, the tools, the project's documents. Read one with `nuclear help <topic>` (MCP
`nuclear_doc`).
