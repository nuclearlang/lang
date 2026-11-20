// The settings that moved to their tool's section (spec 011, settings by component): a value the user set under the
// old id is copied to the new one at the same level (user, workspace, folder), then the old one is removed. A level
// where the new id already has a value keeps it, and the old value stays there for the user to see: nothing is lost.
// The local models are on standby (ADR-platform-0013): a `nuclear.builder.chat` of the kind `local` is removed at its
// level, so the default external agent works the chat, and the user is told once. The settings that only served the
// local models (`nuclear.ai.developerUrl`, `ollamaUrl`, `models.*`) are no longer declared: their values are ignored.
import * as vscode from 'vscode';
import { l10n } from './i18n';

export const MOVED: Record<string, string> = {
  'nuclear.ai.claudeModel': 'nuclear.builder.claudeModel',
  'nuclear.ai.claude.maxBudgetUsd': 'nuclear.spending.budgetUsd',
  'nuclear.ai.resumeInterrupted': 'nuclear.builder.resumeInterrupted',
  'nuclear.ai.watch.minFreeMb': 'nuclear.builder.minFreeMb',
  'nuclear.ai.watch.commandTimeoutMinutes': 'nuclear.builder.commandTimeoutMinutes',
  'nuclear.ai.contextTokens': 'nuclear.atlas.contextTokens',
};

/** The levels where a value of `nuclear.builder.chat` named the local kind, removed; the ids moved are in `MOVED`. */
export async function migrateSettings(): Promise<string[]> {
  const targets: [vscode.ConfigurationTarget, 'globalValue' | 'workspaceValue' | 'workspaceFolderValue', vscode.Uri | undefined][] = [
    [vscode.ConfigurationTarget.Global, 'globalValue', undefined],
    [vscode.ConfigurationTarget.Workspace, 'workspaceValue', undefined],
    ...(vscode.workspace.workspaceFolders ?? []).map((f) => [vscode.ConfigurationTarget.WorkspaceFolder, 'workspaceFolderValue', f.uri] as [vscode.ConfigurationTarget, 'workspaceFolderValue', vscode.Uri]),
  ];
  for (const [from, to] of Object.entries(MOVED)) {
    for (const [target, level, uri] of targets) {
      // a fresh read each time: a configuration object is a snapshot
      const read = () => vscode.workspace.getConfiguration(undefined, uri);
      const old = read().inspect(from)?.[level];
      if (old === undefined || read().inspect(to)?.[level] !== undefined) continue;
      try {
        await read().update(to, old, target);
        // the old one goes only once the value is safe in its new place
        if (read().inspect(to)?.[level] !== undefined) await read().update(from, undefined, target);
      } catch (e) {
        console.warn(`NuclearLang: could not move the setting ${from} to ${to}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
  const converted: string[] = [];
  for (const [target, level, uri] of targets) {
    const read = () => vscode.workspace.getConfiguration(undefined, uri);
    const chat = read().inspect<{ kind?: string }>('nuclear.builder.chat')?.[level];
    if (chat?.kind !== 'local') continue;
    try {
      await read().update('nuclear.builder.chat', undefined, target);
      converted.push(level);
    } catch (e) {
      console.warn(`NuclearLang: could not convert the local nuclear.builder.chat: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (converted.length) void vscode.window.showInformationMessage(l10n.t("NuclearLang: the local models are on standby, so the Builder's chat is now worked by an external agent (Claude Code). Choose another in Settings and integrations → Nuclear Builder."));
  return converted;
}
