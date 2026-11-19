// A stand-in for the `vscode` module in HTTP Connections' tests (sockets.test.ts): the workspace folders in memory,
// the texts in English (`nuclear.language` at its default, so the stub editor's language decides). Only what the
// tested modules use.
export const workspace = { workspaceFolders: undefined as unknown, getConfiguration: () => ({ get: <T>(_k: string, fallback?: T) => fallback }) };
export const env = { language: 'en' };
export const l10n = { t: (message: string, ...args: unknown[]) => message.replace(/\{(\d+)\}/g, (_, i) => String(args[+i])) };
export class EventEmitter<T> {
  private readonly listeners: ((e: T) => void)[] = [];
  readonly event = (l: (e: T) => void) => {
    this.listeners.push(l);
    return { dispose: () => undefined };
  };
  fire(e: T): void {
    for (const l of this.listeners) l(e);
  }
}
// the panels and the commands are not driven by the tests: present so the bundle links
export const window = {};
export const commands = {};
export const ViewColumn = { Active: -1, Beside: -2 };
export const Uri = {};
