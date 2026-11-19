# The code generator

What `nuclear new`, `nuclear make` and `nuclear gen` write into a project. `gen` writes finished code that compiles
from a resource's data (models, repository, a use case per action, the facade's aliases, the controller or the
screen, the tests) and wires a use case into its component. `make` writes one skeleton of a kind, to fill in; `new`
the files of a new project. A person, an AI agent, the MCP server and the Nuclear Builder all generate through it, so
a standard feature costs no model tokens.

## Stack

- Rust, the library crate `nuclear-codegen` (`src/lib.rs`): `src/generate.rs` (`gen`), `src/scaffold.rs` (the
  skeletons and the files of a new project) and `src/context.rs` (the context documents of a new project). It
  writes files and reports `(Wrote::Created | Kept, path)`; the command prints.
- The templates are the Mustache subset of `nuclear-dialect` (`nuclearlang/crates/nuclear-dialect/src/template.rs`);
  what it writes goes through `nuclear_syntax::fmt::format`; a use case's signature is read with
  `nuclear_transpile::map::shape`.
- `curl` for `--from-json <url>` and a spec's `GET <url>` line (`fetch_text` of the command).

## Commands

```sh
cargo test -p nuclear-codegen -p nuclear-cli   # nuclear-cli builds a generated resource with every dialect of every platform
cargo clippy --all-targets
nuclear gen                                    # every option of gen
nuclear gen resource <component> <Name> --fields "id:int name:string" --dry-run
nuclear make <kind> <component> <Name>         # `nuclear help` lists the generators
nuclear help layout --platform <p>             # where each kind's file goes
```

## Folders

- `src/`: the crate (`lib.rs`, `generate.rs`, `scaffold.rs`, `context.rs`).
- `context/`: the templates of a new project's context documents (`AGENTS.md`, `CLAUDE.md`, `docs/` in layers),
  embedded; `{{name}}`, `{{platform}}`, `{{dialect}}`, `{{stack}}`, `{{date}}`, `{{commands}}`, `{{test}}`,
  `{{folders}}`, `{{layout}}` are filled by `context::documents`, the rest is a `TODO(user):` line.
- `platforms/<platform>/generators.toml` (`backend`, `mobile`, `web`): the generators' data of each platform:
  `[gen]` (the forms of the `Http` connection), `[skeletons]` (what `make <kind>` writes; backend and web) and the
  `[[generators.<what>]]` pieces. The loader finds it through `Home.generators` / `Loader::generators_file`
  (`nuclear-dialect`); an installation has it in `<install>/generators/`.
- `docs/`: this project's documents (the table below).

The command side (`make`, `make_from_layout`, `gen_command`, `ensure_http`, `GEN_USAGE`) is in
`tools/cli/src/framework/mod.rs`; where each kind's file goes is the platform's `[layout]`
(`nuclear-synapsis-framework/platforms/<platform>/platform.toml`).

## Rules

1. **Finished code or a refusal.** What `gen` writes compiles as written; when it cannot write something finished
   it refuses and says what to do. Never a placeholder for a model to fill (ADR-codegen-0001).
2. **The templates are the platform's data**, never code here: the Nuclear a generator writes is the same for every
   dialect of a platform. This code only reads the fields, picks the templates and writes each file at the
   platform's `[layout]` path.
3. **Nothing is overwritten, nothing is declared twice.** A file that exists is kept; a `merge` piece gets only the
   whole members it lacks; a name another file declares stops the command before it writes.
4. **A new kind or decorator of a platform updates its generators and skeletons** in the same change; the tests
   `a_generated_resource_compiles_with_every_dialect`, `every_skeleton_parses`,
   `every_new_project_compiles_with_its_dialect` and `make_writes_every_kind_where_the_platform_says` hold it.
5. **A change to what a command takes or writes** updates the user guide
   (`nuclear-synapsis-framework/docs/08-guides/generators.md`), `GEN_USAGE` / `USAGE`, the MCP tool of the same
   name ([the MCP server](../mcp/AGENTS.md)) and the `nuclear` skill.

## Documents

| Read | When |
|---|---|
| [docs/01-product/roadmap.md](docs/01-product/roadmap.md) | You look for what the generators do not write yet, or what is untested |
| [docs/02-architecture/overview.md](docs/02-architecture/overview.md) | You change `generate.rs` or `scaffold.rs`, add a piece to a `generators.toml`, or need how fields become files |
| [docs/03-adr/README.md](docs/03-adr/README.md) | You need why the generators exist and why they never write placeholders |
| [docs/08-guides/context-docs.md](docs/08-guides/context-docs.md) | You need the standard of a project's context documents (the `context-docs` topic every agent reads) |
| [docs/08-guides/README.md](docs/08-guides/README.md) | You need the user's view: why generators, what `new`, `gen` and `make` write on each platform |

Elsewhere:

- What a user reads: [the generators' guide](../../nuclear-synapsis-framework/docs/08-guides/generators.md) (every
  command, option and refusal) and `nuclear help`.
- The format of `[[generators.<what>]]`, `[gen]`, `[skeletons]` and `[layout]`:
  `nuclearlang/docs/07-reference/dialects.md`.
- The command itself: [the command line tool](../cli/AGENTS.md).
