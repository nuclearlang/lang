# NuclearLang website

The NuclearLang site, written in **Nuclear** with the web platform of Synapsis (dialect `react`): its screens, state
managers, search and content repository are `.nuc` files. The content is the reference (`docs/07-reference/`) and
the guides (`docs/08-guides/`) of every project of the NuclearLang tree, turned into JSON by a build script; the app
only reads it.

## Build

From the root of the tree, with `nuclear` installed (`installer/install.sh`):

```sh
cd website
(cd tools && npm ci)             # markdown-it, shiki and smol-toml
node tools/content.mjs           # the content, from the tree ([source] tree in site.toml; NUCLEAR_TREE overrides it)
nuclear build                    # the app into build/app (public/ copied)
nuclear install                  # npm install in build/app
nuclear test                     # vitest: the tests of test/
nuclear run                      # vite dev, http://localhost:5173
(cd build/app && npx vite build) # the published site in build/app/dist
```

Every page's markdown is rendered with the code already highlighted (shiki, with the editors' Nuclear grammar and
their Chernobyl theme), so the browser receives HTML. The home page's sample is transpiled to TypeScript, Dart and
Python by the installed `nuclear` when the site is built. For search engines and agents that read without
JavaScript, every page also has a plain HTML copy in `/static/` (and the sitemap, `llms.txt`, `llms-full.txt`).

The address of a page is `/<project>/<reference|guide>/<name>`: `/nuclearlang/guide/README` is
`nuclearlang/docs/08-guides/README.md`, `/dart/reference/flutter` is
`nuclearlang/dialects/dart/docs/07-reference/flutter.md`.

Texts, menus and links: `site.toml`. How it is made and what is pending: [AGENTS.md](AGENTS.md). License:
[Apache-2.0](LICENSE).
