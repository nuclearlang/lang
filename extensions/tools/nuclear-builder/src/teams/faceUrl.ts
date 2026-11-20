import * as path from 'node:path';
import * as vscode from 'vscode';

/** A portrait's URL in `webview`: the file served from its roster's folder, added to the webview's roots the first
 * time; the painted portraits never travel as `data:` URLs. */
export function webviewFaceUrl(webview: vscode.Webview): (face?: string | null) => string | null {
  const roots = new Set<string>();
  return (face) => {
    if (!face) return null;
    const dir = path.dirname(face);
    if (!roots.has(dir)) {
      roots.add(dir);
      webview.options = { ...webview.options, localResourceRoots: [...(webview.options.localResourceRoots ?? defaultRoots()), vscode.Uri.file(dir)] };
    }
    return webview.asWebviewUri(vscode.Uri.file(face)).toString();
  };
}

/** What a webview reads when it names no roots (VS Code's default): this extension's folder and the workspace's
 * folders. A page that had none keeps them when a face's folder is added: without them its own scripts
 * (`out/chat-embed.js`, `out/builder-flow.js`) would no longer load (found in 0.84.0: Atlas and the Builder's diagram
 * broke once a team's faces were shown). */
export function defaultRoots(): vscode.Uri[] {
  const own = vscode.extensions.getExtension('nuclearlang.nuclearlang')?.extensionUri ?? vscode.Uri.file(path.dirname(__dirname));
  return [own, ...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri)];
}
