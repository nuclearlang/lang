# The code generator

`nuclear-codegen`: what `nuclear new`, `nuclear gen` and `nuclear make` write into a project. `gen` writes finished
code that compiles, from a resource's fields (models, repository, a use case per action, the facade's aliases, the
controller or the screen, the tests); `make` writes one skeleton of a kind, to fill in; `new` the files of a new
project.

## Why it exists

Most of an app is standard code: an entity, a repository, a use case that only calls it, a controller, a screen
that lists a resource, their tests. Written by a model, it costs tokens and fails on what is plain procedure;
written by a tool, it is the same every time, it compiles as written and it costs no model tokens. A person, an AI
agent, the MCP server and the Nuclear Builder all call the same generators, and only what they leave is written by
hand, in Nuclear ([ADR-platform-0004](../../docs/03-adr/0004-products-are-made-with-the-tools.md)).

What it leaves out on purpose: a use case with rules of its own and what a screen shows of it. Those are written by
hand (or by the local developer); the generator then wires them in.

## How we made it

The decision is [ADR-codegen-0001](docs/03-adr/0001-the-generators-write-finished-code-the-agent-only-what-is-not-standard.md):

- **Finished code or a refusal, never a placeholder.** `make` used to write nearly empty skeletons for a model to
  fill. Measured, that was worse than writing from scratch (29 of 42 against 37): the model copies the holes. When
  `gen` cannot write something finished, it refuses and says what to write first.
- **The templates are the platform's data**, `platforms/<platform>/generators.toml` (`backend`, `mobile`, `web`),
  never code of the generator. So the Nuclear a generator writes is the same for every dialect of a platform, and a
  test builds a generated resource with every dialect of every platform.
- **The fields come from data**: `--fields`, an example answer of the API (`--from-json <file or url>`) or a spec
  (`--from-spec`). A JSON key that is not the field's camelCase name gets `@key("air_date")`.
- **Nothing is overwritten, nothing is declared twice.** A file that exists is kept; a facade or a controller only
  gets the members it lacks; a name another file declares stops the command before it writes.
- **Written in Rust**, a library crate the `nuclear` command calls: the templates use the Mustache subset of the
  language's `nuclear-dialect`, and what it writes goes through the formatter.

## Try it

In a backend project (`nuclear new demo -p backend && cd demo`):

```sh
nuclear gen resource books Book --fields "id:int title:string author:string?"
#   created  components/books/data/entities/book.nuc
#   created  components/books/data/repositories/book_repository.nuc
#   created  components/books/domain/usecases/list_books.nuc   ... get, create, update, delete
#   created  components/books/api/books_controller.nuc
#   created  test/books_test.nuc
nuclear check --json                           # []: the generated code compiles
nuclear gen usecase books ArchiveBook          # ✗ ArchiveBook is not declared. A use case with rules of its own
                                               #   is written first (...), then this command wires it
nuclear make entity books Author               # created components/books/data/entities/author.nuc
nuclear gen resource weather Forecast --fields "id:int city:string" \
  --source rest:https://api.example.com --actions list,get --dry-run   # an HTTP repository: prints, writes nothing
nuclear help layout --platform backend         # where each kind's file goes
```

## Where to read next

- [The generators' guide](docs/08-guides/README.md): what `new`, `gen` and `make` write on each platform.
- [The generators in Synapsis](../../nuclear-synapsis-framework/docs/08-guides/generators.md): every option, how
  each source is read, every refusal.
- [How it works](docs/02-architecture/overview.md), [the roadmap](docs/01-product/roadmap.md).
- The command that calls it: [`nuclear`](../cli/README.md). To change it: [AGENTS.md](AGENTS.md).
