---
status: accepted
date: 2026-11-18
deciders: Julian Molina
---
# ADR-0008: WebSockets are a connection of the configuration; the repository's adapter carries its calls over it

## Context and problem
Synapsis had no real time: a `backend` answered requests and could not push, a `web` app could only ask. Nuclear
Chat (spec 013) needs both, and so does any product with live data. The user decided (2026-11-18) that real time
follows the framework's rules: **it is configuration, not code**. A repository, a use case and a screen are the
same whether their calls travel over HTTP or over a WebSocket; switching is one line of the configuration.

## Decision
1. **One protocol of frames**, JSON text, the same for every dialect and for the host's bridge
   (ADR-synapsis-0009):
   - client → app: `{"id": 1, "method": "GET", "path": "/tasks/1?x=1", "headers": {...}, "body": ...}`,
     `{"subscribe": "tasks.created"}`, `{"unsubscribe": "tasks.created"}`;
   - app → client: `{"id": 1, "status": 200, "body": ...}` (the HTTP answer of that request),
     `{"event": "tasks.created", "data": ...}` (an event published by the app).
2. **The server side** (`backend`): `WebSocketServer(path = "ws")` in the `connections` of the `appConfig`
   (plugin `websocket`, which needs `events`) serves the **same controllers** over one socket at `/ws`. The
   upgrade passes the app's guards (ADR-synapsis-0007); each request frame goes through the app as an HTTP request
   (its headers are the upgrade's plus the frame's), so validation, `Result` answers and a controller's guards are
   the HTTP ones. `~publish("topic", value)`, the platform's word for events, also sends the event to every
   client subscribed to that topic. No controller changes.
3. **The client side** (`web`): `WebSocket(url, headers, timeout, interceptors)` is a connection beside `Http`,
   with the same options. A `repository` is written as it is today (`@repository(path)`, `@get`, `@post`...); an
   adapter under it carries each call over the connection the repository is bound to (`connection = "name"`, or
   the default one), runs the connection's interceptors and reads the answer the same way. Changing a repository
   from HTTP to WebSockets is changing `Http(...)` to `WebSocket(...)` in the configuration. The socket opens on
   the first call, reconnects by itself (with growing waits) and subscribes again to what it was subscribed to; a
   call during a reconnection fails like a network failure, which the repository's retries already cover.
4. **What is pushed is a repository method**: `@on("tasks.created")` on a method without a body that returns
   `Stream<T>` (`T` a model, read with `fromJson`, or a map). `Stream<T>` is the platform's type of values that
   arrive (`listen((value) => ...)` gives back the function that stops listening). A use case may return a
   `Stream` (the facade passes it on); a `statemanager` listens with `listen(stream, (value) => ...)`, stopped
   when its screen leaves. A connection that cannot push (`Http`) answers `listen` with an error.
5. **The contract says it** (ADR-synapsis-0006): `webSocket` (the path, or `null`), `transports` in each
   controller (`["http"]` or `["http", "websocket"]`), and `events`: each topic the app publishes, with the
   `component` that publishes it and its `payload` (the model built in place, a typed parameter, or `<string,
   any>` with the map's `fields`).

What each dialect emits: `fastapi`, `synapsis.sockets.WebSocketServer` (Starlette's WebSocket, the requests through
the app with httpx's ASGI transport); `nestjs`, `synapsis-nest/sockets` (`ws` on the app's HTTP server, the
requests through the app over the loopback); `react`, `synapsis-web`'s `WebSocket`, `Transport` and `Stream`.

## Options considered
1. Server-sent events and a stream route (`@stream`): one more way to write a route, push only, and the client's
   calls would still need HTTP; refused by the user in favour of configuration.
2. Socket.IO or a framework's gateway (NestJS gateways, FastAPI's own routes): a second way to write the API, and
   a dialect's library in the platform.
3. Topics with wildcards (`tasks.*`): not needed yet; a client subscribes to each topic it shows.

## Consequences
- Positive: the same Nuclear over HTTP and WebSockets in every dialect; real time costs one config line on each
  side; the editors' HTTP tool reads the transports and the events from the contract.
- Negative: with Kafka, a socket receives only what its own process publishes (a cluster of instances needs the
  events consumed for the sockets: roadmap); a browser cannot send headers on a WebSocket, so a guarded app's
  socket is reached through a host.

## References
- Spec 014 (`docs/04-specs/014-synapsis-real-time-and-embedded/` at the root), requirements 1, 2 and 4.
- The references: `platforms/backend/docs/07-reference/backend.md` §2.8 and §2.9, `platforms/web/docs/07-reference/web.md` §3.2, §3.3 and §3.5.
