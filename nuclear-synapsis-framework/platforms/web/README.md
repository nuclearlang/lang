# Synapsis web

The web platform of Synapsis: single-page apps that run in the browser, written in Nuclear with the same words as
the mobile platform, and built today with the `react` dialect on the TypeScript runtime `synapsis-web`.

## Why it exists

A web project holds only its business logic in Nuclear: components, props, injection, JSON, http calls, state
handling, routes and imports are written by the transpiler. And because the web platform is the mobile platform in
a browser (`appConfig`, `repository` with `@get`, `usecase`, `appcomponent`, state models, `@screen`, events,
guards, tests), an app's domain reads the same on a phone and on the web: whoever knows one writes the other.

What it leaves out on purpose: a design from a UI library up (no kind for a hook, a store or JSX), navigation by
address (`goTo` takes a screen, as on mobile), and what a browser has no use for (a native splash, a secure
keystore). Not there yet: forms, converters, translations, the local database, plugins and AI kinds; they come
with the mobile platform's words ([roadmap](docs/01-product/roadmap.md)).

## How we made it

- **The mobile platform in a browser, first dialect `react`**
  ([ADR-web-0001](docs/03-adr/0001-web-platform.md)): React 19 without JSX, React Router 7, Vite 7, Vitest 4.
  Nuclear has no JSX and the parser does not change for a dialect, so a view returns elements made with the
  runtime's HTML functions (`div(className = ..., children = [...])`).
- **No kind name in Rust**: the two emitter rules the web needed (how a view is built when called, named arguments
  kept as one object) are generic data of the dialect (ADR-web-0001).
- **One contract for every web dialect**: `platform.toml`, refused by the loader when a dialect leaves it
  ([ADR-synapsis-0002](../../docs/03-adr/0002-three-platforms-dialects-under-them.md)).
- **A web app reads a backend through its contract**
  ([ADR-synapsis-0006](../../docs/03-adr/0006-shared-contracts.md)).

**The onboarding example was made with the tools.** `examples/onboarding/todos_web` was written only by
`nuclear new` and `nuclear gen`, no file by hand
([ADR-platform-0004](../../../docs/03-adr/0004-products-are-made-with-the-tools.md)); the website runs those
commands again on every build and fails if they no longer give it. The website itself is a web app of this
platform: [website/](../../../website/README.md).

## Try it

With `nuclear` installed and Node.js 20 or later:

```sh
nuclear new todos_web -p web
cd todos_web
nuclear gen resource todos Todo --source rest:https://jsonplaceholder.typicode.com --path todos \
  --fields "id:int title:string completed:boolean" --screen todos
nuclear check --json      # []
nuclear build             # the React app in build/app
nuclear install           # npm install
nuclear test              # 1 passed
nuclear run               # Vite: open http://localhost:5173/todos
```

A new web project has no screen at `/` yet: open `/todos`. Step by step:
[docs/08-guides/onboarding-web.md](docs/08-guides/onboarding-web.md). The complete example (list and detail
screens, state, events, a guard, tests): `examples/examples-web/characters/`.

## Where to read next

- The rules of the platform (`nuclear help web`): [docs/07-reference/web.md](docs/07-reference/web.md); the short
  sheet an agent reads: [docs/07-reference/brief/web.md](docs/07-reference/brief/web.md).
- The guide of the dialect: [react](../../../nuclearlang/dialects/typescript/docs/08-guides/react.md).
- The same words on a phone: [the mobile platform](../mobile/README.md).
- What the platform is for: [docs/00-context/vision.md](docs/00-context/vision.md).
- To change it (the runtime, the check, the golden): [AGENTS.md](AGENTS.md).

[Apache-2.0](../../../LICENSE). By contributing you agree that your contribution is licensed under it.
