// What the Reports page computes and draws (page.ts), the same in the tests: the numbers as people read them and the
// charts as inline SVG in the HUD's line (no chart library). Inlined in the page's script by `toString()`: no import,
// each function uses nothing outside itself. A colour is a CSS value (`var(--hud)`), so the charts follow the theme.

/** Tokens as people read them: 950, 12.3k, 4.1M; null (not reported) as an em dash. */
export function fmtTokens(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
  const v = Number(n), a = Math.abs(v);
  return a >= 1e9 ? (v / 1e9).toFixed(1) + 'G' : a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e4 ? (v / 1e3).toFixed(1) + 'k' : String(Math.round(v));
}

/** Money in US$: two decimals, four under a cent (a local step costs 0). */
export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  return '$' + (v !== 0 && Math.abs(v) < 0.01 ? v.toFixed(4) : v.toFixed(2));
}

/** A time in ms as its largest unit: 45 s, 12 min, 3.5 h, 2.1 d. */
export function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return '—';
  const s = Number(ms) / 1000;
  return s < 60 ? Math.round(s) + ' s' : s < 3600 ? Math.round(s / 60) + ' min' : s < 86400 ? (s / 3600).toFixed(1) + ' h' : (s / 86400).toFixed(1) + ' d';
}

/** A ratio as a percentage, or an em dash. */
export function fmtPct(r: number | null | undefined): string {
  return r === null || r === undefined || !Number.isFinite(Number(r)) ? '—' : Math.round(Number(r) * 100) + '%';
}

/** Bars, one per point, each with its label under it and its value's text on hover (`<title>`); `fmt` writes a value. */
export function barsSvg(points: { label: string; value: number }[], color: string, width = 560, height = 150, fmt: (v: number) => string = String): string {
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
  if (!points.length) return '';
  const top = 8, bottom = 18, inner = height - top - bottom;
  const max = Math.max(...points.map((p) => Number(p.value) || 0), 0) || 1;
  const step = width / points.length, w = Math.max(2, Math.min(36, step * 0.7));
  const every = Math.max(1, Math.ceil(points.length / 8));
  const bars = points.map((p, i) => {
    const v = Math.max(0, Number(p.value) || 0), h = (v / max) * inner, x = i * step + (step - w) / 2;
    const label = i % every === 0 ? '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (height - 4) + '" text-anchor="middle">' + esc(p.label) + '</text>' : '';
    return '<rect x="' + x.toFixed(1) + '" y="' + (top + inner - h).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(v > 0 ? 1 : 0, h).toFixed(1) + '" fill="' + color + '" fill-opacity=".55" stroke="' + color + '" stroke-width="1"><title>' + esc(p.label + ': ' + fmt(v)) + '</title></rect>' + label;
  }).join('');
  return '<svg class="rp-chart" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" role="img"><path d="M0 ' + (top + inner + 0.5) + 'H' + width + '" stroke="currentColor" stroke-opacity=".3"/>' + bars + '</svg>';
}

/** Stacked bars: each row's parts one over the other, in `colors` (one per part, the legend's order). */
export function stackSvg(rows: { label: string; parts: number[] }[], colors: string[], names: string[], width = 560, height = 170): string {
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
  if (!rows.length) return '';
  const top = 8, bottom = 18, inner = height - top - bottom;
  const sum = (r: { parts: number[] }) => r.parts.reduce((a, b) => a + (Number(b) || 0), 0);
  const max = Math.max(...rows.map(sum), 0) || 1;
  const step = width / rows.length, w = Math.max(2, Math.min(36, step * 0.75));
  const every = Math.max(1, Math.ceil(rows.length / 8));
  const out = rows.map((r, i) => {
    const x = i * step + (step - w) / 2;
    let y = top + inner;
    const parts = r.parts.map((v, k) => {
      const h = ((Number(v) || 0) / max) * inner;
      y -= h;
      return h > 0 ? '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + colors[k % colors.length] + '" fill-opacity=".7"><title>' + esc(r.label + ' · ' + (names[k] ?? '') + ': ' + v) + '</title></rect>' : '';
    }).join('');
    return parts + (i % every === 0 ? '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (height - 4) + '" text-anchor="middle">' + esc(r.label) + '</text>' : '');
  }).join('');
  return '<svg class="rp-chart" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" role="img"><path d="M0 ' + (top + inner + 0.5) + 'H' + width + '" stroke="currentColor" stroke-opacity=".3"/>' + out + '</svg>';
}

/** Lines over the same labels (a burndown, a burnup): each series its colour, its points marked. */
export function linesSvg(labels: string[], series: { name: string; values: number[]; color: string }[], width = 560, height = 170): string {
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
  if (!labels.length || !series.length) return '';
  const top = 8, bottom = 18, inner = height - top - bottom, left = 4, right = 4;
  const max = Math.max(...series.flatMap((s) => s.values.map((v) => Number(v) || 0)), 0) || 1;
  const x = (i: number) => left + (labels.length === 1 ? (width - left - right) / 2 : (i * (width - left - right)) / (labels.length - 1));
  const y = (v: number) => top + inner - ((Number(v) || 0) / max) * inner;
  const every = Math.max(1, Math.ceil(labels.length / 8));
  const lines = series.map((s) => '<path d="' + s.values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('') + '" fill="none" stroke="' + s.color + '" stroke-width="1.6" stroke-linejoin="round"/>' + s.values.map((v, i) => '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.2" fill="' + s.color + '"><title>' + esc(labels[i] + ' · ' + s.name + ': ' + v) + '</title></circle>').join('')).join('');
  const ticks = labels.map((l, i) => (i % every === 0 ? '<text x="' + x(i).toFixed(1) + '" y="' + (height - 4) + '" text-anchor="middle">' + esc(l) + '</text>' : '')).join('');
  return '<svg class="rp-chart" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" role="img"><path d="M0 ' + (top + inner + 0.5) + 'H' + width + '" stroke="currentColor" stroke-opacity=".3"/>' + lines + ticks + '</svg>';
}

/** A split bar of two shares (local against paid): each one's percentage of the whole, the first never past 100. */
export function splitShare(a: number, b: number): { a: number; b: number } {
  const x = Math.max(0, Number(a) || 0), y = Math.max(0, Number(b) || 0), all = x + y;
  if (!all) return { a: 0, b: 0 };
  const pa = Math.round((x / all) * 100);
  return { a: pa, b: 100 - pa };
}
