# Dialects

[![ci](https://github.com/nuclearlang/lang/actions/workflows/ci.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/ci.yml) · [Website](https://nuclearlang.github.io/platforms)

A dialect is the data that says how Nuclear is written in one target: TOML and templates the compiler loads at run
time. The same `.nuc` is written once and each dialect turns it into its language or framework.

## Why

- A new target is data files, templates and tests, not a new compiler.
- A dialect decides only how the output is written; the `.nuc` never changes with it.
- It never reads target code and never wraps the target's libraries.

## How we made them

- Rust decides what, the dialect decides how; Python proved it (ADR-python-0001, [python/docs/03-adr/](python/docs/03-adr/README.md)).
- Language dialects and framework dialects: a framework dialect names its language and its Synapsis platform.
- Official libraries, not code of our own (ADR-dart-0001, ADR-python-0002, ADR-typescript-0001).
- Imports come from type definitions (ADR-lang-0008, [../docs/03-adr/](../docs/03-adr/README.md)); each reference is checked by `spec-check`.

| Dialect | Framework dialects | Read |
|---|---|---|
| `python` | `fastapi` (backend) | [python/](python/README.md) |
| `typescript` | `nestjs` (backend), `react` (web) | [typescript/](typescript/README.md) |
| `dart` | `flutter` (mobile) | [dart/](dart/README.md) |
| `nodejs` | postponed; `nestjs` extends it | [nodejs/](nodejs/AGENTS.md) |

## Try it

```sh
cargo run -q -p nuclear-cli -- dialect list              # every dialect, its chain and one line about it
cargo run -q -p nuclear-cli -- dialect check flutter     # dialect 'flutter' (flutter → dart) is valid
cargo run -q -p nuclear-cli -- spec --dialect fastapi    # the contract: templates, variables, options
```

## Read next

- [The dialect format](../docs/07-reference/dialects.md).
- [Create a dialect with an agent](../docs/08-guides/create-a-dialect-with-an-agent.md).
- [Type definitions](../docs/07-reference/definitions.md) and [the standard library](../docs/07-reference/library.md).
- [The platforms](../../nuclear-synapsis-framework/platforms/README.md) the framework dialects write.
