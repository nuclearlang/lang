---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [docs/04-specs/008-restructure/tasks.md, nuclear-synapsis-framework/docs/08-guides/generators.md]
---
# Roadmap of the code generator

The pending work of `dragonfly gen` and `dragonfly make`. A done item is deleted.

## Half done

- **The project out of the CLI crate** (spec 008, T4.2): `generate.rs`, `scaffold.rs` and the generators' data of
  each `platform.toml` move to `tools/code_generator/`, the data to `platforms/{web,mobile,backend}/`
  ([tasks](../../../../docs/04-specs/008-restructure/tasks.md)).
- **Tests of a backend REST resource** (ADR-codegen-0001). Left: `@mock` for the backend platform, so `gen` writes
  a REST resource's tests (then the tester only adds what is specific).
- **The nestjs HTTP repository decodes by the model.** Today it answers the raw JSON: a renamed field reads
  `undefined` in a use case.

## Untested

- `dragonfly gen resource` adding an action to a resource that exists: only the compile test with the four
  dialects (no pyright, tsc or HTTP run).
- `gen usecase` on mobile and web: only the compile test (no `flutter analyze`, no `tsc` of a react build).
- The fixed-segment-first route order of nestjs with a `@Controller` that Nest scans before `configureApp`.

## Pending

- **The plural of a table**: `gen resource shelves Shelf --source db` names the table `shelfs` (`@entity("shelfs")`):
  the plural is the name plus `s` unless `--plural` is given. Found by the functional tests of 2026-11-16.
- **A resource that reads another API gets no test.** Seen with the user's run
  `nuclear_rick_and_morty/.nuclear/loop/runs/20261111-implements-list-character-feature`: it passes from scratch
  with 10 generated files and **0 tests**; the acceptance step lists "create the unit test" as not shown met, and
  the endpoint's answer was never compared with the API's. The generators write no test for `--source rest`, and
  the Loop's *Tests first* stage is skipped when every file was generated: the generator needs a test over a fake
  `Http` connection (the platform has none to give a test), or the tester must write one from the criteria.
- **The article in generated comments**: what the generators write says "a order" (`// Changes a order`,
  `@test("adds a order and finds it")`). The article is not chosen by the name's first letter (the three
  platforms' `[[generators.resource]]` templates).
- `new`, `make component` and `make screen` do not seed dictionaries, `Translations` or a locale in the skeleton.
  It is the only generator gap left for kinds: every kind has a `make`.
- The `hello_<c>_usecase.nuc` that `make component` creates is almost always deleted.
- What the guide lists as not generated yet: relations and a search for a database resource; on mobile and web,
  what a screen shows of a use case added with `gen usecase`
  ([the guide](../../../../nuclear-synapsis-framework/docs/08-guides/generators.md), §6).
