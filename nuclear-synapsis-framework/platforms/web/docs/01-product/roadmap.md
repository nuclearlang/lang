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

- The generated app in a real browser (`npm run dev` of the `characters` example: routing, the detail page, the
  state builder re-rendering). Only the jsdom tests, `tsc` and `vite build` ran.

## To decide with the user

From the analysis of ADR-web-0001:

- zustand as the engine of `StateManager`.
- TanStack Query as an opt-in per repository method.
- JSX stays out.

## Pending

- **A new project fails its tests**: `nuclear new <name> -p web` writes no test, and `nuclear test` exits 1
  (vitest: "No test files found"). A generated resource brings its test, and then they pass. The skeleton should
  bring one test, as the backend's does. Found by the functional tests of 2026-11-16.
- **Not in the first version** (the same words as mobile): `form` / `formmanager` (react-hook-form + zod
  underneath), `converter`, translations, the local database (`@primary`, `saveLocal`; IndexedDB), plugins and AI
  kinds, a generated tests file, `@splash` / offline.
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
