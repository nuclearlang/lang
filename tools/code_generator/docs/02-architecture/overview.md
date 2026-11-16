---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [nuclear-synapsis-framework/cli/src/generate.rs, nuclear-synapsis-framework/cli/src/scaffold.rs, nuclearlang/docs/07-reference/dialects.md, nuclear-synapsis-framework/docs/08-guides/generators.md]
---
# The code generator: overview

Two commands write files into a project. `dragonfly gen` writes finished code from data; `dragonfly make` writes a
skeleton of one kind. Both write Nuclear only, and neither overwrites a file. What a user types and gets is in
[the generators' guide](../../../../nuclear-synapsis-framework/docs/08-guides/generators.md).

## `gen`: from a resource's data to files

```
 --fields | --from-json | --from-spec        platform.toml of the project's platform
        │ fields, models, page                [[generators.<what>]]  [gen]  [layout]
        ▼                                              │
   Resource / UseCase ──► context (values) ──► plan: one (path, text, merge) per piece ──► write
                                                                                           created | kept | added to
```

1. **The fields** (`gen_command` in `main.rs`, `generate.rs`):
   - `--fields "id:int name:string origin:Origin?"` → `parse_fields`.
   - `--from-json <file|url>` → `from_json`: a nested object becomes a model `<Name><Key>` (`object_model`,
     `nested`), a list under a key of a paged answer gives `<Name>Page`, `null` an optional field, a key that is not
     the field's camelCase name gets `@key` (`json_key`). A url is fetched with `curl` (`fetch_text`) and also gives
     the API's base and path.
   - `--from-spec <spec.md>` → its example answer (`spec_json`), else its `Key | Type | Description` table
     (`from_spec`); a table with objects it does not detail reads the API's answer from the spec's `GET <url>` line
     (`spec_url`).
2. **The checks, before anything is written**: every type a field names is basic (`BASIC`), a model of the same
   answer or declared in the project (`nuclear_transpile::map::inventory`); a database resource takes only columns
   of basic types (a relation is written by hand) and has no generated `search` (which column is searched is a
   decision); the actions are of `ACTIONS`; the platform has pieces for the source (`when = "rest"` / `"db"`:
   mobile and web read APIs, a database resource is backend only); a name another file declares is refused (N0303).
3. **The context** (`context(&Resource)`, `usecase_context(&UseCase)`): the values the templates read. `Name`/`name`,
   `Names`/`names` (`plural`, or `--plural`), `component`/`Component`, `fields`, `data` (the fields without the
   key), `models`, `rest`/`db`, `path`, `baseUrl`, `connection`, `paged`, `Page`, `items`, `idType`,
   `actions.<action>`, `each_action`, `screen`/`Screen`, and the samples the tests use (`sample_of`, `sample`). The
   whole list is in `nuclearlang/docs/07-reference/dialects.md`.
4. **The plan** (`plan(dialect, what, ctx)`): for each `[[generators.<what>]]` piece of the platform, skipped when
   its `when` value is not true, once per item of its `each` list: the declaration's name (`name` rendered), its
   path (the `[layout]` place of its `kind` with `{component}`, `{screen}`, `{file}` = the name in snake_case), and
   its text (`template` rendered, then put in the canonical layout by `nuclear_syntax::fmt::format`).
5. **The write** (`write`): a missing file is `created`; a file that exists is `kept`; a `merge = true` piece (a
   facade, a repository, a controller) gets the members it lacks, each one whole (`members`: its decorators, its
   head line and its body, told by the head line), and says `added to`. `--dry-run` shows the plan and writes
   nothing. A component that does not exist is created first (`generators.component`).
6. **The `Http` connection** (`ensure_http`): a REST resource whose base url no connection of the app's
   `appConfig` file has gets one written with the platform's `[gen] http` form, or `http_named` (named after the
   component) when the app already has another; the repository then names it.

