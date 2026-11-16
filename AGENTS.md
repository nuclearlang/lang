# NuclearLang

A minimal base language for AI agents and people. A Rust transpiler turns `.nuc` into other technologies through
**declarative dialects** (TOML and templates loaded at run time), one way only (`.nuc` → `.ts` / `.dart` / `.py`).
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
| `nuclear-synapsis-framework/` | The framework (Dragonfly in the code today): what it adds to Nuclear | [AGENTS.md](nuclear-synapsis-framework/AGENTS.md) |
| `nuclear-synapsis-framework/platforms/<platform>/` | A platform (`mobile`, `backend`, `web`): its contract, runtime packages, examples, checks | [AGENTS.md](nuclear-synapsis-framework/platforms/AGENTS.md) |
| `tools/cli/` | The command line tools | [AGENTS.md](tools/AGENTS.md) |
| `tools/code_generator/` | What `gen` and `make` write | [AGENTS.md](tools/code_generator/AGENTS.md) |
| `tools/mcp/` | The MCP server | [AGENTS.md](tools/mcp/AGENTS.md) |
| `extensions/` | The editors: `vscode/`, `jetbrains/`, `zed/`, and their tools in `tools/<tool>/` | [AGENTS.md](extensions/AGENTS.md) |
| `device-emulators/` | The devices the command line tool and the editors start | [AGENTS.md](device-emulators/AGENTS.md) |
| `nuclear-graph-storage/` | The Smart Graph: the knowledge base every agent reads | [AGENTS.md](nuclear-graph-storage/AGENTS.md) |
| `nuclear-agents/` | The agents (`nuclear_developer/`) | [AGENTS.md](nuclear-agents/AGENTS.md) |
| `installer/` | The installers and the release | [AGENTS.md](installer/AGENTS.md) |
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
10. **No commits unless the user asks**; commits only in the user's name, with no co-author line.
11. `CodeBuilder/` is teaching material only: never in references, context or code.
12. Node.js/Express is postponed by the user: do not touch it until asked.

## Commands of the whole tree

```sh
cargo test && cargo clippy --all-targets      # every Rust crate, against every dialect and platform example
UPDATE_GOLDEN=1 cargo test                    # golden output changed: regenerate, then review the difference
cargo run -q -p nuclear-cli -- build <file.nuc> --dialect flutter
installer/install.sh                          # the user runs the installed binaries: run it again after changes
```

A project's own commands are in its `AGENTS.md`.

## In progress

The tree is being restructured ([docs/04-specs/008-restructure/tasks.md](docs/04-specs/008-restructure/tasks.md)):
the code still says "Dragonfly", `dragonfly`, `nuclear-loop` and "Nuclear HTTP" where the folders already say
Synapsis, `nuclear-builder` and `nuclear-connector`.
