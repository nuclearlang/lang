# The platforms of Synapsis

The three kinds of software Synapsis knows how to make: `mobile` apps, `backend` services and `web` apps. Each is a
folder here; this level holds only what the three share: what a platform is, the contract every dialect of a
platform implements, and how "the same Nuclear for every dialect" is tested.

## Why it exists

The differences that matter are between a phone app, an HTTP API and a page in a browser, not between the languages
that run them: the state management of a screen has no use in an API. So a platform is what the user and the agent
write, and a dialect is only the language and framework it comes out in. Without a fixed list of what a platform
may write, anyone could make the Nuclear of one dialect incompatible with another.

What it leaves out on purpose: a fourth platform (that would be a decision of the user and a new ADR), any name of
a dialect, a language or a target's library in a platform's contract, reference or examples, and anything only some
projects need (that is a kind package or a plugin).

## How we made it

- **Three platforms, dialects under them** ([ADR-synapsis-0002](../docs/03-adr/0002-three-platforms-dialects-under-them.md)).
  A platform is a specification in Nuclear only: its layout, `config.nuc`, kinds, decorators, connections,
  plugins, tests and errors.
- **The contract comes first.** Each platform's `platform.toml` lists its kinds, decorators and plugins; the
  compiler's loader refuses a dialect that leaves the list (N0305). No name of a kind or a decorator is written in
  Rust: a rule every dialect shares is data of the contract
  ([docs/02-architecture/contract.md](docs/02-architecture/contract.md)).
- **The same shape for each platform**: `platform.toml`, `packages/` (the runtimes), `examples/` with their golden
  output, `checks/` (the generated code against the target's own tools), `docs/`.
- **The web platform is the mobile one in a browser**: the same words for the same things, so an app's domain reads
  the same on a phone and on the web ([ADR-web-0001](web/docs/03-adr/0001-web-platform.md)).

| Platform | What it makes | Dialects | Runtime packages |
|---|---|---|---|
| [`mobile`](mobile/README.md) | apps for Android, iOS, desktop and the web | `flutter` | `synapsis`, `synapsis_genkit` (Dart) |
| [`backend`](backend/README.md) | HTTP APIs, data, events and AI agents | `fastapi` (default), `nestjs` | `synapsis-py` (Python), `synapsis-nest` (TypeScript) |
| [`web`](web/README.md) | apps in the browser | `react` | `synapsis-web` (TypeScript) |

The dialects themselves live with their language, in [`nuclearlang/dialects/`](../../nuclearlang/dialects/README.md).

## Try it

From the root of the tree:

```sh
cargo test -p nuclear-dialect --test loader       # every framework dialect implements its platform's contract
cargo test -p nuclear-transpile --test projects   # the examples of every platform: goldens and the conformance test
```

The conformance example, `backend/examples/examples-backend/tasks_api`, builds with every backend dialect. Each
platform's onboarding makes its example app with `nuclear new` and `nuclear gen` only.

## Where to read next

- One platform: [mobile](mobile/README.md), [backend](backend/README.md), [web](web/README.md).
- What a platform is and what an install takes from it: [docs/02-architecture/overview.md](docs/02-architecture/overview.md);
  how a platform is tested: [docs/05-standards/testing.md](docs/05-standards/testing.md).
- The framework above them: [Synapsis](../README.md).
- To change this level: [AGENTS.md](AGENTS.md).
