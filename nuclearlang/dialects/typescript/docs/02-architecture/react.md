---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../07-reference/react.md, overview.md, dependencies.md]
---
# The `react` dialect: the web platform written in TypeScript

`frameworks/react/` (`extends = "typescript"`, `platform = "web"`). The platform (its kinds, decorators, folders
and tests, in Nuclear) is [the web platform's](../../../../../nuclear-synapsis-framework/platforms/web/AGENTS.md);
its contract is `nuclear-synapsis-framework/platforms/web/platform.toml`. This dialect holds only how each of those
is written: React 19 without JSX, React Router 7, built by Vite 7, tested by Vitest 4 + jsdom + Testing Library.
The generated code calls the platform's runtime package `synapsis-web`
(`nuclear-synapsis-framework/platforms/web/packages/synapsis-web`). The decision is the web platform's (old
ADR-web-0001). How each kind is written, the generated files and the equivalences are normative in
[../07-reference/react.md](../07-reference/react.md) (§1, §2, §3); this document says how the dialect gets there.

## The design: views are classes, no JSX

A view is a class with `build()` that returns elements made with the runtime's HTML functions (`div(...)`,
`button(...)`) and `createElement(Component, props)`. `stateless` and `stateful` write a class over
`StatelessView` / `StatefulView` shown through `statelessOf` / `statefulOf`, so hooks work in `build` and a
stateful keeps its fields between renders. A state model generates a `<Model>Builder` component.
`@screen(providers = [...])` wraps the screen in `Providers`, and `Manager.method()` inside a screen's views is
`this.manager(Manager).method()` (`[decorators.provide]` and the views' `provide`): a hook, called in `build`.

Two generic rules of the emitter came with this dialect, usable by any other:

- `[kinds.<kind>.syntax] construct`: how a call to a declaration of that kind is written. Here a view, a builder
  or a screen is called like a function (`construct = "{{callee}}({{args}})"`: `CharacterTile({ character: c })`),
  not with `new`.
- Named arguments to a kind with `named_params` stay one object in a dialect with `named_args = "object"`
  (TypeScript has no named parameters).

## What it changes of `typescript`

- `[syntax] project_import = "{{relative}}"`: Vite and Vitest resolve a relative import without an extension
  (TypeScript's `bundler` resolution).
- `builtin_result = false`: `Result`, `Ok` and `Err` are the runtime's.
- `type_args_as_args = ["inject"]`: `inject<Repo>()` → `inject(Repo)`, the class is the token.
- `[types] Error = "AppError"`, `DateTime = "Date"`. Nuclear's `Error(message)` is `new AppError(message)`;
  `e.message` is `e.message`.
- `replaces` drops the definitions' automatic imports of `createElement`, `useState`, `useEffect`, `useMemo`,
  `useRef`, `useCallback` and `Fragment`: the runtime re-exports what a view needs from react, and `Element` is the
  runtime's alias (`ReactElement | null`).
- `[auto_imports]` choose the module when two packages export a name: the runtime (`synapsis-web`,
  `synapsis-web/testing`), `vitest` and `@testing-library/react`; the definitions give the rest.
- `[decorators] consumed`: the platform's decorators are read by the templates, not written as TypeScript
  decorators. A method with `@state` returns nothing to its caller (`void = ["state"]`): its value becomes a state.
- In a view, a parameter is read as `this.props.<name>` (`param_access`), one with a default as
  `(this.props.<name> ?? <default>)` (`param_access` gets the default: a generic variable of the templates, `dialects.md`); a
  view with no required parameter takes `props = {}` (`params_required`); an optional field of a `stateful` starts
  `null`.
- `[call_site.Log]`: every `Log.d/i/s/w/e(...)` also receives `at`, the breadcrumb
  `component › kind › Class.method · path.nuc:line`.

## Project files

A folder with `config.nuc` (`synapsis(platform = "web", dialect = "react")`) and `main.nuc` (the project
`marker`: there is no `nuclear.toml`); `nuclear build .` writes `build/app` (`output`). `[project] sources = "src"`,
`assets = ["public"]`; the platform's `test/` stays `test/`, outside `src/`.

| File | Template |
|---|---|
| `src/synapsis.g.ts` | `synapsis_g.tpl` (`startSynapsis`, `synapsisConfig`, `registerModels`, `registerSynapsis`, `routes`, `appRouter`) |
| `src/index.ts`, `index.html` | `index_ts.tpl`, `index_html.tpl` |
| `package.json` | `package_json.tpl`: `"type": "module"`; scripts `dev` (`vite`), `build` (`tsc` + `vite build`), `preview`, `test` (`vitest run --passWithNoTests`: a new project has no tests yet) |
| `tsconfig.json`, `vite.config.ts` | `tsconfig.tpl` (ES2022, `bundler`, strict, `noEmit`), `vite_config.tpl` (jsdom, `test/**/*_test.ts`) |
| `.npmrc` | inline `install-links=true`: npm copies the runtime (a `file:` dependency) instead of linking it; from a link, TypeScript and Vite resolve its imports (react) next to the runtime's own folder, the types become `any` and the bundle fails |

What each generated file holds: [../07-reference/react.md](../07-reference/react.md) §1. Kind by folder
(`[project.kinds]`): `components/*/domain/models`, `contracts/*/models` and `shared/models` → `model`;
`components/*/presentation/*/state_models` and `components/*/presentation/state_models` → `statemodel`; `test` →
`tests`. `config.nuc` sections: `synapsis`, `app`, `plugins`, `contracts`, `dependencies`. The dialect declares no
plugins.

## Toolchain

What the `nuclear` command runs in `build/app` (`[toolchain]`):

| Key | Command |
|---|---|
| `needs` | `node`: the CLI finds Node.js (`NUCLEAR_NODE`, Nuclear's own, the PATH) or offers `nuclear setup node` (ADR-cli-0004) |
| `install` | `npm install {{packages}}/synapsis-web && npm install`, then Vite's dependency cache (`node_modules/.vite`) is removed: it would keep serving the runtime it pre-bundled before (same version, new code) |
| `run` | `npm run dev -- --port {{port}} --strictPort` (`url = "http://localhost:5173"`, `ready = "Local:"`, `installed = "node_modules"`) |
| `serve` | `npx vite --port {{port}} --strictPort --host {{host}} --clearScreen false`: the dev server the editor's web device runs on a port and host it picks |
| `test` | `npm test` |
| `package_add`, `package_remove`, `package_version`, `package_companion`, `package_defs` | the same as `nestjs` ([nestjs.md](nestjs.md)) |

The editor's debug launch (`[[toolchain.launch]]`, type `chrome`) opens the browser with the debugger after the
task `nuclear: run`.

## Architecture rules

`[architecture]`, scope `components`: a use case is called only by its `appcomponent`; a service by use cases and
aggregates; an aggregate by use cases; a repository by use cases and aggregates. Another component sees only the
`appcomponent`, models, events, global components, guards and the screens (`@screen`: navigation goes from one
component to another). Tests are exempt.
