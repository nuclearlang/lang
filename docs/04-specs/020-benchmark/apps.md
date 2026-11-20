---
status: approved
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, design.md]
---
# Spec 020: The benchmark — The applications

Eight applications, each chosen for what is hard in real software: architecture, concurrency, consistency,
performance, security, realtime, AI, change. Each is a prose specification (`benchmark/apps/<id>/spec.md`), a set of
hidden acceptance tests, a load test where performance matters, and a scoring sheet. The platform each one targets
is the one Nuclear has; the baseline builds the same in the native stack.

| # | App | Platforms | What makes it hard | Tests (hidden) |
|---|---|---|---|---|
| A1 | **Library loans** (warm-up, medium) | backend | a domain with rules: a book is lent once, a member has at most 3 loans, overdue fines by day; validation; pagination; OpenAPI | ~40 HTTP tests: rules, edge dates, 422s, 404s, 409s, pagination bounds |
| A2 | **Auth and multi-tenant SaaS API** | backend | JWT access + refresh rotation, roles (owner, admin, member) per organization, tenant isolation (a member never sees another tenant's rows), password reset by token, rate limit on login, migrations | ~60 tests incl. cross-tenant attacks, expired/replayed refresh tokens, role escalation attempts |
| A3 | **Inventory with concurrency** | backend | stock reservations under concurrent orders (no overselling), idempotency keys, optimistic locking, a background job that releases expired reservations, an event outbox | concurrency tests (100 parallel orders on 10 items: exactly 10 succeed), idempotent retries, job timing |
| A4 | **Realtime team chat** | backend + web | WebSocket rooms, presence, typing, message history with cursor pagination, unread counts, reconnect without losing messages, server-sent events fallback | browser tests with two users, reconnect after a dropped socket, ordering under load |
| A5 | **Offline-first field notes** | mobile + backend | a Flutter app that works offline, a local database, sync when online with conflict resolution (last-writer-wins per field plus a conflict list), photos queued for upload | device-driver tests toggling the network, two devices editing the same note, conflict surfaced |
| A6 | **AI support agent** | backend | a LangGraph/agent with tools (search orders, refund under a limit, escalate), memory per conversation, guardrails (never refund above the limit, never leak another customer's order), streaming answers; a mocked model server so the tests are deterministic | scripted conversations against the mocked model: tool calls made, limits respected, data isolation |
| A7 | **Analytics dashboard with performance budgets** | backend + web | ingest 1M events, aggregate by day/segment, queries under 200 ms p95 (indexes, no N+1, caching), a React dashboard with charts and filters, CSV export streaming | k6 load test (p95 latency, throughput, error rate), query-count assertions, browser tests of filters |
| A8 | **One product, three platforms** (the hardest) | backend + web + mobile | a shared contract (the backend's API consumed by the web and mobile apps), clean architecture in all three, the same features (A2's auth, A1's domain) everywhere, end-to-end flows across them | end-to-end: sign up on mobile, see the data on web; contract tests; each platform's tests |

## The change tasks (H6: maintenance)

Each app above, once passing, gets three change requests in a new run of the same agent and condition, starting
from that run's code:

1. **A feature**: e.g. A1 "reservations: a member can reserve a lent book; the next return assigns it".
2. **A bug**: a seeded defect report ("fines are charged on the return day") the agent must find and fix.
3. **A refactor under constraint**: e.g. "split loans into its own component without changing the API", checked by
   the same tests plus an architecture rule.

## The port task (H7)

The passing A2 (FastAPI) is moved to NestJS: with Nuclear, by changing the dialect and fixing what the compiler
reports; without, by rewriting. Same hidden tests.

## Scoring per run

| Score | How |
|---|---|
| Pass rate | hidden tests passed / total (the headline) |
| Complete | all critical tests passed (a list per app: e.g. no overselling, no cross-tenant read) |
| Cost | dollars as reported by the provider; tokens in/out; cache reads separately |
| Effort | turns, wall time, tool calls, compiler/runtime errors met on the way |
| Performance | k6 p50/p95/p99, throughput, error rate (A3, A4, A7) |
| Security | Semgrep + Bandit/ESLint security rules + the app's attack tests (A2, A6) |
| Size | lines written by the agent (Nuclear source vs native source; generated code counted apart) |
