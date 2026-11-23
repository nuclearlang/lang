---
name: sql-databases
description: Design and change the SQL data of a Synapsis backend: entities, relations, --source db resources, repository queries, indexes, pagination, transactions and migrations. Use when a task adds a table, a column, a relation or a query, or moves a backend from SQLite to PostgreSQL, MySQL or MariaDB.
title: SQL databases
title_es: Bases de datos SQL
description_es: Diseñar y cambiar los datos SQL de un backend Synapsis: entidades, relaciones, recursos --source db, consultas del repositorio, índices, paginación, transacciones y migraciones. Úsalo cuando una tarea añade una tabla, una columna, una relación o una consulta, o pasa un backend de SQLite a PostgreSQL, MySQL o MariaDB.
kind: technology
tags: [database, sql, entity, migrations, postgres, sqlite, query, index, transaction]
---
# SQL databases

## When to use

A backend stores data: a new table, a changed column, a relation, a query, a database engine. Read
`nuclear help backend` §2.1, §2.2, §2.4 and the migrations part of §2.8 first.

## Steps

1. **Pick the engine** with its plugin and connection: `sqlite` + `SQLite(file = env("DATABASE", "app.sqlite"))`,
   or `postgres` / `mysql` / `mariadb` + `Postgres(url = env("DATABASE_URL"))`, `MySQL(url = ...)`,
   `MariaDB(url = ...)`. The URL comes from `env(...)`, never a literal with a password.
2. **Generate the resource**: `nuclear gen resource orders Order --source db --fields "id:int total:double
   status:string"` writes the entity, `NewOrder`, the repository with a paged query, a use case per action, the
   controller and the tests over an in-memory database.
3. **Shape the entity** (`nuclear help entity --dialect fastapi`): `@entity("table")`, `@primary(generated = true)`,
   `@column(length, unique, index, nullable, name)`, `@created`, `@updated`; `T?` is a nullable column and a
   default is the column's default. Another table: `nuclear make entity <component> <Name>`.
4. **Relations** (by hand, the generator does not write them): `@manyToOne(inverse, onDelete)` on `x?: T` plus the
   field `xId`; `@oneToMany(inverse)` on `xs?: T[]`; `@manyToMany(inverse)` with `@joinTable()` on one side;
   `@oneToOne(inverse, onDelete)` with `@joinColumn()` on one side. N0308 checks them.
5. **Queries** are repository methods whose lines build one query: `where({...})` (equality, `gt`, `gte`, `lt`,
   `lte`, `ne`, `like`, `ilike`, `oneOf`, `isNull`, `between`), `orderBy(field, desc = true)`, `limit`, `offset`,
   `relations("tasks")`; the last line runs it: `getOne()`, `getMany()`, `paginate(page, size)` (`Page<T>`),
   `count()`, `exists()`, `update({...})`, `delete()`. Wire a query into the API with
   `nuclear gen usecase <component> <Name> --calls <Repository>.<method> --route "GET <prefix>/<path>"`.
6. **Transactions**: `@transactional` on a use case's `exec`: every repository call inside shares one transaction;
   an `Err` or an error rolls it back, an `Ok` commits.
7. **Migrations** once the data must be kept: `nuclear install` (once), `nuclear migrate make "<what changed>"`,
   read the file in `migrations/`, then `nuclear migrate`; `nuclear migrate down` reverts the last one. Remove
   `createTables` from the connection when the project has migrations.
8. `nuclear check . --json`, `nuclear test` (the tests run on databases in memory).

## The platform's tools

- `nuclear gen resource ... --source db`, `nuclear make entity|repository <component> <Name>`.
- `nuclear migrate make <message>`, `nuclear migrate`, `nuclear migrate down`.
- The same query words work on the mobile local tables (a model with `@primary`).
- The shape of the chain outside the repository: `~tasks.where({ "title": t }).exists()`.
- Slow queries: `nuclear run --monitor` then `nuclear monitor` (skill `performance-load`).

## Pitfalls

- A renamed table or column is told to `make`, or the migration is a drop and an add and the data is lost (`make`
  warns of every drop): `nuclear migrate make "<message>" --rename shops=stores --rename orders.shop_id=store_id`
  (the database's names; `project_migrate` takes them as `rename`).
- `make` compares the entities with the last migration, never with a live database: a database changed by hand
  drifts silently.
- Migrations belong to the dialect they were made with; switching `fastapi` ↔ `nestjs` needs new ones.
- Only SQLite migrations have been run by the platform's tests; test against your real engine before shipping.
- An unloaded relation is absent from the JSON, never `null` and never a hidden query: load it with `relations(...)`
  in the query that needs it, instead of one `find` per row (N+1).
- A resource from `--source db` has no relations and no search; which column is searched is a decision you write.
- `createTables = true` against a production database: tables appear but never change; use migrations.
- `findAll()` on a growing table: use `paginate(page, size)`.

## Checklist

- [ ] The engine's plugin is enabled and the URL comes from `env(...)`.
- [ ] Every column queried by `where` or `orderBy` on a large table has `@column(index = true)` or is the key.
- [ ] Unique business keys carry `@column(unique = true)`, and the use case answers `Conflict` before saving.
- [ ] Use cases that write several rows carry `@transactional`; a test proves an `Err` rolls back.
- [ ] Lists are paginated; relations are loaded explicitly.
- [ ] A migration exists for every entity change, was read (no unintended drop) and applies with `nuclear migrate`.
- [ ] `nuclear check . --json` prints `[]` and `nuclear test` is green.
