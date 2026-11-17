// Builds the website's content from the documentation of the NuclearLang tree: the reference (`docs/07-reference/`) and
// the guides (`docs/08-guides/`) of every project. The app (written in Nuclear) only reads it.
//
//   public/content/<key>.json   one page: title, html (code already highlighted), headings, its source on GitHub
//   public/content/site.json    the site: title, top links, side menu, footer, repositories (site.toml)
//   public/content/search.json  the search index: title, headings and words of every page
//   public/content/home.json    the home page: its hooks, the samples and their outputs, the agent's fix (the real compiler)
//   public/content/tools.json   every tool: its page and its documents
//   public/content/platforms.json  every platform: its levels, its onboarding run again, its code built per dialect
//   public/logos/<name>.svg     the logos of the integrations (simple-icons), coloured for each theme
//   public/icons/<name>.svg     the icons the site uses (lucide), in the theme's accent
//   public/brand/<mark>.svg     the marks of NuclearLang's own tools and the orbit of the workspaces (tools/marks.mjs)
//   public/static/<path>.html   the same page as plain HTML, for search engines and agents that read without JS
//   public/llms.txt, public/llms-full.txt, public/sitemap.xml, public/robots.txt
//
// The .md files of the repositories are the only source of the pages; site.toml holds the rest (texts, menus, links,
// addresses). NUCLEAR_TREE overrides its source tree, SITE_URL its address.
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import MarkdownIt from 'markdown-it'
import { bundledLanguages, createHighlighter } from 'shiki'
import { parse } from 'smol-toml'
import * as simpleIcons from 'simple-icons'
import { marks, orbit } from './marks.mjs'

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
const repoOf = () => 'lang'
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
for (const t of [...config.home.samples.targets, 'json', 'shellscript', 'typescript', 'dart', 'python']) fences.add(t)
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
    ? `${org}/lang/blob/${branch}/${GRAMMAR}.ebnf`
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

// --- what the installed compiler makes when the site is built: the samples, the agent's fix, the onboardings ---
const nuclear = process.env.NUCLEAR || 'nuclear'
const scratch = mkdtempSync(join(tmpdir(), 'nuclear-site-'))
const fillSite = t => t.replaceAll('{{site}}', site)
// a command line split as a shell would (double quotes group), run in `dir`; its output without colors
const argv = line => [...line.matchAll(/"([^"]*)"|(\S+)/g)].map(m => m[1] ?? m[2])
const runIn = (dir, line) => {
  const [cmd, ...args] = argv(line)
  const r = spawnSync(cmd === 'nuclear' ? nuclear : cmd, args, { cwd: dir, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } })
  if (r.error) throw r.error
  const output = `${r.stderr ?? ''}${r.stdout ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '').replaceAll(dir, '.').replaceAll(scratch, '').trim()
  return { output, status: r.status }
}
const must = (dir, line) => {
  const r = runIn(dir, line)
  if (r.status !== 0) {
    console.error(`\`${line}\` failed in ${dir}:\n${r.output}`)
    process.exit(1)
  }
  return r.output
}
// the language a generated file is highlighted as
const LANG = { '.ts': 'typescript', '.dart': 'dart', '.py': 'python' }
const extOf = f => f.slice(f.lastIndexOf('.'))

// the samples: each one built for each target language
const samples = config.home.samples.items.map((item, i) => {
  const file = join(scratch, `sample${i}.nuc`)
  writeFileSync(file, item.code.trim() + '\n')
  return {
    title: item.title,
    nuclear: highlight(item.code.trim(), 'nuclear'),
    outputs: config.home.samples.targets.map(dialect => ({ dialect, html: highlight(must(scratch, `nuclear build ${file} --dialect ${dialect}`), dialect) })),
  }
})

