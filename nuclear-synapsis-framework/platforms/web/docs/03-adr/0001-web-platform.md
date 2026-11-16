---
status: accepted
date: 2026-11-06
deciders: Julian Molina
---
# ADR-0001: The web platform is the mobile platform in a browser, and its first dialect is `react`

## Context and problem

Synapsis names three platforms (ADR-synapsis-0002); `web` had no dialect, so "three platforms" was only a promise. The
user asked for the first web dialect to be built on what the mobile platform already does, so the knowledge of one
platform carries to the other, and for an analysis of a simpler design on top of React's own ecosystem.

## Decision

**The web platform is the mobile platform in a browser.** The same kinds with the same words where a browser has a
use for them: `stateless` / `stateful` (parameters are props, `build() Element`), `appConfig` / `config`,
`repository` with the http decorators, `usecase` / `appcomponent` / `service` / `aggregate`, state models and
`statemanager` with `@stateModel` / `@state` / `@before` / `@after`, `@screen(route, providers, loggedIn, acl,
notFound)`, `event` and `component` with `@on`, `guard`, `tests` with `@test` / `@states` / `@widget` / `@mock`.
The contract is `platform.toml`; the rules are `docs/07-reference/web.md`. Forms, converters, translations, the
local database, plugins and AI are left out of the first version: they come with the mobile words.

**The first dialect is `react`** (`nuclearlang/dialects/typescript/frameworks/react/`, extends `typescript`): React
19 **without JSX**, React Router 7, Vite 7, Vitest 4 + jsdom + Testing Library. Nuclear has no JSX: elements are
the runtime's HTML functions (`div(className = ..., children = [...])`) and views are called like functions. A view
is a class (`StatelessView` / `StatefulView`) shown through `createElement`, so hooks work inside `build` and a
`stateful` keeps its fields between renders (`setState`, `initState`, `dispose`), the way a Flutter `State` does. A
state model generates a `<Model>Builder` component; `@screen(providers)` wraps the screen in `Providers`, and
`Manager.method()` inside its views is `this.manager(Manager).method()` (no hook in a callback).

**The runtime is `packages/synapsis-web`** (npm `synapsis-web`, ESM): `Result`, the injector, configuration and
the `Http` connection, `Repository` over fetch (cache, retries, `result` / `attempt`), `StateManager`, the view
bases and hooks, the HTML functions, events, session / ACL / guards, the router (`buildRouter`, `goTo`, `goBack`),
`Log`, and `synapsis-web/testing` (`SynapsisTest` with canned fetch, `mock` / `when` / `verify`, `renderScreen`,
`statesOf`). Its type definitions and those of React, React Router, Vitest and Testing Library are in
`nuclearlang/dialects/typescript/defs/`.

**Two generic emitter rules came with it, with no kind name in Rust:** `[kinds.<k>.syntax] construct` (how a
declaration of that kind is built when called: a view is a function call, not `new`), and named arguments to a kind
with `named_params` stay one object in a dialect whose named arguments are an object, instead of being reordered by
position.

**It is checked** by `checks/react-check/check.sh` (the runtime's `tsc`, the example built, `tsc --strict`, vitest,
`vite build`, the runtime's vitest) and the golden `examples/expected/characters/`.

**The platform's words stay; the dialect may use the ecosystem underneath where it costs no word.** They are what
makes mobile and web code read the same and what the agents already know. Open to the user: zod + react-hook-form
for `form`; zustand as the engine of `StateManager` (the same Nuclear, selectors for free) if the builder's
re-render cost shows up; TanStack Query only as an opt-in for a `repository` method (`@get(query = true)` → a
`useX` hook) once a real app asks for background refetch. JSX stays out.

## Options considered

1. **The mobile platform's words, written by a React dialect** — chosen.
2. **A web platform designed from React up** (hooks, stores, JSX as the kinds): the Nuclear of a web app would
   share nothing with a mobile one; the user asked for the opposite.
3. **react-native as the first web dialect**: it is a mobile dialect (ADR-synapsis-0002 lists it under mobile).
4. **Vue or Angular first**: React has the largest ecosystem, and the type definitions came from `@types/react`
   with the existing generator; the platform's contract is ready for them.
5. **A `.tsx` output with JSX**: it needs JSX in Nuclear (a parser change for one dialect) or a second syntax for
   views.

What the first version copies from mobile, and what React's libraries would replace, piece by piece:

| Mobile piece (copied) | React's alternative | Gain | Cost |
|---|---|---|---|
| `statemodel` + `statemanager` + `<Model>Builder` (a Cubit) | a **zustand** store: `create((set) => ({ characters: [], load: async (page) => set({ ... }) }))` and `useStore((s) => s.characters)` in the view | less generated code (no builder, no status enum), selectors re-render only what changed, devtools | the state is a bag of fields, not a list of named states: `loading` / `full` / `error` become flags the view checks; the `@states` test (ordered states) loses its meaning; Nuclear would need a `store` kind, a new word for both platforms or a web-only one |
| `repository` with `cache` / `retry` / `purge` | **TanStack Query**: `useQuery({ queryKey, queryFn })` gives cache, retries, refetch and loading / error state in the view | removes the manager for read-only screens (the query's state is the screen's), background refetch | ties data fetching to the view (the platform keeps http in `data/` and state in `presentation/`); a use case between them has no place; mobile has nothing equivalent |
| `form` + `formmanager` (not in the first version) | **react-hook-form** + **zod** | the standard of the ecosystem; the validation rules (`@required`, `@email`...) map to a zod schema one to one | none: the recommended path (the Nuclear stays the mobile `form` words; the dialect writes a zod schema and a `useForm`) |
| HTML functions without JSX | JSX in `.tsx` | what every React developer reads | Nuclear would need JSX in the parser, which never changes per dialect, or a template string; the functions keep Nuclear's call syntax, the same the mobile widgets use |
| `Providers` + `this.manager(X)` (context) | zustand stores are global: no provider | less wiring | a store per screen instance (a detail opened twice) needs a factory anyway |
| `goTo(Screen, params)` | react-router's `<Link>` / `useNavigate` with paths | idiomatic | navigation by address breaks when a route changes; the mobile platform navigates by screen on purpose (ADR-mobile-0002) |
| `tests` with `SynapsisTest` + `@mock` | MSW for http, vitest mocks | the ecosystem's tools | `SynapsisTest.respond` is MSW's role with no package; `@mock` already uses `vi.fn` |

## Consequences

- Positive: a web app is made from the mobile example in an afternoon (the `characters` example is the mobile one
  minus Flutter's widgets); "three platforms" is true; there is one platform reference more.
- Positive: the `nuclear` command gets web projects through the dialect's `[toolchain]` (`nuclear new -p web -d
  react`, `build` through `nuclear build .`).
- Negative: no forms, converters, translations, local database, plugins or AI kinds yet; no generated tests file.
- Negative: `@acl(guards)` only in a use case that awaits something (`Guards.verify` is asynchronous).
- Negative: a view's arguments must be named (a positional call to a view is written as positional).
- Negative: `useManager` and `useStateOf` are hooks, so only in `build`.
- Negative: the generated app was not run in a real browser.

## References

- Replaces: ADR-0097
- The rules for a user: [the reference](../07-reference/web.md). The runtime: [runtime](../02-architecture/runtime.md).
- What is left and what waits for the user: [roadmap](../01-product/roadmap.md).
