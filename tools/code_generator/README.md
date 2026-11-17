# The code generator

[![ci](https://github.com/nuclearlang/lang/actions/workflows/ci.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/ci.yml) · [Website](https://nuclearlang.github.io/tools/generator)

`nuclear-codegen`: what `nuclear new`, `gen` and `make` write. `gen` writes finished code that compiles from a
resource's fields; `make` one skeleton of a kind; `new` a new project.

## Why

- Most of an app is standard code. A model spends tokens on it and fails; a tool writes it the same every time.
- Person, agent, MCP server and Nuclear Builder call the same generators
  ([ADR-platform-0004](../../docs/03-adr/0004-products-are-made-with-the-tools.md)).
- A use case with rules of its own is left to be written by hand; the generator then wires it in.

## How we made it

- **Finished code or a refusal, never a placeholder**: measured, skeletons were worse (29 of 42 against 37)
  ([ADR-codegen-0001](docs/03-adr/0001-the-generators-write-finished-code-the-agent-only-what-is-not-standard.md)).
- **The templates are the platform's data** (`platforms/<platform>/generators.toml`): the same Nuclear for every dialect.
- **Fields from data**: `--fields`, `--from-json` or `--from-spec`.
- **Nothing overwritten, nothing declared twice.** Written in Rust, called by `nuclear`.

## Try it

```sh
nuclear new demo -p backend && cd demo
nuclear gen resource books Book --fields "id:int title:string author:string?"
nuclear check --json                           # []: the generated code compiles
nuclear make entity books Author               # created components/books/data/entities/author.nuc
```

## Read next

- [The generators' guide](docs/08-guides/README.md)
- [The generators in Synapsis](../../nuclear-synapsis-framework/docs/08-guides/generators.md): every option and refusal
- [How it works](docs/02-architecture/overview.md), [the roadmap](docs/01-product/roadmap.md)
- To change it: [AGENTS.md](AGENTS.md)
