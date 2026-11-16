// The marks of NuclearLang's own tools (the MCP server, the Smart Graph, HTTP Connections, Nuclear Atlas) and the
// orbit of the workspaces: SVG built on the trefoil of the logo, coloured for each theme (an <img> SVG reads
// prefers-color-scheme) and still for a reader who asks for less motion.
const ACCENT = ['#3d7a00', '#a7ff00']
const SECOND = ['#00838f', '#2fe0f0']
const SURFACE = ['#ffffff', '#0e130c']
const LINE = ['#c9d6c0', '#2c3a29']
const VIOLET = ['#6a3fb5', '#b98cff']
const AMBER = ['#a86b00', '#ffc400']

const style = extra => `<style>
.a{fill:${ACCENT[0]}}.as{stroke:${ACCENT[0]}}.c{fill:${SECOND[0]}}.cs{stroke:${SECOND[0]}}.bg{fill:${SURFACE[0]}}.ln{stroke:${LINE[0]}}.v{fill:${VIOLET[0]}}.vs{stroke:${VIOLET[0]}}.y{fill:${AMBER[0]}}.ys{stroke:${AMBER[0]}}
@media (prefers-color-scheme:dark){.a{fill:${ACCENT[1]}}.as{stroke:${ACCENT[1]}}.c{fill:${SECOND[1]}}.cs{stroke:${SECOND[1]}}.bg{fill:${SURFACE[1]}}.ln{stroke:${LINE[1]}}.v{fill:${VIOLET[1]}}.vs{stroke:${VIOLET[1]}}.y{fill:${AMBER[1]}}.ys{stroke:${AMBER[1]}}}
${extra}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>`

const point = (cx, cy, r, deg) => {
  const t = (deg * Math.PI) / 180
  return [+(cx + r * Math.cos(t)).toFixed(2), +(cy + r * Math.sin(t)).toFixed(2)]
}
// the trefoil: a dot and three blades of 60°, at the upper left, the upper right and the bottom
export const trefoil = (cx, cy, r, cls = 'a') => {
  const inner = r * 0.32
  const blades = [-150, -30, 90].map(mid => {
    const [a, b] = [mid - 30, mid + 30]
    const [x1, y1] = point(cx, cy, inner, a)
    const [x2, y2] = point(cx, cy, r, a)
    const [x3, y3] = point(cx, cy, r, b)
    const [x4, y4] = point(cx, cy, inner, b)
    return `M${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 0 1 ${x3} ${y3}L${x4} ${y4}A${inner} ${inner} 0 0 0 ${x1} ${y1}Z`
  })
  return `<path class="${cls}" d="${blades.join('')}"/><circle class="${cls}" cx="${cx}" cy="${cy}" r="${(r * 0.2).toFixed(2)}"/>`
}

