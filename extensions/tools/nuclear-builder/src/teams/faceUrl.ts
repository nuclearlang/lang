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
      webview.options = { ...webview.options, localResourceRoots: [...(webview.options.localResourceRoots ?? []), vscode.Uri.file(dir)] };
    }
    return webview.asWebviewUri(vscode.Uri.file(face)).toString();
  };
}
