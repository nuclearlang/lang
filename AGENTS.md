# NuclearLang

A minimal base language for AI agents and people. A Rust transpiler turns `.nuc` into other technologies through
**declarative dialects** (TOML and templates loaded at run time), one way only (`.nuc` → `.ts` / `.dart` / `.py`).
Website: [nuclearlang.github.io](https://nuclearlang.github.io); repository: `nuclearlang/nuclearlang`.
The language comes with its framework, as Rust has Actix: three platforms (`web`, `mobile`, `backend`), each
written once in Nuclear and built by its dialects. Vision: [docs/00-context/vision.md](docs/00-context/vision.md).

One git repository. Each folder below is a **project** that documents itself. Read this file, then the `AGENTS.md`
of the one project the task touches, then only the document whose line there matches the task
([docs/README.md](docs/README.md) is the standard every project follows).

## The projects

| Folder | What it is | Start here |
|---|---|---|
| `nuclearlang/` | The language: the compiler crates, the language server, the base words, the examples | [AGENTS.md](nuclearlang/AGENTS.md) |
| `nuclearlang/dialects/<language>/` | A dialect of a target language (`python`, `typescript`, `dart`, `nodejs`) with its `frameworks/`, `defs/` and docs | [README.md](nuclearlang/dialects/README.md) |
| `nuclear-synapsis-framework/` | The framework, Synapsis: what it adds to Nuclear | [AGENTS.md](nuclear-synapsis-framework/AGENTS.md) |
| `nuclear-synapsis-framework/lodash/` | The helpers of lodash that serve Nuclear (lists, maps, texts, numbers, functions), written in Nuclear for every dialect | [AGENTS.md](nuclear-synapsis-framework/lodash/AGENTS.md) |
| `nuclear-synapsis-framework/platforms/<platform>/` | A platform (`mobile`, `backend`, `web`): its contract, runtime packages, examples, checks | [AGENTS.md](nuclear-synapsis-framework/platforms/AGENTS.md) |
| `tools/cli/` | The `nuclear` command: the compiler's commands and the framework's | [AGENTS.md](tools/cli/AGENTS.md) |
| `tools/code_generator/` | What `nuclear new`, `make` and `gen` write: the crate `nuclear-codegen` | [AGENTS.md](tools/code_generator/AGENTS.md) |
| `tools/mcp/` | The MCP server, `nuclear-mcp` (a Nuclear project, `python` dialect) | [AGENTS.md](tools/mcp/AGENTS.md) |
| `extensions/` | The editors: `vscode/`, `jetbrains/`, `zed/`, and their tools in `tools/<tool>/` | [AGENTS.md](extensions/AGENTS.md) |
| `nuclear-chat/` | Nuclear Chat, the factory's workplace: a Synapsis service, its system library, the GIF pack, the UI library | [AGENTS.md](nuclear-chat/AGENTS.md) |
| `device-emulators/` | The devices (`nuclear device`, `nuclear terminal-device`): the crate `nuclear-devices` | [AGENTS.md](device-emulators/AGENTS.md) |
| `nuclear-graph-storage/` | The Smart Graph: the knowledge base every agent reads | [AGENTS.md](nuclear-graph-storage/AGENTS.md) |
| `nuclear-agents/` | The agents (`nuclear_developer/`) | [AGENTS.md](nuclear-agents/AGENTS.md) |
| `installer/` | The installers and the release | [AGENTS.md](installer/AGENTS.md) |
| `website/` | The documentation site, written in Nuclear (web platform, `react`) | [AGENTS.md](website/AGENTS.md) |
| `docs/` | Only what is about the whole platform | [README.md](docs/README.md) |

`github-profile/` is the organization's profile: a repository of its own inside the tree.

## The golden rule

**Performance, speed and readability of the syntax**, for the base language and every dialect: generated code as
fast as an expert's, instant transpilation, minimal readable Nuclear.

## Hard rules

1. **English everywhere**: code, comments, diagnostics, the tools' output, dialects, examples, documents. The
   exceptions are localization data and the tests of unicode. **The chat with the user is always in Spanish.**
2. **The parser does not change per dialect.** Framework words, shortcuts and imports are data of the dialects.
   Rust decides *what* is emitted; the dialect decides *how*.
3. **A dialect only changes the output.** The same Nuclear code is written once and built for every dialect of
   its platform; a `.nuc` never bends its naming or its syntax to make a dialect easier.
4. **Three platforms; the dialects only change the language underneath.** A platform is what the user and the
   agent write, identical for every dialect of it. The Nuclear of a project never changes when its dialect changes
   (the one exception: code that uses a dialect's type definitions). The standard library is Nuclear's own; a
   target's library name in platform code, references or examples is a bug. A platform's reference names no
   dialect. Kinds are Nuclear's libraries: an extension kind is a package of TOML, templates and a runtime, never
   a change to the compiler.
5. **A reference holds only final rules** (`docs/07-reference/` of a project): no question, no history, nothing
   pending. A dialect's reference holds the real Nuclear → target equivalences, checked by `spec-check` (0 problems).
6. **Every new diagnostic code is documented** in `nuclearlang/docs/07-reference/diagnostics.md`; every dialect
   word in its `docs.toml`.
7. **Each project documents itself, in short files.** A change is done when its tests are green and the documents
   of the project it touches say it, in the same change, and the knowledge base follows
   ([docs/05-standards/coding.md](docs/05-standards/coding.md)). Pending work is the project's
   `docs/01-product/roadmap.md`: a done item is deleted, half-done work is recorded the moment it is left. No file
   lists the state of the whole platform, and no document describes another project.
8. **Quality first**: always the right solution, even when it costs more. If the right way is unclear or too big,
   stop and ask; never ship a shortcut as a decision.
9. **Nuclear first**: every new piece of the platform is written in Nuclear (with the framework when a platform
   fits, with a language dialect when none does). Another language only where Nuclear cannot be the source yet.
10. **Finished work is committed and pushed by the agent**, without asking, once its tests are green and rule 15
    is done: only the paths it changed, in the user's name, with no co-author line. A change that must reach the
    installations is released with a tag `v<version>`: one version for the whole platform, that follows [Semantic Versioning](https://semver.org): a fix
    raises PATCH, a new feature MINOR, a breaking change MAJOR (while the version is `0.x`, a breaking change raises
    MINOR) ([docs/05-standards/coding.md](docs/05-standards/coding.md#git)). A tag is pushed only after
    `installer/release/delivery.sh <version>` passes; after it, `installer/release/after-release.sh <version>`.
11. `CodeBuilder/` is teaching material only: never in references, context or code.
12. Node.js/Express is postponed by the user: do not touch it until asked.
13. **A product is made with the tools** ([ADR-platform-0004](docs/03-adr/0004-products-are-made-with-the-tools.md)).
    A product is any software made from Nuclear (an app, a backend, the website, an example). Its code is Nuclear,
    its target code comes from the transpiler, its standard parts from `nuclear new`/`gen`/`make` and the MCP
    server, its libraries from `nuclear add`. No agent writes target code for a feature or migrates code of a
    native dialect (React, Node.js, Python/FastAPI, Dart) into Nuclear by hand. By hand outside Nuclear only when
    strictly necessary: say so, and record the missing capability in the roadmap of the tool that should do it.

14. **Built for a fresh machine and a fresh agent.** Every feature is designed for a user who just ran the
    installer and an agent with no context at all. The installer and the MCP server are the only sources of
    Nuclear an agent has: never the source tree, this repository's `.md` files or a path of the developer's
    machine. Nothing installed or generated names a path of this tree or of one machine; the installer leaves
    services that run on their own on every system.

15. **Every change is deployed, never only written.** A new feature, a change or an update of a tool, and always
    when it is published or written in a CHANGELOG, ends with everything that serves it at the new version: the
    context files (`AGENTS.md`, `docs/`, the skill, the briefs), the Smart Graph and its Chroma
    (`nuclear-graph knowledge build`, `knowledge check` clean, `ingest`), the MCP server (built, tested,
    `uv tool install --reinstall tools/mcp`), and what the user runs installed again (`installer/install.sh`; an
    extension's version raised and installed) ([docs/05-standards/coding.md](docs/05-standards/coding.md)).

16. **The same Nuclear means the same everywhere** ([ADR-platform-0014](docs/03-adr/0014-stability-and-parity.md)).
    The language's rules are not changed by a fix. Every change to the transpiler, a dialect or the library runs
    every test set first (`nuclearlang/docs/05-standards/testing.md`); generated code compiles with no warning of its
    target. What a client sees never depends on the dialect: a runtime converts what its framework answers to one
    output of Nuclear's, and where nothing is decided one mature tool is the rule for every dialect (TypeORM for
    migrations). A capability of a project has its MCP tool, and the knowledge base its rows.

## Commands of the whole tree

```sh
cargo test && cargo clippy --all-targets      # every Rust crate, against every dialect and platform example
UPDATE_GOLDEN=1 cargo test                    # golden output changed: regenerate, then review the difference
cargo run -q -p nuclear-cli -- build <file.nuc> --dialect flutter
installer/install.sh                          # the user runs the installed binaries: run it again after changes
```

A project's own commands are in its `AGENTS.md`.

## In progress

**High priority**: the launch and growth of NuclearLang (website readable by search engines and AI agents, registries,
repository, community, the launch as news:
[docs/04-specs/019-launch-and-growth/tasks.md](docs/04-specs/019-launch-and-growth/tasks.md)) and the public benchmark
that proves its value with cheap models ([docs/04-specs/020-benchmark/tasks.md](docs/04-specs/020-benchmark/tasks.md)).

The AI services ready to run from the installer, with nothing on the machine: their own Python and the set-up in
Nuclear are done; Nuclear Builder's engine in Nuclear and the welcome page for Ollama and the models are left
([docs/04-specs/009-self-contained-ai-services/tasks.md](docs/04-specs/009-self-contained-ai-services/tasks.md)).
