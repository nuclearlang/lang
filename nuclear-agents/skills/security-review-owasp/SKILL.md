---
name: security-review-owasp
description: Review a Synapsis project against the OWASP Top 10 with the platform's defences: guards and @acl, validation decorators, secrets in env, the query chain, fixed base URLs against SSRF, dependency checks. Use before shipping a feature, on a security finding, or for a security review.
title: Security review (OWASP)
title_es: Revisión de seguridad (OWASP)
description_es: Revisar un proyecto Synapsis frente al OWASP Top 10 con las defensas propias de la plataforma: guards y @acl, decoradores de validación, secretos en env, la cadena de consultas contra la inyección, URLs base fijas contra SSRF, revisión de dependencias. Úsalo antes de publicar una función, ante un hallazgo de seguridad o cuando se pide una revisión de seguridad.
kind: practice
tags: [security, owasp, review, injection, ssrf, secrets, access control, validation, vulnerabilities]
base: true
---
# Security review (OWASP)

## When to use

Before a feature ships, when a finding arrives, or when a review is asked. Review the `.nuc` and the project's
configuration, never the generated code: a fix is always a change in Nuclear (or a gap recorded in the platform's
roadmap), never a patch in `build/`.

## Steps

Walk the change through each risk; each finding gets the file and line, the risk, and the fix in Nuclear.

1. **A01 Broken access control.** Every backend route is reachable only as intended: `guards` in `appConfig`
   (`Token(value = env("..."))`, `NoOrigin()` for a local service) and per controller
   (`@controller("x", guards = [...])`). A use case checks ownership (another user's item answers `Forbidden` or
   `NotFound`). On mobile and web, `@acl(roles, permissions, guards)` and `@requires(session)` guard the UI only:
   the backend must refuse too.
2. **A02 Cryptographic failures.** Secrets come from `env("VAR")`, never literals in `.nuc`, tests or docs;
   `testEnv(...)` holds test values only. No password or token stored in a plain column. The mobile local database
   is encrypted unless the config says `LocalDatabase(encrypted = false)`: question any such line.
3. **A03 Injection.** Queries use the repository chain (`where({ "title": t })`, `like`, `oneOf`...): the platform
   has no raw SQL word, so there is nothing to concatenate. Every body is a model with validation decorators
   (`@required`, `@minLength`, `@maxLength`, `@min`, `@max`, `@pattern(r"...")`, `@email`, `@url`). Text sent to a
   model's prompt (an `agent`) is untrusted: its tools must check what they do.
4. **A04 Insecure design.** Rules live in use cases returning `Result`; limits (amounts, counts) are checked on the
   server; state changes follow allowed transitions; writes that must not repeat are idempotent.
5. **A05 Misconfiguration.** `createTables` off in production (migrations instead); a guarded app serves no docs
   pages; plugins enabled only when used; no debug values in `config/project_config.nuc`.
6. **A06 Vulnerable components.** `nuclear add <package>@<version>` pins what enters `config.nuc`; review each added
   package. The platform has no audit command: add the target's audit tool to the CI `security` stage (skill
   `ci-pipelines`).
7. **A07 Authentication failures.** Tokens travel in headers only (guards never read the query). The backend has no
   user/session kind yet: say so instead of inventing one in target code.
8. **A08 Integrity failures.** `build/` and `contracts/` untouched; migrations read before applying; the contract copy
   committed.
9. **A09 Logging failures.** Errors return the platform's statuses without internals; nothing logs secrets or
   personal data; with `plugins(telemetry = true)` use cases are traced.
10. **A10 SSRF.** HTTP repositories call a fixed `Http(baseUrl)` from the configuration; a parameter only fills a
    `:name` segment or the query. Never build a base URL or a full URL from user input.

## The platform's tools

- `nuclear check . --json` (architecture rules N0301/N0302 keep repositories behind use cases).
- Backend tests with `appClient()`: requests without the token, with another user's id, with invalid bodies.
- MCP: `developer_security(code, platform)` for findings on a piece; `graph_prompt("security")` for the validated
  review prompt; the local developer runs a security review in `developer_task`.
- `nuclear-builder ci security` runs the line's security commands.

## Pitfalls

- Trusting `@acl` on a screen as protection: it hides UI; the backend decides.
- A token in a URL: it reaches access logs and the guard ignores it.
- `Token(value = env("X"))` with `X` unset: an empty value refuses every request (safe), but check deployment sets it.
- A browser cannot reach the API from another origin (no CORS setting): do not "fix" it by patching the generated app.
- Reporting a generated-code issue as fixed by editing `build/`: the next build undoes it.
- Findings without a reproducing test: write the test (skill `tdd`).

## Checklist

- [ ] Every route has a guard or is meant to be public, and the docs say which.
- [ ] Ownership is checked in the use case; a test tries another user's item.
- [ ] Every body is a validated model; a test sends an invalid one and gets a 4xx.
- [ ] No secret literal in `.nuc`, tests, docs or `.nuclear/builder.json`; all from `env(...)`.
- [ ] No base URL built from input; repositories use configured connections.
- [ ] Added packages are pinned and reviewed; the CI `security` stage runs something beyond the check.
- [ ] Each finding has a fix in Nuclear or a roadmap entry, and `nuclear test` is green.
