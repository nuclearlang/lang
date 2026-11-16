---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, ../03-adr/0006-shared-contracts.md, ../04-specs/003-shared-contracts/plan.md, ../01-product/roadmap.md]
---
# Shared contracts

A model and a route are written once, in the backend project; every app that calls it generates its models and its
repositories at build time (ADR-synapsis-0006). The normative text is
`nuclearlang/docs/07-reference/projects.md` §1.2; the user's guide is
`nuclear-synapsis-framework/platforms/backend/docs/08-guides/contracts.md`. Paths start at the root of the tree.

```
backend project (tasks_api)                       client project (tasks_app: mobile or web)
  components/tasks/...                             config.nuc: contracts(tasks_api = "../tasks_api")
        │ any build                                contracts/tasks_api/        generated Nuclear, do not edit
        ▼                                            models/task.nuc, models/tasks_api_error.nuc
  .nuclear/contract.json   ───────────────►          tasks_repository.nuc
  .nuclear/openapi.json                            then the normal build of the client's dialect
```

## What is written

| File | Written by | Holds |
|---|---|---|
| `.nuclear/contract.json` | every build and check of any project (`project::write_metadata`) | the models (fields, Nuclear types, optionality, defaults, JSON names, rules, the key, doc comments); a backend's controllers and routes; an app's repositories and calls |
| `.nuclear/openapi.json` | a backend's build | OpenAPI 3.1 made from the contract, for clients that are not Nuclear |
| `contracts/<name>/` in the client | the client's build, before it reads the sources | a model per model the routes carry, `<Name>Error`, a repository per controller with a method per route |
| `contracts/<name>/contract.json` in the client | the same step (`contract::install`); for a url contract, `nuclear contracts update` | the local copy of the contract. For a url contract it is what a build reads: it is committed, so a build never needs the network |

The contract is in Nuclear's notation and is the same whatever the dialect of the backend. Both `.nuclear/` files
are copied into the output folder, and the backend runtimes serve them at `GET /.nuclear/contract.json` and `GET
/.nuclear/openapi.json`.

## How a client uses it

- `contracts(<name> = "<path>")`: a backend built next to the client; `contracts/<name>/` is rewritten on every
  build and stale files are removed.
- `contracts(<name> = "<url>")`: a running API; `nuclear contracts update [name]` fetches it and regenerates.
- `<name>` is the `connectionName` of the connection the generated repositories use.
- Only the decorators the client's dialect consumes are written: `@primary` and the validation rules where they
  exist, `@key` everywhere; a GET that answers a keyed model gets `local = true` where the local database exists.
- `nuclear contracts list` prints each contract, its source and the version of the local copy.

## What fails the build

| Case | Code |
|---|---|
| A contract that cannot be read | N0307 |
| A field the backend renamed, used by the client | N0116, with the field's name |

## Where the code is

`nuclear_transpile::contract` (writing the contract, generating the Nuclear: `contract::generate`), the `nuclear
contracts` command in `tools/cli/`, the runtimes `synapsis-py` and `synapsis-nest` (serving the two files). The
example: `nuclear-synapsis-framework/platforms/mobile/examples/examples-flutter-dialect/tasks_app` over
`nuclear-synapsis-framework/platforms/backend/examples/examples-backend/tasks_api`. The limits are in
[the roadmap](../01-product/roadmap.md).
