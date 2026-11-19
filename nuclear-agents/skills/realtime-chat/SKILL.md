---
name: realtime-chat
description: Build chat and real-time features in a Synapsis product over the app's WebSocket: messages, rooms, ordering, delivery and read receipts, presence, typing and reconnects. Use when users message each other or a screen must update the moment the backend changes.
title: Chat and real time over WebSockets
title_es: Chat y tiempo real con WebSockets
description_es: Construir chat y funciones en tiempo real en un producto Synapsis sobre el WebSocket de la app: mensajes, salas, orden, confirmaciones de entrega y lectura, presencia, escribiendo y reconexiones. Úsalo cuando los usuarios se escriben o una pantalla debe actualizarse en cuanto cambia el backend.
kind: domain
tags: [chat, realtime, websocket, messaging, presence, receipts, live updates, rooms]
---
# Chat and real time over WebSockets

## When to use

Direct and group messages, a support chat, live dashboards, a list that updates as rows are created.

## What the platform has (ADR-synapsis-0008)

- **Backend**: `WebSocketServer(path = "ws")` in the connections (plugins `websocket` and `events`). The app answers
  its same controllers over one socket and pushes what it publishes: `~publish("topic", value)` reaches the
  clients subscribed to the topic. Frames: requests `{"id", "method", "path", "headers", "body"}`, answers
  `{"id", "status", "body"}`, `{"subscribe": topic}`, `{"event": topic, "data"}`. The upgrade passes the app's
  guards.
- **Web**: `WebSocket(url, headers, timeout, interceptors)` connection; repositories bound to it work as they are;
  a method without a body with `@on("topic")` returning `Stream<T>` receives pushes (the topic may use the method's
  parameters). The socket reconnects with growing waits and subscribes again by itself. Example:
  `nuclear help example/tasks_live`.
- **Mobile**: `WebSocket(connectionName, uri, headers, protocols, pingInterval, interceptors)`; it uses `dart:io`
  and does not work on the web build.
- **Tests**: `appClient()` and `~app.socket("/ws", headers = ...)` with `subscribe`, `request`, `next`, `close`.
- **Limits** (backend roadmap): with Kafka a socket gets only what its own process publishes, so several instances
  need the events fanned out; no wildcard topics.

## Steps

1. **Messages are data first.** `nuclear gen resource chat Message --source db --fields "..."`: `id`, `roomId`,
   `senderId`, `clientId` (a UUID made by the sender, unique per sender: dedupe on retry), `body` (`@maxLength`),
   `seq: int` (per room, given by the server), `createdAt`, `editedAt?`, `deletedAt?`. Plus `Room`
   (`id`, `kind`: direct | group) and `Membership` (`roomId`, `userId`, `role`, `lastReadSeq`, `lastDeliveredSeq`).
2. **Send over the socket as a normal request** (`POST rooms/{id}/messages`). The use case (`@transactional`)
   checks membership, assigns the next `seq` for the room, saves, then `~publish("rooms.${roomId}", message)`.
   A repeated `clientId` answers the stored message.
3. **Ordering**: clients sort by `seq`, never by their clock. A gap in `seq` means missed messages: fetch them
   with `GET rooms/{id}/messages?afterSeq=<n>`.
4. **Reconnect**: after the socket comes back (web does it by itself), fetch everything after the last `seq` seen,
   then rely on pushes again. Messages typed while offline stay `sending` and are retried with their `clientId`.
5. **Receipts**: the client reports `delivered` and `read` up to a `seq` (one request, not one per message); the
   server stores `lastDeliveredSeq`/`lastReadSeq` and publishes a small receipt event to the room.
6. **Presence and typing** are ephemeral: keep them in memory or Redis (`~cacheSet(key, value, seconds = 30)`),
   refreshed by a heartbeat; publish changes, throttle typing events (one per 3 s), never store them in tables.
7. **Authorization**: a topic per room; subscribe only after checking membership, and check it again on every
   send. Do not put private data in a topic everyone can subscribe to.
8. **History**: paginate backwards by `seq` (`where({ "seq": lt(before) })`, `orderBy("seq", desc = true)`,
   `limit(50)`); index `(roomId, seq)`.
9. **Moderation and limits**: rate-limit sends per user, cap message size, soft-delete (`deletedAt`) so receipts and
   order stay consistent.

## The platform's tools

- `plugins(events = true, websocket = true)` in `config.nuc`; `WebSocketServer(path = "ws")` in `appConfig`.
- `nuclear gen resource chat Message --source db --fields "roomId:int senderId:int clientId:string body:string seq:int"`
- `nuclear gen usecase chat SendMessage --route "POST rooms/{id}/messages"`
- `nuclear make listener chat RoomEvents` (backend), `nuclear gen resource chat Message --from-json <sample> --screen room` (web, mobile).
- `nuclear test` with `appClient()` sockets; `nuclear run` and two browser tabs for a manual check.

## Pitfalls

- Ordering by `createdAt` from the client's clock; two messages with the same timestamp.
- Trusting a socket message to say who the sender is: take it from the guarded request.
- Missing messages after a reconnect because the client only listens for new pushes.
- Several backend instances with Kafka: pushes reach only the clients of the publishing process.
- Storing typing and presence in the database (write storms).
- Using mobile `WebSocket` in a Flutter web build.

## Checklist

- [ ] Messages have a server `seq` per room and a sender `clientId`; a retried send stores one message.
- [ ] Membership is checked on subscribe and on every send; a test with a non-member gets 403.
- [ ] After a reconnect the client fetches `afterSeq` and shows no gap or duplicate.
- [ ] Receipts are batched up to a `seq`; typing is throttled; presence expires.
- [ ] A socket test (`~app.socket`, `subscribe`, `next`) sees the pushed message.
- [ ] `nuclear check .` reports 0 errors and `nuclear test` is green.
