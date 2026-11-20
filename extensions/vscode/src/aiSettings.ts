// The settings of the AI services (`nuclear.ai.*`, the section "Nuclear: AI services"): where the Smart Graph answers,
// the retry policy, the MCP command, the providers' commands and the integrations. The Builder and
// Nuclear Atlas read it as the machine's defaults, with their own sections (`../../tools/<tool>/src/settings.ts`) and the
// spending's (`spending.ts`); a project's `.nuclear/builder.json` still wins (it is shared with CI). Jira's
// credentials live in the secret storage.
import * as vscode from 'vscode';
import { l10n } from './i18n';
import { urls } from './aiMachine';
import { JiraAuth, RetryPolicy, toolEnv } from '../../tools/nuclear-builder/src/support';

export const JIRA_SECRET = 'nuclear.builder.jira';

export interface AiSettings {
  graphUrl: string;
  /** The Smart Graph's command (serve, connect, requests, revoke). */
  graphCommand: string;
  /** The MCP server's command, started with no argument by an AI client. */
  mcpCommand: string;
  retry: RetryPolicy;
}

export function aiSettings(): AiSettings {
  const c = vscode.workspace.getConfiguration('nuclear.ai');
  // a value the user set in the editor wins; else the one the set-up chose (ai.env, ADR-installer-0002)
  const model = (key: string, chosen: string | undefined) => {
    const i = c.inspect<string>(key);
    return i?.workspaceFolderValue ?? i?.workspaceValue ?? i?.globalValue ?? chosen ?? i?.defaultValue ?? '';
  };
  return {
    // an address set in the editor wins; else the port the set-up chose (ai.env)
    graphUrl: model('graphUrl', urls().graph),
    graphCommand: c.get('graphCommand', 'nuclear-graph'),
    mcpCommand: c.get('mcpCommand', 'nuclear-mcp'),
    retry: { attempts: c.get('retry.attempts', 5), baseMs: c.get('retry.baseMs', 1000), maxMs: c.get('retry.maxMs', 30000) },
  };
}

/** The environment the graph and the Builder's engine start with, so they use the address of the settings. The local
 * models are on standby (ADR-platform-0013): no model nor Developer port is passed. */
export function serviceEnv(): NodeJS.ProcessEnv {
  const s = aiSettings();
  const port = (url: string, fallback: string) => {
    try {
      return new URL(url).port || fallback;
    } catch {
      return fallback;
    }
  };
  return {
    ...toolEnv(),
    NUCLEAR_GRAPH_URL: s.graphUrl,
    NUCLEAR_GRAPH_PORT: port(s.graphUrl, '7878'),
  };
}

/** Jira's site, email and token from the secret storage; asked (and kept) when missing or when `ask`. */
export async function jiraAuth(context: vscode.ExtensionContext, ask: boolean): Promise<JiraAuth | undefined> {
  const saved = await context.secrets.get(JIRA_SECRET);
  if (saved && !ask) return JSON.parse(saved) as JiraAuth;
  // the site and the email are settings (nuclear.ai.jira.*); only the token is a secret
  const c = vscode.workspace.getConfiguration('nuclear.ai');
  const baseUrl = c.get('jira.site', '') || (await vscode.window.showInputBox({ title: 'Jira (1/3)', prompt: l10n.t('Your Jira site'), placeHolder: 'https://your-team.atlassian.net', ignoreFocusOut: true }));
  if (!baseUrl) return undefined;
  const email = c.get('jira.email', '') || (await vscode.window.showInputBox({ title: 'Jira (2/3)', prompt: l10n.t('The email of your Atlassian account'), ignoreFocusOut: true }));
  if (!email) return undefined;
  await c.update('jira.site', baseUrl, vscode.ConfigurationTarget.Global);
  await c.update('jira.email', email, vscode.ConfigurationTarget.Global);
  const token = await vscode.window.showInputBox({ title: 'Jira (3/3)', prompt: l10n.t('An API token (id.atlassian.com → Security → API tokens). Kept in VS Code secret storage.'), password: true, ignoreFocusOut: true });
  if (!token) return undefined;
  const criteriaField = c.get('jira.criteriaField', '');
  const auth: JiraAuth = { baseUrl, email, token, criteriaField: criteriaField || undefined };
  await context.secrets.store(JIRA_SECRET, JSON.stringify(auth));
  return auth;
}
