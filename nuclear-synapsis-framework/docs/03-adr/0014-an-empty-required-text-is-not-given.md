---
status: accepted
date: 2026-11-24
deciders: Julian Molina
---
# ADR-0014: An empty text under `@required` is not given

## Context and problem
`@required` on a text was written as a length of at least one character in both backend dialects (`MinLen(1)` in
`fastapi`, `@IsNotEmpty()` read as `minLength` 1 in `nestjs`), so `""` answered the rule `minLength` while a missing
value or `null` answered `required`. The reference of the backend said only the second. In the factory's baseline
runs (spec 025) the agents read `@required` as `required` three times out of three, wrote the tests for it, and the
run stopped: a client reads it so too. `@minLength(1)` could not be told from `@required` in the answer either.

## Decision
1. **`""` under `@required` answers the rule `required`** (`<field> is required`), as a missing value and `null` do,
   in every dialect. `@minLength(n)` keeps the rule `minLength`, `@minLength(1)` too.
2. `fastapi`: `@required` is the runtime's own check (`AfterValidator(is_given)`), never `MinLen(1)`; `nestjs`:
   `@IsNotEmpty()` answers `required`. Both runtimes test the same case (`test_errors.py`, `errors.test.ts`), and the
   conformance example (`tasks_api`) asks it of both dialects.
3. `@required` refuses an empty text only: an empty list is given (as `nestjs` always did; `fastapi` refused it as a
   length before).

## Consequences
- A body that sends `""` for a required field answers `required` instead of `minLength` in both dialects: a client
  that read the old rule reads the new one.
- An empty list under `@required` is accepted by `fastapi` now, as by `nestjs`.
