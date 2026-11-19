// The devices' settings (`nuclear.devices.*`, the section "Nuclear: devices" of the editor's settings).
import * as vscode from 'vscode';

export interface DeviceSettings {
  /** A device nobody looks at (hidden or not visible) this long is stopped: ms. */
  idleMs: number;
}

export function deviceSettings(): DeviceSettings {
  const c = vscode.workspace.getConfiguration('nuclear.devices');
  return { idleMs: Math.max(1, c.get('idleMinutes', 30)) * 60_000 };
}
