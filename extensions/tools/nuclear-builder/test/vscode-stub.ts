// A stand-in for the `vscode` module in the editors' tests (editors.test.ts): the settings in memory, the questions
// answered from a script, the texts in English. Only what the tested modules use.
type Level = 'globalValue' | 'workspaceValue' | 'workspaceFolderValue';
export const store: Record<Level, Record<string, unknown>> = { globalValue: {}, workspaceValue: {}, workspaceFolderValue: {} };
export const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 } as const;
const levelOf = (target: number): Level => (target === 1 ? 'globalValue' : target === 2 ? 'workspaceValue' : 'workspaceFolderValue');
const value = (key: string) => store.workspaceFolderValue[key] ?? store.workspaceValue[key] ?? store.globalValue[key];

export const workspace = {
  onDidChangeConfiguration: () => disposable,
  workspaceFolders: undefined as unknown,
  workspaceFile: undefined as unknown,
  getConfiguration(section?: string) {
    const full = (k: string) => (section ? `${section}.${k}` : k);
    return {
      get: <T>(k: string, fallback?: T) => (value(full(k)) as T | undefined) ?? fallback,
      inspect: (k: string) => ({ key: full(k), globalValue: store.globalValue[full(k)], workspaceValue: store.workspaceValue[full(k)], workspaceFolderValue: store.workspaceFolderValue[full(k)] }),
      update: async (k: string, v: unknown, target: number) => {
        if (v === undefined) delete store[levelOf(target)][full(k)];
        else store[levelOf(target)][full(k)] = v;
      },
    };
  },
};

/** The answers the next questions get, in order (undefined: the user closed it); what was asked is kept. */
export const answers: (string | undefined)[] = [];
export const asked: { message: string; detail?: string; items: string[] }[] = [];
/** The webview panels opened (the welcome's), each with what its page was given. */
export const panels: { id: string; title: string; webview: { html: string } }[] = [];
const disposable = { dispose() {} };
export const window = {
  async showWarningMessage(message: string, options: { detail?: string }, ...items: string[]) {
    asked.push({ message, detail: options?.detail, items });
    return answers.shift();
  },
  async showInformationMessage(message: string, ...items: string[]) {
    asked.push({ message, items });
    return answers.shift();
  },
  async showErrorMessage(message: string) {
    asked.push({ message, items: [] });
    return undefined;
  },
  createWebviewPanel(id: string, title: string) {
    const webview = { html: '', options: {} as Record<string, unknown>, cspSource: 'vscode-resource:', asWebviewUri: (u: unknown) => u, onDidReceiveMessage: () => disposable, postMessage: async () => true };
    const panel = { id, title, webview, iconPath: undefined as unknown, reveal() {}, onDidDispose: () => disposable, dispose() {} };
    panels.push(panel);
    return panel;
  },
};
export const ViewColumn = { Active: -1 } as const;
export const extensions = { getExtension: (_id: string) => ({ extensionUri: { fsPath: '/ext' } }) };
export const Uri = { file: (p: string) => ({ fsPath: p }), joinPath: (u: { fsPath: string }, ...parts: string[]) => ({ fsPath: [u.fsPath, ...parts].join('/') }) };

export const env = { language: 'en' };
export const l10n = { t: (message: string, ...args: unknown[]) => message.replace(/\{(\d+)\}/g, (_, i) => String(args[+i])) };
/** Enough of an event emitter for the modules the settings page imports (the notifications). */
export class EventEmitter<T> {
  private readonly listeners: ((e: T) => void)[] = [];
  readonly event = (l: (e: T) => void) => (this.listeners.push(l), disposable);
  fire(e: T): void {
    for (const l of this.listeners) l(e);
  }
  dispose(): void {}
}
