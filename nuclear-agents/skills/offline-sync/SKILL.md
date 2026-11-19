---
name: offline-sync
description: Build offline-first sync in a Synapsis mobile app: the encrypted local database, saveLocal and AsLocal reads, a queue of pending changes, conflict rules, retries and network state. Use when an app must work without network and reconcile its changes with the backend later.
title: Offline-first sync
title_es: Sincronización offline primero
description_es: Construir sincronización offline primero en una app móvil Synapsis: base de datos local cifrada, saveLocal y AsLocal, cola de cambios pendientes, conflictos, reintentos y red. Úsalo cuando una app debe funcionar sin red y conciliar sus cambios con el backend después.
kind: domain
tags: [offline, sync, local database, queue, conflicts, mobile, retries, network]
---
# Offline-first sync

## When to use

The app must read and write without a connection (field work, travel, bad coverage) and send its changes when the
network returns. Read-only caching alone is lighter: `@get(cache = true, ttl = ...)`.

## What the platform has

- **The local database** (ADR-mobile-0006): a model with `@primary` has a local table, encrypted by default
  (`LocalDatabase(encrypted = true)` in `appConfig` or a component's `config`). `local<Model>()` gives
  `find`, `findAll`, `save`, `saveAll`, `remove`, `clear` and the backend's queries (`where`, `orderBy`,
  `limit`, `paginate`, `count`, `exists`, `update`, `delete`).
- `@repository(saveLocal = true)` (or `@get(local = true)`) keeps what each GET answered and gives
  `<method>AsLocal()`, the same answer from the device without a request.
- `NetworkManager()` in `globals`, `@requires(internet = true)` on a use case, `HttpError.offline`,
  `NetworkWrapper(offline = ...)` in the app's builder, `@offline` on a test group.
- Retries: GET, PUT and DELETE retry transient failures twice; POST and PATCH only with `retry = n`.
- **Not in the platform**: a sync queue, conflict resolution, background sync. They are built as below. The web
  platform has no local database yet.

## Steps

1. **Pick what works offline**, per screen: read-only (cached rows), or read-write (queued changes). Keep the set
   small: each offline-writable model costs a queue and conflict rules.
2. **Give every row a client id**: `@primary` `id: string`, a UUID made on the device, so a row created offline
   has its final id before the server sees it. Add `version: int` (or `updatedAt` from the server) and
   `deleted: boolean` (a tombstone instead of removing it).
3. **Reads**: the repository with `saveLocal = true`; the use case calls the request and, on `HttpError.offline`
   or `Err`, falls back to `<method>AsLocal()`. The screen shows that the data may be stale (last synced time).
4. **Writes**: the use case writes the row to the local table **and** an entry to a `PendingChange` table
   (`id`, `entity`, `entityId`, `operation`: `create` | `update` | `delete`, `payload`, `baseVersion`,
   `attempts`, `createdAt`), in that order, then returns `Ok` at once. The UI reads the local table.
5. **The sync**: a global `component` with `@on(...)` (an event published when the network returns, on start, and
   by a pull-to-refresh) sends the pending changes **in order**, one at a time or in a batch endpoint, each with
   an idempotency key (the change's id) so a retry after a timeout does not duplicate it. On success, delete the
   entry and store the server's version; on a transient failure stop and retry later with growing waits; on a
   permanent 4xx mark it failed and show it to the user.
6. **Conflicts**: the backend compares `baseVersion` with the row's version and answers 409 when they differ.
   Choose per model and write it down: last-writer-wins (simple, loses data), server-wins (the device takes the
   server's row), field-level merge, or ask the user. Never resolve silently for money or legal data.
7. **Pull**: `GET <resource>?since=<cursor>` returns rows changed after the cursor, tombstones included; save them
   with `saveAll`, then store the new cursor. Pull after pushing.
8. **Session end**: `~session.destroy()` empties the response cache; clear the local tables of personal data too
   (`local<Model>().clear()`), after warning if pending changes would be lost.

## The platform's tools

- `nuclear gen resource tasks Task --from-json <sample>` then set `saveLocal = true` on its `@repository`.
- `nuclear make model tasks PendingChange`, `nuclear make global sync` (a global component and its event).
- `nuclear gen usecase tasks SyncTasks` to wire a hand-written use case into the facade.
- Backend: `nuclear gen usecase tasks ApplyChanges --route "POST tasks/sync"` with `@transactional`.
- `nuclear test` with `@offline` groups; `nuclear device` or `nuclear run` and airplane mode for a manual check.

## Pitfalls

- Server-generated ids for offline creates: the app cannot reference the row until it syncs.
- Hard deletes: the other devices never learn the row is gone. Use tombstones and purge later.
- Sending changes out of order (an update before its create).
- Retrying a POST without an idempotency key: duplicates.
- Clock skew: never decide conflicts with the device's clock; use server versions.
- Changing `encrypted` after the first run: the tables must be cleared (a table is read with its cipher).
- `WebSocket` on mobile uses `dart:io` and does not work on the web build.

## Checklist

- [ ] Offline-writable models have client UUIDs, a version and a tombstone field.
- [ ] Every write goes to the local table and the pending queue; the UI reads the local table.
- [ ] A test group with `@offline` creates, edits and deletes, then syncs with the network back.
- [ ] Each queued change carries an idempotency key; a retried change is applied once on the backend.
- [ ] A 409 follows the conflict rule written for that model; a test covers it.
- [ ] Logout clears personal local data; `nuclear check .` reports 0 errors; `nuclear test` is green.
