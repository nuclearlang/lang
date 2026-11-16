---
status: accepted
date: 2026-11-11
deciders: Julian Molina
---
# ADR-0001: The CLI and the MCP generate the standard code; an agent writes only what is not standard

## Context and problem
A feature such as "list the characters of an API, paged" is mostly code that follows from its data: a component,
the models of the answer, a repository over the API, one use case per action, the aliases of the component's facade,
a controller or a screen with its state manager, the tests. Frameworks generate that code (Phoenix
`mix phx.gen.json`, Laravel `artisan make:model -mcr`, Symfony `make:crud`), and NuclearLang exists so that the
deterministic work is done by a tool. Yet `dragonfly make` wrote one nearly empty file per kind (no fields, nothing
wired, no REST in the backend) and the Loop asked a 3B model to write every file: it failed on what is plain
procedure.

The user's rule: the CLI and the MCP do most of the code; the agent writes only use cases with their own logic and
the interface; a frontier model (whatever the user has) understands the global context and the spec; the agent must
know where the fields come from (the spec, the API's answer, the API's documentation) and look them up, or ask.

## Decision
1. **`dragonfly gen` generates finished code that compiles, never placeholders.**
   - `gen component <component>`: the component's folder, its facade (`appcomponent`) and its config.
   - `gen resource <component> <Name>`: the models (with their fields; nested objects become models), the
     repository (`--source rest:<base url> --path <path>`: an HTTP repository; `--source db`: an entity and its
     queries), one use case per action (`--actions list,get,search,create,update,delete`), their aliases in the
     facade, the entry of the platform (backend: a controller with the routes; mobile and web: `--screen <screen>`,
     a screen with its state manager and state model) and the tests of each action. A component that does not exist
     is created first; a file that exists is never overwritten (the facade gets the missing aliases added).
   - The fields come from `--fields "id:int name:string origin:Origin"`, from `--from-json <file or url>` (an
     example answer of the API: a list under `results` is a paged answer, a nested object a model, `null` an
     optional field) or from `--from-spec <spec.md>` (its example answer, else its `Key | Type | Description` table;
     a table with objects it does not detail reads the API's answer from the spec's `GET <url>` line, which also
     gives the API). A JSON key that is not the field's camelCase name gets `@key("air_date")`; the backend platform
     has `@key` for it (pydantic aliases, class-transformer `@Expose`), as mobile and web had.
   - Before writing anything it refuses a field type nobody declared, a name another file declares (N0303) and a
     source the platform has no pieces for (mobile and web read APIs; a database resource is backend only). The
     `Http` connection is added from the platform's `[gen] http` (or `http_named`, a named one, when the app has
     another), and the repository then names it.
   - `gen usecase <component> <Name>` wires a use case into its component: its alias in the facade and, on the
     backend, with `--route "POST orders/{id}/cancel"`, its route in the controller of the route's prefix (made when
     missing; a `{name}` of the path must be a parameter of the use case). The signature is read from the project,
     never typed again: a use case with rules of its own is written first (by hand or by the coder) and this wires
     it, calling it with `~` only when its `exec` awaits. `--calls <Repository>.<method>` writes the use case too,
     because one that only calls a repository method follows from that method (a method that answers no `Result`
     goes inside an `Ok`: backend). A use case that is neither declared nor given `--calls` is refused with the
     place and the form to write it: a use case with a hole in it would be a placeholder. What a screen shows of a
     use case (a state manager's method and its state) is the interface, written by hand.
   - `gen inspect`: what the project has (components, declarations by kind) as JSON, so an agent checks before it
     generates. A screen that is not a resource's list is `dragonfly make screen` (mobile, web); a resource's list
     screen comes with `gen resource --screen`.
2. **The templates are the platform's** (`[[generators.<what>]]` of its `platform.toml`), never the CLI's code: the
   Nuclear a generator writes is the same for every dialect of a platform. The CLI only reads the fields, picks the
   templates and writes the files at the platform's `[layout]` paths. A merge (`merge = true`) adds whole members,
   told by their head line, so a route keeps its decorator and its body.
3. **The backend has HTTP repositories** with the mobile platform's words: a repository whose methods carry `@get`,
   `@post`, `@put`, `@patch`, `@delete` and no body calls the `Http(baseUrl)` connection (path parameters `:id`,
   the others in the query or the body; an error status is the `Err` of a `Result`), in fastapi and nestjs.
4. **A generated route does not depend on the order it was written in.** A generator appends a route to a
   controller, so both backend runtimes add a fixed segment before a parameter (`search` before `{id}`), whatever
   the order in the `.nuc`.
5. **The MCP exposes the generators and what a model needs to fill them**: `project_inspect`, `generate_component`,
   `generate_resource`, `generate_usecase`, `generate_screen`, `api_inspect` (fetches a url and answers its JSON's
   shape and the files it implies), `web_search` and `web_read` (the API's documentation). Its instructions tell
   the client to generate first and give `developer_task` only what is left.
6. **The Loop generates before it writes**: a *Generate* stage between the spec and the plan runs
   `dragonfly gen resource` for each resource the spec names (a `## Resources` section, else each `GET <url>` line
   of the description). The planner is told what was generated and plans only the rest (a piece that repeats a
   generated file is dropped), the agents write only that, and the tests check the whole. The generated files go to
   the run's write ledger, so a crash undoes them like an agent's.

## Options considered
1. Skeletons with placeholders for the model to fill (what `dragonfly make` did). Measured: worse than writing from
   scratch, 29 of 42 against 37: the model copies the holes.
2. Generators written in each dialect: the Nuclear would differ between the dialects of a platform.
3. Letting the model write the standard code with more examples: it costs tokens and fails on procedure a command
   does exactly.
4. Generators of finished code whose templates are the platform's data. Chosen.

## Consequences
- Positive: a standard feature costs no model tokens; the local 3B model only fills what is specific, where it does
  well. The backend has an HTTP client in both runtimes (`dragonfly-py` over httpx, `dragonfly-nest` over fetch).
- Negative: each platform keeps generator templates next to its kinds, and a new kind or decorator must update
  them (a test builds a generated resource with every dialect of every platform).
- Limits known when it was delivered: the backend platform has no `@mock`, so a REST resource of the backend gets
  no generated tests (a test there would call the real API), and the local tester's own test of such a resource is
  often wrong; the nestjs HTTP repository answers the API's JSON as it came (a use case that reads a renamed field
  gets `undefined`). Both are in the [roadmap](../01-product/roadmap.md).

## References
- Replaces: ADR-0103
- The platforms and the rule that their Nuclear is the same for every dialect: `ADR-synapsis-0002`.
- The MCP server and the Loop it is used from: `ADR-platform-0003`.
- The user guide: `nuclear-synapsis-framework/docs/08-guides/generators.md`.
