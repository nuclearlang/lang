// What the company screen's HUD computes (page.ts), the same in the tests: a stat's level, a team's budget gauge,
// the roster's filter, a team's spending. Inlined in the page's script by `toString()`: no import, each function uses
// nothing outside itself.

/** A stat's level, for its colour: `hi` from 80, `mid` from 50, `low` from 25, else `crit`. */
export function statLevel(v: number): 'hi' | 'mid' | 'low' | 'crit' {
  return v >= 80 ? 'hi' : v >= 50 ? 'mid' : v >= 25 ? 'low' : 'crit';
}

/** A budget as a gauge: how full (0-100, never past 100) and its level (`ok`, `warn` from 75 %, `over` past it). */
export function budgetGauge(spent: number, budget: number): { pct: number; level: 'ok' | 'warn' | 'over' } {
  const s = Math.max(0, Number(spent) || 0), b = Math.max(0, Number(budget) || 0);
  if (!b) return { pct: s > 0 ? 100 : 0, level: s > 0 ? 'over' : 'ok' };
  const r = s / b;
  return { pct: Math.min(100, Math.round(r * 100)), level: r > 1 ? 'over' : r >= 0.75 ? 'warn' : 'ok' };
}

/** The roster as the hiring grid shows it: the words searched (name, profile, place, university, all of them), a
 * temperament and a gender (empty: any). */
export function filterRoster<P extends { name: string; profile?: string; location?: string; university?: string; temperament?: string; gender?: string }>(list: P[], q: string, temper: string, gender: string): P[] {
  const words = String(q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((p) => {
    if (temper && p.temperament !== temper) return false;
    if (gender && p.gender !== gender) return false;
    const text = [p.name, p.profile, p.location, p.university].join(' ').toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** What a team's latest run spent (US$), against the run's budget: the company's gauge. */
export function teamSpend(runs: { created: number; costUsd?: number; team?: { id?: string } | null; factory?: { team?: string } | null }[], team: string): number {
  let last: (typeof runs)[number] | undefined;
  for (const r of runs) if ((r.team?.id ?? r.factory?.team) === team && (!last || r.created > last.created)) last = r;
  return last?.costUsd ?? 0;
}

/** A member's activity in this project: the steps they worked in their team's runs, the latest first (the profile's
 * *Activity*). */
export function memberActivity(runs: { id: string; created: number; spec: { title: string }; team?: { id?: string } | null; factory?: { team?: string } | null; stages: { title: string; steps: { title: string; status: string; employee?: string; ended?: number; started?: number }[] }[] }[], team: string, employee: string, limit = 5): { run: string; spec: string; station: string; step: string; status: string; at: number }[] {
  if (!employee) return [];
  const out: { run: string; spec: string; station: string; step: string; status: string; at: number }[] = [];
  for (const r of runs) {
    if ((r.team?.id ?? r.factory?.team) !== team) continue;
    for (const st of r.stages ?? []) for (const s of st.steps ?? []) if (s.employee === employee) out.push({ run: r.id, spec: r.spec.title, station: st.title, step: s.title, status: s.status, at: s.ended ?? s.started ?? r.created });
  }
  return out.sort((a, b) => b.at - a.at).slice(0, limit);
}
