---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [prd.md, ../03-adr/README.md, ../04-specs/README.md]
---
# Roadmap

The pending work of the framework as a whole. What one platform lacks is in that platform's roadmap
(`platforms/<platform>/docs/01-product/roadmap.md`); what the `dragonfly` command lacks is in `tools/cli/`. A done
item is deleted. Paths start at the root of the tree.

## Half done

- **Kind packages (ADR-synapsis-0004).** Left: `nuclear dialect test` over a kind package and `dragonfly add <git
  url>` with a pinned version (`nuclearlang/docs/04-specs/002-dialects-with-agents/plan.md`, D1 and D6); a
  platform-level list of library extensions in `platform.toml` (today a dialect may add `[library.<base>]` members
  freely).
- **Shared contracts (ADR-synapsis-0006; `nuclear-synapsis-framework/docs/04-specs/003-shared-contracts/plan.md`).**
  Left: a drift warning by version (F5 of the plan), and the aliases of `nuclear contracts` in the `dragonfly`
  command (the `cli/` crate).

## Untested

- Shared contracts: `nuclear contracts update` against a deployed API (`curl`, `/.nuclear/contract.json` served by
  the runtimes: only the files on disk were checked).

## To decide with the user

- **Logs:** done (ADR-mobile-0005; the mobile platform's documents on its runtime). To decide: log navigation, events
  and use case duration automatically; async errors outside Flutter (no `PlatformDispatcher.onError` today: they
  do not go through `Log`); an own file output (today via `Log.sink`); `@log` on use cases?
- **TDD:** undefined; today there are tests in Nuclear and generated tests. Ideas: widget golden tests
  (`matchesGoldenFile`), accessibility (`meetsGuideline`), performance in integration.
- **Linter:** done (ADR-synapsis-0003; the mobile platform's documents on its project). To decide: all rules are
  errors today: any as a warning? disable a rule per file or declaration? new rules (e.g. domain without imports
  from `data/`)?
- What is mandatory in `main.nuc`, and mandatory file names (`_usecase`, `_repository`).

## Pending

- **Language independence (ADR-synapsis-0001):** `[toolchain]` in the dialect, and dialects installable from a
  repository (`nuclearlang/docs/04-specs/002-dialects-with-agents/plan.md`, D5–D6); the neutral reference of the mobile
  platform waits for a second mobile dialect
  (`nuclear-synapsis-framework/platforms/mobile/docs/07-reference/mobile.md` §5).
- **Shared contracts, limits (ADR-synapsis-0006):**
  - the generated repository names (`TasksRepository`) and models are top-level names: a clash with the app's own
    or between two contracts is N0303 (a prefix is a one-line change in `contract::generate`);
  - a route answering a generic (`Page<Task>`) is generated but not stored locally;
  - the client error has `message` only;
  - a stale url copy is not a warning yet (F5 of the plan);
  - a url contract needs `curl`;
  - a web client gets no rules or key until the web platform has forms and the local database;
  - the HTTP view of the editors resolves `{{baseUrl}}` per project or connection only from the environment file
    (the app's `Http(baseUrl)` is not in the contract yet).
- **A real reference app shipped** (step 2 of the competitiveness plan the user chose): one complete app on
  Android, iOS and web with a fastapi backend deployed, built from the tutorial on a clean machine. It burns down
  the untested lists (device, hot reload, debugging, the local database on disk, Postgres, Redis, Kafka and OpenAI
  for real), and the bugs it finds are fixed.
- **Prove the thesis with numbers** (step 7 of the same plan): the hard agent evaluation
  (`tools/cli/docs/04-specs/001-agent-support/plan.md`, F7: an app from scratch, backend and mobile) and benchmarks
  of the generated code against hand-written Flutter, NestJS and FastAPI, published. The system is done
  (`nuclear-synapsis-framework/eval/thesis/`, its README step by step); the bench ran (thesis B holds, C does not
  on two CPU programs); the agent arms (thesis A) wait for the user's go (paid: about USD 100 for 3 repeats).
- A 30-minute validated tutorial and comparison tables.
