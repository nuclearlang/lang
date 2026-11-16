---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [03-adr/0006-local-database.md, 07-reference/mobile.md, 07-reference/dragonfly.md, 01-product/roadmap.md]
---
# The local database

The backend's ORM on the device: the same words as a backend entity and its query builder, 100 % local. The rule
is [mobile.md §3, rule 6](../07-reference/mobile.md); the decision and what was rejected,
[ADR-mobile-0006](../03-adr/0006-local-database.md); the classes, [dragonfly.md §3.2](../07-reference/dragonfly.md).

## What a project writes

| Words | Effect |
|---|---|
| `@primary` on a model's key field | the model has a local table |
| `@primary(generated = true)` | the table gives the key (the field is optional) |
| `@created`, `@updated` | stamps the table writes |
| `@entity("table")` | the table's name; default: the model's name in snake_case |
| `local: LocalDatabase = LocalDatabase(encrypted = false)` in `appConfig` or in a component's `config` | how the tables are kept, for the project or for the tables of that component's models; the default is encrypted |
| `@repository(saveLocal = true)` | every GET of the repository that answers a model with a table (or a list of them) keeps its answer, and gets a twin |
| `@get(local = true)` | the same for one method |
| `<method>AsLocal()` | the twin: same signature and return type; it answers the rows that call answered, as they are now, and never sends a request. Without a previous answer it is an `Err` for a `Result` method |
| `local<M>()` in a repository method with a body | the table of `M`: `find`, `findAll`, `save`, `saveAll`, `remove`, `clear`, and the queries `where`, `orderBy`, `limit`, `offset`, `getOne`, `getMany`, `paginate` → `Page<T>`, `count`, `exists`, `update`, `delete` |

- The operators of `where` are `gt`, `gte`, `lt`, `lte`, `ne`, `like`, `ilike`, `oneOf`, `between`; a plain `null`
  is "is null" and `ne(null)` "is not null". There is no `isNull`.
- A repository may be 100 % local: no http method at all.
- A GET that answers a generic (`Page<Character>`) is not kept: it has no key.
- `@column` is not part of the platform: in a document store the JSON name (`@key`) is the column.
- The Nuclear never names the storage engine.
- The generated tests call each twin and check it answers without a request.

## In the runtime

`packages/dragonfly/lib/src/local/local.dart`.

- `Local`: the registry and the storage. One box per table, the same engine on every platform (a file per box on
  Android, iOS, Linux, macOS and Windows; IndexedDB on web). `LocalDatabase(encrypted)` comes from the configs'
  `local`, per component (`configure` / `settings`, the table's `component`). The AES key is made at the first
  encrypted box and kept in the secure storage. `memory` keeps the boxes in memory, unencrypted, for tests.
  `store` / `recall` use a calls box that remembers which rows each call (name, url and query) answered.
- `LocalTable<T>`: CRUD and the query builder over JSON rows (the model's own JSON mapping, nested objects
  intact); the box is `dragonfly_<name>`. `putRow` stamps `created` / `updated` (ISO-8601 texts) and gives
  `generated` keys.
- `LocalQuery<T>` and the operators as top-level functions.
- `NotFound`: a `RepositoryError`, like `HttpError`; `attempt` catches both.
- `Repository.send(local:)`, `recall`, `target`, `local<T>()`, `saveLocal`.
- `Dragonfly.reset` closes the database; `DragonflyTest.start` sets `memory`.
- The dialect writes the table in the model and registers it with its component at startup; nothing generated
  names the engine, so it can change in the package without touching the transpiler or any `.nuc`.

## Limits

A table is loaded in memory: it is for what a phone shows, not for millions of rows. Turning `encrypted` on or off
after the first run needs the tables cleared. On web the key lives in the browser's storage, weaker than a phone's
keystore. The open limits are in the [roadmap](../01-product/roadmap.md).
