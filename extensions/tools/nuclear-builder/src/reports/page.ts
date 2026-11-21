// The Reports page (spec 017): what the factory spent and made, drawn as the company screen's HUD (thin neon frames,
// corner brackets, monospace labels; light panels in a light theme). On top the bill (tokens in and out, the money,
// local against paid, the budget used, tokens and money by period); under it the Jira-like views as tabs (throughput
// and velocity, cycle time, burndown and burnup, cumulative flow, the gates waiting for the user, quality, people,
// indicators), each a chart of inline SVG and its table. The filters (project, team, member, dates, by day or week)
// ask the host again (`reports:load`); the host answers with `nuclear-builder metrics --json` (host.ts). The page only
// draws: what it computes is charts.ts's, tested. Its texts are `t('rp.…')` (l10n.ts).
import { barsSvg, fmtMs, fmtPct, fmtTokens, fmtUsd, linesSvg, splitShare, stackSvg } from './charts';

const BRACKETS = ['0 0/16px 1px', '0 0/1px 16px', '100% 0/16px 1px', '100% 0/1px 16px', '0 100%/16px 1px', '0 100%/1px 16px', '100% 100%/16px 1px', '100% 100%/1px 16px'].map((p) => 'linear-gradient(var(--brk), var(--brk)) ' + p).join(', ');

