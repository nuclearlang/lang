---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [glossary.md, ../01-product/roadmap.md, ../03-adr/0001-web-platform.md, ../07-reference/web.md]
---
# Vision

## The problem

Dragonfly names three platforms, and the web one is built on what the mobile platform already does, so the
knowledge of one carries to the other. The web platform is the mobile platform in a browser: the same words for the
same things (`appConfig`, `repository` with `@get`, `usecase`, `appcomponent`, state models and `statemanager`,
`@screen`, events, guards, tests), so an app's domain and state read the same on a phone and on the web, and a
person or an agent that knows one writes the other.

A web project holds only its business logic in Nuclear. Components, props, registration in the injector, JSON, http
calls, state handling, routes and imports are written by the transpiler.

## Who uses it

- **A person or an AI agent writing a web app**: they read [the reference](../07-reference/web.md)
  (`nuclear help web`) and [the brief](../07-reference/brief/web.md).
- **Whoever already has the mobile app**: the `characters` example here is the mobile one minus the widgets of the
  mobile dialect.
- **The author of a dialect**: `platform.toml` says what a web dialect must implement.
- **Whoever changes the runtime** (`packages/dragonfly-web`): the code every generated app runs on.

## What it does not do

- It is not designed from a UI library up: no kind for a hook, a store or JSX. The Nuclear of a web app shares its
  words with a mobile one ([ADR-web-0001](../03-adr/0001-web-platform.md)).
- It has no JSX: the parser does not change for a dialect. A view returns elements made with HTML functions.
- It does not navigate by address: `goTo` takes a screen, as on mobile.
- What a browser has no use for is not here (a native splash, workmanager, a secure keystore); what a browser needs
  and a phone does not is (HTML elements, a url bar).
- It does not say how a dialect writes its target: that is the dialect's reference, in the TypeScript dialect
  project.
- Not there yet ([roadmap](../01-product/roadmap.md)): forms, converters, translations, the local database, plugins
  and AI kinds. They come with the mobile platform's words.

## Constraints

- The golden rule of the whole platform: performance, speed and readability of the syntax.
- A light clean architecture: `data`, `domain` and `presentation` layers plus what is shared, and closed
  components (another component is used only through its `appcomponent`), with the same N0301 / N0302 rules as the
  mobile platform.
- The http client with cache and retries, the state managers, events, session, ACL, the router and the test helpers
  come from the dialect's runtime package; the UI library, the bundler and the test runner are the dialect's.
