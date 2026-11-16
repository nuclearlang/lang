---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md]
---
# The content: `tools/content.mjs` and `site.toml`

`node tools/content.mjs` reads the tree named by `site.toml` `[source] tree` (`..`; `NUCLEAR_TREE` overrides it) and
fails if `nuclearlang/docs/07-reference/nuclear-base.md` is not there.

## Which files are pages

Every `.md` under a `docs/07-reference/` or `docs/08-guides/` of any project of the tree. Skipped folders:
`node_modules`, `target`, `build`, `dist`, `out`, `.git`, `.venv`, `.dart_tool`, `website`, `github-profile`,
`aprende`, `work`. The grammar page is made from `nuclearlang/docs/07-reference/grammar.ebnf`.

- **Route** = `/<project>/<reference|guide>/<name>`: the project is the folder that holds the page's `docs/`
  (`nuclear-synapsis-framework` is `synapsis`), the layer `07-reference` is `reference` and `08-guides` is `guide`, and
  the rest of the path is joined by `-` (`brief/dart` → `brief-dart`). `/nuclearlang/guide/README`,
  `/dart/reference/flutter`, `/mobile/reference/brief-mobile`. An address of `site.toml` is written as the page's path
  in the tree and turned into its route. The page's content file is the route with `--` for `/`.
- **Title** = the first `# ` heading.
- **Links**: a relative link to another page becomes its route; to any other file of the tree, its url on GitHub
  (`site.org` + `site.branch`); a GitHub url of the organization that is a page becomes its route.
- **Highlighting**: shiki, with `extensions/vscode/syntaxes/nuclear.tmLanguage.json` and the theme
  `extensions/vscode/themes/chernobyl-color-theme.json` (dark) and `github-light`.

## What it writes (into `public/`, ignored by git)

| File | Holds |
|---|---|
| `content/<key>.json` | one page: path, title, html, headings (levels 2 and 3), its source on GitHub; key = the path with `/` → `--` |
| `content/site.json` | title, url, org, footer, the top links, the side menu |
| `content/search.json` | title, headings and words of every page |
| `content/home.json` | the home page: texts, actions, features, the sample and its outputs, platforms, install lines |
| `static/<path>.html` | the plain page, with a canonical link to its route |
| `llms.txt`, `llms-full.txt` | the briefs (`07-reference/brief/`) first, then the side menu's sections; the full file carries the briefs and `nuclearlang/docs/08-guides/reference.md` |
| `sitemap.xml`, `robots.txt` | every route |
| `install.sh`, `install.ps1` | copied from `installer/release/` |

## `site.toml`

- `[site]`: title, lead, tagline, `url` (`SITE_URL` overrides it), `org`, `branch`, footer.
- `[[top]]`: the links of the top bar.
- `[[sidebar]]`: the side menu; each section lists pages by their path without `.md`. A `*` matches any part of a
  name; a pattern expands to the matching pages in order, without `README`s, each page once per section.
- `[[home.actions]]`, `[[home.features]]`, `[home.platforms]` with its cards, `[home.install]` (`{{site}}` is
  replaced by the url).
- `[home.sample]`: the Nuclear `code` and the `targets` (language dialects). Each output is
  `nuclear build app.nuc --dialect <target>` run by the installed compiler (`NUCLEAR` overrides it), highlighted as
  that language.
