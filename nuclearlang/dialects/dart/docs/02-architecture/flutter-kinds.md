---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../07-reference/flutter.md, flutter.md, ../../frameworks/flutter/dialect.toml]
---
# What each kind of `flutter` generates

How the `flutter` dialect writes the kinds and decorators of the mobile platform in Dart. What a kind means and
the rules a user follows are the platform's
([mobile.md](../../../../../nuclear-synapsis-framework/platforms/mobile/docs/07-reference/mobile.md)); the normative
equivalences are [../07-reference/flutter.md](../07-reference/flutter.md) §5–§8. `frameworks/flutter/dialect.toml`
holds the kinds, the decorators, `[architecture]`, `[project]`, `[project.manifest]`, `[call_site.Log]` and the
`defs` list; every kind and decorator has its entry in `frameworks/flutter/docs.toml` (required by a test).

## Kinds

| Kind | Template | Dart |
|---|---|---|
| `stateless` | `stateless.tpl` | a `StatelessWidget` with a `const` constructor (`{super.key, ...}`, named parameters as `final` fields); `build` and the other members get `@override` |
| `stateful` | `stateful.tpl` | a `StatefulWidget` and its `State`: fields, methods and mixins (`with SingleTickerProviderStateMixin`) go to the `State`; the parameters stay in the widget and are read as `widget.name` (`param_access`) |
| `@screen(providers = [...])` on a view | the same templates | the widget wraps a private `_<Name>View` in a `MultiBlocProvider` with one `BlocProvider<Manager>(create: (_) => inject<Manager>())` per provider; `Manager.load()` in the view is `context.read<Manager>().load()` |
| `appConfig`, `config` | `appconfig.tpl`, `config.tpl` | a subclass of `AppConfig` / `ComponentConfig` with `final` fields |
| `model` | `model.tpl` | an immutable class with a `const` constructor, `fromJson` / `toJson` written by json_serializable (`@JsonSerializable(explicitToJson: true)`, `part '<file>.g.dart';`) and equality. A generic model (`Page<T>`) uses `genericArgumentFactories`. `@key("json_name")` is the field's name in the JSON; `@Converter` on a field is the converter that reads and writes it |
| `model` with `@primary` | `model.tpl` (`field_decor`) | `static final LocalTable<M> table`, named by `@entity("table")` (`decor.entity.arg`; the model's name in `snake_case` without it); `@created` / `@updated` are stamped by the table. It is registered with its component in `registerDragonfly` (`Local.register(M.table, component: ...)`) |
| `converter` | `converter.tpl` | a `JsonConverter<T, J>`; `T` and `J` come from the `fromJson` signature; `sample()` is optional, for the generated tests |
| `repository` | `repository.tpl`, `repository_method.tpl` | a `Repository` subclass; each method without a body and with `@get` / `@post` / `@put` / `@patch` / `@delete` is a `send(...)` call (path, query or body from the parameters, `Decode`, `Cache`, `retry`). A cached method also generates `purge<Method>()`. A method with a body is a plain Dart method |
| `usecase` | `injectable.tpl`, `usecase_method.tpl` | a class with its injected dependencies and one `exec`; `@requires(...)` → `Guards.check(...)` and `@acl(...)` → `await Guards.verify(...)` (`Guards.check(...)` when `exec` is not async) at the start of `exec`, returning `Left(...)` when denied |
| `appcomponent` | `injectable.tpl` | aliases to the use cases through `inject` (`alias_via = "inject"`) |
| `service`, `aggregate`, `component` | `injectable.tpl` | a plain class with its injected dependencies |
| `statemodel` | `statemodel.tpl` | the states of a screen: `<Name>Status`, the constructors `Name.field(...)`, `Name.initial()`, and a typed `<Name>Builder` over `BlocBuilder` |
| `statemanager` | `statemanager.tpl`, `statemanager_method.tpl`, `statemanager_signature.tpl` | a Cubit (`StateManager`) built with `super(const S.initial())`; a `@state(S.field)` method emits that state, and with a `Result` it emits the error with the `Err` |
| `form` | `form.tpl` | a form model: fields, rules (`Rule`, `Rules`), initial values |
| `formmanager` | `formmanager.tpl` | a `FormManager<F>` built with `super(F.rules, F.initial, F.fromValues)`; `@validate("field")` methods are remote validations |
| `event` | `event.tpl` | an `AppEvent` with `fromJson` / `toJson` (json_serializable) and `eventName` |
| `guard` | `guard.tpl` | a `Guard` with `canActivate()`, sync or async |
| `tests` | `tests.tpl`, `tests_method.tpl` | a `flutter_test` group: `@test` → `test(...)`, `@widget` → `testWidgets(...)`, `@states` → `blocTest(...)` (`seed`, `wait`, `skip`, `expect`); a method without a decorator is `setUp`, `tearDown`, `setUpAll` or `tearDownAll`; `@mock([X])` creates a mocktail mock of `X` and puts it in the injector; `X.m()` is `inject<X>().m()`; a `Result` is kept, not propagated |
| `integration` | `integration.tpl`, `tests_method.tpl` | the same over `IntegrationTestWidgetsFlutterBinding`: the real app on a device or emulator |
| `tools`, `flow`, `chat`, `remote`, `knowledge` (plugin `genkit`) | `genkit_tools.tpl`, `genkit_flow.tpl`, `genkit_chat.tpl`, `genkit_remote.tpl` + `genkit_remote_method.tpl`, `genkit_knowledge.tpl` | Genkit tools (the doc comment is what the model reads), a `GenkitFlow` with `run`, a `Chat`, typed `RemoteFlows` (`@flow` / `@stream` methods without body), a `Knowledge` |

## The local twin of a repository method

With `@repository(saveLocal = true)` or `@get(local = true)`, a GET whose answer is a model (`ret_info.model`) with
`fields_decor.primary` and without type arguments gets, in `repository_method.tpl` under
`{{#deco_args.local or owner_decor.repository.saveLocal}}`:

- `local: 'Repo.method'` in its `send`, so its rows are saved in the local database;
- a `<method>AsLocal()` twin that reads them back with `recall`, without a request.

The generated tests call the twin.

## Files generated once per project

- `lib/dragonfly.g.dart` (`dragonfly_g.tpl`): `startDragonfly`, `dragonflyConfig`, `registerDragonfly`,
  `buildRouter`, `appRouter`.
- `test/dragonfly_generated_test.dart` (`generated_tests.tpl`): the JSON round trip of models, the requests of
  repositories, the route guards, the forms and a smoke test of each screen. A field's JSON comes from its
  converter (`const Conv().toJson(DateTime(2000))`, or `sample()` when it has one); an enum field gets
  `Enum.values.first.name`.
- `flutter_native_splash.yaml` (`native_splash.tpl`): only with `decorated.splash`.

## Other rules of the output

- `Result<E, T>` is error first: fpdart's `Either` ([overview.md](overview.md)).
- Navigation is `context.goTo(...)`, `context.pushTo(...)`, `context.goBack(...)` with a screen, only in views.
