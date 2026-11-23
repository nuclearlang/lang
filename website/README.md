# NuclearLang website

[![website](https://github.com/nuclearlang/nuclearlang/actions/workflows/website.yml/badge.svg)](https://github.com/nuclearlang/nuclearlang/actions/workflows/website.yml) · [Website](https://nuclearlang.github.io)

The site of NuclearLang: it shows in a minute what NuclearLang gives and publishes every project's documentation. It
is itself a Synapsis web app written in Nuclear (dialect `react`).

## Why

- A visitor must see what NuclearLang gives and reach the detail that interests them.
- One place to read the documents that live beside each project's code, with plain HTML for search engines and agents.
- Left out on purpose: documents of its own, claims nobody measured, translations.

## How we made it

- It sells the idea: hooks with real output, a page per tool and per platform ([ADR-website-0001](docs/03-adr/0001-the-site-sells-the-idea.md)).
- The onboardings are run when the site is built ([ADR-website-0002](docs/03-adr/0002-onboardings-are-run-when-the-site-is-built.md)).
- A target library through `nuclear add motion` ([ADR-website-0003](docs/03-adr/0003-libraries-of-the-target-through-nuclear-add.md)).
- Made with the tools: `nuclear gen resource` and `nuclear make` ([ADR-platform-0004](../docs/03-adr/0004-products-are-made-with-the-tools.md)).

## Try it

```sh
cd website && (cd tools && npm ci)
node tools/content.mjs           # the content, from the tree; runs the onboardings
nuclear build && nuclear install
nuclear run                      # vite dev, http://localhost:5173
```

## Read next

- [What the site is for](docs/00-context/vision.md) and [its decisions](docs/03-adr/README.md).
- [How it is made](docs/02-architecture/overview.md) and [the content](docs/02-architecture/content.md).
- [The web platform](../nuclear-synapsis-framework/platforms/web/README.md).
- Texts, menus and links: `site.toml`. To change it: [AGENTS.md](AGENTS.md).

License: [Apache-2.0](LICENSE).
