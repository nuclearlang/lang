---
status: accepted
date: 2026-11-10
deciders: Julian Molina
---
# ADR-0001: Backend data is written with one key decorator, a decorator per relation, `paginate`, `@transactional` and generated migrations

## Context and problem

A real backend needs relations between tables, pagination, transactions and migrations of the database schema
([spec 004](../04-specs/004-backend-parity/plan.md), F1–F4). The user's rule for them: the code must look as much
alike as possible across the platforms, at the middle point of cost and benefit, polished step by step. The words
had to be the same in every backend dialect, and the key and the pages also on the mobile local tables
(ADR-mobile-0006).

## Decision

**One key decorator, `@primary(...)`, that takes what it needs as arguments.** `generated` (the database or the
runtime fills it: auto increment for an `int`, a uuid for a `string`) and `length` (a `string` key the app gives).
There is no `@generated` and no key by name, on any platform: `@generated()` is N0309, with
`@primary(generated = true)` as the fix.

```nuclear
@entity("tasks")
entity Task()
  @primary(generated = true)     // the database gives it
  id: int

@entity("codes")
entity Code()
  @primary(length = 8)           // the app gives it
  code: string
```

**A decorator per relation, as TypeORM writes them**, because the explicit form needs no deduction rules to learn.

```nuclear
@entity("tasks")
entity Task()
  @primary(generated = true)
  id: int
  @manyToOne(inverse = "tasks", onDelete = "cascade")
  project?: Project
  projectId: int                 // the join column of `project` (projectId?: int: a task may have no project)
  @manyToMany(inverse = "tasks")
  @joinTable()
  tags?: Tag[]
```

| Decorator | On | Arguments |
|---|---|---|
| `@manyToOne` | `x?: T`, with a field `xId` | `inverse`, `onDelete` (`"cascade"`, `"set null"`, `"restrict"`) |
| `@oneToMany` | `xs?: T[]` | `inverse` (required: the `@manyToOne` field of `T`) |
| `@manyToMany` | `xs?: T[]` | `inverse`; `@joinTable()` on the side that owns the join table |
| `@oneToOne` | `x?: T` | `inverse`, `onDelete`; `@joinColumn()` and a field `xId` on the side that keeps the column |

The related type comes from the field's type, so the decorator does not repeat it. The join column is a field of
its own (`projectId`): it is set without loading the other row and it is in the JSON answer. The join table is
`<owner table>_<field>` (`tasks_tags`), with the columns `<entity>_id` of both sides; the column of a relation is
`<field>_id`. Both are conventions, the same in every dialect.

Checked at compile time (N0308): a relation field is optional (it is there only when loaded); its type is an entity
(a list for `@oneToMany` / `@manyToMany`, one for `@manyToOne` / `@oneToOne`); `@manyToOne`, and `@oneToOne` with
`@joinColumn`, need the field `<name>Id`; `inverse` names a field of the related entity; one side of a
`@manyToMany` has `@joinTable`, one side of a `@oneToOne` has `@joinColumn`.

**Loading is explicit**: `relations("tasks")` is one more step of the query builder. An unloaded relation is absent
from the JSON answer: never `null`, never a lazy query. Saving writes what the entity holds: the join column of a
`@manyToOne`, and the rows of the join table when a `@manyToMany` list is set (`task.tags = [a, b]`, then
`save(task)`).

**The rules are data of the platform, with no decorator name in Rust.** `[decorators.args]` and
`[decorators.fields]` of `platform.toml` list them (`optional`, `list`, `target`, `sibling`, `inverse`, `with`);
the loader merges them into every backend dialect. Templates get `tinfo.decor` (the decorators of the field's type:
its table), `owner` / `owner_decor` (the declaration the field is in) and the `unquote` filter.

**Pagination is `paginate(page, size)` → `Page<T>`**, one more step of the query builder (one `count` and one
`limit` / `offset`). `Page<T>` (`items`, `page` from 1, `size`, `total`, `pages`) is a class of the runtimes. The
same line is written in a backend repository and in a mobile local query.

```nuclear
repository TaskRepository
  page(page: int, size: int = 20) Page<Task>
    orderBy("id")
    paginate(page, size)
```

