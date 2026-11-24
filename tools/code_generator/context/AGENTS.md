# {{name}}

TODO(user): one or two sentences: what it is, for whom, and the problem it solves.

## Stack

- A Synapsis project of the `{{platform}}` platform, written in NuclearLang (`.nuc`), built with the `{{dialect}}`
  dialect ({{stack}}). The target code is generated in `build/`: never edited by hand.
- Infrastructure: TODO(user): cloud, databases, queues, CI/CD.

## Commands

{{commands}}

## Structure

{{folders}}
- `docs/`: the context documents (the map below).

## Rules

- Never commit secrets.
- Before building a feature, read or write its spec in `docs/04-specs/`.
- A structural decision (a library, a pattern, infrastructure) is an ADR in `docs/03-adr/`.
- A changed API or contract updates `docs/02-architecture/integrations.md`.
- What is not documented and cannot be read from the code is asked, never invented.
- Nuclear itself is never written in `docs/`: the MCP server answers it (the NuclearLang section below); `docs/`
  holds this project's architecture and what is only its own (`docs/README.md`).
- A change is done when its tests pass and the documents it touches say it, in the same change.

## Documents (read by task)

| You need | Read |
|---|---|
| The business and the domain | `docs/00-context/` |
| The product's requirements | `docs/01-product/prd.md` |
| The architecture and dependencies | `docs/02-architecture/` |
| Why something was decided | `docs/03-adr/README.md` |
| The work in progress | `docs/04-specs/README.md` |
| Code and test conventions | `docs/05-standards/` |
| Deploying or operating | `docs/06-runbooks/` |
