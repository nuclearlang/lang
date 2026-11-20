// The onboarding's progress (spec 022): the welcome's three steps (the workspace, its apps, the tour), then the AI
// services' set-up, kept in the editor's global state so a reload (opening a workspace in this window restarts the
// extensions), a new window or a closed editor resumes it where it was. No `vscode` import: test/onboarding.test.ts.
import * as fs from 'node:fs';
import { markerOf } from './workspaces';

export type Step = 'workspace' | 'apps' | 'tour' | 'services' | 'done';
export const STEPS: Step[] = ['workspace', 'apps', 'tour', 'services', 'done'];

export interface Onboarding {
  step: Step;
  /** The workspace it is about, once there is one. */
  root?: string;
  /** Where the user chose to open that workspace. */
  chosenWindow?: 'this' | 'new';
  at: number;
}

/** The global state's key (`nuclear.onboarding.done` is the AI services' set-up's own, SetupPanel's). */
export const ONBOARDING = 'nuclear.onboarding';
/** 0.84.0's flag: the welcome was opened once (it did not say whether it was finished). */
export const WELCOMED = 'nuclear.workspace.welcomed';

export const next = (step: Step): Step => STEPS[Math.min(STEPS.indexOf(step) + 1, STEPS.length - 1)];

/** A step never goes back by itself: `to` only when it is after `o`'s. */
export function advance(o: Onboarding | undefined, to: Step, now: number, extra: Partial<Onboarding> = {}): Onboarding {
  const from = o?.step ?? 'workspace';
  const step = STEPS.indexOf(to) > STEPS.indexOf(from) ? to : from;
  return { ...o, ...extra, step, at: now };
}

export interface Facts {
  /** The saved progress (undefined: never written, an editor before 0.84.1). */
  saved: Onboarding | undefined;
  /** 0.84.0's flag. */
  welcomed: boolean;
  /** The AI services' set-up finished or declined (SetupPanel's `nuclear.onboarding.done` / `nuclear.ai.setup.declined`). */
  servicesDone: boolean;
  /** The recent workspaces (the last opened first) and whether each one's marker names an app. */
  recent: { root: string; apps: boolean }[];
  now: number;
}

/**
 * What activation does with the onboarding: the progress to resume (and write), or `done` (nothing to show).
 * - Saved and not done: resumed at its step; `services` ends once the set-up is finished or declined.
 * - Never saved, a first run (no flag, no recent workspace): from the start.
 * - Never saved, 0.84.0's flag set (it was marked seen the moment it opened, finished or not): resumed once when
 *   nothing says it was finished (no recent workspace with an app, the AI services not set up), at the step the
 *   recent workspaces show; else done.
 */
export function resume(f: Facts): Onboarding {
  const done: Onboarding = { step: 'done', at: f.now };
  if (f.saved) {
    if (f.saved.step === 'services' && f.servicesDone) return done;
    return f.saved;
  }
  const withApps = f.recent.find((r) => r.apps);
  if (!f.welcomed && !f.recent.length) return { step: 'workspace', at: f.now };
  if (!f.welcomed) return done; // an editor that had workspaces before the welcome existed
  if (withApps || f.servicesDone) return done;
  return f.recent.length ? { step: 'apps', root: f.recent[0].root, at: f.now } : { step: 'workspace', at: f.now };
}

/** Whether a workspace's marker names an app (`app(` on a line of its own). */
export function markerHasApps(root: string, read: (file: string) => string = (f) => fs.readFileSync(f, 'utf8')): boolean {
  try {
    return /^\s*app\s*\(/m.test(read(markerOf(root)));
  } catch {
    return false;
  }
}