`gen usecase` (`UseCase`, `Route`, `parse_route`, `result_parts`): the signature of `exec` is read from the project
with `nuclear_transpile::map::shape`, never typed again. `--calls <Repository>.<method>` writes the use case too
(a method that answers no `Result` goes inside an `Ok`); `--route "<VERB> <prefix>[/<path>]"` adds its route to the
controller of the prefix, made when missing (a `{name}` of the path must be a parameter of the use case; the route
calls it with `~` only when `exec` awaits). A use case that is neither declared nor given `--calls` is refused with
the place and the form to write it.

`gen inspect` prints what the project has as JSON: its platform and dialect, its components with their declarations
(`kind`, `name`, `file`), what is outside a component, and the generators of its platform.

## `make`: one skeleton of a kind

| Project | Where the skeleton is | Code |
|---|---|---|
| Mobile | Rust templates in `scaffold.rs`: project, component, screen (`--manager`, `--state`, `--route`), statemanager / statemodel (`presentation`), stateful, usecase, repository, model, service, aggregate, config, test, event, widget, guard, global, page (`--route`, `--not-found`), integration | `make` in `main.rs`; `component`, `screen`, `config`, `in_component`, `test`, `shared`, `presentation`, `app_wide` |
| Backend, web | The platform's `[skeletons]` entry of the kind, written at its `[layout]` path, with `{{Name}}`, `{{name}}`, `{{Component}}`, `{{component}}`, `{{table}}` filled | `make_from_layout` in `main.rs` |

`scaffold.rs` also holds the files of a new project (`project`, `backend_project`, `web_project`), the name helpers
`snake` / `pascal`, and `write`, which never overwrites. Names are given in any case and normalized.

## The data of a platform

In `nuclear-synapsis-framework/platforms/<platform>/platform.toml` today; in
`tools/code_generator/platforms/<platform>/` after spec 008, T4.2.

| Section | What it gives | Backend | Mobile | Web |
|---|---|---|---|---|
| `[layout]` | the place of every kind's file | yes | yes | yes |
| `[skeletons]` | what `make <kind>` writes | yes | no (`scaffold.rs`) | yes |
| `[gen]` | the forms of the `Http` connection (`http`, `http_named`) | yes | yes | yes |
| `[[generators.component]]`, `[[generators.resource]]`, `[[generators.usecase]]` | the pieces of each `gen` command | yes | yes | yes |

The templates are Nuclear, the same for every dialect of the platform: nothing here names a dialect.

## Tests

- `generate.rs`: `a_spec_gives_its_example_answer_and_its_url`, `plurals_and_fields`,
  `an_example_answer_gives_the_models_and_the_page`, `a_route_is_a_verb_a_prefix_and_a_path_of_the_parameters`,
  `a_merge_adds_whole_members`, `a_spec_table_gives_the_fields_or_says_what_is_missing`.
- `main.rs`: `a_generated_resource_compiles_with_every_dialect`, `make_writes_every_kind_where_the_platform_says`.
- `scaffold.rs`: `names`, `every_skeleton_parses`, `every_new_project_compiles_with_its_dialect`.

## Who calls it

- A person or an agent in a shell: `dragonfly gen`, `dragonfly make` ([the CLI](../../../cli/AGENTS.md)).
- The MCP server: `project_inspect`, `generate_component`, `generate_resource`, `generate_usecase`,
  `generate_screen` and `api_inspect` run these commands ([the MCP server](../../../mcp/AGENTS.md)).
- The Loop's *Generate* stage: `dragonfly gen resource` for each resource a spec names, before any agent works
  ([the extensions](../../../../extensions/AGENTS.md)).

The state manager that `make screen` (and `make statemanager`) writes loads `Ok([])`: it calls no use case,
because a component made by `gen resource` has none of the skeleton's (`hello` exists only in a component made by
`make component`). The user replaces it with a call to one of the component's aliases.
