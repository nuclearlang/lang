// The Reports page's host: it answers the page's `reports:*` messages with `nuclear-builder metrics --json` (and the
// teams' names for the filter, `team list --json`), one process per call. It computes nothing of the reports: the
// engine is the command's (metrics.nuc). No `vscode` import: the panel and the tests share it.
import { listTeams, TeamEntry } from '../teams/cli';
import { metrics, MetricsFilter, VIEWS, View } from './metrics';

/** A filter as the page sends it, kept to what the command takes. */
export function filterOf(m: Record<string, unknown>): MetricsFilter {
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return {
    project: text(m.project),
    team: text(m.team),
    member: text(m.member),
    from: date(m.from),
    to: date(m.to),
    by: m.by === 'week' ? 'week' : 'day',
    view: VIEWS.includes(m.view as View) ? (m.view as View) : undefined,
  };
}

export class ReportsHost {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly post: (m: unknown) => void) {}

  /** Answers a page message; false when it was not the page's. */
  async handle(m: { type: string; [k: string]: unknown }): Promise<boolean> {
    if (!m.type.startsWith('reports:')) return false;
    const done = this.queue.then(() => this.receive(m)).catch((e) => this.post({ type: 'reports:error', text: e instanceof Error ? e.message : String(e) }));
    this.queue = done;
    await done;
    return true;
  }

  private async receive(m: { type: string; [k: string]: unknown }): Promise<void> {
    switch (m.type) {
      case 'reports:ready': {
        const teams: TeamEntry[] = await listTeams().catch(() => []);
        this.post({ type: 'reports:teams', teams: teams.map((t) => ({ id: t.id, name: t.name })) });
        return this.load(m);
      }
      case 'reports:load':
        return this.load(m);
    }
  }

  private async load(m: Record<string, unknown>): Promise<void> {
    const filter = filterOf((m.filter as Record<string, unknown>) ?? {});
    this.post({ type: 'reports:data', filter, data: await metrics(filter) });
  }
}