// an agent's mistake: what `nuclear check --json` answers and what `nuclear fix` makes of it
const mistake = join(scratch, 'mistake.nuc')
const wrong = config.home.check.code.trim() + '\n'
writeFileSync(mistake, wrong)
const found = JSON.parse(runIn(scratch, `nuclear check ${mistake} --dialect ${config.home.check.dialect} --json`).output)
if (!found.length) {
  console.error('the mistake of [home.check] gives no error')
  process.exit(1)
}
must(scratch, `nuclear fix ${mistake} --dialect ${config.home.check.dialect}`)
const check = {
  title: config.home.check.title,
  text: config.home.check.text,
  wrong: highlight(wrong.trim(), 'nuclear'),
  diagnostics: found.map(d => ({ code: d.code, line: d.line, col: d.col, message: d.message, fix: d.fix ? `${d.fix.replace} → ${d.fix.with}` : '' })),
  json: highlight(JSON.stringify(found.map(({ file, 'explanation-context': _, ...d }) => d), null, 2), 'json'),
  fixed: highlight(readFileSync(mistake, 'utf8').trim(), 'nuclear'),
}

// the files of a folder (relative paths), without what a build or a package manager writes
const GENERATED_SKIP = new Set(['node_modules', '.venv', '.dart_tool', '.nuclear', '.git', '.claude', '.cursor', 'android', 'ios', 'macos', 'linux', 'windows', 'web'])
const files = (base, dir = '') => existsSync(join(base, dir))
  ? readdirSync(join(base, dir)).flatMap(name => {
      const path = posix.join(dir, name)
      if (GENERATED_SKIP.has(name)) return []
      return statSync(join(base, path)).isDirectory() ? files(base, path) : [path]
    })
  : []
const nucOf = base => files(base).filter(f => f.endsWith('.nuc') && !f.startsWith('build/')).sort()
const linesOf = (base, list) => list.reduce((n, f) => n + readFileSync(join(base, f), 'utf8').split('\n').filter(l => l.trim()).length, 0)
// the file a dialect writes from `nuc` (same name, any separator): `todos_controller.nuc` → `todos.controller.ts`
const norm = name => name.toLowerCase().replace(/[^a-z0-9]/g, '')
const outputOf = (build, nuc) => {
  const stem = norm(posix.basename(nuc, '.nuc'))
  return files(build).find(f => LANG[extOf(f)] && norm(posix.basename(f, extOf(f))).startsWith(stem))
}

// the onboarding of each platform: its steps run again in a scratch folder; the .nuc they make must be the example
// of the tree (UPDATE_EXAMPLES=1 writes the example from them)
const update = !!process.env.UPDATE_EXAMPLES
const onboardings = new Map(config.onboarding.map(o => {
  const work = mkdtempSync(join(scratch, `${o.platform}-`))
  let dir = work
  const steps = o.steps.map(step => {
    if (!step.run) return { title: step.title, text: step.text, command: step.command, output: '' }
    const output = must(dir, step.run)
    const words = argv(step.run)
    if (words[1] === 'new') dir = join(dir, words[2])
    return { title: step.title, text: step.text, command: step.run, output }
  })
  const example = join(tree, o.example)
  const made = nucOf(dir)
  if (update) {
    rmSync(example, { recursive: true, force: true })
    for (const f of made) {
      mkdirSync(dirname(join(example, f)), { recursive: true })
      copyFileSync(join(dir, f), join(example, f))
    }
  }
  const kept = nucOf(example)
  const differ = [...new Set([...made, ...kept])].filter(f => !existsSync(join(example, f)) || !existsSync(join(dir, f)) ||
    readFileSync(join(example, f), 'utf8') !== readFileSync(join(dir, f), 'utf8'))
  if (differ.length) {
    console.error(`${o.example} is not what its onboarding makes (${differ.join(', ')}): run the steps again, or UPDATE_EXAMPLES=1`)
    process.exit(1)
  }
  // level 4: the shown file and what each dialect of the platform writes from it, built by the compiler
  const platform = config.platforms.find(p => p.key === o.platform)
  const manifest = readFileSync(join(dir, 'config.nuc'), 'utf8')
  const own = manifest.match(/dialect = "([^"]+)"/)[1]
  let generated = { files: 0, lines: 0 }
  const outputs = platform.dialects.map(dialect => {
    const copy = join(scratch, `${o.platform}-${dialect}`)
    rmSync(copy, { recursive: true, force: true })
    mkdirSync(copy)
    for (const f of made) {
      mkdirSync(dirname(join(copy, f)), { recursive: true })
      copyFileSync(join(dir, f), join(copy, f))
    }
    writeFileSync(join(copy, 'config.nuc'), manifest.replace(`dialect = "${own}"`, `dialect = "${dialect}"`))
    must(copy, 'nuclear build .')
    const build = join(copy, 'build')
    const code = files(build).filter(f => LANG[extOf(f)])
    if (dialect === own) generated = { files: code.length, lines: linesOf(build, code) }
    const out = outputOf(build, o.show)
    if (!out) {
      console.error(`the ${dialect} build of ${o.example} writes no file for ${o.show}`)
      process.exit(1)
    }
    return { dialect, path: `build/${out}`, html: highlight(readFileSync(join(build, out), 'utf8').trim(), LANG[extOf(out)]) }
  })
  // the onboarding with an agent: shown, never run (it needs the reader's agent)
  const fill = text => fillSite(text.trim()).replaceAll('{{platform}}', o.platform)
    .replaceAll('{{app}}', posix.basename(o.example)).replaceAll('{{prompt}}', o.prompts[0])
  const agentSteps = config.agent_onboarding.map(st => ({ title: st.title, text: st.text, command: fill(st.command), output: '' }))
  return [o.platform, {
    app: posix.basename(o.example),
    agentSteps,
    prompts: o.prompts,
    example: `${org}/lang/tree/${branch}/${o.example}`,
    steps,
    code: { path: o.show, html: highlight(readFileSync(join(dir, o.show), 'utf8').trim(), 'nuclear'), outputs },
    stats: { nucFiles: made.length, nucLines: linesOf(dir, made), outFiles: generated.files, outLines: generated.lines },
  }]
}))
rmSync(scratch, { recursive: true, force: true })

