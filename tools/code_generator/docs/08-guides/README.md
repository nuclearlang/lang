---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [tools/code_generator/src/generate.rs, tools/code_generator/src/scaffold.rs, tools/code_generator/platforms/, nuclear-synapsis-framework/docs/08-guides/generators.md, docs/03-adr/0004-products-are-made-with-the-tools.md]
---
# The generators: `nuclear new`, `gen` and `make`

Most of an app is standard code: an entity, a repository, a use case that only calls it, a controller, a screen
that lists a resource, their tests. In NuclearLang that code is written by a tool, not by a person and not by a
model: the result is the same every time, it compiles as written, and it costs no model tokens. A person, an AI
agent, the MCP server and the Nuclear Builder all call the same generators.

This is how products are made on the platform: `nuclear new`, `nuclear gen` and `nuclear make` come first, and only
what they leave is written by hand, in Nuclear
([ADR-platform-0004](../../../../docs/03-adr/0004-products-are-made-with-the-tools.md),
[ADR-codegen-0001](../03-adr/0001-the-generators-write-finished-code-the-agent-only-what-is-not-standard.md)).

The three commands:

| Command | Writes |
|---|---|
| `nuclear new <name> -p <platform>` | the files of a new project |
| `nuclear gen resource` / `gen usecase` / `gen component` | finished code that compiles, or a refusal that says what to do |
| `nuclear make <kind> <component> <Name>` (`nuclear g`) | one skeleton of a kind, to fill in |

What each writes is the platform's data (`platforms/<platform>/generators.toml` in this project), so it is the
same Nuclear for every dialect of the platform. **A generator never overwrites a file**: a file that exists is
kept, a facade or a controller only gets the members it lacks, and a name another file declares stops the command
before it writes anything.

## `nuclear new`

The `.nuc` files `new` writes (the output of a real run):

| Platform | Files |
|---|---|
| `backend` (`fastapi`, `nestjs`) | `config.nuc`, `config/project_config.nuc`, `test/app_test.nuc` |
| `web` (`react`) | `config.nuc`, `main.nuc`, `config/project_config.nuc` |
| `mobile` (`flutter`) | `config.nuc`, `main.nuc`, `config/project_config.nuc` and a `home` component: `home_component.nuc`, `domain/usecases/hello_home_usecase.nuc`, `presentation/home/home_screen.nuc`, `presentation/home/managers/home_manager.nuc`, `presentation/home/state_models/home_state.nuc`; then the Flutter app in `build/app` |

Every platform also gets its context documents, the project's from then on: `AGENTS.md`, `CLAUDE.md` and `docs/`
in layers (vision, PRD, roadmap, architecture with the platform's layout, ADRs, specs and their template, standards,
runbooks), filled with what `new` knows; the rest is a `TODO(user):` line. How they are written:
[context-docs.md](context-docs.md) (`nuclear help context-docs`).

## `nuclear gen resource <component> <Name>`

A resource is something the app lists, reads and changes. The fields come from one of three sources:

```sh
nuclear gen resource books Book --fields "id:int title:string author:string?"
nuclear gen resource users User --from-json users.json          # an example answer of an API (a file or a url)
nuclear gen resource episodes Episode --from-spec episodes.md    # the spec's Key | Type | Description table
```

From `--from-spec`, a `GET https://...` line gives the API, and a snake_case key keeps its name with `@key`:

```nuc
Episode
  id: int
  name: string
  @key("air_date")
  airDate: string
```

The other options:

| Option | Meaning |
|---|---|
| `--source rest:<base url>` \| `rest` \| `db` | another API (an HTTP repository) or the database (default: `db`; `rest` with a url). The web platform has no `db` |
| `--actions list,get,search,create,update,delete` | one use case each. Default: `list,get` for `rest`, every one for `db` |
| `--path <path>` | the API's path of the resource (default: the url's last segment, or the name) |
| `--screen <screen>` | mobile and web: a screen that lists the resource |
| `--plural <Names>` | when the English plural is not the right one |
| `--dry-run` | print the files and their code, write nothing |

What it writes, per platform (from `--dry-run`):

**backend, `--source db`** (the default): `nuclear gen resource books Book --fields "id:int title:string author:string?"`

```text
components/books/data/entities/book.nuc
components/books/domain/models/new_book.nuc
components/books/data/repositories/book_repository.nuc
components/books/domain/usecases/list_books.nuc
components/books/domain/usecases/get_book.nuc
components/books/domain/usecases/create_book.nuc
components/books/domain/usecases/update_book.nuc
components/books/domain/usecases/delete_book.nuc
components/books/books_appcomponent.nuc
components/books/api/books_controller.nuc
test/books_test.nuc
```

