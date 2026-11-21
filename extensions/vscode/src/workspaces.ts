// The Nuclear workspaces of the editor (spec 022): a folder with `.workspace/workspace.nuc` and its apps, read and
// changed only through `nuclear workspace … --json` (tools/cli/docs/08-guides/workspace.md). What is computed here has
// no `vscode` import, so test/workspaces.test.ts drives it: the CLI's JSON, the recent list, the projects opened by
// hand before 0.84 (kept per VS Code folder), the empty panel's reason, the dialects offered for a platform.
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface App {
  name: string;
  folder: string;
  platform: string;
  dialect: string | null;
  exists: boolean;
}

export interface WorkspaceInfo {
  root: string;
  name: string;
  description: string;
  apps: App[];
}

export interface Recent {
  root: string;
  name: string;
  openedAt: number;
}

export const RECENT = 'nuclear.workspaces.recent';
export const OLD_CLI = 'the installed nuclear has no "workspace" command: update NuclearLang (nuclear update)';
export const RECENT_MAX = 10;
export const PLATFORMS = ['backend', 'web', 'mobile'] as const;
/** The dialects of each platform, its default first (`nuclear new`'s). shortcut: `nuclear dialect list` says no
 * platform, so this table names them and the list filters it to the installed ones; read the platform from the list
 * when it says it. */
const PLATFORM_DIALECTS: Record<string, string[]> = { backend: ['fastapi', 'nestjs'], web: ['react'], mobile: ['flutter'] };

/** `nuclear workspace … --json`'s answer: its last line (`add` prints `nuclear new`'s lines first) is the workspace,
 * `null` (find, outside a workspace) or `{"error": …}` (a refusal, exit 1), thrown with the command's message. */
