// Every external connection of the extension, checked (ADR-platform-0003): the Nuclear Developer, the Smart Graph, Ollama and
// the local models, and each integration enabled in the settings (Claude Code, Codex, OpenCode, GitHub, Jira). Before
// every task (a Builder run checks its own: builderEngine `preflight`; a chat question: `checkForChat`) and every
// `nuclear.ai.checkEveryMinutes`: a connection that stops answering, or answers again, is a notification.
import { execFile } from 'node:child_process';
import * as os from 'node:os';
import * as vscode from 'vscode';
import { l10n } from './i18n';
import { aiSettings, JIRA_SECRET } from './aiSettings';
import { toolEnv } from '../../tools/nuclear-builder/src/support';
import { Check, checkConnections } from '../../tools/nuclear-builder/src/support';
import { notices } from './notifications';

function run(cmd: string, args: string[]): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => execFile(cmd, args, { timeout: 15000, env: toolEnv() }, (e, out, err) => resolve({ ok: !e, out: `${out}${err}`.trim() })));
}

/** Every connection the settings name, checked now. */
export async function checkAll(context: vscode.ExtensionContext): Promise<Check[]> {
  const s = aiSettings();
  const c = vscode.workspace.getConfiguration('nuclear.ai');
  const tools = [c.get('claude.command', 'claude')];
  if (c.get('codex.enabled', false)) tools.push(c.get('codex.command', 'codex'));
  if (c.get('opencode.enabled', false)) tools.push(c.get('opencode.command', 'opencode'));
  const base = await checkConnections({ developerUrl: s.developerUrl, graphUrl: s.graphUrl, ollamaUrl: s.ollamaUrl, models: [s.coderModel, s.assistantModel, s.embeddingsModel], tools, folders: [os.tmpdir()], minFreeMb: c.get('watch.minFreeMb', 500) }, toolEnv());
  const gh = c.get('github.command', 'gh');
  const auth = await run(gh, ['auth', 'status']);
  base.push({ name: 'GitHub', ok: auth.ok, detail: auth.ok ? l10n.t('signed in') : l10n.t('{0} auth status: {1} (run gh auth login)', gh, auth.out.split('\n')[0] || l10n.t('not signed in')) });
  const site = c.get('jira.site', '');
  const token = await context.secrets.get(JIRA_SECRET);
  if (site || token) {
    let detail = l10n.t('no API token: Connect in Settings and integrations');
    let ok = false;
    if (token) {
      try {
        const auth = JSON.parse(token) as { baseUrl: string; email: string; token: string };
        const r = await fetch(auth.baseUrl.replace(/\/$/, '') + '/rest/api/3/myself', { headers: { Authorization: `Basic ${Buffer.from(`${auth.email}:${auth.token}`).toString('base64')}`, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
        ok = r.ok;
        detail = r.ok ? auth.baseUrl : l10n.t('{0} answered {1} (check the email and the token)', auth.baseUrl, r.status);
      } catch (e) {
        detail = l10n.t('does not answer ({0})', e instanceof Error ? e.message : String(e));
      }
    }
    base.push({ name: 'Jira', ok, detail });
  }
  return base;
}

/** What a chat question needs: the Developer, the graph, Ollama and the assistant's model. `''` when all answer. */
export async function checkForChat(): Promise<string> {
  const s = aiSettings();
  const checks = await checkConnections({ developerUrl: s.developerUrl, graphUrl: s.graphUrl, ollamaUrl: s.ollamaUrl, models: [s.assistantModel], tools: [], folders: [], minFreeMb: 0 });
  return checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`).join('\n');
}

let last: Check[] = [];

/** The last regular check (the settings page shows it). */
export function lastChecks(): Check[] {
  return last;
}

/** Checks every connection now and every `nuclear.ai.checkEveryMinutes`; a change (down or back) is a notification. */
export function watchConnections(context: vscode.ExtensionContext): void {
  const tick = async () => {
    const now = await checkAll(context);
    for (const c of now) {
      const before = last.find((x) => x.name === c.name);
      if (before && before.ok !== c.ok) {
        notices.add({ tool: 'settings', title: c.ok ? l10n.t('{0} answers again', c.name) : l10n.t('{0} stopped answering', c.name), text: c.detail, level: c.ok ? 'info' : 'warning' });
      }
    }
    last = now;
  };
  let timer: NodeJS.Timeout | undefined;
  const schedule = () => {
    if (timer) clearInterval(timer);
    const minutes = vscode.workspace.getConfiguration('nuclear.ai').get('checkEveryMinutes', 5);
    if (minutes > 0) timer = setInterval(() => void tick(), minutes * 60_000);
  };
  void tick();
  schedule();
  context.subscriptions.push(
    { dispose: () => timer && clearInterval(timer) },
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('nuclear.ai')) return;
      schedule();
      void tick();
    }),
  );
}
