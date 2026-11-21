// The automatic update, from the editor (the user, 2026-11-21): every use of VS Code with NuclearLang tells the
// `nuclear` command the user is working (`nuclear update --touch`, at most every few minutes); once a day it looks for
// a newer release and, when there is one, installs it by itself once the user stops (or within 12 hours). The setting
// `nuclear.update.auto` turns it on or off (`nuclear update --auto on|off`); when it has updated, the editor says so
// once and offers to reload the window. The rules are the command's (tools/cli/src/update.rs); none is repeated here.
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { l10n } from './i18n';
import { nuclearCommand } from './toolchains';
import { toolEnv } from '../../tools/nuclear-builder/src/support';
import { cacheDir, later } from './updates';

/** The editor tells the command the user is working no more often than this. */
const EVERY = 5 * 60 * 1000;
const SHOWN = 'nuclear.update.shown';

function nuclear(args: string[]): void {
  execFile(nuclearCommand(), args, { env: toolEnv(), timeout: 20000, shell: process.platform === 'win32' }, () => undefined);
}

export function activateAutoUpdate(context: vscode.ExtensionContext): void {
  let last = 0;
  const touch = () => {
    if (Date.now() - last < EVERY) return;
    last = Date.now();
    nuclear(['update', '--touch']);
  };
  const auto = () => vscode.workspace.getConfiguration('nuclear.update').get<boolean>('auto', true);
  nuclear(['update', '--auto', auto() ? 'on' : 'off']);
  touch();
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((s) => s.focused && touch()),
    vscode.window.onDidChangeActiveTextEditor(touch),
    vscode.workspace.onDidSaveTextDocument(touch),
    vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('nuclear.update.auto') && nuclear(['update', '--auto', auto() ? 'on' : 'off'])),
  );
  // the update done: said once per version, with a reload (the new extension and server run after it)
  const updated = path.join(cacheDir(), 'updated');
  const own = String(context.extension.packageJSON.version ?? '');
  const tell = () => {
    let version = '';
    try {
      version = fs.readFileSync(updated, 'utf8').trim();
    } catch {
      return;
    }
    if (!later(version, own) || context.globalState.get<string>(SHOWN) === version) return;
    void context.globalState.update(SHOWN, version);
    const reload = l10n.t('Reload');
    void vscode.window.showInformationMessage(l10n.t('NuclearLang updated itself to {0}: reload the window to use it.', version), reload).then((pick) => pick === reload && vscode.commands.executeCommand('workbench.action.reloadWindow'));
  };
  tell();
  const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(cacheDir()), 'updated'));
  context.subscriptions.push(watcher, watcher.onDidCreate(tell), watcher.onDidChange(tell));
}