// the documents a tool or a platform lists, by their path in the tree: each must be a page
const pagesOf = (owner, paths) => paths.map(p => {
  if (!sourceOf.has(`${p}.md`)) {
    console.error(`${owner}: ${p} is not a page of the tree`)
    process.exit(1)
  }
  return { title: titleOf(`${p}.md`), path: route(`${p}.md`) }
})
const flowOf = f => {
  const m = f.match(/^(.+?) → (.+?)(?:: (.+))?$/)
  return { source: m[1], target: m[2], text: m[3] ?? '' }
}

// --- the logos and the icons: SVG files whose colour follows the reader's theme (an <img> reads prefers-color-scheme) ---
const THEME = { light: '#17200f', dark: '#dbe7d2', accentLight: '#3d7a00', accentDark: '#a7ff00' }
const luminance = hex => {
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const themed = (light, dark, prop) => `<style>*{${prop}:${light}}@media (prefers-color-scheme:dark){*{${prop}:${dark}}}</style>`
mkdirSync(join(out, 'logos'), { recursive: true })
// a logo is a simple-icons slug, or { devicon = "<folder>/<file>", name } for a brand simple-icons leaves out (VS Code,
// IntelliJ IDEA), or { lucide = "<icon>", name } for a product with no free logo (Codex); { simple, name } renames one
const lucideSvg = (owner, name, light, dark) => {
  const file = join(project, 'tools/node_modules/lucide-static/icons', `${name}.svg`)
  if (!existsSync(file)) {
    console.error(`${owner}: lucide has no icon "${name}"`)
    process.exit(1)
  }
  const svg = readFileSync(file, 'utf8').replace(/<!--.*?-->\s*/s, '').replace('stroke="currentColor"', '')
  return svg.replace(/(<svg[^>]*>)/, `$1${themed(light, dark, 'stroke')}`)
}
const logos = new Map(Object.entries(config.logos).map(([name, source]) => {
  const file = join(out, 'logos', `${name}.svg`)
  if (typeof source === 'object' && source.devicon) {
    const from = join(project, 'tools/node_modules/devicon/icons', `${source.devicon}.svg`)
    if (!existsSync(from)) {
      console.error(`[logos] ${name}: devicon has no "${source.devicon}"`)
      process.exit(1)
    }
    copyFileSync(from, file)
    return [name, { name: source.name, src: `/logos/${name}.svg` }]
  }
  if (typeof source === 'object' && source.lucide) {
    writeFileSync(file, lucideSvg(`[logos] ${name}`, source.lucide, THEME.light, THEME.dark))
    return [name, { name: source.name, src: `/logos/${name}.svg` }]
  }
  const slug = typeof source === 'object' ? source.simple : source
  const icon = Object.values(simpleIcons).find(i => i?.slug === slug)
  if (!icon) {
    console.error(`[logos] ${name}: simple-icons has no "${slug}"`)
    process.exit(1)
  }
  // a brand colour too dark for the dark theme (or too light for the light one) takes the theme's text colour
  const l = luminance(icon.hex)
  const light = l > 0.7 ? THEME.light : `#${icon.hex}`
  const dark = l < 0.08 ? THEME.dark : `#${icon.hex}`
  writeFileSync(file, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">${themed(light, dark, 'fill')}<path d="${icon.path}"/></svg>`)
  return [name, { name: source.name ?? icon.title, src: `/logos/${name}.svg` }]
}))
const logo = (owner, name) => {
  if (!logos.has(name)) {
    console.error(`${owner}: no logo "${name}" in [logos] of site.toml`)
    process.exit(1)
  }
  return logos.get(name)
}
mkdirSync(join(out, 'icons'), { recursive: true })
mkdirSync(join(out, 'brand'), { recursive: true })
const icon = (owner, name) => {
  if (name.startsWith('brand:')) {
    const mark = name.slice(6)
    if (!marks[mark]) {
      console.error(`${owner}: tools/marks.mjs has no mark "${mark}"`)
      process.exit(1)
    }
    writeFileSync(join(out, 'brand', `${mark}.svg`), marks[mark]())
    return `/brand/${mark}.svg`
  }
  writeFileSync(join(out, 'icons', `${name}.svg`), lucideSvg(owner, name, THEME.accentLight, THEME.accentDark))
  return `/icons/${name}.svg`
}
// the screenshots of the editor: an image of public/shots/, the keys it answers to and its callouts
const shots = new Map(config.shots.map(sh => {
  if (!existsSync(join(out, sh.image))) {
    console.error(`[[shots]] ${sh.id}: no image ${sh.image} in public/`)
    process.exit(1)
  }
  return [sh.id, { id: sh.id, image: sh.image, alt: sh.alt, caption: sh.caption, spots: sh.spots }]
}))
const shotsOf = (owner, ids = []) => ids.map(id => {
  if (!shots.has(id)) {
    console.error(`${owner}: no [[shots]] "${id}" in site.toml`)
    process.exit(1)
  }
  return shots.get(id)
})
// the orbit of the workspaces: the platforms (their first dialect's logo) around the same Nuclear
const platformLogo = key => {
  const source = config.logos[config.platforms.find(p => p.key === key).dialects[0]]
  const slug = typeof source === 'object' ? source.simple : source
  const i = Object.values(simpleIcons).find(x => x?.slug === slug)
  return { path: i.path, hex: i.hex }
}
writeFileSync(join(out, 'brand', 'orbit.svg'), orbit(['mobile', 'backend', 'web'].map(platformLogo)))
const ART = { orbit: '/brand/orbit.svg' }
// the parts of the extension, most important first; each links to its tool's page
const modules = new Map(config.modules.map(m => {
  if (!m.link && !config.tools.some(t => t.key === m.tool)) {
    console.error(`[[modules]] ${m.id}: no tool "${m.tool}"`)
    process.exit(1)
  }
  if (m.art && !ART[m.art]) {
    console.error(`[[modules]] ${m.id}: no art "${m.art}"`)
    process.exit(1)
  }
  return [m.id, {
    id: m.id, name: m.name, icon: icon(m.id, m.icon), title: m.title, points: m.points, keys: m.keys,
    logos: (m.logos ?? []).map(l => logo(m.id, l)), marks: (m.marks ?? []).map(k => ({ name: k.label, src: icon(m.id, k.icon) })),
    art: m.art ? ART[m.art] : '', shots: shotsOf(m.id, m.shots), more: m.link ?? `/tools/${m.tool}`,
  }]
}))

// an output of a dialect, with the logo of its language or framework for its tab
const withLogo = o => ({ ...o, logo: logos.get(o.dialect)?.src ?? '' })

const tools = config.tools.map(t => ({
  key: t.key, name: t.name, group: t.group, tagline: t.tagline, pitch: t.pitch, highlights: t.highlights,
  icon: icon(t.key, t.icon), logos: (t.logos ?? []).map(l => logo(t.key, l)), shots: shotsOf(t.key, t.shots),
  demo: highlight(t.demo.trim(), 'shellscript'), project: `${org}/lang/tree/${branch}/${t.project}`, pages: pagesOf(t.key, t.pages),
}))
writeFileSync(join(out, 'content', 'tools.json'), JSON.stringify(tools))

const platforms = config.platforms.map(p => ({
  key: p.key, name: p.name, dialects: p.dialects.join(' · '), logos: p.dialects.map(d => logo(p.key, d)), tagline: p.tagline, pitch: p.pitch,
  levels: p.levels.map(l => ({ level: l.level, title: l.title, text: l.text, boxes: l.boxes, flows: l.flows.map(flowOf) })),
  pages: pagesOf(p.key, p.pages),
  ...onboardings.get(p.key),
  code: { ...onboardings.get(p.key).code, outputs: onboardings.get(p.key).code.outputs.map(withLogo) },
}))
writeFileSync(join(out, 'content', 'platforms.json'), JSON.stringify(platforms))

const h = config.home
const lead = platforms.find(p => p.key === h.generator.platform)
writeFileSync(join(out, 'content', 'home.json'), JSON.stringify({
  title: config.site.title,
  lead: config.site.lead,
  tagline: config.site.tagline,
  actions: h.actions.map(a => ({ title: a.title, path: address(a.path), primary: !!a.primary })),
  targetsTitle: h.hero.targetsTitle,
  targets: h.hero.targets.map(t => logo('home.hero', t)),
  agentsTitle: h.hero.agentsTitle,
  agents: h.hero.agents.map(t => logo('home.hero', t)),
  hooks: h.hooks.map(k => ({ title: k.title, text: k.text, icon: icon(k.title, k.icon) })),
  samplesTitle: h.samples.title,
  samplesNote: h.samples.note,
  samples: samples.map(sample => ({ ...sample, outputs: sample.outputs.map(withLogo) })),
  check,
  generatorTitle: h.generator.title,
  generatorText: h.generator.text,
  generatorPlatform: lead.key,
  generator: lead.steps.filter(s => s.output),
  stats: lead.stats,
  dialectsTitle: h.dialects.title,
  dialectsText: h.dialects.text,
  dialects: platforms.find(p => p.key === h.dialects.platform).code,
  platformsTitle: h.platforms.title,
  platformsText: h.platforms.text,
  logs: modules.get(h.logs.module),
  extension: { title: h.extension.title, text: h.extension.text, editorsTitle: h.extension.editorsTitle,
    editors: h.extension.editors.map(e => ({ ...logo('home.extension', e.logo), path: `/tools/${e.tool}` })), modules: h.extension.modules.map(id => {
    if (!modules.has(id)) {
      console.error(`home.extension: no [[modules]] "${id}"`)
      process.exit(1)
    }
    return modules.get(id)
  }) },
  platforms: platforms.map(p => ({ key: p.key, name: p.name, dialects: p.dialects, logos: p.logos, tagline: p.tagline })),
  toolsTitle: h.tools.title,
  toolsText: h.tools.text,
  tools: tools.filter(t => t.group !== 'Editors').map(t => ({ key: t.key, name: t.name, group: t.group, tagline: t.tagline, icon: t.icon })),
  librariesTitle: h.libraries.title,
  librariesText: h.libraries.text,
  librariesCommand: highlight(h.libraries.code.trim(), 'shellscript'),
  librariesExample: highlight(h.libraries.example.trim(), 'nuclear'),
  install: {
    title: h.install.title, text: h.install.text, mark: icon('home.install', 'brand:install'),
    systems: h.install.systems.map(x => ({ name: x.name, logos: x.logos.map(l => logo('home.install', l)), html: highlight(fillSite(x.command), 'shellscript') })),
    next: highlight(h.install.next.trim(), 'shellscript'),
  },
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
  ['/', '/tools', ...config.tools.map(t => `/tools/${t.key}`), ...config.platforms.flatMap(p => [`/platforms/${p.key}`, `/start/${p.key}`]), ...pages.map(route)].map(r => `  <url><loc>${site}${r}</loc></url>`).join('\n') + '\n</urlset>\n')
// the installers (curl … | sh, irm … | iex) are the tree's own, served at the site's root
for (const f of ['install.sh', 'install.ps1']) copyFileSync(join(tree, 'installer/release', f), join(out, f))
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`)

console.log(`content: ${pages.length} pages from ${roots.length} repositories (${roots.map(repoOf).join(', ')}) → public/`)
