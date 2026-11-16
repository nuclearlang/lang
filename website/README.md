# NuclearLang website

The site of NuclearLang: it shows in a minute what NuclearLang gives, and publishes the documentation of every
project of the tree. It is itself a Synapsis web app written in Nuclear (dialect `react`).

## Why it exists

NuclearLang is free, but it still has to be chosen: a visitor must see what it gives (a minimal language, three
platforms from one codebase, tools that write the standard code, an AI loop that runs locally) and reach the detail
of whatever interests them. Its documentation lives beside the code of each project; people need one place to read
it, and search engines and agents need it without JavaScript.

What it leaves out on purpose: holding documentation (every page is a `.md` of a project's `docs/07-reference/`
or `docs/08-guides/`, and every other text is data in `site.toml`), any claim nobody measured or output nobody ran,
and translations (English only).

## How we made it

- **It sells the idea** ([ADR-website-0001](docs/03-adr/0001-the-site-sells-the-idea.md)): a home page of hooks,
  from the most general to the most concrete, each a small interactive block with real output; a page per tool
  (`/tools`) and a page per platform (`/platforms/<key>`) that goes from the context down to the code, as in the C4
  model. Every number is measured when the site is built or comes from a measured report; a claim that does not
  hold is not made.
- **The onboardings are run when the site is built**
  ([ADR-website-0002](docs/03-adr/0002-onboardings-are-run-when-the-site-is-built.md)): each platform's steps
  (`/start/<key>`) are replayed with the installed `nuclear`, and the build fails when they no longer give the
  platform's example app.
- **A library of the target through `nuclear add`**
  ([ADR-website-0003](docs/03-adr/0003-libraries-of-the-target-through-nuclear-add.md)): the animations are the npm
  package `motion`, added with `nuclear add motion`, which wrote it in `config.nuc` and generated its type
  definitions into `defs/`. Only `public/styles.css` is not Nuclear: the web platform has no styling words.
- **Made with the tools** ([ADR-platform-0004](../docs/03-adr/0004-products-are-made-with-the-tools.md)): the
  models, repositories, use cases, managers and first screens of the tools and the platforms were written by
  `nuclear gen resource`, the other views by `nuclear make` and then filled in Nuclear. The one model written by
  hand is `Home`: the generator has no resource of one object.

A build script, `tools/content.mjs`, turns the documents into JSON, highlights the code (shiki, with the editors'
Nuclear grammar and Chernobyl theme) and runs the compiler, so the home page's sample is transpiled to TypeScript,
Dart and Python by the real `nuclear`. Every page also has a plain HTML copy in `/static/`, with the sitemap,
`llms.txt` and `llms-full.txt`.

## Try it

From the root of the tree, with `nuclear` installed (`installer/install.sh`):

```sh
cd website
(cd tools && npm ci)             # markdown-it, shiki and smol-toml
node tools/content.mjs           # the content, from the tree; runs the onboardings and fails if they differ
nuclear check --json             # []
nuclear build                    # the app into build/app (public/ copied)
nuclear install                  # npm install in build/app
nuclear test                     # vitest: the tests of test/
nuclear run                      # vite dev, http://localhost:5173
(cd build/app && npx vite build) # the published site in build/app/dist
```

A page's address is `/<project>/<reference|guide>/<name>`: `/nuclearlang/guide/README` is
`nuclearlang/docs/08-guides/README.md`.

## Where to read next

- What the site is for: [docs/00-context/vision.md](docs/00-context/vision.md); its decisions:
  [docs/03-adr/](docs/03-adr/README.md).
- How the app and the content are made: [docs/02-architecture/overview.md](docs/02-architecture/overview.md),
  [docs/02-architecture/content.md](docs/02-architecture/content.md).
- The platform it is written on: [the web platform](../nuclear-synapsis-framework/platforms/web/README.md).
- Texts, menus and links: `site.toml`. To change it: [AGENTS.md](AGENTS.md).

License: [Apache-2.0](LICENSE).
