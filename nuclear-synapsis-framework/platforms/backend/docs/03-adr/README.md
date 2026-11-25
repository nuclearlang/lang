---
status: accepted
owner: Julian Molina
updated: 2026-11-22
related: [0001-backend-data.md, 0002-typeorm-is-the-rule-of-migrations.md, 0003-exact-numbers-in-the-database.md]
---
# Decisions of the backend platform

A decision of this project is cited `ADR-backend-NNNN`. For a new one, copy
[the template](../../../../../docs/03-adr/0000-template.md) with the next number. An accepted decision is not
edited: a change is a new ADR, and the old one is marked `superseded by ADR-backend-NNNN`.

| ADR | Decision | Status | Date |
|---|---|---|---|
| [0001](0001-backend-data.md) | Backend data is written with one key decorator, a decorator per relation, `paginate`, `@transactional` and generated migrations | accepted | 2026-11-10 |
| [0002](0002-typeorm-is-the-rule-of-migrations.md) | TypeORM is the rule of behaviour for migrations: the history, the order, `--fake`, the transactions, the schema of the timestamps and the foreign keys | accepted | 2026-11-22 |
| [0003](0003-exact-numbers-in-the-database.md) | A `bigint` is a `BIGINT`, a `bigdouble` a `NUMERIC(p, s)`, SQLite keeps their text compared by value; a value the column cannot hold is 409; on the wire a JSON text | accepted | 2026-11-23 |
| [0004](0004-every-database-is-a-plugin.md) | Every database is a `plugin` in Nuclear on one adapter contract: native where the dialect's ORM knows it, the Synapsis ORM where not; what it cannot do is refused at compile time; a retry is the library's | accepted | 2026-11-25 |

Decided in other projects and binding here: what a platform and a dialect are, the contract every dialect
implements and the conformance example (ADR-synapsis-0002); the contract a backend shares with its apps (ADR-synapsis-0006);
the plugins (ADR-synapsis-0004); the generators (ADR-codegen-0001); how each dialect writes its target (ADR-python-0001 for the
Python language, ADR-python-0002 for `fastapi`, ADR-typescript-0001 for `nestjs`).

A decision cited by its old platform-wide number (`ADR-00NN`, in code or commits before 2026-11-16): see
[the table of old numbers](../../../../../docs/03-adr/old-numbers.md).
