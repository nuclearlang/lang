---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, ../03-adr/0002-onboardings-are-run-when-the-site-is-built.md]
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

## What it writes (into `public/`, ignored by git; `public/shots/` and `styles.css` are kept)

| File | Holds |
|---|---|
| `content/<key>.json` | one page: path, title, html, headings (levels 2 and 3), its source on GitHub; key = the path with `/` → `--` |
| `content/site.json` | title, url, org, footer, the top links, the side menu |
| `content/search.json` | title, headings and words of every page |
| `content/home.json` | the home page: texts, actions, the hero's logos, hooks with their icons, the editor's screenshots, the samples and their outputs, the agent's fix, the backend onboarding's steps and numbers, one file per dialect, the platforms and tools in short, the library, install lines |
| `content/tools.json` | every tool: key, name, group, tagline, pitch, highlights, icon, logos, screenshots, how it starts (highlighted), its project on GitHub, its pages |
| `content/platforms.json` | every platform: its levels (boxes and flows), its pages, and its onboarding run again: the app, the steps with their real output, the shown file and what each dialect writes from it, the numbers |
| `logos/<name>.svg` | the logo of each `[logos]` entry, from `simple-icons` (CC0) or `devicon` (MIT), its brand colour per theme: a colour too dark for the dark theme (luminance under 0.08) or too light for the light one (over 0.7) takes the theme's text colour (an `<img>` SVG reads `prefers-color-scheme`) |
| `icons/<name>.svg` | each icon the site names, from `lucide-static` (ISC), stroked in the theme's accent the same way |
| `brand/<mark>.svg` | the animated marks of the hooks (`hook-*`) and of the install, the marks of NuclearLang's own tools (`mcp`, `graph`, `http`, `atlas`: the logo's trefoil with a hub, a database, two arrows, a globe) and `orbit.svg`, the animated orbit of the three platforms around Nuclear (the first dialect's logo of each), from `tools/marks.mjs` |
| `static/<path>.html` | the plain page, with a canonical link to its route |
| `llms.txt`, `llms-full.txt` | the briefs (`07-reference/brief/`) first, then the side menu's sections; the full file carries the briefs and `nuclearlang/docs/08-guides/reference.md` |
| `sitemap.xml`, `robots.txt` | every route |
| `install.sh`, `install.ps1` | copied from `installer/release/` |

## `site.toml`

- `[site]`: title, lead, tagline, `url` (`SITE_URL` overrides it), `org`, `branch`, footer.
- `[[top]]`: the links of the top bar (a path in the tree is a page; another, a screen: `/tools`, `/platforms/mobile`).
- `[[sidebar]]`: the side menu; each section lists pages by their path without `.md`. A `*` matches any part of a
  name; a pattern expands to the matching pages in order, without `README`s, each page once per section.
- The home page: `[[home.actions]]`, `[[home.hooks]]`, `[home.samples]` (`targets` and its `items`), `[home.check]`
  (a mistake and its `dialect`), `[home.generator]` and `[home.dialects]` (the platform whose onboarding they show),
  `[home.platforms]`, `[home.tools]`, `[home.libraries]`, `[home.install]` (`title`, `text`, `systems`: a tab each with
  its `logos` and its `command`, `{{site}}` replaced by the url; `next`: the commands after it), `[home.logs]` (the
  `[[modules]]` entry the logs block shows).
- `[logos]`: name → a `simple-icons` slug, or `{ simple, name }` to rename one, `{ devicon = "<folder>/<file>", name }`
  for a brand simple-icons leaves out (VS Code, IntelliJ IDEA, Windows: copied as they are), `{ lucide, name }` for a
  product with no free logo (Codex). A logo goes next to a name (chips, tabs, cards), never inside a text.
  `[home.hero] targets` and `agents`, a platform's `dialects`, a tool's `logos`, `[home.extension] editors` and a
  dialect's tab name logos of this table.
- `[home.extension]`: the editor block, `title`, `text`, `editorsTitle` and `editors` (a `logo` and its `tool` page each)
  and `modules` (ids of `[[modules]]`, most important first).
- `[[modules]]`: a part of the extension: `id`, `name`, `icon`, `title` (its slogan), `points` (at most three),
  `keys` (`key`, `label`: the real shortcuts of the extensions' guides), `logos`, `marks` (`icon`, `label`), `art`
  (`orbit`), `shots` (ids of `[[shots]]`) and `tool` (the page its "More about" link opens; the build fails if it is
  not a tool) or `link` (any address). The text stays short: the detail is the tool's page.
- `[[shots]]`: a screenshot of the editor: `id`, `image` (a file of `public/shots/`, kept in git), `alt`, `caption`
  and `spots` (callouts: `x` and `y` as fractions of the image from its top left corner, `label`). A screenshot is
  cropped to what it sells (its outline and what does not matter removed), lightly sharpened and saved as WebP. A
  screenshot in another language is rendered again in English (Nuclear Atlas's).
- A hook, a tool and a module name an `icon`: a `lucide` name, or `brand:<mark>` for a mark of `tools/marks.mjs`.
- `[[tools]]`: `key` (its address `/tools/<key>`), `name`, `group` (Build, Edit, Run or AI), `tagline`, `pitch`, `icon`,
  `logos` and `shots` (optional),
  `highlights`, `demo` (commands), `project` (its folder), `pages` (its documents: each must be a page, or the
  build fails).
- `[[platforms]]`: `key`, `name`, `dialects`, `tagline`, `pitch`, `pages`, and `[[platforms.levels]]` (`level`,
  `title`, `text`, `boxes` with a `kind` of person, system, container, component or external, `flows` written
  `A → B: what`).
- `[[onboarding]]`: `platform`, `example` (its folder in the tree), `show` (the file of the code level), `steps`
  (`title`, `text`, and `run` to replay it or `command` to only show it).

## What runs when the site is built

With the installed `nuclear` (`NUCLEAR` overrides it), in a scratch folder:

- each sample: `nuclear build sample.nuc --dialect <target>` for each target;
- the mistake: `nuclear check mistake.nuc --dialect <d> --json`, then `nuclear fix` (the build fails if the mistake
  gives no error);
- each onboarding: its `run` steps in order (`nuclear new <name>` moves into the new folder), then the `.nuc` files
  they made are compared with the example of the tree (the build fails on a difference; `UPDATE_EXAMPLES=1` writes
  the example from them); then the project is copied once per dialect of the platform, `config.nuc` set to that
  dialect, built with `nuclear build .`, the file made from `show` found by its name, and the lines of `.nuc` and of
  the generated code counted (blank lines left out)
  ([ADR-website-0002](../03-adr/0002-onboardings-are-run-when-the-site-is-built.md)).
