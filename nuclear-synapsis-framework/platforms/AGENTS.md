# The platforms of Synapsis

What is common to the three platforms of the framework, and only that: what a platform is, the contract file
(`platform.toml`) every dialect of a platform implements, the shape of a platform folder, and how the promise "the
same Nuclear for every dialect" is tested. Everything about one platform is in that platform's own folder.

Paths in these documents are relative to this folder (`nuclear-synapsis-framework/platforms/`); a path that starts
with `nuclearlang/`, `tools/`, `installer/` or `.github/` starts at the root of the tree. The framework's rules are
in [`../AGENTS.md`](../AGENTS.md), the rules of the whole tree in [the root `AGENTS.md`](../../AGENTS.md).

## Where to go

| The task is about | Open |
|---|---|
| A mobile app: views, state, forms, the local database, Genkit; the Dart runtime | [`mobile/AGENTS.md`](mobile/AGENTS.md) |
| A backend: controllers, entities, migrations, events, agents and graphs; the Python and TypeScript runtimes | [`backend/AGENTS.md`](backend/AGENTS.md) |
| A web app in the browser; the TypeScript runtime | [`web/AGENTS.md`](web/AGENTS.md) |
| How one dialect writes a platform (templates, `[toolchain]`, type definitions) | `nuclearlang/dialects/<language>/AGENTS.md` |
| The loader that reads and checks the contracts | `nuclearlang/AGENTS.md` |

## Stack

- The contract of each platform: TOML (`<platform>/platform.toml`), read by `nuclearlang/crates/nuclear-dialect`.
  What `make` and `gen` write per platform is the code generator's:
  `tools/code_generator/platforms/<platform>/generators.toml`.
- The dialects that implement a platform: TOML and templates in
  `nuclearlang/dialects/<language>/frameworks/<dialect>/` (`flutter`, `fastapi`, `nestjs`, `react`).
- Runtime packages in the target languages: Dart (`mobile/packages/`), Python and TypeScript
  (`backend/packages/`), TypeScript (`web/packages/`).
- Examples in Nuclear with golden output; checks in `sh`, `bash` and Python.

## Commands

From the root of the tree:

```sh
cargo test -p nuclear-dialect --test loader       # every framework dialect implements its platform's contract
cargo test -p nuclear-transpile --test projects   # the examples: goldens and the conformance test
UPDATE_GOLDEN=1 cargo test                        # generated output changed on purpose: regenerate, review the diff
cargo run -q -p nuclear-cli -- dialect check <dialect>            # one dialect's report, its contract included
cargo run -q -p nuclear-cli -- help layout --dialect <dialect>    # where each kind's file goes
```

The checks of each platform against the target's own tools are in
[docs/05-standards/testing.md](docs/05-standards/testing.md).

## Folders

- `mobile/`, `backend/`, `web/`: one platform each, with the same shape: `platform.toml`, `packages/`,
  `examples/` (and `examples/expected/`), `checks/`, `docs/`, its own `AGENTS.md`.
- `docs/`: the documents of this level (the table below).

## Rules

1. **A platform is written in Nuclear only.** Its contract, its reference, its brief, its examples and its
   diagnostics name no dialect, no language and no target's library.
2. **Exactly three platforms.** A new one is a decision of the user and a new ADR of the framework.
3. **The contract comes first.** A kind, a decorator or a plugin is declared in `platform.toml` and implemented by
   every dialect of the platform in the same change; the loader refuses a dialect that leaves the contract
   (N0305). Only a plugin may be brought later by a dialect (a warning).
4. **No name of a kind or of a decorator is written in Rust.** A rule every dialect shares is data of the contract
   (`[decorators.args]`, `[decorators.fields]`, `[layout]`).
5. **What only some projects need is not in a contract:** it is a kind package or a plugin
   (`../docs/02-architecture/kinds-and-plugins.md`).
6. **One fact, one platform.** This level describes no platform: it links to it. A platform does not repeat what
   is here.
7. A file under a platform's `docs/07-reference/` or `docs/08-guides/` is normative and shipped by the installer:
   it changes only with the feature it describes.

## Documents

| Read | When |
|---|---|
| [docs/02-architecture/overview.md](docs/02-architecture/overview.md) | You need what a platform is, the table of the three, what a platform folder holds and what an install takes from it |
| [docs/02-architecture/contract.md](docs/02-architecture/contract.md) | You read or change a `platform.toml`, add a dialect to a platform, or meet N0305 |
| [docs/05-standards/testing.md](docs/05-standards/testing.md) | You run or add a test of a contract, a conformance example, a golden or a platform check |
| [../docs/02-architecture/rules.md](../docs/02-architecture/rules.md) | You design something for any platform: the rules all of them follow |
| [../docs/03-adr/README.md](../docs/03-adr/README.md) | You need why there are three platforms and why dialects never show in the Nuclear code (`ADR-synapsis-0002`) |
| [../docs/01-product/roadmap.md](../docs/01-product/roadmap.md) | You look for the pending work that is not of one platform |
