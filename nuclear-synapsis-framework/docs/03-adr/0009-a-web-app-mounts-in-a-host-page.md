---
status: accepted
date: 2026-11-18
deciders: Julian Molina
---
# ADR-0009: A web app also builds as a bundle that mounts in a host's page, with the host's theme and its bridge

## Context and problem
Nuclear Chat's UI (spec 013) is a `web` project shown inside an editor's webview, and other products will show a
Synapsis app inside another site's page. A webview has no address bar to route by, its page has its own styles,
and it cannot reach a local service with the service's token (the token belongs to the host, and a browser's
requests carry an `Origin` the service refuses, ADR-synapsis-0007). The app must be the same Nuclear: only how it
starts changes.

## Decision
1. **Every web build also writes the embedded entry**: `mount(element, host)` mounts the app in `element` and
   gives back the function that unmounts it. The normal app (its `index.html`, its router of the address) does not
   change. The bundle is one ES module with the UI library inside (the host has none).
2. **No router of the address**: mounted, the app's router is an in-memory one, starting at `host.path` (default
   `/`); `goTo` and `goBack` work as always.
3. **Scoped styles**: the app lives in a shadow root of `element`, with the project's stylesheet
   (`public/styles.css`) inside it: the host's rules do not reach the app and the app's do not leak out.
4. **The host's theme**: CSS variables cross the shadow root, so the app's stylesheet reads the host's
   (`var(--accent, #0a84ff)`); nothing else is needed and nothing is copied.
5. **The bridge**: `host.bridge = { send(frame), onMessage(callback) }` carries the frames of ADR-synapsis-0008.
   Given a bridge, every repository's call and every `Stream` goes through it, whatever its connection (the host
   forwards the frames to the service with its token and back); without one, the connections of the
   configuration work as in the normal app.

What the `react` dialect emits: `src/embed.ts` (`mount`), `vite.embed.config.ts` and the script `build:embed` (a
library build to `dist-embed/embed.js`); `synapsis-web` gives `Synapsis.embed(...)`, the bridge's transport and the
in-memory router.

## Options considered
1. An iframe with the normal app: a second document, its own origin, and the host's theme does not cross it.
2. A web component (`<synapsis-app>`): the same shadow root, plus a custom element registry the host may not want;
   `mount` is the smaller contract, and a host can wrap it in one.
3. A flag in `config.nuc` to build one mode or the other: both entries cost nothing, and the same project serves
   both ways.

## Consequences
- Positive: one project runs as a site and inside any page; a webview's app talks to a guarded service without
  holding its token.
- Negative: the embedded bundle carries its own copy of the UI library; the app's stylesheet must use the host's
  variables to follow its theme.

## References
- Spec 014 (`docs/04-specs/014-synapsis-real-time-and-embedded/` at the root), requirement 3.
- The reference: `platforms/web/docs/07-reference/web.md` §1.1.
