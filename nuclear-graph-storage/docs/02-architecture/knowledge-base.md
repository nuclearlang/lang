---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [shelves.md, ../06-runbooks/update-the-knowledge-base.md, ../../data/README.md, ../03-adr/0001-a-library-of-typed-linked-versioned-rows.md]
---
# The knowledge base: assets, versions, and how it stays current

What the graph knows is one folder: `nuclear-graph-storage/data`. Its `assets/<shelf>/<name>.json` files are the
rows: `{shelf, origin, about, rows}`. The files of the folder and an example row are in
[`data/README.md`](../../data/README.md); the commands are in
[the runbook](../06-runbooks/update-the-knowledge-base.md).

## Three kinds of content

**Generated rows** (`"origin": "generated"`, never edited by hand) are read from a structured source by
`nuclear-graph knowledge build` (the `extract*.nuc` modules):

| Rows | Read from |
|---|---|
| the diagnostics | the compiler's `Code` table joined with `nuclearlang/docs/07-reference/diagnostics.md`; a code without documentation fails the build |
| the habits of other languages | the table of the base brief (`nuclearlang/docs/07-reference/brief/nuclear-base.md`) |
| the standard library, and the names of other languages it replaces | `nuclearlang/crates/nuclear-dialect/src/library.rs` |
| each platform's kinds, decorators, layout and plugins | `nuclear-synapsis-framework/platforms/<platform>/platform.toml`, and the `docs.toml` and `dialect.toml` of the platform's default dialect |
| what each generator writes | the `generators` table of `tools/code_generator/platforms/<platform>/generators.toml` (the extractor still reads `platform.toml`: [roadmap](../01-product/roadmap.md)) |
| the commands of `nuclear`, `nuclear-builder` and `nuclear-graph` | their help, read from the installed binaries |
| the MCP tools and the server's instructions | `nuclear-mcp tools` (the project `tools/mcp`), read from the installed command |
| the HTTP routes of the graph and of the Nuclear Developer | `server.nuc`, the Developer's controller |
| the Builder's stages, the editor's commands and settings | `extensions/tools/nuclear-builder/src/engine.ts`, `extensions/vscode/package.json` |
| the local agents | their own sources in `nuclear-agents/nuclear_developer/` |
| each component's version (and its repository: `nuclearlang/lang`, the whole tree) | its manifest (`COMPONENTS` in `extract_tools.nuc`) |
| the examples | every `.nuc` of the example projects, by kind and platform |
| the solved tasks | the validated answers of the `train` tasks of the Developer's evaluation, never the held-out ones |
| the documents | every markdown file of the tree and the website: one row per heading section, on the shelf its section of `data/sections.toml` names |

**Curated rows** (`"origin": "curated"`) are written by hand, because no file says it in one place: the purpose and
the advantages, the concepts and the theory, the questions people ask, what can and cannot be done, the limits of
the local agents, the playbooks and the strategies, the roles and skills, the failures of the tools and services,
the mistakes small models repeat. Each names its `sources`: a file, or `file#Heading` for one section.

**Overlays** (`<name>.overlay.json`) add hand-written fields to generated rows by id: which errors come together, a
right example, who reads it.

A new command, MCP tool, kind, decorator, diagnostic, version or example reaches the base by building it. A new
capability, limit, failure or procedure needs its row written by hand.

## Valid or not built

`build` and `ingest` refuse a base with: a link to a row that does not exist, a duplicated id, a prefix or a type
of another shelf, a filter the shelf does not have, a missing title, summary or body, code of a target language in
a row the local agents read, a diagnostic without documentation, a document no section claims, or a query of the
catalogue that does not run ([exact-facts.md](exact-facts.md)).

## Versions

- `data/manifest.json` holds the schema (the row format; it changes when an old row could not be read), the
  revision (one more whenever any row changes, is added or is removed), each row's hash and the revision that last
  changed it, and for each curated row the hash of each of its `sources` at its last review.
- `data/revisions.json` is the log: what each revision added, changed and removed.
- An ingest writes the schema and the revision into the collections' metadata; `GET /v1/stats` and
  `nuclear-graph stats` say which revision the graph holds.

## The base never stays behind the code

`nuclear-graph knowledge check` fails when a generated file is not what the tree gives now, when a row is invalid,
when the manifest is of other rows, when a source of a curated row changed since its review, or when the running
graph holds another revision. The end-of-turn hook of the working tree (`.claude/hooks/context-check.sh stop`) runs
it: a session that changed the ecosystem cannot finish while it fails. The procedure is itself a row,
`playbook:update-the-knowledge-base`. A row written by hand is reviewed when it is written or changed.

An ingest embeds again only what changed, removes only the sources of its own roots, and keeps what an agent wrote
at run time.

## Retrieval is tested with people's questions

`data/questions.toml` lists questions and the row each must return, and requests with the strategy each must get.
`nuclear-graph knowledge ask` runs them against the running graph; a question a change answers is added with the
change. See [testing](../05-standards/testing.md).

## What is never in the base

The teaching material (`docs/aprende`) and the pending work of the projects. The pending work changes with every
task: what matters of it for a reader of the graph is in `capabilities` rows that name its sections as sources, so
a change there asks for their review.

## Limits

- The help of `nuclear` and `nuclear-builder`, and the tools of `nuclear-mcp`, are read from the installed commands: after changing a
  command, install it (`installer/install.sh`) before building the base.
- A curated row without `sources` is never asked for a review; one whose source is a long section is asked often.

The help of every command the build records (`nuclear`, `nuclear-builder`, `nuclear-graph` itself) is
rendered 100 columns wide, whatever the terminal of whoever runs the build: the rows are the same in a shell, in
the end-of-turn hook and in CI.