export const REPORTS_CSS = String.raw`
/* Sala de control, as the teams' screen: slate, one desaturated teal, gold for money, no all-caps */
.rp { --hud: #5cc8b2; --hud2: #7fa6c4; --warn: #d9b86c; --bad: #e48a84; --vio: #a597d6; --on-hud: #07201b; --ease: cubic-bezier(.2, .8, .2, 1);
  --bg: var(--vscode-editor-background, #0b0f0b); --fg: var(--vscode-foreground, #d9e4d2); --mut: var(--vscode-descriptionForeground, #8a9a8a);
  --panel: color-mix(in srgb, var(--bg) 95%, #8fb0c8); --line: color-mix(in srgb, var(--fg) 10%, transparent); --line2: color-mix(in srgb, var(--fg) 18%, transparent);
  --grid: transparent; --mono: var(--vscode-editor-font-family, ui-monospace, Menlo, Consolas, monospace); --brk: var(--hud);
  display: flex; flex-direction: column; gap: 12px; min-height: 100%; color: var(--fg); font: 13px/1.45 var(--vscode-font-family, system-ui, sans-serif); color-scheme: dark; }
.vscode-light .rp { --hud: #137a68; --hud2: #3f6c9c; --warn: #8a6512; --bad: #b3443a; --vio: #6c58a0; --on-hud: #fff; --panel: color-mix(in srgb, var(--bg) 97%, #5b7f99); --line: color-mix(in srgb, var(--fg) 12%, transparent); --line2: color-mix(in srgb, var(--fg) 22%, transparent); color-scheme: light; }
.vscode-high-contrast .rp { --line: var(--vscode-contrastBorder, #fff); --line2: var(--vscode-contrastBorder, #fff); --grid: transparent; }
.rp * { box-sizing: border-box; }
.rp button, .rp select, .rp input { font: inherit; color: var(--vscode-input-foreground, var(--fg)); background: var(--vscode-input-background, var(--panel)); border: 1px solid var(--vscode-input-border, var(--line)); border-radius: 6px; padding: 4px 8px; }
.rp option { background: var(--vscode-dropdown-background, var(--bg)); color: var(--vscode-dropdown-foreground, var(--fg)); }
.rp button { cursor: pointer; background: transparent; border-color: var(--line2); font: 500 12.5px/1.5 var(--vscode-font-family, system-ui, sans-serif); padding: 5px 11px; white-space: nowrap; transition: background .18s var(--ease), border-color .18s var(--ease), color .18s var(--ease); }
.rp button:hover { border-color: color-mix(in srgb, var(--hud) 45%, var(--line2)); background: color-mix(in srgb, var(--hud) 8%, transparent); }
.rp :focus-visible { outline: 2px solid color-mix(in srgb, var(--hud) 75%, transparent); outline-offset: 2px; }
.rp .hud { position: relative; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; transition: border-color .25s var(--ease), box-shadow .25s var(--ease); }
.rp .brk::before { content: ''; position: absolute; inset: -1px; pointer-events: none; border-radius: 8px; background: ${BRACKETS}; background-repeat: no-repeat; opacity: 0; transform: scale(1.012); transition: opacity .3s var(--ease), transform .3s var(--ease); }
.rp .brk:hover::before { opacity: 1; transform: none; } .rp .brk:hover { border-color: color-mix(in srgb, var(--brk) 35%, var(--line)); box-shadow: 0 8px 28px rgb(0 0 0 / .18); }
.rp .hs { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--line); font: 600 12px/1.4 var(--vscode-font-family, system-ui, sans-serif); color: var(--fg); }
.rp .hs i { font-style: normal; color: var(--mut); text-transform: none; letter-spacing: 0; font-weight: 400; }
.rp .lbl { font: 500 11px/1.4 var(--mono); color: var(--mut); }
.rp-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.rp-head h1 { margin: 0; font: 700 19px/1.2 var(--vscode-font-family, system-ui, sans-serif); color: var(--fg); }
.rp-head .sub { color: var(--mut); font-size: 12px; }
.rp-filters { display: flex; flex-wrap: wrap; align-items: end; gap: 8px; padding: 10px 12px; }
.rp-filters label { display: flex; flex-direction: column; gap: 2px; }
.rp-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px; background: var(--line); border-radius: 8px; overflow: hidden; }
.rp-tile { padding: 10px 12px; background: var(--panel); min-width: 0; }
.rp-tile b { display: block; font: 700 20px/1.2 var(--mono); color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rp-tile small { display: block; color: var(--mut); font-size: 11.5px; }
.rp-tile.money b { color: var(--warn); } .rp-tile.ok b { color: var(--hud); }
.rp-split { display: flex; height: 6px; border-radius: 3px; overflow: hidden; margin: 6px 0 3px; background: color-mix(in srgb, var(--mut) 25%, transparent); }
.rp-split span:first-child { background: var(--hud); } .rp-split span:last-child { background: var(--warn); }
.rp-gauge { height: 6px; border-radius: 3px; overflow: hidden; margin: 6px 0 3px; background: color-mix(in srgb, var(--mut) 25%, transparent); }
.rp-gauge span { display: block; height: 100%; background: var(--hud); border-radius: 3px; transform-origin: left; animation: rp-grow .7s var(--ease); }
@keyframes rp-grow { from { transform: scaleX(0); } } .rp-gauge.warn span { background: var(--warn); } .rp-gauge.over span { background: var(--bad); }
.rp-body { padding: 10px 12px 12px; }
.rp-chart { display: block; width: 100%; height: 150px; color: var(--mut); font: 9px var(--mono); }
.rp-chart text { fill: var(--mut); }
.rp-legend { display: flex; flex-wrap: wrap; gap: 12px; margin: 4px 0 8px; font-size: 11.5px; color: var(--mut); }
.rp-legend i { display: inline-block; width: 9px; height: 9px; margin-right: 5px; vertical-align: -1px; }
.rp-tabs { display: flex; flex-wrap: wrap; border-bottom: 1px solid var(--line); }
.rp-tabs button { border: none; border-bottom: 2px solid transparent; border-radius: 0; color: var(--mut); }
.rp-tabs button.sel { color: var(--hud); border-bottom-color: var(--hud); }
.rp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
.rp table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.rp th { text-align: left; font: 500 11px/1.4 var(--mono); letter-spacing: .01em; color: var(--mut); padding: 5px 6px; border-bottom: 1px solid var(--line2); }
.rp td { padding: 5px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
.rp td.n, .rp th.n { text-align: right; font-family: var(--mono); white-space: nowrap; }
.rp tr:hover td { background: color-mix(in srgb, var(--hud) 6%, transparent); }
.rp .res-passed { color: var(--hud); } .rp .res-failed { color: var(--bad); } .rp .res-waiting, .rp .res-running { color: var(--warn); }
.rp .none, .rp .note { color: var(--mut); font-size: 12px; padding: 6px 0; }
.rp .err { padding: 8px 12px; border-left: 3px solid var(--bad); color: var(--bad); background: color-mix(in srgb, var(--bad) 10%, transparent); }
.rp h3 { margin: 4px 0 6px; font: 500 11px/1.4 var(--mono); letter-spacing: .01em; color: var(--hud2); }
@media (prefers-reduced-motion: reduce) { .rp *, .rp *::before, .rp *::after { animation: none !important; transition: none !important; } }
`;

