---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, kinds-and-plugins.md, ../03-adr/README.md, ../../platforms/docs/05-standards/testing.md]
---
# The rules every platform and dialect follows

What makes a project a Synapsis project, whatever its platform and its dialect. A new kind, decorator, platform
feature or dialect is designed against this list. Paths start at the root of the tree.

1. **Light clean architecture.** Components with layers (`config`, `data`, `domain`, and the platform's entry
   layer: `presentation` in mobile and web, `api` in backend) and a facade (`appcomponent`). The layers exist in
   the generated code, not as ceremony in Nuclear (ADR-dart-0001, ADR-synapsis-0003).
2. **Closed components.** From another component only its public kinds are visible (the facade, models, events,
   global components, guards, screens); the transpiler checks it (N0302). Who calls whom is checked too (N0301): a
   use case only from the facade; a service only from a use case or an aggregate (ADR-synapsis-0003). The rules
   are data of each dialect: `[architecture]` (`nuclearlang/docs/07-reference/projects.md` §4).
3. **Injection by header.** A typed parameter in a kind's header is injected (ADR-synapsis-0003).
4. **Errors as values.** Use cases return `Result<E, T>` (ADR-lang-0006, ADR-lang-0006); the runtime's errors carry
   an HTTP status in backend.
5. **Only `.nuc` in the project.** Everything generated goes to `build/` and is never edited (ADR-synapsis-0001).
6. **Only third-party packages and plugins in `config.nuc`.** The framework's packages are added automatically
   (ADR-mobile-0001), a plugin's packages only when it is enabled (ADR-synapsis-0004).
7. **The same concepts in every platform, implemented natively:** events on demand, session, ACL with guards,
   forms, translations (ADR-synapsis-0005), logs by component (ADR-mobile-0005); connections declared in `config/`.
8. **Warn** when something breaks the architecture or brings security or performance problems (the mobile
   platform documents its security checks).
9. **Commands per platform.** `nuclear <command>` in a project reads `synapsis(...)` of `config.nuc` (ADR-cli-0001,
   ADR-synapsis-0001). The command knows no language: what it runs is declared by the dialect in `[toolchain]`.
   The mobile path of the command still calls Flutter directly (the roadmap of `tools/cli/`).
10. **The golden rule** for every kind, decorator or shortcut: generated code as fast as an expert's, instant
    transpilation, minimal readable Nuclear (ADR-lang-0001).
11. **A conformance test per platform:** one example built from the same `.nuc` with every dialect of the platform
    (ADR-synapsis-0002; `platforms/docs/05-standards/testing.md`).
12. **Kinds are the libraries** (ADR-synapsis-0004): native kinds in the platform's contract, extension kinds as
    packages made of TOML, templates, a runtime and docs only, never of compiler code
    ([kinds-and-plugins.md](kinds-and-plugins.md)).

Two more rules come from the hard rules of the root `AGENTS.md`:

- **The platform names no dialect** (rule 11). A platform's reference, docs, examples and diagnostics hold only
  Nuclear. The standard library is Nuclear's own (`nuclearlang/docs/07-reference/library.md`, ADR-lang-0009): a
  target's library name (`push`, `len`, `toUpperCase`) in platform code, references, docs or examples is a bug.
- **Nuclear and Synapsis first** (rule 12). A new development of the tree (a service, a tool, an agent) is a
  Synapsis project when one of the three platforms fits.

## Proposals

Something an agent decided that waits for the user's review is a proposal, not a rule: it is listed in
[the roadmap](../01-product/roadmap.md) under "To decide with the user". Once decided it becomes a rule here and
an ADR.
