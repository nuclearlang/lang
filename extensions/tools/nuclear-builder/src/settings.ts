// Nuclear Builder's settings (`nuclear.builder.*`, the section "Nuclear Builder" of the editor's settings). The money a
// run may spend is the spending's (`nuclear.spending.*`, vscode/src/spending.ts). A project's `.nuclear/builder.json`
// still wins over these for its own pipeline (it is shared with CI).
import * as vscode from 'vscode';
import { PROVIDERS } from './teams/cli';

/** Who works the general agent of Nuclear Chat (the setting `nuclear.builder.chat`): a kind, a provider, its model. */
export interface ChatProvider {
  kind: 'local' | 'agent' | 'api';
  provider: string;
  model?: string;
}

export const DEFAULT_CHAT: ChatProvider = { kind: 'local', provider: 'nuclear-developer', model: '' };

export const CLAUDE_MODELS = ['haiku', 'sonnet', 'opus'];

export interface BuilderSettings {
  /** The team of a run when the project names none ('' : the onboarding's). */
  team: string;
  claudeModel: string;
  resumeInterrupted: boolean;
  minFreeMb: number;
  commandTimeoutMs: number;
  /** Who works the general agent (`nuclear.builder.chat`, Nuclear Atlas's direct message); a value that is not one the factory knows is the default. */
  chat: ChatProvider;
}

/** The setting's value when it names a provider of its kind, else the local Nuclear Developer. */
export function chatProvider(v: unknown): ChatProvider {
  const x = (v ?? {}) as Partial<ChatProvider>;
  const ok = typeof x.kind === 'string' && x.kind in PROVIDERS && (PROVIDERS[x.kind] as readonly string[]).includes(String(x.provider));
  return ok ? { kind: x.kind!, provider: x.provider!, model: typeof x.model === 'string' ? x.model : '' } : { ...DEFAULT_CHAT };
}

export function builderSettings(): BuilderSettings {
  const c = vscode.workspace.getConfiguration('nuclear.builder');
  return {
    team: c.get('team', ''),
    claudeModel: c.get('claudeModel', 'haiku'),
    resumeInterrupted: c.get('resumeInterrupted', true),
    minFreeMb: c.get('minFreeMb', 500),
    commandTimeoutMs: c.get('commandTimeoutMinutes', 20) * 60_000,
    chat: chatProvider(c.get('chat')),
  };
}
