---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [../04-specs/004-backend-parity/plan.md, ../03-adr/0001-backend-data.md]
---
# Roadmap

The pending work of the backend platform, its contract and its runtime packages. A done item is deleted. What is
pending in how one dialect writes its target is in that dialect's project; what is pending in the framework's
commands of `nuclear` is in [the command line tools](../../../../../tools/cli/AGENTS.md).

## Half done

- **Backend parity** (step 4 of the competitiveness plan;
  [spec 004](../04-specs/004-backend-parity/plan.md)). In place, in both dialects
  ([ADR-backend-0001](../03-adr/0001-backend-data.md)): `@primary(generated)`, the relations with
  `relations(...)`, `paginate` → `Page<T>` (also on the mobile local tables), `@transactional`, and the migrations
  (`nuclear migrate`), the header guards `Token` and `NoOrigin` (ADR-synapsis-0007). Left: auth (users,
sessions, a guard kind for checks beyond headers), background jobs, file uploads, a Dockerfile,
  observability (below). `nuclear make` / `check` / `watch` for backend projects belong to the command.

- **Telemetry** ([spec 012](../../../../../docs/04-specs/012-observability/tasks.md)). Done in `fastapi`: the plugin
  `telemetry`, the connections `Datadog`, `NewRelic`, `Grafana`, `Otlp`, `Metric`, the spans of requests and use
  cases, `@untraced`, `sample`. Left: `nestjs` (it consumes `@untraced` but does not bring the plugin yet: a loader
  warning), the spans of queries, outgoing HTTP, listeners and agents, `Log` sent with the trace.

- **The app's WebSocket** (ADR-synapsis-0008). Done in both dialects: `WebSocketServer`, the frames, `publish` to the
  subscribed. Left: with Kafka a socket receives only what its own process publishes (several instances need the
  events consumed for the sockets: a `shortcut:` comment in both `events` modules); topics with wildcards; the
  OpenAPI document does not list the guards' headers (the contract does).

## Untested

- An HTTP repository in a project's tests: an `Http` connection takes no fake transport and `nuclear test` starts no
  stub server, so a use case that calls another API is tested only on models built by hand (found in Nuclear
  Chat's Tenor and Giphy searches, 2026-11-18).

- **Telemetry against the real vendors** (spec 012; left for later by the user, 2026-11-18). Only in-memory exporters
  and a refused local port ran. To do, with `rick_api` and `plugins(telemetry = true)`:
  1. `Otlp(url = "http://localhost:4318")` against a local collector (Grafana Alloy or Jaeger): the request and use
     case spans arrive, one trace per request, `@untraced` routes absent, `sample` respected.
  2. `Datadog(apiKey = env("DD_API_KEY"))` through the Agent with its OTLP receiver on, and without an Agent through
     the OTLP intake of the account's site: traces and delta metrics in APM.
  3. `NewRelic(licenseKey = env("NEW_RELIC_LICENSE_KEY"), region = "us")` and `region = "eu"`.
  4. `Grafana(url, instanceId, token)` against a Grafana Cloud stack's OTLP gateway: traces in Tempo, metrics in
     Mimir.
  5. The app stopping with the destination down (today the exporter retries for about ten seconds).
- The migrations (ADR-backend-0001) against PostgreSQL, MySQL and MariaDB: only SQLite ran.
- `nuclear migrate` on Windows (`cmd /C` quoting).

## To decide with the user

- The first provider of authentication: JWT only, or also sessions with cookies for web clients
  ([spec 004](../04-specs/004-backend-parity/plan.md) §5).

## Pending

- **Found writing the skills library (2026-11-18)**: no users with password hashing or JWT auth; no multipart upload; no background jobs; no documented way to read a raw request body or headers (webhook signatures); no `graph` make-kind. `@status` is in the reference but undocumented for fastapi, and the reference says 400 for an invalid body where fastapi answers 422.
- **The listeners of one test receive the events of the next** (synapsis-py): `testing.running` resets the injector
  but not `events._listeners`, so each test adds one more instance of every listener and a published event reaches
  all of them (Nuclear Chat's members answered five times in its fifth test, 2026-11-18; its responders now ignore a
  message they are already answering). Wanted: `running` forgets the listeners it did not make, in both runtimes.

- **No CORS**: a web app on another origin cannot call a backend (the browser blocks it); the platform has no word to
  allow the origins of its clients. Found building the onboardings (2026-11-16): `todos_web` reads a public API for
  that reason.
- **A repository whose name implies an entity nobody declares compiles** (found by a rename, ADR-developer-0001). With
  `Supplier` renamed to `Vendor` and `SupplierRepository` left, `nuclear check .` reports nothing and the generated
  Python fails when imported (`NameError: name 'Supplier' is not defined`). The repository kind takes its entity
  from its own name: the compiler should report a `<Name>Repository` without a declared `<Name>` (a diagnostic of
  the platform's contract, both dialects). The rename tool renames the names built from the old one, so it no
  longer leaves one.
- **`@acl` and sessions**, as the mobile platform has them (Flutter); a `guard` kind for checks beyond headers.
- **Limits of the data words** (ADR-backend-0001):
  - the join table's name is always `<owner table>_<field>` (no custom name);
  - `@transactional` uses the default database only (nestjs: the database of the last repository made, a
    `shortcut:` comment in `packages/synapsis-nest/src/repository.ts`);
  - the members of `Page<T>` are untyped in Nuclear (type definitions carry no member types:
    `items: Task[] = page.items`);
  - pyright over `packages/synapsis-py/src` shows 4 errors (`events.py`, the `Select` typing of
    `repository.py`).
- **Publish `synapsis-py`** on PyPI: the generated `pyproject.toml` asks for `synapsis-py` by name.
- **Publish `synapsis-nest`** on npm: the generated `package.json` asks for it by name.
- The user's project `~/Documents/projects/nuc/python/nuclear_langgraph_agent` still writes `@generated()` in
  `components/tasks/data/entities/task.nuc`: it is N0309 now; the fix is `@primary(generated = true)` (not changed:
  it is the user's project).
