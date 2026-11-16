# The code generator

What `dragonfly gen` and `dragonfly make` write into a project. `gen` writes finished code that compiles from a
resource's data (models, repository, a use case per action, the facade's aliases, the controller or the screen, the
tests) and wires a use case into its component. `make` writes one skeleton of a kind, to fill in. A person, an AI
agent, the MCP server and the Loop all generate through it, so a standard feature costs no model tokens.

## Where it is today

This folder holds only documents. The project is still inside two others and moves here in spec 008, T4.2
([tasks](../../docs/04-specs/008-restructure/tasks.md)):

| Part | Where it is today |
|---|---|
| `gen`: fields, context, plan, write and merge | `nuclear-synapsis-framework/cli/src/generate.rs` |
| `gen`: the command, its checks, the `Http` connection | `gen_command`, `ensure_http`, `GEN_USAGE` in `nuclear-synapsis-framework/cli/src/main.rs` |
| `make` and `new` of a mobile project: the skeletons | `nuclear-synapsis-framework/cli/src/scaffold.rs`; `make` in `main.rs` |
| `make` of a backend or web project | `make_from_layout` in `main.rs`, over the platform's `[skeletons]` |
| The generators' data: `[[generators.*]]`, `[gen]`, `[skeletons]`, `[layout]` | `nuclear-synapsis-framework/platforms/<platform>/platform.toml` |

After the move, `tools/code_generator/platforms/{web,mobile,backend}/` is where each platform's generator data
lives.

## Stack

- Rust, inside the `dragonfly` crate; the templates are the Mustache subset of `nuclear-dialect`
  (`nuclearlang/crates/nuclear-dialect/src/template.rs`); what it writes goes through `nuclear_syntax::fmt::format`;
  a use case's signature is read with `nuclear_transpile::map::shape`.
- `curl` for `--from-json <url>` and a spec's `GET <url>` line.

## Commands

```sh
cargo test -p dragonfly                       # also builds a generated resource with every dialect of every platform
cargo clippy --all-targets
dragonfly gen                                 # every option of gen
dragonfly gen resource <component> <Name> --fields "id:int name:string" --dry-run
dragonfly make <kind> <component> <Name>      # backend, web; `dragonfly help` lists the mobile generators
nuclear help layout --platform <p>            # where each kind's file goes
```

## Rules

1. **Finished code or a refusal.** What `gen` writes compiles as written; when it cannot write something finished
   it refuses and says what to do. Never a placeholder for a model to fill (ADR-codegen-0001).
2. **The templates are the platform's**, never code here: the Nuclear a generator writes is the same for every
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
| [docs/02-architecture/overview.md](docs/02-architecture/overview.md) | You change `generate.rs` or `scaffold.rs`, add a generator piece to a `platform.toml`, or need how fields become files |
| [docs/03-adr/README.md](docs/03-adr/README.md) | You need why the generators exist and why they never write placeholders |

Elsewhere:

- What a user reads: [the generators' guide](../../nuclear-synapsis-framework/docs/08-guides/generators.md) (every
  command, option and refusal) and `dragonfly help`.
- The format of `[[generators.<what>]]`, `[gen]`, `[skeletons]` and `[layout]`:
  `nuclearlang/docs/07-reference/dialects.md`.
- The command itself: [the command line tools](../cli/AGENTS.md).
