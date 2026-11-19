// The factory's reports as the editors read them: only through `nuclear-builder metrics … --json` (metrics.nuc), one
// process per call; the editor never reads the ledger itself (ADR-platform-0009: an agent reads the same numbers with
// the MCP tool `metrics`). No `vscode` import: the page's host, the company screen and the tests share it.
import { call } from '../teams/cli';

export const VIEWS = ['bill', 'throughput', 'cycle', 'burndown', 'flow', 'waiting', 'quality', 'people', 'indicators'] as const;
export type View = (typeof VIEWS)[number];

/** What a report is asked for (empty: every project, team and member; every date). */
export interface MetricsFilter {
  project?: string;
  team?: string;
  member?: string;
  /** `YYYY-MM-DD`, the last one whole. */
  from?: string;
  to?: string;
  by?: 'day' | 'week';
  /** One view only (all of them when none). */
  view?: View;
}

/** A total of usage: tokens are those reported; `notReported` counts the calls whose provider gave none. */
export interface UsageTotal {
  inTokens: number;
  outTokens: number;
  costUsd: number;
  ms: number;
  calls: number;
  notReported: number;
}

/** A member's work (the `people` view). */
export interface PersonRow extends UsageTotal {
  team: string;
  teamName: string;
  member: string;
  employee: string;
  role: string;
  steps: number;
  answers: number;
  passed: number;
  failed: number;
  added: number;
  removed: number;
  linesNotReported: number;
  passRate: number | null;
}

/** What `metrics --json` answers: the filter, and each view asked (metrics.nuc writes their fields). */
export interface Metrics {
  filter: Record<string, unknown>;
  lines: number;
  runs: number;
  bill?: Record<string, any>;
  throughput?: Record<string, any>;
  cycle?: Record<string, any>;
  burndown?: Record<string, any>;
  flow?: Record<string, any>;
  waiting?: Record<string, any>;
  quality?: Record<string, any>;
  people?: { members: PersonRow[]; byResult: string[] };
  indicators?: Record<string, any>;
}

/** The command's arguments of a filter. */
export function metricsArgs(f: MetricsFilter): string[] {
  const args = ['metrics'];
  const put = (flag: string, v: string | undefined) => v && args.push(flag, v);
  put('--project', f.project);
  put('--team', f.team);
  put('--member', f.member);
  put('--from', f.from);
  put('--to', f.to);
  put('--by', f.by);
  put('--view', f.view);
  args.push('--json');
  return args;
}

/** The reports of a filter, from the command. */
export const metrics = (f: MetricsFilter = {}) => call<Metrics>(metricsArgs(f));

/** Each member's numbers of a team, by member id (the member panel's Summary). */
export async function teamNumbers(team: string): Promise<Record<string, PersonRow>> {
  const found = await metrics({ team, view: 'people' });
  return Object.fromEntries((found.people?.members ?? []).filter((r) => r.team === team).map((r) => [r.member, r]));
}
