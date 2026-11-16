# Synapsis mobile

The mobile platform of Synapsis: apps for Android, iOS, desktop and the web written once in Nuclear. This folder
holds the platform's contract (`platform.toml`), its runtime for Flutter — the `synapsis` package (repositories
over dio, state managers, events, sessions, ACL, routing, forms, a local database) and `synapsis_genkit` for AI —
and its examples. Its dialect `flutter` (TOML + templates read by the `nuclear` compiler) is in
[`nuclearlang/dialects/dart/frameworks/flutter/`](../../../nuclearlang/dialects/dart/frameworks/flutter/).

Start with the [Synapsis tutorial](../../docs/08-guides/tutorial.md) and
[the rules of the platform](docs/07-reference/mobile.md).

## What is inside

| Folder | What |
|---|---|
| `platform.toml` | the contract: the kinds, decorators and plugins every dialect of the platform implements; where each file goes (what `nuclear gen` writes is `tools/code_generator/platforms/mobile/generators.toml`) |
| `packages/synapsis/` | the runtime of an app ([its API](docs/07-reference/synapsis.md)) |
| `packages/synapsis_genkit/` | the runtime of the `genkit` plugin ([guide](docs/08-guides/genkit.md)) |
| `examples/` | example apps and their expected output |
| `checks/` | the scripts that check the examples and the reference |
| `docs/` | the documentation, for people and agents ([AGENTS.md](AGENTS.md) lists it) |

## Working on it

It is built by the `nuclear` compiler and the `nuclear` CLI of the same tree:

```sh
git clone https://github.com/nuclearlang/nuclear && cd nuclear
installer/install.sh
```

The checks before a change, and what each one covers: [docs/05-standards/testing.md](docs/05-standards/testing.md).
Conventions: [docs/05-standards/coding.md](docs/05-standards/coding.md).

## License

[Apache-2.0](../../../LICENSE). By contributing you agree that your contribution is licensed under it.
