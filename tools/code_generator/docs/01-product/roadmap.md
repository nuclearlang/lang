---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [nuclear-synapsis-framework/docs/08-guides/generators.md]
---
# Roadmap of the code generator

The pending work of `nuclear gen` and `nuclear make`. A done item is deleted.

## Half done

- **Tests of a backend REST resource** (ADR-codegen-0001). Left: `@mock` for the backend platform, so `gen` writes
  a REST resource's tests (then the tester only adds what is specific).
- **The nestjs HTTP repository decodes by the model.** Today it answers the raw JSON: a renamed field reads
  `undefined` in a use case.

## Untested

- `nuclear gen resource` adding an action to a resource that exists: only the compile test with the four
  dialects (no pyright, tsc or HTTP run).
- `gen usecase` on mobile and web: only the compile test (no `flutter analyze`, no `tsc` of a react build).
- The fixed-segment-first route order of nestjs with a `@Controller` that Nest scans before `configureApp`.

## Pending

- **Found by an agent making a backend for frontend over The One API (2026-11-25):** an API whose `GET <path>/{id}`
  answers a page with one item (`{docs: [book], total: 1...}`) gets a repository `one(id) Result<Error, Book>` that
  cannot read it: the get use case was written by hand (`page.docs[0]`, `NotFound` when empty). The detail answer is
  never read; `--from-json` reads only the list's. A field the list answer has but another page omits (`offset` once
  `page` is sent) is not optional either.

- **Found making a backend with timestamps (2026-11-23):** `gen resource --fields` has no way to give an
  entity `@created()` / `@updated()` (`createdAt:DateTime?` becomes a plain column, and a field of the model too):
  they were written by hand in the entity.
- **Found making the backend's `store_api` (2026-11-21):** `gen resource --source db` with a `DateTime` field writes
  a test that does not parse (`NewOrder(..., placedAt =)`: no example value for a `DateTime`); the test says "adds a
  order"; a use case made with `--calls` drops the defaults of the repository method's parameters
  (`page: int = 1` becomes a required `page: int`).

- **Found making Nuclear Chat's service (spec 013, 2026-11-18):**
  - `nuclear make component <c>` is listed by `nuclear help` but refused in a backend project (its kinds have no
    `component`): each piece was made with `make appcomponent|usecase|service|model|controller|listener`;
  - `gen usecase --calls` takes only `<Repository>.<method>`: a use case that only calls a service's method is
    written by hand;
  - `gen resource --source rest:<url>` adds its `Http(...)` after a one-line `connections: Connection[] = []`, so
    the config no longer parses (a list written on two lines works); it guesses the path (`tenor`) and a `name`
    parameter, and always writes a controller with routes, which would have published a third-party API (Tenor)
    without the project's consent: Nuclear Chat deleted the routes and rewrote the repositories' methods.

- **Found building the website and the onboardings (2026-11-16):**
  - a generated screen keys its list by `item.id` even when the model has no `id` (a resource from JSON whose
    objects have a `key`): `nuclear check` accepts it and `tsc` fails (`Property 'id' does not exist`);
  - `--source rest:<url>` without `--path` calls the resource's name in the singular (`GET todo`), while the
    database table is plural (`todos`): the default path should be the plural;
  - no resource of one object: `--actions get` always takes an `id`, so a JSON document that is one object (a home
    page's data) gets no repository method without one;
  - no generator for a view shared by the whole app: `make stateless shared X` writes a component `shared` whose
    views are private (N0302), while the views of the top-level `shared/` folder are visible everywhere;
  - `gen component` says it writes "its facade and its config"; a backend dry run lists only the facade.
- **The plural of a table**: `gen resource shelves Shelf --source db` names the table `shelfs` (`@entity("shelfs")`):
  the plural is the name plus `s` unless `--plural` is given. Found by the functional tests of 2026-11-16.
- **A resource that reads another API gets no test.** Seen with the user's run
  `nuclear_rick_and_morty/.nuclear/builder/runs/20261111-implements-list-character-feature`: it passes from scratch
  with 10 generated files and **0 tests**; the acceptance step lists "create the unit test" as not shown met, and
  the endpoint's answer was never compared with the API's. The generators write no test for `--source rest`, and
  the Nuclear Builder's *Tests first* stage is skipped when every file was generated: the generator needs a test over a fake
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
