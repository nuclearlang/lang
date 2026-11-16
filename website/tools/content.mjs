// Builds the website's content from the documentation of the NuclearLang tree: the reference (`docs/07-reference/`) and
// the guides (`docs/08-guides/`) of every project. The app (written in Nuclear) only reads it.
//
//   public/content/<key>.json   one page: title, html (code already highlighted), headings, its source on GitHub
//   public/content/site.json    the site: title, top links, side menu, footer, repositories (site.toml)
//   public/content/search.json  the search index: title, headings and words of every page
//   public/content/home.json    the sample of the home page and its output in each target (from the real compiler)
//   public/static/<path>.html   the same page as plain HTML, for search engines and agents that read without JS
//   public/llms.txt, public/llms-full.txt, public/sitemap.xml, public/robots.txt
//
// The .md files of the repositories are the only source of the pages; site.toml holds the rest (texts, menus, links,
// addresses). NUCLEAR_TREE overrides its source tree, SITE_URL its address.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import MarkdownIt from 'markdown-it'
import { bundledLanguages, createHighlighter } from 'shiki'
import { parse } from 'smol-toml'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const config = parse(readFileSync(join(project, 'site.toml'), 'utf8'))
const tree = resolve(process.env.NUCLEAR_TREE || join(project, config.source.tree))
const site = (process.env.SITE_URL || config.site.url).replace(/\/$/, '')
const org = config.site.org.replace(/\/$/, '')
const branch = config.site.branch
const out = join(project, 'public')

const GRAMMAR = 'nuclearlang/docs/07-reference/grammar'
if (!existsSync(join(tree, 'nuclearlang/docs/07-reference/nuclear-base.md'))) {
  console.error(`no nuclearlang working tree at ${tree} (set NUCLEAR_TREE)`)
  process.exit(1)
}

// --- the pages: the reference and the guides of every project of the tree (a context document is not a page) ---
const PUBLIC = ['07-reference', '08-guides']
const SKIP = new Set(['node_modules', 'target', 'build', 'dist', 'out', '.git', '.venv', '.dart_tool', 'website', 'github-profile', 'aprende', 'work'])
const repoOf = () => 'nuclear'
const walk = (base, dir) => existsSync(join(base, dir))
  ? readdirSync(join(base, dir)).flatMap(name => {
      const path = posix.join(dir, name)
      if (SKIP.has(name)) return []
      return statSync(join(base, path)).isDirectory() ? walk(base, path) : [path]
    })
  : []
const roots = [tree]
const sourceOf = new Map()
for (const p of walk(tree, '')) {
  const parts = p.split('/')
  const layer = parts.indexOf('docs')
  if (p.endsWith('.md') && layer >= 0 && PUBLIC.includes(parts[layer + 1])) sourceOf.set(p, tree)
}
// A page's address: `/<project>/<reference|guide>/<name>` (`/nuclearlang/guide/README`, `/dart/reference/flutter`,
// `/mobile/reference/brief-mobile`): short, and of the depth the app's screens match. The project is the folder that
// holds the page's `docs/` (the framework is `synapsis`).
const LAYER = { '07-reference': 'reference', '08-guides': 'guide' }
const route = path => {
  const parts = path.replace(/\.md$/, '').split('/')
  const at = parts.indexOf('docs')
  if (at < 1 || !LAYER[parts[at + 1]]) return '/' + parts.join('/')
  const project = parts[at - 1] === 'nuclear-synapsis-framework' ? 'synapsis' : parts[at - 1]
  return `/${project}/${LAYER[parts[at + 1]]}/${parts.slice(at + 2).join('-')}`
}
// the file of a page's content: its address with `--` for `/` (the app reads it so)
const keyOf = path => route(path).slice(1).replaceAll('/', '--')
// an address of site.toml is a page's path in the tree (`/nuclearlang/docs/08-guides/README`): its page's address
const address = path => (path.startsWith('/') && sourceOf.has(`${path.slice(1)}.md`) ? route(`${path.slice(1)}.md`) : path)
const read = path => path === `${GRAMMAR}.md`
  ? `# Formal grammar\n\nThe grammar of the base language in EBNF. The parser implements it ` +
    `(\`nuclearlang/crates/nuclear-syntax/src/parser.rs\`).\n\n\`\`\`txt\n${readFileSync(join(tree, `${GRAMMAR}.ebnf`), 'utf8')}\`\`\`\n`
  : readFileSync(join(sourceOf.get(path), path), 'utf8')