**Transactions are `@transactional` on a use case's `exec`.** Every repository call inside it joins one transaction
of the default database; an `Err` result or a thrown error rolls it back, an `Ok` commits it. The repositories of the
runtimes read the open transaction, so nothing else changes in the code.

```nuclear
usecase MoveTasks(tasks: TaskRepository, projects: ProjectRepository)
  @transactional
  exec(from: int, to: int) Result<Error, int>
    ~projects.find(to)
    moved = ~tasks.where({ "projectId": from }).update({ "projectId": to })
    Ok(moved)
```

**Migrations are generated from the entities.** `nuclear migrate make "<message>"` writes one migration from the
difference between the entities and the last migration, never a live database, in the dialect's tool, under
`migrations/` of the project (kept with the sources, not in `build/`). `nuclear migrate` applies the pending
ones to the default database; `nuclear migrate down` reverts the last. They are the dialect's `[toolchain]` keys
`migrate_make`, `migrate`, `migrate_down` (placeholders `{{message}}`, `{{migrations}}`), so the command names no
tool. `SQLite(createTables = true)` stays for tests and development. A field default (`done: boolean = false`) is
also the column's SQL default, so a non-null column can be added to a table with rows. A rename shows as a drop
and an add; `make` warns of every drop; the file is the project's to edit.

**How each dialect implements it.**

| | `fastapi` (SQLAlchemy 2) | `nestjs` (sequelize-typescript) |
|---|---|---|
| `@manyToOne` | `relationship` + `ForeignKey` on `x_id` | `@BelongsTo` + `@ForeignKey` on `xId` |
| `@oneToMany` | `relationship(back_populates=...)` | `@HasMany` |
| `@manyToMany` | `relationship(secondary=...)` | `@BelongsToMany(..., through)` |
| `@oneToOne` | `relationship(uselist=False)` | `@BelongsTo` / `@HasOne` |
| Transaction | an `AsyncSession` in a `ContextVar` | a sequelize transaction in an `AsyncLocalStorage` |
| Migrations | Alembic: `make` brings an empty SQLite in memory to the last migration and lets autogenerate write the difference, in batch mode (SQLite cannot alter a column; the other databases run the same file); the folder's `env.py` is written once; `alembic_version` lists what is applied | the runtime's `synapsis-nest-migrate`: it reads the entities' attributes, diffs them with the `schema` the last migration exports and writes `up` / `down` over `queryInterface`; `SequelizeMeta` lists what is applied |

In fastapi related entities are imported only for the type checker; in nestjs a single relation is typed
`Related<T>` and the runtime's `Entity` keeps the relations given to the constructor. In Dart `Page<T>` is the
runtime's `PageOf<T>` (Flutter has its own `Page`; a project's own `Page` keeps its name).

## Options considered

1. **A decorator for the key and one per relation, explicit loading** — chosen.
2. **The key and the relations deduced from types and names** (`id` is the key, a field of an entity type is a
   relation): less to write, but it needs deduction rules to learn, and the user prefers the explicit form.
3. **A kind by folder for repositories and controllers, with paths from the name**: the kinds stay as they are.
4. **Lazy or eager loading by default**: hidden queries and N+1, against the golden rule (ADR-lang-0001).
5. **Cursor pagination first**: offset pages are what most APIs and the mobile `Page<T>` use; cursors can come later.
6. **umzug for the nestjs migrations**: not needed, `SequelizeMeta` and `queryInterface` are enough.

## Consequences

- Positive: an entity reads like a TypeORM entity in every backend dialect; the key is one word on backend and
  mobile, and so is a page.
- Positive: the rules of the relation decorators are data of the platform, so a new backend dialect gets them by
  writing templates.
- Positive: `make` never needs a running database, and the same migration file runs on every database.
- Negative: the join table and the relation column have no custom name; another name would be a later argument.
- Negative: `@transactional` covers the default database only.
- Negative: the members of `Page<T>` are untyped in Nuclear until type definitions carry member types.

## References

- Replaces: ADR-0100
- The rules for a user: [the reference](../07-reference/backend.md) §2.1, §2.2, §2.4, §2.8.
- How the runtimes build it: [Python](../02-architecture/runtime-python.md#data),
  [TypeScript](../02-architecture/runtime-typescript.md#data).
