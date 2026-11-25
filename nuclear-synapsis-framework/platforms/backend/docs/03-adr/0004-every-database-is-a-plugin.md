---
status: accepted
date: 2026-11-25
deciders: Julian Molina
---
# ADR-0004: Every database is a plugin, written in Nuclear on one adapter contract

## Context and problem

A backend's repositories work on the four databases its two ORMs were wired to (SQLite, PostgreSQL, MySQL,
MariaDB), and the wiring is in the dialects' TOML and the runtimes. Oracle, SQL Server or a database nobody knows
(CamusDB) cannot be used, and an agent has no way to add one without changing Nuclear (root rule 17). The user
decided on 2026-11-25: one adapter for every database; when the ORM of a dialect supports the database the
transpiler matches it to that ORM natively, as the ORM is matched to Synapsis today; when it does not, Synapsis's
own adapter does the unit of work, the CRUD and the transactions, so the repositories work exactly the same. A
database is declared with the kind `plugin`, and the knowledge base tells an agent how to write one.
([spec 005](../04-specs/005-database-adapters/requirements.md) holds the inventory of what the repositories give.)

## Decision

**A database is a `plugin`**, a kind of the backend platform written in Nuclear and added to a project as a
package (`nuclear add`). It is data of the platform, never a word of the parser (root rule 2). The four databases
of today become plugins of the same form: none is special.

**One contract, two ways under it, chosen per dialect.**

| The ORM of the dialect | What the plugin gives | Who does the unit of work, CRUD, transactions |
|---|---|---|
| knows the database (Oracle and SQL Server in SQLAlchemy) | the native match, in the plugin's dialect part: the ORM's dialect and driver | the ORM, as today |
| does not (CamusDB anywhere; a database Sequelize lacks) | the adapter in Nuclear: the driver and what its SQL writes otherwise | the Synapsis ORM, written once in Nuclear |

The project's `.nuc` is the same either way: only its connection line names the database. Whether a dialect is
native or adapted is the plugin's detail, and the database check proves both give the same answers.

**What a database cannot do is declared by its plugin** and refused at compile time with a documented diagnostic
that names the fix. No hidden emulation (`onDelete = "cascade"` on CamusDB does not build).

**A transaction the database asks to retry is retried by the library**, the whole transaction from its start, a
fixed number of times the plugin sets; then the error is thrown, as any error the program does not handle.

**The knowledge base holds how to write a plugin**: the contract, the native and the adapted way, the checks to
pass, as a playbook an agent follows from a fresh install.

## Options considered

1. **One contract for every database, native where the ORM knows it, the Synapsis ORM where not** — chosen.
2. **The Synapsis ORM for every database**: one engine, but it throws away two mature ORMs that already pass the
   database check.
3. **Adapters at the level of each ORM**: two programs in two languages per database, and impossible where an ORM
   takes no outside dialect (Sequelize 6).
4. **The Synapsis ORM only for unknown databases, the four of today wired as now**: two ways to add a database
   instead of one.

## Consequences

- Positive: any relational database can be added by an agent with the tools, in Nuclear, without changing the
  installation; the four of today follow the same rule.
- Positive: where an ORM knows the database, nothing new runs underneath.
- Negative: two engines under the repositories; their parity rests on the database check running every plugin.
- Negative: a retried transaction runs the use case again: what it does outside the database (an event it
  publishes) must wait for the commit, or it would happen twice.
- Negative: Nuclear lacks pieces for it (spec 005 design §6): an HTTP client in the language's library, built
  Nuclear inside a runtime, the compile-time check of what a plugin refuses.

## References

- Spec: [005-database-adapters](../04-specs/005-database-adapters/design.md).
- Builds on: ADR-backend-0001 (the data words), ADR-backend-0002 (migrations), ADR-synapsis-0004 (plugins and kind
  packages are libraries), ADR-platform-0016 (the installation is sealed).