const svg = (size, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img">${style(extra)}${body}</svg>`

// The MCP server: the trefoil as a hub, three clients plugged into it
const mcp = () => svg(64, [
  ...[-90, 30, 150].map(d => {
    const [x, y] = point(32, 32, 26, d)
    const [x0, y0] = point(32, 32, 15, d)
    return `<line class="cs" x1="${x0}" y1="${y0}" x2="${x}" y2="${y}" stroke-width="3" stroke-linecap="round"/><circle class="bg cs" cx="${x}" cy="${y}" r="5" stroke-width="3"/>`
  }),
  trefoil(32, 32, 14),
].join(''))

// The Smart Graph (the RAG): a database whose front carries the trefoil
const graph = () => svg(64, `
<path class="bg as" stroke-width="3" d="M12 14v36c0 4.4 9 8 20 8s20-3.6 20-8V14"/>
<ellipse class="bg as" stroke-width="3" cx="32" cy="14" rx="20" ry="8"/>
<path class="ln" fill="none" stroke-width="2" d="M12 25c0 4.4 9 8 20 8s20-3.6 20-8"/>
${trefoil(32, 45, 10, 'c')}`)

// HTTP Connections: the trefoil between a request that goes and an answer that comes back
const http = () => svg(64, `
<path class="cs" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" d="M8 15h44l-7-6M56 49H12l7 6"/>
${trefoil(32, 32, 13)}`)

// Nuclear Atlas: the trefoil inside a globe
const atlas = () => svg(64, `
<circle class="cs" fill="none" stroke-width="3" cx="32" cy="32" r="26"/>
<ellipse class="ln" fill="none" stroke-width="2" cx="32" cy="32" rx="12" ry="26"/>
<path class="ln" fill="none" stroke-width="2" d="M6 32h11M47 32h11"/>
${trefoil(32, 32, 11)}`)

// The workspaces: every platform turning around the same Nuclear, joined; `logos` are the simple-icons of the
// platforms' dialects: { path, hex, label } at the top, the bottom right and the bottom left
const orbit = logos => svg(200, `
<circle class="ln" fill="none" stroke-width="1.5" cx="100" cy="100" r="88"/>
<g class="spin"><circle class="as" fill="none" stroke-width="2" stroke-dasharray="3 9" cx="100" cy="100" r="88"/>
<circle class="a glow" cx="100" cy="12" r="4"/><circle class="c" cx="100" cy="188" r="3"/></g>
<path class="cs flow" fill="none" stroke-width="2" stroke-dasharray="6 6" d="M${point(100, 100, 70, -90)}L${point(100, 100, 70, 30)}L${point(100, 100, 70, 150)}Z"/>
<g class="pulse">${trefoil(100, 100, 27)}</g>
${logos.map((l, i) => {
    const [x, y] = point(100, 100, 70, [-90, 30, 150][i])
    return `<circle class="bg cs" stroke-width="2" cx="${x}" cy="${y}" r="17"/><path fill="#${l.hex}" transform="translate(${x - 10} ${y - 10}) scale(.8333)" d="${l.path}"/>`
  }).join('')}`, `
.spin{transform-origin:100px 100px;animation:spin 24s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.flow{animation:flow 2.4s linear infinite}@keyframes flow{to{stroke-dashoffset:-24}}
.pulse{transform-origin:100px 100px;animation:pulse 3s ease-in-out infinite}@keyframes pulse{50%{transform:scale(1.08)}}
.glow{filter:drop-shadow(0 0 4px #a7ff00)}`)

// --- the hooks of the home page: one small animated picture each ---
const R = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'

// Built for AI: signals flow from the agent's nodes into Nuclear
const hookAi = () => svg(64, [
  ...[-90, -18, 54, 126, 198].map((d, i) => {
    const [x, y] = point(32, 32, 25, d)
    const [x0, y0] = point(32, 32, 11, d)
    return `<line class="cs flow" style="animation-delay:-${i * 0.3}s" x1="${x}" y1="${y}" x2="${x0}" y2="${y0}" stroke-width="2" stroke-dasharray="3 4"/><circle class="c node" style="animation-delay:${i * 0.35}s" cx="${x}" cy="${y}" r="4"/>`
  }),
  trefoil(32, 32, 10),
].join(''), `.flow{animation:flow 1.2s linear infinite}@keyframes flow{to{stroke-dashoffset:-14}}
.node{transform-box:fill-box;transform-origin:center;animation:node 1.8s ease-in-out infinite}@keyframes node{50%{transform:scale(1.35)}}`)

// Only business logic: the lines that are not logic fade away, the logic stays lit
const hookLogic = () => svg(64, `
<path class="vs" ${R} stroke-width="3" d="M14 18 5 32l9 14M50 18l9 14-9 14"/>
<line class="ln noise" x1="20" y1="20" x2="40" y2="20" stroke-width="3" stroke-linecap="round"/>
<line class="as logic" x1="20" y1="29" x2="44" y2="29" stroke-width="3.5" stroke-linecap="round"/>
<line class="ln noise" style="animation-delay:-.7s" x1="20" y1="38" x2="36" y2="38" stroke-width="3" stroke-linecap="round"/>
<line class="ln noise" style="animation-delay:-1.4s" x1="20" y1="46" x2="42" y2="46" stroke-width="3" stroke-linecap="round"/>`,
`.noise{animation:noise 2.4s ease-in-out infinite}@keyframes noise{50%{opacity:.08}}
.logic{animation:logic 2.4s ease-in-out infinite}@keyframes logic{50%{filter:drop-shadow(0 0 4px #a7ff00)}}`)

// Easy for people to read: the page writes itself, line by line
const hookRead = () => svg(64, `
<rect class="cs" ${R} stroke-width="2.5" x="12" y="8" width="40" height="48" rx="6"/>
${[0, 1, 2, 3].map(i => `<line class="as type" style="animation-delay:${i * 0.5}s" x1="20" y1="${20 + i * 9}" x2="${[44, 38, 42, 30][i]}" y2="${20 + i * 9}" stroke-width="3" stroke-linecap="round" stroke-dasharray="26" stroke-dashoffset="26"/>`).join('')}`,
`.type{animation:type 3.2s ease-out infinite}@keyframes type{0%{stroke-dashoffset:26}35%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:0;opacity:0}}`)

// Tools write the standard code: a gear turns and sparks come out
const hookTools = () => svg(64, `
<g class="gear">${[0, 45, 90, 135, 180, 225, 270, 315].map(d => `<rect class="y" x="27" y="9" width="10" height="9" rx="2" transform="rotate(${d} 32 34)"/>`).join('')}
<circle class="ys" fill="none" stroke-width="6" cx="32" cy="34" r="14"/></g>
<circle class="bg" cx="32" cy="34" r="6"/>
<path class="a spark" d="M52 6l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path class="c spark" style="animation-delay:-.8s" d="M10 6l1.5 3.5L15 11l-3.5 1.5L10 16l-1.5-3.5L5 11l3.5-1.5z"/>`,
`.gear{transform-origin:32px 34px;animation:spin 6s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.spark{transform-box:fill-box;transform-origin:center;animation:spark 1.6s ease-in-out infinite}@keyframes spark{50%{transform:scale(.4);opacity:.3}}`)

// As fast as an expert's code: a bolt with speed lines
const hookFast = () => svg(64, `
${[16, 32, 48].map((y, i) => `<line class="cs speed" style="animation-delay:-${i * 0.25}s" x1="4" y1="${y}" x2="22" y2="${y}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="6 10"/>`).join('')}
<path class="y bolt" d="M38 4 20 36h12l-4 24 20-34H36l6-22z"/>`,
`.speed{animation:speed .8s linear infinite}@keyframes speed{to{stroke-dashoffset:16}}
.bolt{animation:bolt 1.6s ease-in-out infinite}@keyframes bolt{50%{filter:drop-shadow(0 0 6px #ffc400)}}`)

// Free, open and local: a shield whose check draws itself
const hookLocal = () => svg(64, `
<path class="as" ${R} stroke-width="3" d="M32 6 52 13v17c0 13-9 22-20 28C21 52 12 43 12 30V13z"/>
<path class="cs check" ${R} stroke-width="4" d="m22 31 7 7 13-14" stroke-dasharray="30" stroke-dashoffset="30"/>`,
`.check{animation:check 2.6s ease-out infinite}@keyframes check{0%{stroke-dashoffset:30}40%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:0;opacity:0}}`)

// Install: the trefoil drops into the machine, again and again
const install = () => svg(64, `
<path class="cs" ${R} stroke-width="3" d="M10 40v10a4 4 0 0 0 4 4h36a4 4 0 0 0 4-4V40"/>
<line class="ln" x1="20" y1="47" x2="44" y2="47" stroke-width="3" stroke-linecap="round"/>
<g class="drop">${trefoil(32, 22, 11)}<path class="as" ${R} stroke-width="3" d="M26 38l6 5 6-5"/></g>`,
`.drop{animation:drop 2.2s cubic-bezier(.5,0,.5,1) infinite}@keyframes drop{0%{transform:translateY(-10px);opacity:0}25%{opacity:1}70%{transform:translateY(4px);opacity:1}100%{transform:translateY(8px);opacity:0}}`)

export const marks = { install, mcp, graph, http, atlas, 'hook-ai': hookAi, 'hook-logic': hookLogic, 'hook-read': hookRead, 'hook-tools': hookTools, 'hook-fast': hookFast, 'hook-local': hookLocal }
export { orbit }
