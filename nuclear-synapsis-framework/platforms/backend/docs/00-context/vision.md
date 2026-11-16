---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [glossary.md, ../01-product/roadmap.md, ../07-reference/backend.md]
---
# Vision

## The problem

A backend written in Nuclear holds only its business logic: the kinds write the framework code, the dependencies,
the JSON, the validation and the routes. The backend platform is the list of what such a project may write (its
kinds, decorators, folders, `config.nuc`, plugins and tests) and it is the same for every dialect, so one project
builds as the project of more than one technology and its Nuclear never changes when its dialect changes.

It covers HTTP APIs, data (entities with relations, repositories, pagination, transactions, migrations), events
and a cache, and AI (tools, agents, states, graphs).

## Who uses it

- **A person or an AI agent writing a backend**: they read [the reference](../07-reference/backend.md)
  (`nuclear help backend`) and [the brief](../07-reference/brief/backend.md), and never a dialect's documents to
  know what to write.
- **An app of the mobile or web platform**: it gets its models and repositories generated from a backend's contract
  ([the guide](../08-guides/contracts.md)).
- **The author of a dialect**: `platform.toml` says what the dialect must implement; the rules of the data
  decorators come with it, so a new backend dialect gets them by writing templates.
- **Whoever changes a runtime** (`packages/`): the code every generated backend runs on.

## What it does not do

- It does not say how a dialect writes its target. That is each dialect's reference, in its language's dialect
  project.
- It has no kind, decorator or feature that exists in one dialect only. The one thing that ties code to a dialect is
  using that dialect's type definitions (a library that exists only in its language).
- It never loads a relation by itself: no lazy query, no eager loading by default
  ([ADR-backend-0001](../03-adr/0001-backend-data.md)).
- It is not the `dragonfly` command: what `new`, `build`, `run`, `test` and `migrate` do is the dialect's
  `[toolchain]`, run by [the command line tools](../../../../../tools/cli/AGENTS.md).
- Not there yet ([roadmap](../01-product/roadmap.md)): authentication, guards and sessions; background jobs; file
  uploads; a Dockerfile; observability.

## Constraints

- The golden rule of the whole platform: generated code as fast as an expert's, instant transpilation, minimal
  readable Nuclear.
- The user's rule for the data words: the code looks as much alike as possible across the platforms, at the middle
  point of cost and benefit (the key decorator and `paginate` are the same word on backend and mobile).
- A feature is delivered in every dialect at once: the reference gets the Nuclear, each dialect's reference its
  output, and both checks run it.
