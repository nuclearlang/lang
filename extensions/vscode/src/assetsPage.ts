// The editor's side of the pages' bundled files (assets.ts): a file's URL for a page from the extension's folder,
// else from the copy kept in the extension's storage (that folder added to the page's roots); a file in neither is
// said and taken from this version's release once per window, then the window is reloaded to use it.
import * as path from 'node:path';
import * as vscode from 'vscode';
import { assetDir, brokenInstall, cacheDir, httpFetch, PAGE_ASSETS, restoreAssets } from './assets';
import { l10n } from './i18n';
import { defaultRoots } from '../../tools/nuclear-builder/src/teams/faceUrl';

let where: { storage: string; version: string } | undefined;
let restoring: PromiseLike<void> | undefined;

/** Where the copies are kept and of which version (called once, on activation). */
export function initAssets(context: vscode.ExtensionContext): void {
  where = { storage: context.globalStorageUri.fsPath, version: String((context.extension?.packageJSON as { version?: string } | undefined)?.version ?? '') };
}

/** The page's URL of a bundled file (`out/chat-embed.js`, `icons/icon.svg`): the extension's own, else the kept copy. */
export function assetUrl(webview: vscode.Webview, extension: vscode.Uri, rel: string): string {
  const cache = where?.version ? cacheDir(where.storage, where.version) : '';
  const dir = assetDir(rel, extension.fsPath, cache || extension.fsPath);
  if (!dir && brokenInstall(rel, extension.fsPath)) void restore(rel);
  if (dir && dir !== extension.fsPath) {
    const roots = webview.options.localResourceRoots ?? defaultRoots();
    if (!roots.some((r) => r.fsPath === dir)) webview.options = { ...webview.options, localResourceRoots: [...roots, vscode.Uri.file(dir)] };
    return webview.asWebviewUri(vscode.Uri.file(path.join(dir, rel))).toString();
  }
  return webview.asWebviewUri(vscode.Uri.joinPath(extension, ...rel.split('/'))).toString();
}

/** A missing file said, and the pages' files taken from the release (once per window). */
function restore(rel: string): PromiseLike<void> {
  if (restoring || !where?.version) return restoring ?? Promise.resolve();
  const { storage, version } = where;
  restoring = vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: l10n.t('A file of the NuclearLang extension is missing ({0}): taking it from the release {1} on GitHub…', rel, version) },
    () => restoreAssets(PAGE_ASSETS, { version, cache: cacheDir(storage, version), fetch: httpFetch }),
  ).then(
    async () => {
      const reload = l10n.t('Reload Window');
      if ((await vscode.window.showInformationMessage(l10n.t('The missing files of the extension were taken from its release {0} and checked. Reload the window to use them.', version), reload)) === reload) void vscode.commands.executeCommand('workbench.action.reloadWindow');
    },
    (e: Error) => {
      restoring = undefined;
      void vscode.window.showErrorMessage(l10n.t('A file of the NuclearLang extension is missing ({0}) and could not be taken from its release: {1}. Install the extension again (the installer, or code --install-extension nuclearlang-{2}.vsix).', rel, e.message, version));
    },
  );
  return restoring!;
}
