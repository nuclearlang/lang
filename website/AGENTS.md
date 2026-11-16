# AGENTS.md — the website

The documentation site of NuclearLang, written in Nuclear with the web platform of Synapsis (dialect `react`). The
app only reads JSON; its content is the reference (`docs/07-reference/`) and the guides (`docs/08-guides/`) of every
project of the tree, turned into JSON, plain HTML and `llms.txt` by a build script. ADR key: `website`.

## Stack

- The app: Nuclear (`.nuc`), `config.nuc` = `synapsis(platform = "web", dialect = "react")`; built into
  `build/app` (React, Vite, vitest).
- The content: `tools/content.mjs` (Node.js) with `markdown-it`, `shiki` and `smol-toml` (`tools/package.json`).
- The texts, menus, links and addresses: `site.toml`.
- CI: `.github/workflows/website.yml` at the root of the tree (content, build, tests, bundle).

## Commands

```sh
cd website
(cd tools && npm ci)             # markdown-it, shiki, smol-toml
node tools/content.mjs           # public/content, public/static, llms.txt, sitemap, installers (needs `nuclear` installed)
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
| `components/docs/` | the one component: `data/` (the content repository), `domain/` (models, use cases, the search score), `presentation/` (home, doc and not-found screens, the layout, the search box) |
| `test/docs_test.nuc` | the search ranking, the pages and the home page (the repository is a mock) |
| `public/` | `styles.css`, `favicon.svg`; the rest is written by `tools/content.mjs` (ignored by git) |
| `site.toml` | every text, menu, link and address of the site |
| `tools/` | `content.mjs` and its `package.json` |
| `build/` | generated: never edit |

## Rules

- **No content in the code.** A page is a `.md` of a project's `07-reference/` or `08-guides/`; every other text is
  in `site.toml`. Change the document in its project, not here.
- A new area of the documentation (a dialect, a platform, a tool with guides) gets a line in `site.toml`'s
  `[[sidebar]]`; a page matched by a `*` pattern needs none.
- The site is in English ([ADR-platform-0001](../docs/03-adr/0001-english-everywhere.md)).
- A page's address is `/<project>/<reference|guide>/<name>` (`route` in `tools/content.mjs`): renaming or moving a
  published document changes its address. An address must keep three parts: the app's screens route no deeper.

## Documents

| Document | Read when |
|---|---|
| [docs/00-context/vision.md](docs/00-context/vision.md) | you need what the site is for and what it does not do |
| [docs/02-architecture/overview.md](docs/02-architecture/overview.md) | you change the app: its screens, routes, state and tests |
| [docs/02-architecture/content.md](docs/02-architecture/content.md) | you change how pages, menus, the home page, the plain pages or `llms.txt` are made |
| [docs/01-product/roadmap.md](docs/01-product/roadmap.md) | you look for what is pending (publishing, routes) |
| [README.md](README.md) | the short introduction |

<!-- nuclearlang -->
## NuclearLang

This project is written in NuclearLang (`.nuc`), dialect `react`. Its syntax is not TypeScript, Dart nor Python.

- Before writing code, read the sheet: `nuclear spec --brief --dialect react`.
- After each change: `nuclear check <file>.nuc --dialect react --json` must report no errors; fix exactly what each error says (most carry a `fix`).
- Look up instead of guessing: an API `nuclear defs show <Name> --dialect react`; a kind or decorator
  `nuclear help <word> --dialect react` (all: `nuclear help words --dialect react`); a topic `nuclear help <topic>`.
- Never edit generated code (`build/` and the `.ts`/`.dart`/`.py` built from the `.nuc`): change the `.nuc` files.
<!-- /nuclearlang -->
