---
status: approved
priority: high
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, tasks.md, naming.md, community.md]
---
# Spec 019: Launch and growth — Design

## The order: fix the doors before inviting people

Inviting people to a website search engines cannot read, or to a repository that looks abandoned, wastes the one
chance a launch gives. So the work runs in five phases; the launch (phase 4) waits for phases 1-3 and for the
benchmark (spec 020).

| Phase | What | Why first |
|---|---|---|
| 1. Readable | prerendered website, metadata, robots, sitemap check, Search Console | every other door links here |
| 2. Presentable | repository and organization: logo, READMEs in two languages, community files, topics, dead repos gone | a visitor decides in ten seconds |
| 3. Findable | MCP registries, Context7, package registries, stores, awesome lists | where developers and agents look |
| 4. Launch | benchmark published, launch day, press, videos | a number to talk about, and doors that work |
| 5. Grow | community rituals, content every week, measures every month | a launch fades; a community stays |

## R1: how the website is prerendered

The website is a product of the web platform (React dialect). The right place for prerendering is the platform:
`nuclear build` of a web project with `prerender = true` (in `config.nuc`) renders each route of the app's router
to `build/app/dist/<route>/index.html` after the Vite build, the client hydrating it in the browser. Every web
product gets it; the website turns it on. Steps:

1. A spec in `nuclear-synapsis-framework/platforms/web/docs/04-specs/`: the word in `config.nuc`, the router's
   routes as the list (or a `routes()` the app gives for dynamic ones, as the site's documentation pages), how the
   head of each page is declared (a `head(title, description, image, jsonLd)` the screen returns, rendered by the
   runtime `synapsis-web` with React 19's document metadata), the hydration.
2. The dialect's `[toolchain]` gains a `prerender` command (Vite SSR build + a script of the runtime that renders
   each route with `react-dom/server` and writes the files); the CLI runs it after `build` when the project asks.
3. The website: its pages declare their head (from `site.toml`, which already has each page's text), its build
   turns prerender on, its workflow keeps `404.html` only for unknown URLs.
4. The check of R1.4 runs in `website.yml` against the built `dist/` (no network) and, after the deploy, against
   the live site.

The JSON-LD of each page comes from `site.toml` (one `[seo]` table per page type), never written in HTML by hand.

## R2: generative engine optimization (GEO)

AI answers are made from (a) what the model learned in training and (b) what its search finds now. For (a) the
project must be written about in many places before each model's cutoff (content, GitHub, registries, Q&A); for
(b) the pages must answer the question in their first lines, in plain HTML, with numbers, and be cited by other
sites. The pages of R2.2 are written as answers: the question as the title, the answer in two sentences, then the
code, then the proof. `llms.txt` points agents to the sheets (it already does); each registry entry repeats the one
paragraph that describes NuclearLang, so every source says the same thing.

## R4: one release, every registry

Each registry is a job of `release.yml` after `snapshot`, publishing the artifacts of that same tag
(ADR-platform-0011), with trusted publishing where the registry has it (PyPI, npm, crates.io have OIDC trusted
publishing from GitHub Actions; pub.dev has automated publishing from GitHub Actions; Homebrew a tap updated by the
release; winget and Scoop manifests by pull request). A registry's failure never fails the release (as
`marketplaces` today). The names are reserved first (`nuclear-mcp`, `synapsis-py`, `synapsis-nest`,
`synapsis-web`, `synapsis`, `nuclear-cli`): a name taken by someone else is decided with the user (naming.md).

## Open source: what a project like this must take care of

| Topic | Decision or task |
|---|---|
| **License** | Apache-2.0 (kept): permissive, with an explicit patent grant, accepted by companies. Every package's manifest says it; `THIRD-PARTY.md` lists vendored code (Atom Material Icons, MIT) and the release archives carry the licenses of what they bundle (the AI archive's Python and its wheels, the language server's crates: `cargo about`). |
| **Contributions** | DCO (`Signed-off-by:`), checked by a GitHub app, not a CLA: lighter for contributors; Apache-2.0 §5 already licenses contributions. |
| **Trademark** | "NuclearLang", "Synapsis" and the radioactive mark: a short `TRADEMARKS.md` (use the name to refer to the project, not for a fork's product; the logo for articles and talks). A search of existing marks before the launch (Synapsis is a common word: naming.md). |
| **Security** | `SECURITY.md` with GitHub's private vulnerability reporting; supported: the latest release. The real state is [spec 018](../018-failure-matrix/requirements.md), group M: the release archives carry a SHA-256 from the same release but are not signed, the Windows and macOS binaries are not code-signed, the Nuclear Developer's port has no token yet. Signing (Sigstore/cosign or minisign, Apple notarization, Windows Authenticode), SLSA provenance (GitHub artifact attestations) and an SBOM per archive are tasks of phase 3. |
| **Privacy** | No telemetry. The update check fetches only the latest release's URL once a day and can be turned off (`NUCLEAR_NO_UPDATE_CHECK=1`); the Smart Graph and the agents run locally; a `PRIVACY.md` says it, because "AI" makes people ask. |
| **AI-written code** | The project is built with AI agents and says so (the agents commit in the user's name, root rule 10). Contributions written with AI are welcome under the same review and DCO; the contributor answers for them. |
| **Governance** | Today a single maintainer decides (BDFL). `GOVERNANCE.md` says it, how a contributor becomes a maintainer (sustained merged work, invited), and the RFC process: a change to the base language or a platform's contract is an RFC (a pull request to `docs/rfcs/`), discussed two weeks, decided by the maintainers; dialects and tools follow normal review. |
| **Stability** | Semantic Versioning for the whole platform (ADR-platform-0011); while 0.x a MINOR may break, always written in the CHANGELOG with the migration (`nuclear fix` for what it can rewrite). 1.0 freezes the base language's syntax: after it, a breaking change needs a MAJOR and an RFC. |
| **Sustainability** | GitHub Sponsors and Open Collective (`FUNDING.yml`); later sponsorship tiers for companies, paid support. Grants that fund open source tools (NLnet, Sovereign Tech Fund, GitHub Secure Open Source Fund) when the project qualifies. |
| **Supply chain** | Pinned versions in workflows and packages (already the rule); Dependabot or Renovate; `cargo deny`; the release built only from the tag in CI (already true). |
| **Accessibility and languages** | The website and the editors keep WCAG AA contrast (the Chernobyl themes are checked); the docs in English with the most read pages also in Spanish (the extension and the website already speak both). |
| **Code of conduct** | Contributor Covenant 2.1, an email to report, enforced by the maintainers. |
| **Citation** | `CITATION.cff`, for papers that use the benchmark. |
