// The run told to a product owner (spec 024 requirement 5, C4's first level): what is being built and five business
// steps in plain words, each with what it produced and its state, from the stations of the run (any engine). Pure: the
// diagram (`flow.tsx`) draws it and the tests read it. No `vscode` import.
import type { Run, Stage, Status } from './runs';

export type Beat = 'understand' | 'design' | 'build' | 'check' | 'deliver';
export type BeatState = 'waiting' | 'working' | 'needsYou' | 'done' | 'failed' | 'skipped';

export interface StoryBeat {
  id: Beat;
  /** The stations told by this step, in the run's order (none: the run has no such station). */
  stations: Stage[];
  state: BeatState;
  /** What it produced, as a text key of the page (`flow.story.made.<id>.<form>`) and its arguments. */
  made: { key: string; args: (string | number)[] };
}

const BEATS: Beat[] = ['understand', 'design', 'build', 'check', 'deliver'];
/** Each station of the factory, by its id; any other (an older engine's, a custom one) is building. */
const BEAT_OF: Record<string, Beat> = { analysis: 'understand', design: 'design', tests: 'build', code: 'build', quality: 'check', delivery: 'deliver' };

export const beatOf = (stationId: string): Beat => BEAT_OF[stationId] ?? 'build';

/** One state for several stations: a failure first, then a question to the user, then work going on. */
export function beatState(stations: { status: Status }[]): BeatState {
  const has = (s: Status) => stations.some((x) => x.status === s);
  if (has('failed')) return 'failed';
  if (has('waiting')) return 'needsYou';
  if (has('running')) return 'working';
  if (stations.length && stations.every((x) => x.status === 'skipped')) return 'skipped';
  if (stations.length && stations.every((x) => x.status === 'passed' || x.status === 'skipped')) return 'done';
  // some passed, the rest to come: still on its way
  return stations.some((x) => x.status === 'passed') ? 'working' : 'waiting';
}

/** The five business steps of a run, each with its stations, its state and what it produced. */
export function storyOf(run: Run): StoryBeat[] {
  return BEATS.map((id) => {
    const stations = run.stages.filter((s) => beatOf(s.id) === id);
    const steps = stations.flatMap((s) => s.steps);
    const state = beatState(stations);
    // one of a count is said in the singular (`.one`): '1 decision taken', not '1 decisions'
    const made = (form: string, ...args: (string | number)[]) => ({ key: `flow.story.made.${id}.${form}${args.length === 1 && args[0] === 1 ? '.one' : ''}`, args });
    if (id === 'understand') return { id, stations, state, made: run.spec.criteria.length ? made('criteria', run.spec.criteria.length) : made('spec') };
    if (id === 'design') {
      const decisions = steps.reduce((n, x) => n + (x.decisions?.length ?? 0), 0);
      return { id, stations, state, made: decisions ? made('decisions', decisions) : made('plan') };
    }
    if (id === 'build') {
      const files = new Set(steps.flatMap((x) => [...(x.file ? [x.file] : []), ...(x.files ?? [])]));
      return { id, stations, state, made: files.size ? made('files', files.size) : made('code') };
    }
    if (id === 'check') {
      const done = steps.filter((x) => x.status === 'passed').length;
      return { id, stations, state, made: steps.length ? made('checks', done, steps.length) : made('none') };
    }
    return { id, stations, state, made: state === 'done' ? made('delivered') : made('pr') };
  });
}

/** A trace item an agent called a tool with (`Glob`, `Read`, `Write`…): shown only in the technical details. */
export const isToolCall = (t: { kind?: string }): boolean => t.kind === 'tool';