export const REPORTS_SCRIPT = String.raw`
window.Reports = (() => {
  const fmtTokens = ${fmtTokens.toString()};
  const fmtUsd = ${fmtUsd.toString()};
  const fmtMs = ${fmtMs.toString()};
  const fmtPct = ${fmtPct.toString()};
  const barsSvg = ${barsSvg.toString()};
  const stackSvg = ${stackSvg.toString()};
  const linesSvg = ${linesSvg.toString()};
  const splitShare = ${splitShare.toString()};
  const VIEWS = ['bill', 'throughput', 'cycle', 'burndown', 'flow', 'waiting', 'quality', 'people', 'indicators'];
  const STATIONS = ['analysis', 'design', 'tests', 'code', 'quality', 'delivery'];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // the series' colours, the theme's
  const C = { a: 'var(--hud)', b: 'var(--hud2)', c: 'var(--warn)', d: 'var(--vio)', e: 'var(--bad)', m: 'var(--mut)' };
  let el = null, post = () => undefined;
  // F: the filter asked; D: the reports; TEAMS: the teams' names; PROJECTS, MEMBERS: what the filters offer (every one
  // seen, so a filter does not hide the others); tab: the view open; rank: the people's order
  let F = { project: '', team: '', member: '', from: '', to: '', by: 'day' }, D = null, TEAMS = [], PROJECTS = {}, MEMBERS = {}, tab = 'bill', rank = 'cost', loading = true, error = '';

  const station = (s) => T['st.' + s] ? t('st.' + s) : s;
  const per = () => t('rp.by.' + (F.by || 'day'));
  const tbl = (heads, rows) => rows.length ? '<table><thead><tr>' + heads.map((h) => '<th' + (h[1] ? ' class="n"' : '') + '>' + esc(h[0]) + '</th>').join('') + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c, i) => '<td' + (heads[i]?.[1] ? ' class="n"' : '') + '>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table>' : '<div class="none">' + esc(t('rp.none')) + '</div>';
  const tokens = (g) => esc(fmtTokens(g.inTokens)) + ' / ' + esc(fmtTokens(g.outTokens));
  const legend = (items) => '<div class="rp-legend">' + items.map((x) => '<span><i style="background:' + x[1] + '"></i>' + esc(x[0]) + '</span>').join('') + '</div>';
  const result = (r) => '<span class="res-' + esc(r) + '">' + esc(r) + '</span>';
  const sec = (title, body) => '<div><h3>' + esc(title) + '</h3>' + body + '</div>';
  const tile = (label, value, more, cls) => '<div class="rp-tile' + (cls ? ' ' + cls : '') + '"><span class="lbl">' + esc(label) + '</span><b title="' + esc(value) + '">' + esc(value) + '</b>' + (more ?? '') + '</div>';

  function filters() {
    const opt = (v, label, on) => '<option value="' + esc(v) + '"' + (on ? ' selected' : '') + '>' + esc(label) + '</option>';
    const all = opt('', t('rp.f.all'), false);
    const sel = (f, list) => '<select data-f="' + f + '">' + all + list.map((x) => opt(x[0], x[1], F[f] === x[0])).join('') + '</select>';
    const projects = Object.entries(PROJECTS).map(([root, name]) => [root, name]);
    const teams = TEAMS.map((x) => [x.id, x.name]);
    const members = Object.entries(MEMBERS).filter(([, m]) => !F.team || m.team === F.team).map(([id, m]) => [id, m.label]);
    const field = (label, body) => '<label><span class="lbl">' + esc(label) + '</span>' + body + '</label>';
    return '<div class="hud brk rp-filters">'
      + field(t('rp.f.project'), sel('project', projects)) + field(t('rp.f.team'), sel('team', teams)) + field(t('rp.f.member'), sel('member', members))
      + field(t('rp.f.from'), '<input type="date" data-f="from" value="' + esc(F.from) + '">') + field(t('rp.f.to'), '<input type="date" data-f="to" value="' + esc(F.to) + '">')
      + field(t('rp.f.by'), '<select data-f="by">' + opt('day', t('rp.by.day'), F.by !== 'week') + opt('week', t('rp.by.week'), F.by === 'week') + '</select>')
      + '<button data-a="refresh">' + esc(t('rp.refresh')) + '</button></div>';
  }

  function bill(b) {
    const total = b.total, local = b.local, paid = b.paid, budget = b.budget ?? {};
    const split = splitShare(local.inTokens + local.outTokens, paid.inTokens + paid.outTokens);
    const used = Number(budget.used ?? 0), level = used > 1 ? 'over' : used >= 0.75 ? 'warn' : '';
    const periods = b.byPeriod ?? [];
    return '<div class="hud brk"><div class="hs"><span>' + esc(t('rp.bill')) + '</span><i>' + esc(t('rp.measured')) + '</i></div>'
      + '<div class="rp-tiles">'
      + tile(t('rp.in'), fmtTokens(total.inTokens), '<small>' + esc(t('rp.calls', total.calls)) + '</small>')
      + tile(t('rp.out'), fmtTokens(total.outTokens), total.notReported ? '<small>' + esc(t('rp.notReported', total.notReported)) + '</small>' : '')
      + tile(t('rp.spent'), fmtUsd(total.costUsd), '<small>' + esc(t('rp.paid')) + ' ' + esc(fmtUsd(paid.costUsd)) + '</small>', 'money')
      + tile(t('rp.localPaid'), split.a + '% / ' + split.b + '%', '<div class="rp-split"><span style="width:' + split.a + '%"></span><span style="width:' + split.b + '%"></span></div><small>' + esc(t('rp.local')) + ' ' + esc(fmtTokens(local.inTokens + local.outTokens)) + ' · ' + esc(t('rp.paid')) + ' ' + esc(fmtTokens(paid.inTokens + paid.outTokens)) + '</small>', 'ok')
      + tile(t('rp.budget'), fmtPct(budget.used), '<div class="rp-gauge ' + level + '"><span style="width:' + Math.min(100, Math.round(used * 100)) + '%"></span></div><small>' + esc(t('rp.budgetOf', fmtUsd(budget.spentUsd), fmtUsd(budget.budgetUsd), budget.runs ?? 0)) + '</small>')
      + '</div><div class="rp-body rp-grid">'
      + sec(t('rp.byPeriod', per()), legend([[t('rp.in'), C.b], [t('rp.out'), C.a]]) + stackSvg(periods.map((p) => ({ label: p.period, parts: [p.inTokens, p.outTokens] })), [C.b, C.a], [t('rp.in'), t('rp.out')]))
      + sec(t('rp.spent') + ' · ' + per(), barsSvg(periods.map((p) => ({ label: p.period, value: p.costUsd })), C.c, 560, 150, fmtUsd))
      + '</div></div>';
  }

  const views = {
    bill(b) {
      const row = (g, first) => [first, tokens(g), esc(fmtUsd(g.costUsd)), esc(g.calls)];
      const heads = (first) => [[first], [t('rp.col.tokens'), 1], [t('rp.col.usd'), 1], [t('rp.col.calls'), 1]];
      return '<div class="rp-grid">'
        + sec(t('rp.col.model'), tbl(heads(t('rp.col.model')), (b.byModel ?? []).map((g) => row(g, esc((g.provider || '—') + (g.model ? ' · ' + g.model : ''))))))
        + sec(t('rp.col.team'), tbl(heads(t('rp.col.team')), (b.byTeam ?? []).map((g) => row(g, esc(g.teamName || g.team || '—')))))
        + sec(t('rp.col.project'), tbl(heads(t('rp.col.project')), (b.byProject ?? []).map((g) => row(g, esc(g.project || g.root)))))
        + sec(t('rp.col.member'), tbl(heads(t('rp.col.member')), (b.byMember ?? []).map((g) => row(g, esc(g.member) + ' <span class="lbl">' + esc(g.role) + '</span>'))))
        + '</div>' + sec(t('rp.runs'), tbl([[t('rp.col.run')], [t('rp.col.project')], [t('rp.col.result')], [t('rp.col.usd'), 1], [t('rp.col.used'), 1]], (b.runs ?? []).map((r) => [esc(r.spec || r.run), esc(r.project), result(r.result), esc(fmtUsd(r.costUsd)) + ' / ' + esc(fmtUsd(r.budgetUsd)), esc(fmtPct(r.used))])));
    },
    throughput(x) {
      const periods = x.periods ?? [];
      return '<div class="rp-grid">' + sec(t('rp.delivered', per()), barsSvg(periods.map((p) => ({ label: p.period, value: p.delivered })), C.a))
        + sec(t('rp.velocity'), tbl([[t('rp.col.team')], [t('rp.col.delivered'), 1], [t('rp.col.perPeriod', per()), 1]], (x.velocity ?? []).map((v) => [esc(TEAMS.find((tm) => tm.id === v.team)?.name ?? v.team), esc(v.delivered), esc(Number(v.perPeriod).toFixed(1))]))) + '</div>';
    },
    cycle(x) {
      const d = x.delivered ?? {};
      return '<div class="rp-tiles">' + tile(t('rp.cycleMedian'), fmtMs(d.median)) + tile(t('rp.cycleP85'), fmtMs(d.p85)) + tile(t('rp.col.max'), fmtMs(d.max)) + tile(t('rp.cycleCount'), String((x.specs ?? []).length)) + '</div>'
        + '<div class="rp-grid" style="margin-top:12px">' + sec(t('rp.perStation'), barsSvg((x.stations ?? []).map((s) => ({ label: station(s.station), value: s.median })), C.b, 560, 150, fmtMs))
        + sec(t('rp.specs'), tbl([[t('rp.col.spec')], [t('rp.col.team')], [t('rp.col.result')], [t('rp.col.time'), 1]], (x.specs ?? []).slice(0, 40).map((s) => [esc(s.spec || s.run), esc(s.team), result(s.result), esc(fmtMs(s.ms))]))) + '</div>';
    },
    burndown(x) {
      const periods = x.periods ?? [];
      return '<div class="note">' + esc(t('rp.burndownSub')) + '</div>' + legend([[t('rp.remaining'), C.c], [t('rp.burnup'), C.a], [t('rp.scope'), C.m]])
        + linesSvg(periods.map((p) => p.period), [{ name: t('rp.remaining'), values: periods.map((p) => p.remaining), color: C.c }, { name: t('rp.burnup'), values: periods.map((p) => p.delivered), color: C.a }, { name: t('rp.scope'), values: periods.map((p) => p.scope), color: C.m }]);
    },
    flow(x) {
      const cols = x.columns ?? [], periods = x.periods ?? [];
      const colors = cols.map((c, i) => c === 'delivered' ? C.a : c === 'stopped' ? C.e : c === 'pending' ? C.m : [C.b, C.d, C.c, 'var(--hud2)', 'var(--vio)', 'var(--warn)'][i % 6]);
      const name = (c) => c === 'pending' ? t('rp.col.pending') : c === 'delivered' ? t('rp.burnup') : c === 'stopped' ? t('rp.col.stopped') : station(c);
      return '<div class="note">' + esc(t('rp.flowSub', per())) + '</div>' + legend(cols.map((c, i) => [name(c), colors[i]]))
        + stackSvg(periods.map((p) => ({ label: p.period, parts: cols.map((c) => p.counts?.[c] ?? 0) })), colors, cols.map(name));
    },
    waiting(x) {
      const a = x.answered ?? {};
      const open = (x.open ?? []).map((o) => [esc(o.spec || o.run) + ' <span class="lbl">' + esc(o.project) + '</span>', esc(o.gate), esc(o.station ? station(o.station) : ''), esc(fmtMs(o.ms))]);
      return sec(t('rp.open'), open.length ? tbl([[t('rp.col.spec')], [t('rp.col.gate')], [t('rp.col.station')], [t('rp.col.since'), 1]], open) : '<div class="none">' + esc(t('rp.noOpen')) + '</div>')
        + sec(t('rp.answered'), '<div class="rp-tiles">' + tile(t('rp.col.median'), fmtMs(a.median)) + tile(t('rp.col.p85'), fmtMs(a.p85)) + tile(t('rp.col.max'), fmtMs(a.max)) + tile(t('rp.col.answers'), String(a.count ?? 0)) + '</div>');
    },
    quality(x) {
      const rows = x.stations ?? [];
      return '<div class="rp-grid">' + sec(t('rp.quality'), barsSvg(rows.map((r) => ({ label: station(r.station), value: Math.round(Number(r.firstTryRate ?? 0) * 100) })), C.a, 560, 150, (v) => v + '%'))
        + sec(t('rp.tab.quality'), tbl([[t('rp.col.station')], [t('rp.col.steps'), 1], [t('rp.col.passed'), 1], [t('rp.col.failed'), 1], [t('rp.col.retried'), 1], [t('rp.col.firstTry'), 1]], rows.map((r) => [esc(station(r.station)), esc(r.steps), esc(r.passed), esc(r.failed), esc(r.retried), esc(fmtPct(r.firstTryRate))]))) + '</div>';
    },
    people(x) {
      const all = x.members ?? [];
      const order = rank === 'result' ? (x.byResult ?? []).map((k) => all.find((m) => m.team + '-' + m.member === k)).filter(Boolean) : all;
      const switcher = '<div class="rp-legend"><button data-rank="cost"' + (rank === 'cost' ? ' style="border-color:var(--hud);color:var(--hud)"' : '') + '>' + esc(t('rp.rankCost')) + '</button><button data-rank="result"' + (rank === 'result' ? ' style="border-color:var(--hud);color:var(--hud)"' : '') + '>' + esc(t('rp.rankResult')) + '</button></div>';
      return switcher + barsSvg(order.slice(0, 20).map((m) => ({ label: m.member, value: rank === 'result' ? Math.round(Number(m.passRate ?? 0) * 100) : m.costUsd })), rank === 'result' ? C.a : C.c, 560, 150, rank === 'result' ? (v) => v + '%' : fmtUsd)
        + tbl([[t('rp.col.member')], [t('rp.col.team')], [t('rp.col.steps'), 1], [t('rp.col.answers'), 1], [t('rp.col.lines'), 1], [t('rp.col.passed'), 1], [t('rp.col.failed'), 1], [t('rp.col.passRate'), 1], [t('rp.col.tokens'), 1], [t('rp.col.usd'), 1]],
          order.map((m) => [esc(m.member) + ' <span class="lbl">' + esc(m.role) + '</span>', esc(m.teamName || m.team), esc(m.steps), esc(m.answers), '+' + esc(m.added) + ' / −' + esc(m.removed), esc(m.passed), esc(m.failed), esc(fmtPct(m.passRate)), tokens(m), esc(fmtUsd(m.costUsd))]));
    },
    indicators(x) {
      const retries = Object.entries(x.retriesPerStation ?? {});
      return '<div class="rp-tiles">' + tile(t('rp.ind.costPerSpec'), fmtUsd(x.costPerDeliveredUsd), '<small>' + esc(t('rp.ind.delivered', x.delivered ?? 0)) + '</small>', 'money')
        + tile(t('rp.ind.tokensPerLine'), x.tokensPerUsefulLine == null ? '—' : fmtTokens(x.tokensPerUsefulLine), '<small>' + esc(t('rp.ind.usefulLines', x.usefulLines ?? 0)) + '</small>')
        + tile(t('rp.ind.localShare'), fmtPct(x.localTokenShare), '<small>' + esc(t('rp.ind.localUsd', fmtUsd(x.localUsd), fmtUsd(x.paidUsd))) + '</small>', 'ok') + '</div>'
        + '<div style="margin-top:12px">' + sec(t('rp.ind.retries'), barsSvg(retries.map(([s, n]) => ({ label: station(s), value: n })), C.e)) + '</div>';
    },
  };

  function draw() {
    if (!el) return;
    const head = '<div class="rp-head"><h1>' + esc(t('rp.title')) + '</h1><span class="sub">' + esc(t('rp.sub')) + '</span>' + langButton() + '</div>';
    let body = '';
    if (error) body += '<div class="err">' + esc(t('rp.error', error)) + '</div>';
    if (loading && !D) body += '<div class="none">' + esc(t('rp.loading')) + '</div>';
    else if (D && !D.lines && !D.runs) body += '<div class="hud brk rp-body none">' + esc(t('rp.empty')) + '</div>';
    else if (D) {
      body += D.bill ? bill(D.bill) : '';
      const tabs = VIEWS.map((v) => '<button role="tab" data-tab="' + v + '" aria-selected="' + (tab === v) + '" class="' + (tab === v ? 'sel' : '') + '">' + esc(t('rp.tab.' + v)) + '</button>').join('');
      body += '<div class="hud brk"><div class="rp-tabs" role="tablist">' + tabs + '</div><div class="rp-body" role="tabpanel">' + (D[tab] ? views[tab](D[tab]) : '') + '</div></div>';
    }
    el.innerHTML = '<div class="rp">' + head + filters() + body + '</div>';
  }

  function ask() { loading = true; error = ''; post({ type: 'reports:load', filter: F }); draw(); }
  function onChange(e) { const f = e.target.dataset?.f; if (!f) return; F[f] = e.target.value; if (f === 'team') F.member = ''; ask(); }
  function onClick(e) {
    const b = e.target.closest?.('button');
    if (!b) return;
    if (b.dataset.tab) { tab = b.dataset.tab; draw(); }
    else if (b.dataset.rank) { rank = b.dataset.rank; draw(); }
    else if (b.dataset.a === 'refresh') ask();
  }
  // what the filters offer: every project and member the reports named
  function remember(d) {
    for (const p of d?.bill?.byProject ?? []) if (p.root) PROJECTS[p.root] = p.project || p.root;
    for (const m of d?.people?.members ?? []) MEMBERS[m.member] = { team: m.team, label: m.member + ' · ' + (m.teamName || m.team) };
  }

  return {
    mount(root, send) {
      el = root; post = send;
      root.addEventListener('change', onChange); root.addEventListener('click', onClick);
      draw(); post({ type: 'reports:ready', filter: F });
    },
    /** A message of the host; true when it was the page's. */
    receive(m) {
      if (!m || typeof m.type !== 'string' || !m.type.startsWith('reports:')) return false;
      if (m.type === 'reports:teams') { TEAMS = m.teams ?? []; draw(); }
      else if (m.type === 'reports:data') { D = m.data; loading = false; error = ''; remember(D); draw(); }
      else if (m.type === 'reports:filter') { F = { ...F, team: m.team ?? '', member: m.member ?? '' }; tab = m.member ? 'people' : tab; ask(); }
      else if (m.type === 'reports:error') { loading = false; error = m.text; draw(); }
      return true;
    },
  };
})();
`;
