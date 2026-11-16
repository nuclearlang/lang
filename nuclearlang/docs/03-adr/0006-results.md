---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0006: Errors are values: `Result<E, T>` with the error first, propagated on its own, handled with `.ok()` / `.error()` by what the callback returns

## Context and problem

Exceptions hide which functions fail, and explicit handling at every call (`match`, `try`, `?`) is noise an agent
writes by reflex and often wrong. Errors need one form that the compiler can check and each target can write as its
experts do.

## Decision

**The type.** `Result<E, T>` with `Ok(value)` / `Err(error)`, never declared. The error type goes first, like
`Either<L, R>` in fpdart and Arrow.

**Propagation.** Inside a function that returns `Result`, errors propagate on their own (no `match`, `try` or `?`);
outside, an unhandled `Result` is an error. An error of another type is a compile error (convert it with
`.error(e => Err(...))`).

**Keeping one.** A `Result` is kept with a variable typed `Result`. `match` with `Ok(x) ->` / `Err(e) ->`.

**`.ok(cb)` / `.error(cb)` by what the callback returns.** `Ok`/`Err` transforms or recovers; a plain value
transforms (`.ok`) or recovers (`.error`: the expression is that value); nothing (`void`, an external function)
only observes and the error keeps propagating.

**Runtime.** Each dialect generates its own runtime, without dependencies. Dart is the exception: there
`Result<E, T>` is fpdart's `Either<E, T>` (`Ok` → `Right`, `Err` → `Left`); async is `Future<Either<E, T>>` with
`~`.

## Options considered

1. Exceptions: rejected.
2. Rust-style `?` at each call: rejected.
3. `Result<T, E>`, the value first: it was the first order; replaced by the error first.

## Consequences

- Positive: a function's signature says it can fail; the happy path reads as plain code; the Dart output is what an
  fpdart user writes.
- Negative: `Result` propagates only through functions written in Nuclear with a `Result` return and the library
  methods the type definitions mark; `~f().error(...)` on an async function does not chain (store it first in a
  variable typed `Result`).

## References

- `docs/07-reference/nuclear-base.md` §3.2, `docs/08-guides/13-results.md`, `docs/02-architecture/result.md`;
  diagnostics N0108–N0111.
- Replaces: ADR-0036, ADR-0047, ADR-0048
