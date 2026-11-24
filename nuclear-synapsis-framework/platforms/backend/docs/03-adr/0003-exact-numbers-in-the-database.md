---
status: accepted
date: 2026-11-23
deciders: Julian Molina
---
# ADR-0003: The exact numbers in the database and on the wire

## Context and problem

The language has `bigint` and `bigdouble` since ADR-lang-0015: exact, of any size, JSON as their text. The user
decided on 2026-11-23 that the platforms get them too ("create the data types bigint and bigdouble in Nuclear, add the
check functions… yes, exact types"). A backend must keep them in four databases and answer them in two dialects with
the same values and the same bytes, and a database column is never of any size.

## Decision

1. **A `bigint` column is the database's `BIGINT`** (64 bits, TypeORM's `bigint`, the rule of ADR-backend-0002). Its
   range is −2^63 to 2^63 − 1: a value beyond it is never written, on any database, and the write answers 409
   `conflict`, as a text longer than its column does. A `bigint` of a model (the body of a request) has no column and
   keeps the language's size, up to 1000 digits.
2. **A `bigdouble` column is `NUMERIC(p, s)`** (`DECIMAL(p, s)` on MySQL and MariaDB, TypeORM's `decimal` with
   `precision` and `scale`): `@column(precision = p, scale = s)`, 30 and 10 by default, `p` from 1 to 65 and `s` from 0
   to 30 and at most `p` (what all four databases take). A value with more decimals than `s` or more digits before
   the point than `p − s` is never rounded or cut: 409 `conflict`. A changed precision or scale is a migration.
3. **SQLite keeps the text of the value.** SQLite has no exact number: a `NUMERIC` column there keeps a REAL, and
   `12345678901234567890123` or `0.12345678901234567891` lose digits (checked with SQLite 3.54). Both columns are a
   type of TEXT affinity whose words say what it holds: `EXACT TEXT` (a `bigint`) and `EXACT TEXT(p,s)` (a
   `bigdouble`, the text with exactly `s` decimals). The runtimes compare and sort that text by value (`where` with
   `gt`, `gte`, `lt`, `lte`, `between`, equality, `oneOf`, and `orderBy`: the sign, the digits before the point, then
   the text), and a migration of SQLite writes the texts of a column whose scale changed again, rounded half away from
   zero as the other databases round them.
4. **On the wire an exact number is a JSON text**, `toString()` of the language both ways: the texts of
   `text.toBigInt()` and `text.toBigDouble()` are read, any other text, a JSON number or a value of more than 1000
   digits (written without an exponent) is refused with the rule `type`. A parameter of the path or the query reads
   the same texts. The OpenAPI document gives them as `{"type": "string", "pattern": ...}`, the pattern of the
   language's text.
5. **`@min` and `@max` of an exact field compare exactly**: their argument is a literal of the field's type (a
   decimal for a `bigint` is N0119, a bound beyond 2^53 is written exactly).

## Options considered

1. `BIGINT` for `bigint`, `NUMERIC(p, s)` for `bigdouble`, TEXT on SQLite (chosen): TypeORM's types, a generated key
   could later be a `BIGINT`, the sort and the comparisons by value on every database.
2. `NUMERIC(65, 0)` for an unbounded `bigint`: no auto increment on PostgreSQL, not TypeORM's mapping, and 65 digits
   are a bound all the same.
3. SQLite's REAL with a precision of at most 15 digits on every database: exact only for small values, and a limit the
   other three databases do not have.
4. A sortable encoding of the text on SQLite: rows that no SQL reader of the database can read.

## Consequences

- Positive: the same values, schema and answers in both dialects on the four databases (the database check).
- Negative: a value written into SQLite by SQL, not by the app, must be the column's text (`'0.3000000000'`), or it
  sorts as text until the next migration writes it again.
- Negative: a key (`@primary`) is still an `int` or a `string`: an exact key is refused (N0308).

## References

- The rules: [the reference](../07-reference/backend.md) §2.1, §2.2, §2.3; the language: ADR-lang-0015.
