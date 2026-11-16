---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-0006: The local database is the backend's ORM on the device: `@primary` models, `@repository(saveLocal)` and `<method>AsLocal()`

## Context and problem

The mobile platform needed the ORM the backend platform has (ADR-python-0002, ADR-typescript-0001: an entity with `@primary`,
`@created`, `@updated`, a repository with CRUD and the query builder), but 100 % local: a secure database on the
device, automated through the `repository` kind. With `@repository(saveLocal = true)` the transpiler creates the
table from the model a GET answers, saves every answer in it, asks for the minimum of annotations on the model, and
writes for each method a twin that answers from the device instead of the network; one method can turn it on by
itself.

Constraints: the mobile `repository` is http calls, not tables, so the two kinds cannot be merged (ADR-synapsis-0004);
the Nuclear of a project never names the storage engine; the runtime must work on web; the compiler stays generic.

## Decision

**A model with `@primary` has a local table.** The same words as a backend entity: `@primary` on the key field,
`@primary(generated = true)` for a key the table gives (an auto-increment: the field is `T?`; ADR-backend-0001),
`@created` and `@updated` for stamps the table writes, `@entity("characters")` for the table's name (default: the
model's name in snake_case; the box is `dragonfly_<name>`). `@column` has no meaning in a document store (the JSON
name, `@key`, is the column) and is not part of the platform. The dialect writes
`static final LocalTable<M> table` in the model and registers it at startup with its component.

**`@repository(saveLocal = true)`, or `@get(local = true)` on one method.** A GET that answers a model with a table
(or a list of them; not `Page<Character>`, which has no key) passes `local: 'Repo.method'` to `send`: the decoded
rows go to the model's table and a calls table remembers which rows that call (url and query) answered. The
transpiler writes the twin **`<method>AsLocal()`**, with the same signature and return type, which reads those rows
as they are now (`recall`) and never sends a request; without a previous answer it is `Err(E(message))` for a
`Result` method and a thrown `NotFound` otherwise.

**The table is the ORM.** `local<Character>()` in a repository (and `Character.table` anywhere) is a `LocalTable`:
`find`, `findAll`, `save`, `saveAll`, `remove`, `clear`, and the backend's query builder: `where({ "age": gt(18) })`
with `gt`, `gte`, `lt`, `lte`, `ne`, `like`, `ilike`, `oneOf`, `between` (a plain `null` is "is null", `ne(null)`
"is not null"), `orderBy(field, desc)`, `limit`, `offset`, `getOne`, `getMany`, `paginate` → `Page<T>`, `count`,
`exists`, `update`, `delete`. A repository method with a body writes its queries on it, so a repository can be
100 % local.

**The engine is `hive_ce`, behind the runtime, one database for every platform.** Pure Dart: a file per box on
Android, iOS, Linux, macOS and Windows, IndexedDB on web. Rows are JSON text (the model's `toJson` / `fromJson`,
nested objects intact); in memory and unencrypted in tests. **Encryption is a setting of the config files:**
`local: LocalDatabase = LocalDatabase(encrypted = true)` in `appConfig` (the project) and in a component's `config`
(the tables of its models). The default is encrypted: AES-256, a key generated once and kept in the secure storage
(Keychain, Keystore, libsecret, DPAPI, WebCrypto). Nothing generated names hive: the dialect writes `LocalTable`,
`Local`, `LocalDatabase`, `send(local:)`, `recall`, so the engine can change in the package without touching the
transpiler or any `.nuc`.

**Two generic template variables, no kind name in the compiler:** `ret_info.fields_decor.<decorator>` (the first
field of the returned model with that decorator) and `field_decor` of each declaration in the project context, plus
`{{#a or b}}` in templates (the first alternative that is true). Everything else is TOML, templates and the
package.

## Options considered

1. **Isar**: v3 is unmaintained against current Flutter, v4 unfinished.
2. **Drift / sqflite / sqlite3**: real SQL and SQLCipher, but web needs a wasm bundle and a worker copied into
   every app, and drift adds its own code generation per table on top of json_serializable; the backend's query
   vocabulary is covered without SQL at mobile sizes.
3. **Hive v2**: frozen. `hive_ce` is its maintained fork with the same API, pure Dart, web and encryption built in:
   chosen.
4. **sembast**: queries built in, but no encryption without a third package.
5. **An `entity` kind in mobile**: a second kind for the same model doubled every model (an http model and a table
   model); the minimum of annotations on the model the GET returns was asked for.
6. **A twin that reads the table by the method's parameters** (`getOne(id)` → `find(id)`): right only when a
   parameter is the key; `search(name)` or `getPage(page)` would need a mapping per method. Remembering which rows
   each call answered works for every signature and still returns fresh rows.
7. **A plugin `local`**, with the package added only when used: `hive_ce` is pure Dart and small; a plugin would
   add a line to `config.nuc` for a feature two annotations already declare.

## Consequences

- Positive: offline reading with two words (`saveLocal = true`, `@primary`); the backend's query vocabulary on the
  device; a local-only repository without a new kind; generated tests that check each twin answers without a
  request.
- Negative:
  - a GET that answers a model without `@primary` under `saveLocal` fails at its first call with a `StateError`
    that names the fix (the generated tests catch it; there is no compile-time diagnostic);
  - `local = false` on a method does not opt out of `saveLocal` (templates compare no values);
  - `isNull` of the backend is not a mobile operator: the word is the `flutter_test` matcher already in the
    dialect's auto-imports, so a `[functions]` shortcut is refused by `N0204`;
  - `hive_ce` keeps a box in memory: a table is for the data a phone shows, not for millions of rows;
  - `@created` / `@updated` are ISO-8601 texts; a backend entity's `@column` options (`length`, `unique`, `index`)
    have no equivalent in a document store;
  - turning `encrypted` on or off after the first run needs the tables cleared (a box is read with the cipher it
    was written with);
  - on web the key lives in the browser's storage, weaker than a phone's keystore.

## References

- How it works: [local-database.md](../02-architecture/local-database.md); the rule:
  [mobile.md §3](../07-reference/mobile.md); the classes: [dragonfly.md §3.2](../07-reference/dragonfly.md).
- Replaces: ADR-0096
