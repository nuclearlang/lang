---
name: performance-load
description: Find and fix slowness in a Synapsis product with Nuclear Monitor (nuclear run --monitor, nuclear monitor): hot spots, N+1 queries, async calls in a loop, pagination, caching, and a load-testing approach. Use when something is slow, before a launch, or when asked about performance.
title: Performance and load
title_es: Rendimiento y carga
description_es: Encontrar y corregir la lentitud en un producto Synapsis con Nuclear Monitor (nuclear run --monitor, nuclear build --monitor, nuclear monitor): puntos calientes, consultas N+1, llamadas asíncronas en un bucle, paginación, caché y un enfoque de pruebas de carga. Úsalo cuando algo va lento, antes de un lanzamiento o cuando se pregunta por el rendimiento.
kind: practice
tags: [performance, load testing, monitor, n+1, pagination, cache, latency, profiling]
---
# Performance and load

## When to use

A route or screen is slow, a launch is near, or memory grows. Measure first, change one thing, measure again. Read
`nuclear help monitor`.

## Steps

1. **Measure.** A backend: `nuclear run --monitor`. Another program: `nuclear build --monitor` and run it your usual
   way. Use it: call the slow routes, open the slow screens. The report lands in `.nuclear/monitor/report.json`.
2. **Read the hot spots**: `nuclear monitor` (or `--json`; in VS Code *Nuclear: Open Monitor*; MCP
   `project_monitor`):
   - `slow`: its own time is a fifth or more of the whole call;
   - `async calls in a loop`: five or more awaited calls one after another inside one call;
   - `many connections`: ten or more new connections per call;
   - `much memory`: 10 MB or more grown per call.
3. **Fix the cause in Nuclear**, by hot spot:
   - **async calls in a loop** → start them together: `~awaitAll([a(), b()])`; on a list of ids, one repository query
     with the `oneOf` filter of `where` (`nuclear help backend` §2.2) instead of one `find` per id;
   - **N+1 over relations** → load them in the same query with `relations("tasks")`; an unloaded relation is never a
     hidden query, so a loop that fetches each one is yours to remove;
   - **big lists** → `paginate(page, size)` (`Page<T>`) instead of `findAll()`; `limit` on feeds;
   - **slow filters or sorts** → `@column(index = true)` on the column, then `nuclear migrate make "index ..."`;
   - **repeated reads** → backend `plugins(redis = true)` with `~cacheGet(key)` / `~cacheSet(key, value, seconds =
     60)`; mobile and web repositories `@get(cache = true, ttl = ...)`;
   - **many connections** → connections belong to the configuration (opened once at start), never made per call;
   - **slow work in a request** → publish an event and do it in a `listener`.
4. **Measure again** with the same steps; keep the change only if the hot spot shrank.
5. **Build again without `--monitor`** before shipping: the monitor is for finding problems, not for production.
6. **Load test** (the platform has no load tool): run the built app (`nuclear build`, `nuclear install`,
   `nuclear run`, without the monitor) against a database with realistic volume, and drive it with an external
   HTTP load generator from outside the project. Record latency percentiles and errors per route; then run one
   monitored pass at moderate load to see where time goes.
7. **Production view**: `plugins(telemetry = true)` with `Otlp(url)`, `Datadog`, `NewRelic` or `Grafana` traces every
   request and use case (fastapi today; nestjs is on the roadmap).

## The platform's tools

- `nuclear run --monitor`, `nuclear build --monitor`, `nuclear monitor [--json]`.
- MCP `project_monitor`, `graph_monitor` (keeps the hot spots for later sessions).
- Query words: `paginate`, `limit`, `relations`, `count`, `exists` (cheaper than loading rows).

## Pitfalls

- Optimising without a measurement, or measuring a build with the monitor and shipping it.
- A save in the editor rebuilds without the monitor: measure, then edit.
- A phone or browser tab cannot write the report to the project folder yet (roadmap): measure the backend, or a
  desktop run.
- `exists()` and `count()` replaced by loading every row and checking the list's length.
- Load testing against SQLite in a temp file and concluding about PostgreSQL.
- Caching data that must be fresh (balances, stock) without an expiry or an invalidation.

## Checklist

- [ ] A monitored run before and after the change, with the hot spot named.
- [ ] No `async calls in a loop` or `many connections` hot spot left on the changed path.
- [ ] Lists that grow are paginated; relations used in a loop are loaded with `relations(...)`.
- [ ] Filtered and sorted columns on large tables are indexed, with a migration.
- [ ] The shipped build has no `--monitor`.
- [ ] `nuclear check . --json` prints `[]` and `nuclear test` is green after the change.
