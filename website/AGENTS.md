# AGENTS.md — the website

The site of NuclearLang, written in Nuclear with the web platform of Synapsis (dialect `react`). It sells the idea
(a home page of hooks, a page per tool, a page per platform from the context down to the code, an onboarding per
platform) and publishes the documentation: the reference (`docs/07-reference/`) and the guides (`docs/08-guides/`)
of every project of the tree. The app only reads JSON, written by a build script that also runs the compiler and
the onboardings' commands. ADR key: `website`.

## Stack

- The app: Nuclear (`.nuc`), `config.nuc` = `synapsis(platform = "web", dialect = "react")`; built into
  `build/app` (React, Vite, vitest). The animations: the npm package `motion`, added with `nuclear add motion`
  (its type definitions in `defs/`).
- The content: `tools/content.mjs` (Node.js) with `markdown-it`, `shiki` and `smol-toml` (`tools/package.json`).
- The texts, menus, links and addresses: `site.toml`.
- CI: `.github/workflows/website.yml` at the root of the tree (content, build, tests, bundle).

## Commands

```sh
cd website
(cd tools && npm ci)             # markdown-it, shiki, smol-toml
node tools/content.mjs           # public/content, public/static, llms.txt, sitemap, installers; runs the onboardings (needs `nuclear` installed)
UPDATE_EXAMPLES=1 node tools/content.mjs   # a generator changed on purpose: write the onboardings' examples again
nuclear build                    # the app into build/app (public/ copied)
nuclear install                  # npm install in build/app
nuclear test                     # vitest: the tests of test/
nuclear run                      # vite dev, http://localhost:5173
(cd build/app && npx vite build) # the published site in build/app/dist
```

`NUCLEAR_TREE` overrides the source tree (`site.toml` `[source] tree = ".."`), `SITE_URL` the site's address,
`NUCLEAR` the compiler that transpiles the home page's sample.

## Folders

| Folder | Holds |
|---|---|
| `config.nuc`, `main.nuc`, `config/` | the project, the app (the router), the `Http(baseUrl = "/")` connection |
| `components/docs/` | the one component: `data/` (the repositories of the content, the tools and the platforms), `domain/` (models, use cases, the search score), `presentation/` (`home/`, `tools/`, `platforms/` with the onboarding, `doc/`, `layout/` with the views the pages share) |
| `defs/` | the type definitions of `motion` (written by `nuclear add`) |
| `test/docs_test.nuc` | the search, a page, the home page, a tool, a platform, an onboarding (the repositories are mocks) |
| `public/` | `styles.css`, `favicon.svg`; the rest is written by `tools/content.mjs` (ignored by git) |
| `site.toml` | every text, menu, link and address of the site; the tools, the platforms (their C4 levels) and the onboardings' steps |
| `tools/` | `content.mjs` and its `package.json` |
| `build/` | generated: never edit |

## Rules

- **Made with the tools** ([ADR-platform-0004](../docs/03-adr/0004-products-are-made-with-the-tools.md)): a new
  resource is `nuclear gen resource`, a new view or screen `nuclear make`, a library `nuclear add`; only what they
  leave is written by hand, in Nuclear. A gap of a tool goes to that tool's roadmap.
- **Every claim is real** ([ADR-website-0001](docs/03-adr/0001-the-site-sells-the-idea.md)): an output comes from
  the compiler or a command run when the site is built; a number is measured. No claim the reports do not hold.
- **The onboardings are replayed** ([ADR-website-0002](docs/03-adr/0002-onboardings-are-run-when-the-site-is-built.md)):
  a change of their steps changes the examples of the platforms (`UPDATE_EXAMPLES=1`, then `UPDATE_GOLDEN=1 cargo
  test`) and their guides (`onboarding-<platform>.md`).
- **No content in the code.** A page is a `.md` of a project's `07-reference/` or `08-guides/`; every other text is
  in `site.toml`. Change the document in its project, not here. A tool or a platform lists its pages in
  `site.toml`; a missing page fails the build.
- A new area of the documentation (a dialect, a platform, a tool with guides) gets a line in `site.toml`'s
  `[[sidebar]]`; a page matched by a `*` pattern needs none.
- The site is in English ([ADR-platform-0001](../docs/03-adr/0001-english-everywhere.md)).
- A page's address is `/<project>/<reference|guide>/<name>` (`route` in `tools/content.mjs`): renaming or moving a
  published document changes its address. An address must keep three parts: the app's screens route no deeper.

## Documents

| Document | Read when |
|---|---|
| [docs/00-context/vision.md](docs/00-context/vision.md) | you need what the site is for and what it does not do |
| [docs/02-architecture/overview.md](docs/02-architecture/overview.md) | you change the app: its screens, routes, shared views, motion, state and tests |
| [docs/02-architecture/content.md](docs/02-architecture/content.md) | you change how pages, menus, the home page, the tools, the platforms, the onboardings, the plain pages or `llms.txt` are made |
| [docs/03-adr/README.md](docs/03-adr/README.md) | you need why the site sells with hooks, why the onboardings run at build time, why `motion` |
| [docs/01-product/roadmap.md](docs/01-product/roadmap.md) | you look for what is pending (publishing, routes, plain copies of the screens) |
| [README.md](README.md) | the short introduction |

<!-- nuclearlang -->
## NuclearLang

This project is written in NuclearLang (`.nuc`), dialect `react`. Its syntax is not TypeScript, Dart nor Python.

- Before writing code, read the sheet: `nuclear spec --brief --dialect react`.
- After each change: `nuclear check --json` must report no errors; fix exactly what each error says (most carry a `fix`).
- Look up instead of guessing: an API `nuclear defs show <Name> --dialect react`; a kind or decorator
  `nuclear help <word> --dialect react` (all: `nuclear help words --dialect react`); a topic `nuclear help <topic>`.
- Create each piece with `nuclear make ...` (`nuclear help`); after `nuclear check`, run `nuclear analyze` and, with tests, `nuclear test`.
- A library the project does not have (npm, PyPI, pub.dev): `nuclear add <package>` installs it and generates its type definitions; then use its names (they are imported for you). Never install it by hand in `build/`.
- Never edit generated code (`build/`): change the `.nuc` files.
- Make it with the tools: `nuclear gen`, `nuclear make`, the MCP server, `nuclear add` for a library. Never write
  target code for a feature nor translate TypeScript, Dart or Python into Nuclear by hand; when a tool cannot do
  something, say so instead of working around it.
<!-- /nuclearlang -->
