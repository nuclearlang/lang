// HTTP Connections' settings (`nuclear.http.*`, the section "HTTP Connections" of the editor's settings).
import * as vscode from 'vscode';

export interface HttpSettings {
  /** A request that takes longer is cancelled: ms. */
  timeoutMs: number;
}

export function httpSettings(): HttpSettings {
  const c = vscode.workspace.getConfiguration('nuclear.http');
  return { timeoutMs: Math.max(1, c.get('timeoutSeconds', 30)) * 1000 };
}
