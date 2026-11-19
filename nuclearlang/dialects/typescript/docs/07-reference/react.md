# Dialect `react`: the `web` platform in TypeScript with React

> The React dialect of the [web platform](../../../../../nuclear-synapsis-framework/platforms/web/docs/07-reference/web.md) (ADR-web-0001), extending [typescript](typescript.md). The platform's
> rules, kinds and Nuclear are in `web.md`; this document holds only how this dialect writes them: **React 19**
> without JSX (`createElement` and the runtime's HTML functions), **React Router 7**, **Vite 7** to build and run,
> **Vitest 4** + jsdom + Testing Library to test. Files: `nuclearlang/dialects/typescript/frameworks/react/`; runtime: `packages/synapsis-web`
> (npm `synapsis-web`). Checked by `tools/react-check/check.sh` (tsc --strict, vitest, vite build).

## 1. Project

A folder with `config.nuc` (`synapsis(platform = "web", dialect = "react")`) and `main.nuc`; `nuclear build .`
writes `build/app`: `src/` (the app; `src/synapsis.g.ts` and `src/index.ts` generated), `test/`, `index.html`,
`package.json`, `tsconfig.json`, `vite.config.ts`. In `build/app`: `npm install`, `npm run dev` (Vite, port 5173),
`npm test` (Vitest), `npm run build` (tsc + Vite). The `[toolchain]` of the dialect gives the `nuclear` CLI those
commands.

Generated once per project:

| File | Holds |
|---|---|
| `src/synapsis.g.ts` | `startSynapsis()`, `synapsisConfig()`, `registerModels()`, `registerSynapsis()` (configs, the injector, the `@on` subscriptions), `routes` (one `AppRoute` per `@screen`, props from the url parameters), `appRouter()` |
| `src/index.ts` | starts Synapsis, mounts the `App` of `main.nuc` in `#root` |
| `src/embed.ts`, `vite.embed.config.ts` | the embedded mode (ADR-synapsis-0009): `mount(element, host)` calls `mountApp` with the `App`, `startSynapsis` and `public/styles.css` (imported `?inline`); `npm run build:embed` writes `dist-embed/embed.js`, one ES module with React inside |
| `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `.npmrc` | Vite's entry (title, description, the project's `public/styles.css` and `favicon.svg`), the test environment (jsdom, `test/**/*_test.ts`), TypeScript strict, the dependencies, `install-links=true` (npm copies the runtime instead of linking it, so TypeScript and Vite resolve React from the app) |

## 2. How each kind is written

| Kind | TypeScript |
|---|---|
| `stateless Name(params)` | `export function Name(props: NameProps): Element` → `createElement(NameView, props)`; `NameProps` interface (`key?` added); `NameView = statelessOf(class extends StatelessView<NameProps> { build() })`; params read as `this.props.x`, a param with a default as `(this.props.x ?? default)` (it is optional in `NameProps`); when no param is required, `props` defaults to `{}` so the view is called with none; with `@screen(providers)` the function wraps the view in `Providers` |
| `stateful Name(params)` + fields | the same over `statefulOf(class extends StatefulView<NameProps>)`: fields are class fields (`x: T \| null = null` when optional), `setState`, `initState`, `dispose` |
| `appConfig`, `config` | `class extends AppConfig` / `ComponentConfig` with `override readonly connections`, `globals` |
| model | `class` with `readonly` fields, `constructor(init: {...})`, `static fromJson(json: Json)` (a field with a default takes it when the key is missing: `(json['tags'] as string[] \| undefined) ?? []`), `toJson()`, `copyWith()`; a generic model's `fromJson(json, fromJsonT)`; built with `new` anywhere, also inside a view |
| `event` | the same, `extends AppEvent` with `eventName` |
| `@repository(path)` | `class extends Repository` with `super({ path })`; a `Result` method `return this.result(() => this.send(HttpMethod.get, ':id', { params: { id }, decode: Decode.one(Model.fromJson) }), (e) => new Error({ message: e.message }))`; another return type `return this.send(...)`; `cache` → `new Cache({ ttl })` + `purgeX()`; `@on("topic")` on a method that returns `Stream<T>` → `return this.stream('topic', (data) => T.fromJson(data as Json))` (not async). The calls travel over the connection's `Transport` (`Http`, `WebSocket`, or the host's bridge when mounted) |
| `usecase`, `service`, `aggregate`, `component` | `class` with `constructor(private readonly dep: Dep)`; `@requires` → `Guards.check({...})` + `return Err(...)`; `@acl` → `await Guards.verify({...})` |
| `appcomponent` | `class` whose methods `return await inject(UseCase).exec(...)` |
| `guard` | `class extends Guard` with `canActivate()` |
| state model `Name(a: A, flag: boolean)` | `enum NameStatus`, `class Name` (`status`, optional data fields, `static initial()`, `static a(a)`, `static flag()`), `interface NameBuilders`, `function NameBuilder(builders)` → a component that reads `useStateOf(Name)` and calls the builder of the current status |
| `@stateModel(S) statemanager` | `class extends StateManager<S>`; `@state(S.x)` methods become `async x(...): Promise<void>` that `emit` (`result.match(S.error, S.x)` for a `Result`) around a private `_x` with the body; `@before`/`@after` call the named method; `listen(stream, (v) => ...)` is `this.listen(...)`, stopped by `close()` |
| `tests` | `describe(name, () => { beforeEach(SynapsisTest.start(...), SynapsisTest.mock(X)); afterEach(cleanup); ... })` (a rendered screen leaves the page after each test); `beforeEach()`/`afterEach()` methods are more hooks; `@test` → `test(desc, async () => ...)`; `@states` → `statesOf(manager, ...)` + `expect(states).toEqual(...)`; `@widget` → `test` |

Children: `if c x` in `children = [...]` is `c ? x : null` (`[options] slot_lists`, `list_if_slot`): the elements
after it keep their place, so React does not remake them (a `textarea` keeps its focus); in any other list it is a
spread. A state manager's method may not be named `close`, `emit`, `subscribe`, `listen` or `state`, the runtime's
(`[kinds.statemanager] sealed`, N0223).

Calls: a view, a builder or a screen is **called like a function** (`CharacterTile({ character: c })`): the kinds
declare `construct = "{{callee}}({{args}})"` and the named arguments stay one object (TypeScript has no named
parameters; the emitter keeps them for a kind with `named_params`). `inject<X>()` is `inject(X)`;
`Manager.method()` inside a screen's views is `this.manager(Manager).method()`.

## 3. Equivalences

A model (`model` is written when the file is not in `domain/models/`):

```nuclear
model Origin
  name: string
  url?: string
```

```typescript
export class Origin {
  readonly name: string;
  readonly url?: string | null;

  constructor(init: { name: string; url?: string | null }) {
    this.name = init.name;
    this.url = init.url;
  }

  static fromJson(json: Json): Origin {
    return new Origin({
      name: json['name'] as string,
      url: json['url'] as string | null,
    });
  }

  toJson(): Json {
    return {
      name: this.name,
      url: this.url,
    };
  }

  /** The same value with some fields changed. */
  copyWith(changes: Partial<{ name: string; url: string | null }>): Origin {
    return new Origin({ ...this, ...changes });
  }
}
```

A view:

```nuclear
stateless Greeting(name: string)
  build() Element
    p(className = "greeting", children = "Hello ${name}")
```

```typescript
export function Greeting(props: GreetingProps): Element {
  return createElement(GreetingView, props);
}

export interface GreetingProps {
  key?: string | number;
  name: string;
}

const GreetingView = statelessOf(
  class extends StatelessView<GreetingProps> {
    override build(): Element {
      return p({ className: 'greeting', children: `Hello ${this.props.name}` });
    }
  },
);
```

An event:

```nuclear
event Pinged
  n: int
```

```typescript
import { AppEvent, Json } from 'synapsis-web';

export class Pinged extends AppEvent {
  readonly n: number;

  constructor(init: { n: number }) {
    super();
    this.n = init.n;
  }

  static fromJson(json: Json): Pinged {
    return new Pinged({
      n: json['n'] as number,
    });
  }

  get eventName(): string {
    return 'Pinged';
  }

  toJson(): Json {
    return {
      n: this.n,
    };
  }
}
```

The complete example: `examples/examples-web/characters` (golden `examples/expected/characters`): a characters
component with its repository, use cases, facade, state, list and detail screens, a global component, an event, a
guard and four tests (`tools/react-check/check.sh`: tsc --strict 0 errors, 4 tests, vite build).

Real time (ADR-synapsis-0008): the connection is a `WebSocket`; what the server pushes is a repository method with
`@on`, passed on by a use case and listened to by a state manager:

```nuclear
appConfig ProjectConfig
  connections: Connection[] = [WebSocket(url = "ws://localhost:3000/ws", timeout = 5000)]

```

```typescript
export class ProjectConfig extends AppConfig {
  override readonly connections: Connection[] = [new WebSocket({ url: 'ws://localhost:3000/ws', timeout: 5000 })];
}
```

```nuclear
TaskCreated
  id: int
  title: string

@repository(path = "tasks")
repository TaskRepository
  @on("tasks.created")
  created() Stream<TaskCreated>
```

```typescript
import { Repository, Stream } from 'synapsis-web';

export interface TaskCreated {
  id: number;
  title: string;
}

export class TaskRepository extends Repository {
  constructor() {
    super({ path: 'tasks' });
  }

  created(): Stream<TaskCreated> {
    return this.stream('tasks.created', (data) => data as TaskCreated);
  }
}
```

## 4. Runtime (`synapsis-web`)

| Export | What it does |
|---|---|
| `Result`, `Ok`, `Err`, `AppError`, `HttpError`, `NotFound` | the platform's Result and errors (`Error(message)` in Nuclear is `new AppError(message)`) |
| `register`, `inject`, `replace`, `resetInjector` | the injector (`{ singleton: false }` for use cases and managers) |
| `AppConfig`, `ComponentConfig`, `Connection`, `Transport`, `Http`, `WebSocket`, `HttpInterceptor`, `Global` | configuration; a `Transport` carries a repository's calls (`exchange`) and what is pushed (`listen`) |
| `Stream<T>` (`listen`, `map`), `Frames`, `Bridge`, `BridgeTransport` | what a server pushes; the platform's frames (ADR-synapsis-0008) over a socket or a host's bridge |
| `Synapsis.start/addConfig/connection/transport/embed/reset` | the runtime's entry point |
| `mountApp(element, host, App, start, styles)`, `Host` | the embedded mode: a shadow root, the in-memory router, the bridge (ADR-synapsis-0009) |
| `Repository` (`send`, `result`, `attempt`, `target`, `purgeCache`), `Decode`, `Cache`, `HttpMethod` | http calls over fetch; GET/PUT/DELETE retry transient failures twice |
| `StateManager<S>` (`state`, `emit`, `subscribe`, `listen`, `close`) | the state of a screen |
| `StatelessView`, `StatefulView`, `statelessOf`, `statefulOf`, `Providers`, `useManager`, `useStateOf`, `useManagerState`, `Element` | views as classes over React components; the provided managers |
| `div`, `span`, `ul`, `li`, `button`, `input`, `img`, `form`... (`el`, `fragment`) | HTML without JSX: `div({ className, children })` or `div(child, child)` |
| `AppEvent`, `Events` (`publish`, `subscribe`, `decoder`, `publishJson`), `useEvent` | events |
| `SessionManager`, `SessionStarted`, `SessionEnded`, `Acl`, `NetworkManager`, `Guard`, `Guards` (`check`, `verify`, `verifySync`) | session and access |
| `buildRouter`, `goTo`, `pushTo`, `goBack`, `pathTo`, `RouterProvider`, `AppRoute` | routes from `@screen`, navigation by screen |
| `Log` (`d`, `i`, `s`, `w`, `e`, `sink`) | logs with the call site the transpiler passes (`at`) |
| `synapsis-web/testing`: `SynapsisTest` (`start`, `respondWith`, `respond`, `requests`, `replace`, `mock`, `of`), `when`, `verify`, `renderScreen`, `statesOf`, `okOf`, `errOf` | tests |
