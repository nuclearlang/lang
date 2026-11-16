---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../03-adr/0001-web-platform.md, ../07-reference/web.md]
---
# Roadmap

The pending work of the web platform, its contract and its runtime package. A done item is deleted. What is pending
in how the `react` dialect writes its target is in the TypeScript dialect's project; what is pending in the
`nuclear` command is in [the command line tools](../../../../../tools/cli/AGENTS.md).

## Half done

- **The web platform** (step 5 of the competitiveness plan: the `react` dialect, so "three platforms" is true). The
  first version is in place ([ADR-web-0001](../03-adr/0001-web-platform.md)). Left: forms, converters, translations,
  the local database, plugins / AI, the CLI's web commands, a run in a browser.

## Untested

- The `characters` example in a browser (its detail page, the guard). Two web apps did run in a real browser
  (Chromium, headless) on 2026-11-16: the onboarding's `todos_web` (its screen loads and lists the todos of the
  API) and the website (every screen, routes with parameters, a library of npm, the state builders re-rendering).

## To decide with the user

From the analysis of ADR-web-0001:

- zustand as the engine of `StateManager`.
- TanStack Query as an opt-in per repository method.
- JSX stays out.

## Pending

- **The runtime's HTML functions leave out common elements**: `figure`, `figcaption`, `kbd`, `code`, `blockquote`,
  `video`, `picture` and others (`packages/synapsis-web/src/html.ts` exports 39 tags). The website uses a `div` and
  a `span` with a class where it meant a `figure` and a `kbd`. The list should cover the HTML elements, with the
  type definitions regenerated. Found by the website, 2026-11-16.
- **A new project fails its tests**: `nuclear new <name> -p web` writes no test, and `nuclear test` exits 1
  (vitest: "No test files found"). A generated resource brings its test, and then they pass. The skeleton should
  bring one test, as the backend's does. Found by the functional tests of 2026-11-16.
- **Not in the first version** (the same words as mobile): `form` / `formmanager` (react-hook-form + zod
  underneath), `converter`, translations, the local database (`@primary`, `saveLocal`; IndexedDB), plugins and AI
  kinds, a generated tests file, `@splash` / offline.
- **A new project has no screen at `/`**: `nuclear new <name> -p web` writes the router and no screen, so the app
  answers "not found" at its root until one is made (the onboarding opens `/todos`).
- **No browser globals in the type definitions**: `window`, `document`, `navigator` and `IntersectionObserver` are
  not in the react dialect's definitions, so Nuclear cannot read the url, the storage or the DOM (the website moves
  its blocks through motion's selectors instead).
- **Found building the website:**
  - navigation by address inside the app: a link of rendered content reloads the page (`goTo` is by screen);
  - the type of a state builder's callback parameter is unknown to the emitter, so a library member such as
    `list.isEmpty` is not translated there (write `list.length == 0`);
  - no way to give an attribute whose name is not an identifier (`aria-label`);
  - a deploy story: the base path for GitHub Pages, the SPA fallback `404.html`.
- **Limits:**
  - `@acl(guards)` only in a use case that awaits something;
  - a view's arguments must be named;
  - `useManager` and `useStateOf` are hooks: only in `build` (`this.manager(X)` elsewhere);
  - `Guards.check(internet)` reads `navigator.onLine` only.