**backend, `--source rest`**: `nuclear gen resource weather Forecast --fields "id:int city:string" --source rest:https://api.example.com --actions list,get`

```text
components/weather/domain/models/forecast.nuc
components/weather/data/repositories/forecast_repository.nuc
components/weather/domain/usecases/list_forecasts.nuc
components/weather/domain/usecases/get_forecast.nuc
components/weather/weather_appcomponent.nuc
components/weather/api/forecasts_controller.nuc
```

**mobile and web** (the same files): `nuclear gen resource books Book --fields "id:int title:string" --source rest:https://api.example.com --screen catalog`

```text
components/books/domain/models/book.nuc
components/books/domain/models/book_error.nuc
components/books/data/book_repository.nuc
components/books/domain/usecases/list_books.nuc
components/books/domain/usecases/get_book.nuc
components/books/books_component.nuc
components/books/presentation/catalog/state_models/books_state.nuc
components/books/presentation/catalog/managers/books_manager.nuc
components/books/presentation/catalog/books_screen.nuc
test/books_test.nuc
```

Run the same command twice and nothing changes:

```text
    created  components/books/data/entities/book.nuc        (first run)
       kept  components/books/data/entities/book.nuc        (second run)
```

## `nuclear gen usecase <component> <Name>`

Wires a use case into its component: its alias in the facade and, with `--route`, its route in the controller
(backend; the controller is created when missing, and a `{name}` of the path is a parameter of the use case).

```sh
nuclear gen usecase books CountBooks --calls BookRepository.page --route "GET books/count"
```

With `--calls <Repository>.<method>` the use case is written too: it only calls that method, which a repository of
the project must declare. Without it, the use case has rules of its own: write it first, by hand, then run the
command to wire it. Otherwise it refuses:

```text
✗ ArchiveBook is not declared. A use case with rules of its own is written first
  (components/books/domain/usecases/archive_book.nuc: `usecase ArchiveBook(...)` with `exec(...) Result<Error, T>`),
  then this command wires it; one that only calls a repository is written here: --calls <Repository>.<method>
```

## `nuclear gen component <component>` and `nuclear gen inspect`

`gen component orders` writes the component's facade (backend: `components/orders/orders_appcomponent.nuc`;
mobile and web: `components/<c>/<c>_component.nuc`). `gen inspect` prints what the project has, as JSON: each
component and its declarations (`file`, `kind`, `name`). An agent reads it before it generates.

TODO(human): `nuclear gen` says `gen component` writes "its facade and its config"; a backend dry run lists only
the facade. Which is right?

## `nuclear make <kind> <component> <Name>`

A skeleton of one kind, at the platform's place, to fill in by hand. `nuclear make` alone lists the kinds of the
project's platform; `nuclear help layout --platform <p>` prints where each one goes.

| Platform | Kinds |
|---|---|
| backend | agent, aggregate, appcomponent, config, controller, entity, listener, model, repository, service, state, tests, tools, usecase |
| web | appcomponent, event, model, repository, service, stateful, stateless, statemodel, tests, usecase (`--screen <screen>` for the screen's pieces) |
| mobile | component, screen, statemanager, statemodel, stateful, usecase, repository, model, service, aggregate, config, test, event, widget, guard, global, page, integration (`nuclear help` lists their aliases and options) |

```text
$ nuclear make entity books Author          (backend)
  created components/books/data/entities/author.nuc
$ nuclear g service books Pricing
  created components/books/domain/services/pricing.nuc
$ nuclear make stateless shop Cart --screen cart          (web)
  created components/shop/presentation/cart/cart.nuc
$ nuclear make screen shop cart --route /cart          (mobile)
  created components/shop/presentation/cart/state_models/cart_state.nuc
  created components/shop/presentation/cart/managers/cart_manager.nuc
  created components/shop/presentation/cart/cart_screen.nuc
note: the component 'shop' has no facade yet; create it with: nuclear g c shop
```

## Go deeper

- [The generators in Synapsis](../../../../nuclear-synapsis-framework/docs/08-guides/generators.md): every option,
  how each source is read, and every refusal.
- [The `nuclear` command](../../../cli/docs/08-guides/README.md): the rest of the commands.
- How the generators work and how to add a piece: [the overview](../02-architecture/overview.md).
