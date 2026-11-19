---
status: approved
owner: Julian Molina
updated: 2026-11-18
related: [requirements.md]
---
# Spec 014 — Tasks

- [x] T1 ADRs in `nuclear-synapsis-framework` (WebSockets as a connection of `config`, the repository's adapter;
      the embedded mode of `web`; the guards), with the design: the config words, what each dialect emits, the runtime
      packages.
- [x] T2 `backend`: the WebSocket transport from config with the same controllers, and the publishing, in `fastapi` and `nestjs`; the reference, the equivalences
      (`spec-check` 0 problems), an example, the platform's checks.
- [x] T2b `backend` guards: a token from a header on every route of a controller or the app, `Origin` refused; both
      dialects; reference, equivalences, example, checks. The WebSocket transport uses them.
- [x] T3 `web`: the WebSocket connection in `appConfig`, the repository's adapter (HTTP or WebSockets by config, a
      stream method for what is pushed); the embedded build (`mount`, in-memory router, scoped styles, host's theme,
      the bridge); `react` first, then every `web` dialect the platform has; the reference, an example, the checks.
- [x] T4 `nuclear new`/`gen` for both; the guides; the knowledge base follows.
- [x] T5 A backend's tests call the app over HTTP and its WebSocket (`appClient()`, `testEnv(...)`,
      ADR-synapsis-0010), both dialects; `tasks_api` and Nuclear Chat's service test their guards and socket.
