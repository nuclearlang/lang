# NuclearLang — the language

[![ci](https://github.com/nuclearlang/nuclearlang/actions/workflows/ci.yml/badge.svg)](https://github.com/nuclearlang/nuclearlang/actions/workflows/ci.yml) · [Website](https://nuclearlang.github.io/nuclearlang/guide/README)

The base language (`.nuc`), the Rust compiler that turns it into TypeScript, Dart or Python through declarative
dialects, and the language server every editor runs.

## Why

- One way to write each thing, the fewest tokens, diagnostics that come with their fix.
- Type definitions so agents do not invent APIs; a dialect author adds a target without touching Rust.
- Measured: the output passes `tsc --strict`, `pyright` and `flutter analyze`; 26 files build in about 20 ms.
- Left out on purpose: reading target code, OOP as a goal, a package manager ([limits](docs/02-architecture/limits.md)).

## How we made it

- One golden rule: performance, speed, readability ([ADR-lang-0001](docs/03-adr/0001-principles.md)).
- Few symbols, two-space blocks ([ADR-lang-0002](docs/03-adr/0002-files-and-lexical-syntax.md)); errors are values ([ADR-lang-0006](docs/03-adr/0006-results.md)).
- Dialects are data; the transpiler writes the imports ([ADR-lang-0007](docs/03-adr/0007-dialects-and-imports.md)).
- Type definitions like `.d.ts` ([ADR-lang-0008](docs/03-adr/0008-type-definitions-and-target-packages.md)) and a standard library of its own ([ADR-lang-0009](docs/03-adr/0009-standard-library.md)).
- The compiler helps editors and agents ([ADR-lang-0010](docs/03-adr/0010-compiler-helps-editors-and-agents.md)); debugging through the target ([ADR-lang-0011](docs/03-adr/0011-debugging-nuc.md)).

## Try it

```sh
cargo run -q -p nuclear-cli -- build hello.nuc --dialect python          # def full_name(...) -> str:
cargo run -q -p nuclear-cli -- check hello.nuc --dialect python --json   # [] when there is no error
cargo run -q -p nuclear-cli -- fmt hello.nuc                             # the canonical layout
cargo test                                                               # every crate, the golden examples
```

## Read next

- [The guide](docs/08-guides/README.md) and [the language on one page](docs/08-guides/reference.md).
- The reference: [nuclear-base.md](docs/07-reference/nuclear-base.md), [diagnostics.md](docs/07-reference/diagnostics.md).
- [The dialects](dialects/README.md) and [create a dialect with an agent](docs/08-guides/create-a-dialect-with-an-agent.md).
- [How it is built](docs/02-architecture/overview.md).
- [AGENTS.md](AGENTS.md): to change the language, the compiler or the server.
