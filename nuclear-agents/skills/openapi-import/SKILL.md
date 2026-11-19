---
name: openapi-import
description: Bring an external API (an OpenAPI document or any JSON API) into a Synapsis project with gen resource --from-json or --from-spec, and say honestly what is not imported. Use when a product must call a third-party or legacy API that is not written in Nuclear.
title: Importing an API
title_es: Importar una API
description_es: Traer una API externa (un documento OpenAPI o cualquier API JSON) a un proyecto Synapsis con gen resource --from-json o --from-spec, y decir con honestidad qué no se importa. Úsalo cuando un producto debe llamar a una API de terceros o heredada que no está escrita en Nuclear.
kind: technology
tags: [openapi, swagger, import, api, third party, from-json, http repository, integration]
---
# Importing an API

## When to use

A product must call an API not written in Nuclear: a payment provider, a public data API, a legacy service with an
OpenAPI (Swagger) document. For a backend written in Nuclear use its contract instead (skill `rest-contracts`).

## The platform's tools (what it does and does not do)

- **There is no OpenAPI importer.** No command reads an OpenAPI or Swagger document and writes its models and
  repositories. The platform exports OpenAPI (a backend's build writes `.nuclear/openapi.json`); it does not import
  it.
- **What exists**: `nuclear gen resource` builds a whole resource from **one example answer** (`--from-json <file|url>`)
  or from a spec (`--from-spec <spec.md>`: its example answer, else its `Key | Type | Description` table; a
  `GET https://...` line gives the API). It writes the models (a nested object becomes `<Name><Key>`, a paged answer
  `<Name>Page`, a snake_case key gets `@key`), an HTTP repository, a use case per action, the facade's aliases and
  the controller (backend) or the screen (mobile, web, with `--screen`).
- The editor's HTTP Connections view opens OpenAPI documents (JSON only) to send requests by hand: useful to get
  real example answers, not to generate code.
- MCP: `api_inspect(url, project, component, name)` shows the shape of a public API's answer and the files
  `generate_resource` would write.

## Steps

1. **List the resources** you need from the document: for each, its base URL, path, the actions used and one
   example answer. Do not import the whole API: only what a use case calls.
2. **Get a real example answer** for each resource: call the API (HTTP Connections, or the document's `example`) and
   save it as `specs/<resource>/example.json`. A public GET URL can be given directly.
3. **Generate**: `nuclear gen resource characters Character --from-json https://rickandmortyapi.com/api/character`
   or, from a saved file, `nuclear gen resource payments Charge --from-json specs/charges/example.json
   --source rest:<base url> --path charges --actions list,get,create`. `--dry-run` first; `--plural` when the
   English plural is wrong.
4. **Or from a spec**: write `specs/<component>/<id>/spec.md` with a `Key | Type | Description` table and a
   `GET https://...` line, then `nuclear gen resource <component> <Name> --from-spec <spec.md>`.
5. **Credentials**: the generated `Http(baseUrl)` connection takes `headers` (an API key) and `timeout`; put the key
   in `env("PROVIDER_API_KEY")`, never in a literal.
6. **What is left, by hand in Nuclear**: another endpoint of the same resource is a repository method without a
   body with `@get(path = ":id/items")`, `@post`... (`nuclear help backend` §2.2 or `nuclear help web` §3.3); then
   `nuclear gen usecase <component> <Name> --calls <Repository>.<method>`.
7. `nuclear check --json`, `nuclear test`.
8. **Record the gap**: each part of the document the tools could not take (below) goes to the roadmap of the code
   generator (`tools/code_generator/docs/01-product/roadmap.md`) when it blocks the product.

## Pitfalls

- Polymorphic schemas (`oneOf`, `anyOf`, discriminators), enums, formats (`date-time`, `uuid`) and required/optional
  rules are not read from the document: the example answer decides the types. A field absent from the example is
  absent from the model; a `null` in the example gives no type. Pick an example with every field filled, or fix the
  model by hand (`T?` for optional).
- Authentication schemes (OAuth flows, signed requests) are not generated: only static `headers` on the connection.
- A backend resource over `rest` gets no tests, and an `Http` connection takes no fake transport in backend tests
  (roadmap): test the use cases on models built by hand.
- An error answer becomes an `Err` by status (404 `NotFound`, 400/422 `Invalid`, 401, 403, 409); a provider's error
  body is not modelled.
- Never translate the vendor's SDK or a generated client into Nuclear by hand, and never write target code for it.
  A vendor SDK needed on a device is `nuclear add <package>`, which ties that code to the dialect.

## Checklist

- [ ] Each resource came from `nuclear gen resource` with `--from-json`, `--from-spec` or `--fields`.
- [ ] The example answers used are kept under `specs/` so the generation can be repeated.
- [ ] API keys come from `env(...)` through the connection's `headers`.
- [ ] Optional and nullable fields were checked against the document and marked `T?`.
- [ ] Every gap the tools could not cover is listed in the project's docs and, when blocking, the generator's roadmap.
- [ ] `nuclear check --json` prints `[]` and `nuclear test` is green.