export function parseCli(out: string, code: number | null): WorkspaceInfo | null {
  const last = out.trim().split(/\r?\n/).filter((l) => /^\s*(\{|null\b)/.test(l)).pop();
  let v: unknown;
  try {
    v = last === undefined ? undefined : JSON.parse(last);
  } catch {
    v = undefined;
  }
  if (v && typeof v === 'object' && typeof (v as { error?: unknown }).error === 'string') throw new Error((v as { error: string }).error);
  if (v === null && code === 0) return null;
  if (v && typeof v === 'object' && typeof (v as WorkspaceInfo).root === 'string' && Array.isArray((v as WorkspaceInfo).apps)) {
    const w = v as WorkspaceInfo;
    return { root: w.root, name: w.name ?? path.basename(w.root), description: w.description ?? '', apps: w.apps.map((a) => ({ name: a.name ?? a.folder, folder: a.folder, platform: a.platform, dialect: a.dialect ?? null, exists: a.exists !== false })) };
  }
  // an older `nuclear` without `workspace` prints its usage
  throw new Error(out.trim().split(/\r?\n/).pop() || `exit ${code}`);
}

/** Runs `nuclear workspace <args> --json` in `cwd` (the installed `nuclear`, given by the caller). */
export function workspaceCli(bin: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): Promise<WorkspaceInfo | null> {
  return new Promise((resolve, reject) =>
    execFile(bin, ['workspace', ...args, '--json'], { cwd, env, timeout: 300_000, maxBuffer: 8 << 20, shell: process.platform === 'win32' }, (e, stdout, stderr) => {
      const code = e ? (typeof (e as NodeJS.ErrnoException).code === 'number' ? Number((e as NodeJS.ErrnoException).code) : 1) : 0;
      if ((e as NodeJS.ErrnoException | null)?.code === 'ENOENT') return reject(new Error(`${bin}: not found (install NuclearLang)`));
      try {
        resolve(parseCli(`${stdout}`, code));
      } catch (x) {
        // an older `nuclear` without `workspace` answers with its usage
        if (/^usage:/m.test(`${stdout}${stderr}`)) return reject(new Error(OLD_CLI));
        reject(code && !`${stdout}`.trim() ? new Error(`${stderr}`.trim().split(/\r?\n/).pop() || (x as Error).message) : x);
      }
    }),
  );
}

/** The workspace just opened first, its name refreshed, each root once, at most `max`. */
export function remember(list: Recent[] | undefined, w: { root: string; name: string }, now: number, max = RECENT_MAX): Recent[] {
  return [{ root: w.root, name: w.name, openedAt: now }, ...(list ?? []).filter((r) => r.root !== w.root)].slice(0, max);
}

/** The recent workspaces whose marker is still there. */
export function alive(list: Recent[] | undefined, exists: (file: string) => boolean = fs.existsSync): Recent[] {
  return (list ?? []).filter((r) => exists(markerOf(r.root)));
}

export const markerOf = (root: string): string => path.join(root, '.workspace', 'workspace.nuc');

/**
 * The projects opened by hand (Ctrl+Alt+O), kept since 0.84 in the editor's global state, so a change of VS Code's
 * folder never loses them. From 0.63 to 0.83 each folder kept its own (`workspaceState`): they join the global list
 * when that folder is opened (the old entry is then cleared), the global ones first, each root once.
 */
export function migrateSaved(global: string[] | undefined, here: string[] | undefined): { saved: string[]; changed: boolean } {
  const g = (global ?? []).filter((r) => typeof r === 'string');
  const extra = (here ?? []).filter((r) => typeof r === 'string' && !g.includes(r));
  return { saved: [...new Set([...g, ...extra])], changed: here !== undefined };
}

/** Why the column has nothing to show: no workspace and no project. `null`: it has something. */
export type Empty = { reason: 'noFolder' | 'notWorkspace'; recent: Recent[] } | null;
export function emptyState(workspace: WorkspaceInfo | undefined, projects: number, folders: string[], recent: Recent[]): Empty {
  if (workspace || projects > 0) return null;
  return { reason: folders.length ? 'notWorkspace' : 'noFolder', recent };
}

/** The dialects offered for a platform: the installed ones (`nuclear dialect list`'s first column), its default first;
 * the default alone when the list could not be read. */
export function dialectsOf(platform: string, installed: string[] | undefined): string[] {
  const all = PLATFORM_DIALECTS[platform] ?? [];
  const found = installed?.length ? all.filter((d) => installed.includes(d)) : [];
  return found.length ? found : all.slice(0, 1);
}

/** The names of `nuclear dialect list`'s lines. */
export function parseDialects(out: string): string[] {
  return out.split(/\r?\n/).map((l) => l.trim().split(/\s+/)[0]).filter((n) => /^[a-z][a-z0-9_-]*$/.test(n));
}

/** An app's name as `nuclear new` makes its folder: letters, digits and `_`. */
export const appFolder = (name: string): string => name.trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * The projects the column shows. A workspace open: its apps and nothing else, so the editor works on a clean folder
 * (no scan of VS Code's folders, no project opened by hand in another window). No workspace: the projects found in
 * VS Code's folders, then the ones opened by hand. Not known yet (`nuclear workspace find` still answering): none, so a
 * scan of a parent folder never shows, even for a moment, the projects of other workspaces or none.
 */
export function shownProjects<T extends { root: string }>(known: boolean, w: WorkspaceInfo | undefined, apps: () => T[], folders: () => T[], saved: () => T[]): T[] {
  if (!known) return [];
  if (w) return apps();
  const out = folders();
  const seen = new Set(out.map((p) => p.root));
  return [...out, ...saved().filter((p) => !seen.has(p.root))];
}

/** The workspace after its marker changed: the CLI's new reading; when that failed while the marker is still there (a
 * write in progress, `nuclear` busy), the workspace it was, never none (none would scan VS Code's folders instead). */
export const afterReload = (current: WorkspaceInfo | undefined, fresh: WorkspaceInfo | null, markerThere: boolean): WorkspaceInfo | undefined =>
  fresh ?? (markerThere ? current : undefined);
