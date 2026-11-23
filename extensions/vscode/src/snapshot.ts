/**
 * A release is one snapshot of the whole platform (ADR-platform-0011): this extension, `nuclear`, the language server,
 * the Smart Graph, the MCP server and the local agents carry one version. The stores update the extension by
 * themselves; at start it compares its version with the installation's and offers what makes them one again.
 * Nothing is blocked.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { l10n } from './i18n';
import { findInstalled, syncFor } from './snapshotCheck';

const SHOWN = 'nuclear.snapshot.shown';

export function checkSnapshot(context: vscode.ExtensionContext): void {
  const own = String(context.extension.packageJSON.version);
  const installed = findInstalled(process.env, os.homedir());
  const sync = syncFor(own, installed);
  if (sync.kind === 'none' || !installed) return;
  // once per pair of versions: the same question is not asked at every start
  const key = `${own}/${installed.version}/${installed.ai ?? ''}`;
  if (context.globalState.get(SHOWN) === key) return;
  void context.globalState.update(SHOWN, key);
  if (sync.kind === 'update') void offerUpdate(own, installed.version, sync.to);
  else void offerExtension(context, own, sync.to);
}

async function offerUpdate(own: string, installed: string, to: string): Promise<void> {
  const update = l10n.t('Update NuclearLang');
  const message =
    own === installed
      ? l10n.t('NuclearLang {0}: its AI services are of another version. Every part of a release goes together: update them to {0}.', to)
      : l10n.t('NuclearLang {0} is installed and this extension is {1}. Every part of a release goes together: update NuclearLang and its services to {1}.', installed, own);
  if ((await vscode.window.showWarningMessage(message, update)) !== update) return;
  const terminal = vscode.window.createTerminal({ name: 'NuclearLang · update' });
  terminal.show();
  terminal.sendText('nuclear update');
}

async function offerExtension(context: vscode.ExtensionContext, own: string, to: string): Promise<void> {
  const install = l10n.t('Install the extension {0}', to);
  const message = l10n.t('This extension is {0} and NuclearLang {1} is installed. Every part of a release goes together: install the extension of {1}.', own, to);
  if ((await vscode.window.showWarningMessage(message, install)) !== install) return;
  const url = `https://github.com/nuclearlang/nuclearlang/releases/download/v${to}/nuclearlang-${to}.vsix`;
  const file = path.join(context.globalStorageUri.fsPath, `nuclearlang-${to}.vsix`);
  try {
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: l10n.t('Downloading the extension {0}…', to) }, async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    });
    await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(file));
  } catch (e) {
    void vscode.window.showErrorMessage(l10n.t('The extension {0} could not be installed: {1}', to, String(e)));
    return;
  }
  const reload = l10n.t('Reload Window');
  if ((await vscode.window.showInformationMessage(l10n.t('The extension {0} is installed.', to), reload)) === reload)
    void vscode.commands.executeCommand('workbench.action.reloadWindow');
}