sourceOf.set(`${GRAMMAR}.md`, tree)
const pages = [...sourceOf.keys()].sort()
const titleOf = path => (read(path).match(/^# (.+)$/m)?.[1] ?? path).replace(/`/g, '').replace(/^NuclearLang — /, '')

// --- highlighting: Nuclear with the editors' grammar, the dark Chernobyl theme of the editors and a light theme ---
const grammar = JSON.parse(readFileSync(join(tree, 'extensions/vscode/syntaxes/nuclear.tmLanguage.json'), 'utf8'))
for (const p of grammar.repository?.['doc-tag']?.patterns ?? []) if (p.contentName === 'comment.example.nuclear') delete p.patterns
const chernobyl = JSON.parse(readFileSync(join(tree, 'extensions/vscode/themes/chernobyl-color-theme.json'), 'utf8'))
// the languages of the pages' code blocks (and of the sample's targets) that shiki knows
const fences = new Set(pages.flatMap(p => [...read(p).matchAll(/^```(\w+)/gm)].map(m => m[1])))
for (const t of config.home.sample.targets) fences.add(t)
const languages = [...fences].filter(l => l in bundledLanguages)
const highlighter = await createHighlighter({
  themes: [{ ...chernobyl, name: 'chernobyl' }, 'github-light'],
  langs: [{ ...grammar, name: 'nuclear', aliases: ['nuc'] }, ...languages],
})
const aliases = { sh: 'shellscript', bash: 'shellscript', zsh: 'shellscript', ts: 'typescript', js: 'javascript', py: 'python', yml: 'yaml' }
const known = new Set(highlighter.getLoadedLanguages())
const highlight = (code, lang) => {
  const l = aliases[lang] || lang
  return highlighter.codeToHtml(code, {
    lang: known.has(l) ? l : 'text',
    themes: { light: 'github-light', dark: 'chernobyl' },
    defaultColor: false,
  })
}

// --- markdown: ids on headings, links rewritten to the app's routes or to the repository on GitHub ---
const slug = text => text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[`*_]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
const md = new MarkdownIt({ html: true, highlight })
let current = { path: '', base: tree, headings: [] }
md.renderer.rules.heading_open = (tokens, i, options, env, self) => {
  const text = tokens[i + 1].children.map(t => t.content).join('')
  const id = slug(text)
  tokens[i].attrSet('id', id)
  const level = Number(tokens[i].tag.slice(1))
  if (level === 2 || level === 3) current.headings.push({ level, id, text })
  return self.renderToken(tokens, i, options)
}
const linkOpen = md.renderer.rules.link_open ?? ((tokens, i, options, env, self) => self.renderToken(tokens, i, options))
md.renderer.rules.link_open = (tokens, i, options, env, self) => {
  const href = tokens[i].attrGet('href') ?? ''
  const [target, hash = ''] = href.split('#')
  // a link to another repository of the organization (written as its GitHub url) that is a page of this site
  const other = target.startsWith(`${org}/`) && target.slice(org.length + 1).match(/^[^/]+\/blob\/[^/]+\/(.+)$/)
  if (other && sourceOf.has(other[1])) {
    tokens[i].attrSet('href', route(other[1]) + (hash ? `#${hash}` : ''))
  } else if (target && !/^[a-z]+:|^\//i.test(target)) {
    const path = posix.normalize(posix.join(posix.dirname(current.path), target)).replace(/\/$/, '')
    const page = path === `${GRAMMAR}.ebnf` ? `${GRAMMAR}.md` : path
    if (sourceOf.has(page)) {
      tokens[i].attrSet('href', route(page) + (hash ? `#${hash}` : ''))
    } else if (!path.startsWith('..')) {
      const base = roots.find(r => existsSync(join(r, path))) ?? current.base
      const kind = existsSync(join(base, path)) && statSync(join(base, path)).isDirectory() ? 'tree' : 'blob'
      tokens[i].attrSet('href', `${org}/${repoOf(base)}/${kind}/${branch}/${path}${hash ? `#${hash}` : ''}`)
    }
  }
  return linkOpen(tokens, i, options, env, self)
}
const words = html => html.replace(/<pre[\s\S]*?<\/pre>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ')
  .toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter(w => w.length > 2)

// --- write ---
for (const dir of ['content', 'static']) rmSync(join(out, dir), { recursive: true, force: true })
mkdirSync(join(out, 'content'), { recursive: true })
const index = []
for (const path of pages) {
  current = { path, base: sourceOf.get(path), headings: [] }
  const html = md.render(read(path))
  const title = titleOf(path)
  const source = path === `${GRAMMAR}.md`
    ? `${org}/nuclear/blob/${branch}/${GRAMMAR}.ebnf`
    : `${org}/${repoOf(current.base)}/blob/${branch}/${path}`
  writeFileSync(join(out, 'content', `${keyOf(path)}.json`),
    JSON.stringify({ path: route(path), title, html, headings: current.headings, source }))
  index.push({ path: route(path), title, headings: current.headings.map(h => h.text), words: [...new Set(words(html))].join(' ') })
  // the plain page, for search engines and agents that read without JavaScript
  const file = join(out, 'static', `${route(path).slice(1)}.html`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title} · NuclearLang</title>` +
    `<link rel="canonical" href="${site}${route(path)}"></head><body><p><a href="${route(path)}">Open in the NuclearLang site</a></p>` +
    `<main>${html}</main></body></html>\n`)
}
writeFileSync(join(out, 'content', 'search.json'), JSON.stringify(index))

// the site: the side menu of site.toml (a page with `*` expands to the pages it matches, in order, once each), the
// top links, the footer and where the repositories are
const pattern = p => new RegExp('^' + p.split('*').map(x => x.replace(/[.+?^${}()|\\]/g, '\\$&')).join('[^/]*') + '$')
const expand = p => p.includes('*') ? pages.filter(x => !x.endsWith('/README.md') && pattern(p).test(x.replace(/\.md$/, ''))) : pages.filter(x => x === `${p}.md`)
const sections = config.sidebar.map(section => {
  const seen = new Set()
  const items = section.pages.flatMap(expand).filter(x => !seen.has(x) && seen.add(x))
  return { title: section.title, items: items.map(x => ({ title: titleOf(x), path: route(x) })) }
})
writeFileSync(join(out, 'content', 'site.json'), JSON.stringify({
  title: config.site.title, url: site, org, footer: config.site.footer, top: config.top.map(t => ({ ...t, path: address(t.path) })), sections,
}))

// the home page's sample, transpiled by the installed compiler to each target
const sample = config.home.sample.code.trim() + '\n'
const nuclear = process.env.NUCLEAR || 'nuclear'
const scratch = mkdtempSync(join(tmpdir(), 'nuclear-site-'))
writeFileSync(join(scratch, 'app.nuc'), sample)
// each target dialect's output, highlighted as its language (the dialect's name is its language's name)
const outputs = config.home.sample.targets.map(dialect => ({
  dialect,
  html: highlight(execFileSync(nuclear, ['build', join(scratch, 'app.nuc'), '--dialect', dialect], { encoding: 'utf8' }).trim(), dialect),
}))
rmSync(scratch, { recursive: true, force: true })
const fillSite = t => t.replaceAll('{{site}}', site)
const h = config.home
writeFileSync(join(out, 'content', 'home.json'), JSON.stringify({
  title: config.site.title,
  lead: config.site.lead,
  tagline: config.site.tagline,
  actions: h.actions.map(a => ({ title: a.title, path: address(a.path), primary: !!a.primary })),
  features: h.features,
  sampleTitle: h.sample.title,
  sampleNote: h.sample.note,
  sample: highlight(sample.trim(), 'nuclear'),
  outputs,
  platformsTitle: h.platforms.title,
  platforms: h.platforms.cards.map(c => ({ ...c, path: address(c.path) })),
  installTitle: h.install.title,
  install: h.install.lines.map(fillSite).join('\n'),
}))

// llms.txt (llmstxt.org): what an AI agent reads first; llms-full.txt carries the short sheets and the reference
const briefs = pages.filter(p => p.includes('/07-reference/brief/'))
  .sort((a, b) => (a.endsWith('nuclear-base.md') ? -1 : b.endsWith('nuclear-base.md') ? 1 : a.localeCompare(b)))
const link = p => `- [${titleOf(p)}](${site}/static/${route(p).slice(1)}.html)`
writeFileSync(join(out, 'llms.txt'), [
  `# ${config.site.title}`, '',
  `> ${config.site.tagline} Its syntax is not TypeScript, Dart nor Python: read the sheet of the dialect before`,
  '> writing. With the CLI: `nuclear spec --brief --dialect <d>`.',
  '', '## Sheets (read first)', '', ...briefs.map(link), '',
  // the side menu's sections, the same order as the site
  ...sections.flatMap(sec => [`## ${sec.title}`, '', ...sec.items.map(i => `- [${i.title}](${site}/static/${i.path.slice(1)}.html)`), '']),
].join('\n'))
writeFileSync(join(out, 'llms-full.txt'), [...briefs, 'nuclearlang/docs/08-guides/reference.md'].map(p => `<!-- ${p} -->\n${read(p).trim()}\n`).join('\n'))
writeFileSync(join(out, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  ['/', ...pages.map(route)].map(r => `  <url><loc>${site}${r}</loc></url>`).join('\n') + '\n</urlset>\n')
// the installers (curl … | sh, irm … | iex) are the tree's own, served at the site's root
for (const f of ['install.sh', 'install.ps1']) copyFileSync(join(tree, 'installer/release', f), join(out, f))
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`)

console.log(`content: ${pages.length} pages from ${roots.length} repositories (${roots.map(repoOf).join(', ')}) → public/`)
