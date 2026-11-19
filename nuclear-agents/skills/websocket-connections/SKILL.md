---
name: websocket-connections
description: Add real time to a Synapsis product with the platform's WebSocket: a backend's WebSocketServer and its pushed events, a web app's WebSocket connection and Stream repositories. Use when data must be pushed to clients as it changes (live lists, notifications, chat).
title: WebSocket connections
title_es: Conexiones WebSocket
description_es: Añadir tiempo real a un producto Synapsis con el WebSocket de la plataforma: el WebSocketServer de un backend y sus eventos empujados, la conexión WebSocket de una app web y repositorios Stream. Úsalo cuando los datos deben llegar a los clientes en cuanto cambian (listas en vivo, avisos, chat).
kind: technology
tags: [websocket, realtime, live, push, events, stream, subscribe, socket]
---
# WebSocket connections

## When to use

A client must see a change without asking again: a list that grows live, a notification, a chat. The platform's
WebSocket (ADR-synapsis-0008) carries the same controllers as HTTP plus the events the backend publishes; nothing
else changes in the project. Read `nuclear help backend` §2.9 and `nuclear help web` §3.2–3.3 first.

## Steps

1. **The backend.** A new one: `nuclear new <name> -p backend --websocket [--token <ENV_VAR>]` writes
   `plugins(sqlite = true, events = true, websocket = true)`, `WebSocketServer(path = "ws")` in
   `config/project_config.nuc` and, with `--token`, the guards `NoOrigin()` and `Token(value = env("<ENV_VAR>"))`.
   An existing one: enable `websocket` (it needs `events`) in `plugins(...)` and add `WebSocketServer(path = "ws")`
   to the `appConfig` connections; `nuclear check . --json` says what is missing (N0304).
2. **Publish what changed.** In the use case that makes the change, `~publish("tasks.created", { "id": task.id,
   "title": task.title })`. Every client subscribed to the topic gets `{"event": "tasks.created", "data": ...}`.
   A `listener` with `@consumer("topic")` receives it inside the backend too.
3. **The web app.** A new one: `nuclear new <name> -p web --websocket` writes a `WebSocket(url = ..., timeout =
   5000)` connection. An existing one: replace its `Http(...)` by `WebSocket(url = "ws://<host>:<port>/ws")`: the
   repositories stay as they are and their calls travel over the socket.
4. **Listen to a topic.** Add to the repository a method without a body: `@on("tasks.created") created()
   Stream<TaskCreated>` (and the model `TaskCreated` with `nuclear make model <component> TaskCreated`). Then
   `nuclear gen usecase tasks WatchCreatedTasks --calls TaskRepository.created` writes the use case that passes the
   stream on, and its alias.
5. **Show it.** In the state manager, `listen(tasks.watchCreatedTasks(), (created) => load())`: it runs until the
   screen leaves. Read the whole example: `nuclear help example/tasks_live` (and its backend,
   `nuclear help example/tasks_api`).
6. **Test the socket** from the backend's tests with `appClient()`: `~app.socket("/ws", headers = ...)`,
   `~ws.subscribe(topic)`, `~ws.request("POST", "/tasks", body = {...})`, `~ws.next()` (the next pushed event or
   `null`), `~ws.close()`. A guarded socket without the token is an `Err` with the guard's status.
7. `nuclear check . --json`, `nuclear test`, then run both apps (`nuclear run` in each) and watch the list change.

## The platform's tools

- Frames (JSON text): request `{"id", "method", "path", "headers", "body"}`, answer `{"id", "status", "body"}`,
  `{"subscribe": "topic"}` / `{"unsubscribe": "topic"}`, pushed `{"event", "data"}`.
- The contract lists each controller's `transports`, the `webSocket` path and the `events` published.
- A topic can use the method's parameters: `@on("chat.${workspace}") events(workspace: string) Stream<ChatEvent>`.
- Mounted in a host page, every call and stream goes through `host.bridge` with the same frames.
- Mobile: `WebSocket` is one of the connections of the mobile platform's configuration (`nuclear help mobile`).
- Tests: `appClient()`, `testEnv(NAME = "value")` in `config.nuc` for the test's own token.

## Pitfalls

- A browser sends no headers on the socket's upgrade: a backend whose guards check the upgrade is reached only
  through a host page (the bridge); `headers` of the web connection go with every call, not with the upgrade.
- Listening to an `@on` stream over an `Http` connection is an error: it needs `WebSocket` or the bridge.
- The port differs by dialect: a fastapi app listens on 8000 (the generated URL), the `tasks_live` example points at
  3000. Read the backend's `nuclear run` output.
- With Kafka and several instances, a socket receives only what its own process publishes (roadmap). Topics have no
  wildcards yet.
- A request frame that does not parse closes the socket; the client reconnects with growing waits and subscribes
  again, and a call during the reconnection fails like a network failure (the repository's retries cover it).
- A manager method named `listen` or `subscribe` clashes with the runtime: N0223.

## Checklist

- [ ] `config.nuc` enables `events` and `websocket`; `WebSocketServer(path = ...)` is in the connections.
- [ ] Each change a client must see is published with a stable topic name, documented in the project's docs.
- [ ] The web connection is `WebSocket(...)` and each pushed topic is an `@on` method returning `Stream<T>`.
- [ ] A backend test opens the socket, subscribes, causes the change and receives the event.
- [ ] A guarded socket refuses a client without the token (a test).
- [ ] `nuclear check . --json` prints `[]` in both projects and `nuclear test` is green.
