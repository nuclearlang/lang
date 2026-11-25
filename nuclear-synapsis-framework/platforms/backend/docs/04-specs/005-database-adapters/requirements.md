---
status: draft
owner: Julian Molina
updated: 2026-11-25
related: [design.md, tasks.md, ../../03-adr/0001-backend-data.md, ../../03-adr/0002-typeorm-is-the-rule-of-migrations.md, ../../07-reference/backend.md]
---
# 005 — Database adapters: requirements

A backend's repositories work today on the four databases its two ORMs know (SQLite, PostgreSQL, MySQL, MariaDB).
A database no ORM knows (the test case: CamusDB) cannot be used. This spec gives the platform a way to adapt any
database so that the same `repository`, `@entity`, `@transactional` and migrations work on it unchanged, decided by
the user on 2026-11-25:

- The adapter is written **in Nuclear**, once, and the transpiler takes it to every dialect.
- It is a **sub-framework**: Synapsis keeps the unit of work and everything that makes an ORM; a new database
  implements only a small contract.
- What a database cannot do is a **compile-time error** of the project, never a hidden emulation.
- The first delivery covers **everything `store_api` uses**, in both dialects, inside the database check.

## 1. What the repositories give today, and who does it

Who does it: **ORM** (SQLAlchemy / Sequelize), **DB** (the database itself), **RT** (the Synapsis runtime, the same
rule in both). An adapted database must give every row, same answer, same bytes.

### 1.1 Connection

| Feature | Who | Rule |
|---|---|---|
| A connection by name, opened at start, closed at stop | RT | §2.8: `name` (`"default"`), `connectionName` picks another |
| Reads outside a transaction without `BEGIN` / `ROLLBACK` | RT + DB | one statement, autocommit where the driver can |
| `createTables` | ORM | the entities' tables, unique keys, foreign keys and join tables |

### 1.2 Schema of an entity

| Feature | Who | Rule |
|---|---|---|
| `@entity("t")`, a column per field, Nuclear camelCase ↔ snake_case column | ORM + RT | §2.1 |
| `@primary(generated = true)`: auto increment (`int`), uuid (`string`) | ORM + DB | the key comes back after the insert |
| `@primary(length = n)`: a key the app gives | ORM | |
| `@column(length, unique, nullable, name)`, `T?` nullable, a default is the SQL default | ORM + DB | a non-null column can be added to a table with rows |
| A text of `n` characters: `VARCHAR(n)` or the larger type that holds `n` | RT | §2.1 table; longer is refused with 409, counted in code points |
| `bigint`, `bigdouble` (`precision`, `scale`): exact on every database | RT + DB | ADR-backend-0003; a value that does not fit is refused with 409 |
| `DateTime`: the same instant back, UTC, milliseconds, `toIso()` in JSON | RT | the column keeps the fraction of a second |
| `@created`, `@updated`: the app's clock, the same instant for a new row's two | ORM + RT | |
| Relations `@manyToOne`, `@oneToMany`, `@manyToMany` + `@joinTable`, `@oneToOne` + `@joinColumn` | ORM | ADR-backend-0001; join table `<table>_<field>`, columns `<entity>_id` |
| `onDelete`: `"cascade"`, `"set null"`, `"restrict"`, none (the database's) | DB | a foreign key, named |

### 1.3 CRUD of a repository

| Feature | Who | Rule |
|---|---|---|
| `find(id)` → `Ok(entity)` / `Err(NotFound)` | ORM | |
| `findAll()` | ORM | |
| `save(entity)`: insert without a key, update of the row with the key | ORM | writes what the entity holds; answers the row as the database keeps it (generated key, defaults, `@created`) |
| `save` with a `@manyToOne` set: writes the join column | ORM | |
| `save` with a `@manyToMany` list set: replaces the rows of the join table | ORM + RT | also on a found row whose list was not loaded |
| `remove(id)` → `true` / `false` | ORM | |

### 1.4 The query builder

| Feature | Who | Rule |
|---|---|---|
| `where({...})`: equality and `gt`, `gte`, `lt`, `lte`, `ne`, `oneOf`, `isNull`, `between` | ORM | only the entity's columns; another name is a 500 |
| `like`, `contains`: the database's case rule | ORM + DB | `contains`: `%`, `_`, `/` are characters (`ESCAPE '/'`) |
| `ilike`, `icontains`: case-insensitive on every database | RT | `ILIKE`, or `lower()` on both sides |
| An exact column compared and sorted by value | RT | |
| `orderBy(field, desc)`, `limit(n)`, `offset(n)` | ORM | |
| `relations("a", "a.b")`: loads relations, nested; an unloaded one is absent, never a hidden query | ORM | one query per relation (select-in), never N+1 |
| `getOne()`, `getMany()`, `count()`, `exists()` | ORM | |
| `paginate(page, size)` → `Page<T>`: one `count` and one `limit` / `offset`, `size` ≤ `maxPageSize` | RT | |
| `update({...})`, `delete()` → the rows they changed | ORM | over the same `where` |

### 1.5 The unit of work and the state of an entity

| Feature | Who | Rule |
|---|---|---|
| A write outside `@transactional` is its own transaction | RT | |
| `@transactional`: every repository call of the use case shares one transaction of the default database | RT | an `Err` or an error rolls back, an `Ok` commits; a nested call joins it |
| A write inside a transaction is sent at once (the next read sees it) | ORM (flush) | the order of the writes is the order of the calls |
| The state of an entity: new (no key), kept (read or saved), its relations loaded or not, a `@manyToMany` list waiting for `save` | ORM + RT | an entity is a value: changing a field writes nothing until `save` |
| What the database refuses for integrity is 409 `conflict` | RT + DB | a unique, a foreign key, a required column, a long text, an exact number; never the database's words |

### 1.6 Migrations

| Feature | Who | Rule |
|---|---|---|
| `make "<message>"`: entities minus the last migration, never a live database; `--rename` | RT | ADR-backend-0002, §2.8 |
| `up`, `down`, `status`, `--to`, `--fake`, `--transaction all\|each\|none` | RT | a history of one line per migration |
| Every unique and foreign key named; a drop warned | RT | |
| Every change of a column: add, drop, type, length, nullable, default, unique, rename | RT + DB | `migrations.py` of the database check lists them |

## 2. What a new database must make possible

1. An agent with a fresh install adapts a database **without changing Nuclear** (root rule 17): the adapter is a
   package the project adds (`nuclear add`), never a change of the compiler, a dialect or a runtime.
2. The adapter is Nuclear: one source for every dialect of the platform.
3. The project's `.nuc` does not change when its connection moves to the adapted database: only the connection
   line of `config/project_config.nuc`.
4. What the database cannot do is declared by the adapter and refused at compile time with a documented
   diagnostic that names the fix (`onDelete = "cascade"` on CamusDB).
5. The database check runs `store_api` on the adapted database in both dialects with the same answers as on the
   other four.
6. Performance: no more statements per request than the ORMs send today (`app-check`'s performance counts them).
