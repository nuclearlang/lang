---
status: accepted
date: 2026-11-18
deciders: Julian Molina
---
# ADR-0007: A backend's guards check the headers of every request, of the app or of a controller, over every transport

## Context and problem
A `backend` had no way to refuse a request before its route ran. Nuclear Chat (spec 013) is a local service that
starts commands (its responders): served without a check, any page the user opens in a browser could call it
(`fetch("http://127.0.0.1:…")`), and any local process could too. What it needs is common to every service of the
platform: a shared secret that only the host knows, and no request from a web page. The check must be written once
in Nuclear for every dialect (root rules 2 to 4) and hold over every transport the app serves (ADR-synapsis-0008).

## Decision
1. **A guard is a value of the configuration**, like a connection: `guards: Guard[] = [...]` in the `appConfig`
   checks every route of the app (and the upgrade of its WebSocket); `@controller("x", guards = [...])` adds the
   guards of one controller, checked after the app's. They run in order; the first that refuses answers.
2. **Two guards of the platform**:
   - `Token(value, header = "Authorization")`: the request carries `value` in `header`; in `Authorization` it is
     `Bearer <value>`. A missing or different token answers **401**. An empty `value` (an unset environment
     variable, `env("TOKEN")`) refuses every request: a guard never opens by mistake. Compared in constant time.
   - `NoOrigin()`: a request with an `Origin` header answers **403**. Browsers send it on every cross-origin request
     and on every WebSocket; a host (an editor's extension, a script) does not.
3. **Headers only.** A guard never reads the query: a token in a URL reaches access logs, proxies and the history.
   A client that cannot set headers (a browser's `WebSocket`) reaches a guarded app through a host (ADR-synapsis-0009).
4. **The same over HTTP and WebSockets.** The upgrade passes the app's guards; each request over the socket goes
   through the app as an HTTP request with the upgrade's headers and its own, so a controller's guards answer the
   same status over both.
5. **A guarded app shows no documentation pages** it did not ask for, and its contract routes (`/.nuclear/…`)
   pass the same guards.
6. **The contract says it** (ADR-synapsis-0006): `guards` at the top (the app's) and in each controller (its own),
   as `{"guard": "token", "header": "X-Token"}` or `{"guard": "noOrigin"}`; a token's value is never written.

What each dialect emits: `fastapi`, a FastAPI dependency on every router (`synapsis.guards`, `synapsis.web`);
`nestjs`, a global Nest guard and `@guardedBy([...])` on a controller (`synapsis-nest`'s `guards.ts`).

## Options considered
1. A `guard` kind with a `canActivate(request)` method written by the project (the mobile and web word): more
   general, but every service would write the same token check, and a request type would enter the platform.
   Kept for later, when a check needs more than headers.
2. A guard as a decorator (`@token("X-Token")`): the token's value comes from the environment at run time, and a
   decorator's arguments are not the configuration; the configuration already holds the app's other secrets.
3. The token in a query parameter, as some WebSocket APIs do: refused (point 3).

## Consequences
- Positive: one line of config guards a whole app over both transports; the same Nuclear for every dialect; the
  editors' tools know which header to send from the contract.
- Negative: a browser cannot open a guarded app's WebSocket by itself (by design: it goes through a host); checks
  that need more than headers wait for a guard kind.

## References
- Spec 014 (`docs/04-specs/014-synapsis-real-time-and-embedded/` at the root), requirement 5.
- The platform's reference: `platforms/backend/docs/07-reference/backend.md` §2.8.
