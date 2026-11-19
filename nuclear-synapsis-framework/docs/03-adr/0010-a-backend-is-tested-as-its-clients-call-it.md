---
status: accepted
date: 2026-11-18
deciders: Julian Molina
---
# ADR-0010: A backend's tests call the app as its clients do, over HTTP and its WebSocket, with their own environment

## Context and problem
A `tests` class had `inject<X>()`: it called the facades and the use cases, never the app. The guards
(ADR-synapsis-0007), the app's WebSocket and the events pushed to it (ADR-synapsis-0008) were checked only by the
runtimes' own tests and a live run outside the project. Nuclear Chat (spec 013), a local service that starts
commands, could not prove in its own tests that a request without its token is refused. And a guard's token comes
from the environment, which a test must give without the user's real token.

## Decision
1. **`appClient()`** in a test gives the app as its clients see it, with the test's connections (the databases in
   memory, the same `inject<X>()` instances):
   - `~app.get(path, headers = {...})`, `~app.post(path, body = ..., headers = {...})`, `put`, `patch`, `delete`,
     and `~app.request(method, path, body = ..., headers = ...)` answer an `HttpAnswer` (`status`, `body`).
   - `~app.socket(path = "/ws", headers = {...})` opens its WebSocket: `Ok(AppSocket)`, or `Err` with the status of
     the guard that refused the upgrade (401, 403).
   - An `AppSocket`: `~ws.request(method, path, body = ..., headers = ...)` (a request frame and its answer),
     `~ws.subscribe(topic)`, `~ws.unsubscribe(topic)`, `~ws.next(seconds = 2)` (the next `SocketEvent`: `topic`,
     `data`; `null` when none comes in time), `~ws.close()`.
   `body` and `headers` are always named.
2. **`testEnv(NAME = "value")`** in `config.nuc` is the environment the tests run with, set before the app is
   loaded: a test token instead of the user's, written in the project. Only the tests see it.
3. **The same Nuclear for every dialect**: `fastapi` builds the app again for each test from `app/main.py`'s
   `create()` (HTTP through httpx's ASGI transport, the socket as an ASGI connection in the test's event loop) and
   sets `testEnv` in `tests/conftest.py`; `nestjs` listens on a free port of `127.0.0.1` (`fetch`, `ws`) and imports
   `src/test_env.ts` before the tests (`node --import`).

## Options considered
1. A test client per dialect (pytest's `TestClient`, supertest): the target's library in the project's tests.
2. The token read in the test from the environment of the shell that runs it: a test that passes only on one
   machine, or with the user's real token.
3. Guards turned off in tests: the tests would not prove the guards.

## Consequences
- Positive: a project proves its guards, its socket and its pushed events in its own tests, in every dialect.
- Negative: `fastapi` builds the app once per `appClient()` call's first use; `nestjs` opens a port per test that
  uses it.

## References
- Spec 014 (`docs/04-specs/014-synapsis-real-time-and-embedded/` at the root), T5.
- The reference: `platforms/backend/docs/07-reference/backend.md` §2.14.
