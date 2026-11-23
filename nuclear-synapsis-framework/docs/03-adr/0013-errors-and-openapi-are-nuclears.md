---
status: accepted
date: 2026-11-22
deciders: Julian Molina
---
# ADR-0013: The body of an error and the OpenAPI document are Nuclear's, the same in every dialect

## Context and problem
The database check (2026-11-21) ran one backend with both dialects and compared every answer. The statuses agreed;
the bodies of the errors did not: `{"detail": "..."}` in `fastapi` and `{"statusCode": 409, "message": "..."}` in
`nestjs`, and an invalid body listed each validator's own words (two reasons in one dialect, five in the other for
the same body). The contract's OpenAPI document already described one `Error` (`message`, `status`) that neither
dialect answered. And `fastapi` served a second OpenAPI document at `/openapi.json`, worked out by the framework
from the generated Python, while `nestjs` served none. A client had to know which dialect its backend was built
with, against ADR-synapsis-0012 and root rule 3.

The user decided (2026-11-22): a converter, so that whatever each framework answers, the output of Nuclear is the
same; and the JSON and the OpenAPI are made from Nuclear, not from the dialects.

## Decision
1. **One body for every error**, in every dialect, written by the runtime whatever its framework would write:

   ```json
   { "status": 404, "message": "no task 9" }
   ```

   `status` is the HTTP status; `message` is the error's (`AppError.message`), `not found` for a route that does not
   exist, `error` for what nothing handled (a 500 never says why: the reason may hold what the app must not show).
2. **An invalid body or parameter is a 400 with its reasons**, one per field, in the order of the fields' names:

   ```json
   { "status": 400, "message": "invalid", "errors": [
     { "field": "priority", "rule": "max", "message": "priority must be at most 3" },
     { "field": "title", "rule": "minLength", "message": "title must have at least 1 characters" } ] }
   ```

   `field` is a path (`items.0.name`; empty for the body itself). `rule` is the name of the validation in Nuclear:
   `required`, `type`, `minLength`, `maxLength`, `min`, `max`, `pattern`, `email`, `url`, `json` (the body is not
   JSON), `invalid`. `message` is written by the runtime from the rule, never the validator's text. A field that
   breaks several rules names the first of that list.
3. **The converter is the runtime's.** Each runtime turns what its framework reports (pydantic's errors;
   class-validator's constraints, Nest's exceptions) into that body: `synapsis.errors` (`error_body`, `reasons_of`)
   and `synapsis-nest`'s `errors.ts` (`errorBody`, `reasonsOf`) with its `ErrorFilter`. The same list of cases, with
   the same expected bodies, is tested in both (`tests/test_errors.py`, `test/errors.test.ts`).
4. **The API is described once, from the Nuclear.** `/openapi.json` (and the documentation pages of a dialect that
   has them) serve `.nuclear/openapi.json`, the document the transpiler writes from the contract; no dialect's
   framework describes the API. Its `Error` schema is the body above.
5. A route or query parameter that is a number or a boolean is read by the runtime's own pipes in `nestjs`
   (`IntPipe`, `DoublePipe`, `BoolPipe`), which know the parameter's name; the framework's report no name.

## Consequences
- Positive: a client reads one error body and one OpenAPI document whatever the dialect; the check compares the
  whole body of an error, not only its status.
- Negative: a client of an existing service that read `detail` or `statusCode` must read `message` and `status`;
  the documentation page of a `fastapi` app shows the contract's document, without the framework's extras.
- Decided after (the user, 2026-11-22): a value of another JSON type is refused in every dialect, with the rule
  `type`; nothing converts (the backend's reference, §2.3).
- Decided after (the user, 2026-11-23: "copia lo que haría springboot"): what the database refuses for integrity
  is not "what nothing handled". It answers what Spring Data REST's `RepositoryRestExceptionHandler` answers for
  Spring's `DataIntegrityViolationException`, 409 Conflict, with this body and the fixed message `conflict`
  (Spring's body carries the database's message; ours never does): a repeated unique value, a foreign key that
  points at nothing, a row others point to, a null in a required column, a text longer than its column. Plain
  Spring Boot has no handler for that exception and answers 500 (the backend's reference, §2.4).

## References
- `platforms/backend/packages/synapsis-py/src/synapsis/errors.py`, `app.py`;
  `platforms/backend/packages/synapsis-nest/src/errors.ts`, `web.ts`.
- `nuclearlang/crates/nuclear-transpile/src/contract.rs` (`openapi`: the `Error` and `ErrorReason` schemas).
- ADR-synapsis-0006 (contracts), ADR-synapsis-0012 (one JSON for every dialect).
