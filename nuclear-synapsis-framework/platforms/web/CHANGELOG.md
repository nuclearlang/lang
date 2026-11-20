# Changelog

All notable changes to synapsis-web are written here; versions follow [Semantic Versioning](https://semver.org).

## Unreleased

- Environments (spec 021): `env("NAME", "default")` in a web app reads the values of the environment it was built
  for, constants of the build (`nuclear build --env <name>`); a secret read by the app is N0311. The example
  `characters` reads `API_URL`.
- Found by Nuclear Chat's UI: `if c x` in `children` keeps its place (`c ? x : null`, no remount, a textarea keeps
  its focus); `not xs.isEmpty` is `!(xs.length === 0)`; a model built in a view is `new Model(...)`; `fromJson` takes
  a field's default when the key is missing; `afterEach` is imported and a rendered screen is cleaned up after each
  test; a `@state` method with a body and no value emits its state; `@on("chat.${workspace}")` takes the method's
  parameters; a screen gets the query's parameters; a manager method named `close` (and the runtime's other members)
  is N0223; `thenReturn` of a `Stream` method answers the stream; `nuclear make screen|statemanager|widget|component|guard`.
- Real time (ADR-synapsis-0008): `WebSocket(url, headers, timeout, interceptors)` is a connection beside `Http`; a
  repository bound to it is written as it is and its calls travel over the socket (reconnecting by itself);
  `@on("topic")` methods return `Stream<T>` of what the server pushes; a use case may return a `Stream`; a state
  manager follows one with `listen(stream, ...)`. `nuclear gen usecase --calls` writes a use case over a stream method.
- The embedded mode (ADR-synapsis-0009): every build also writes `src/embed.ts` (`mount(element, host)`) and
  `vite.embed.config.ts` (`npm run build:embed` → `dist-embed/embed.js`): a shadow root with the stylesheet, the
  host's CSS variables, an in-memory router, and the host's bridge for every call.
- The example `examples/examples-web/tasks_live`: tasks_api's tasks over its WebSocket, pushed as they are created.
- `dependencies(...)` in `config.nuc` and `[toolchain] package_*` in react: `nuclear add|remove <package>` installs
  any npm package and generates its type definitions (ADR-lang-0008).
- First public version.
- `[[generators]]` in the platform: `nuclear gen` writes a resource's models, repository, use cases, view with its state manager and tests (ADR-codegen-0001).
- `[[generators.usecase]]`: `nuclear gen usecase` adds a use case's alias to its component's facade and, with `--calls`, writes a use case over a repository method (ADR-codegen-0001).
- `[[generators.resource]]`: the repository is merged (`merge = true`), so an action added to a resource that exists gets the members it lacks (ADR-developer-0001).
