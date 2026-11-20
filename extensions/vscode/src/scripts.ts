/**
 * The scripts of the backend projects, as VS Code shows npm's: a task per command (*Terminal → Run Task…* →
 * `nuclear: <project>: run`, also before the first build) and the *Nuclear Scripts* view of the explorer, a ▷ per
 * script. Only backend projects (the user, 2026-11-20).
 */
import * as vscode from 'vscode';
import { nuclearBinary, Project } from '../../tools/nuclear-http-connections/src/httpConnections';
import { backendScripts, BackendScript } from './backendScripts';
import { l10n } from './i18n';

const TYPE = 'nuclear';

interface ScriptTask extends vscode.TaskDefinition {
  script: string;
  project: string;
}

function taskOf(p: Project, s: BackendScript): vscode.Task {
  const def: ScriptTask = { type: TYPE, script: s.name, project: p.root };
  const scope = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(p.root)) ?? vscode.TaskScope.Workspace;
  const exec = new vscode.ShellExecution(nuclearBinary(), s.args, { cwd: p.root });
  const task = new vscode.Task(def, scope, `${p.name}: ${s.name}`, TYPE, exec, []);
  task.detail = `nuclear ${s.args.join(' ')}: ${l10n.t(s.detail)}`;
  task.isBackground = !!s.background;
  task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, panel: vscode.TaskPanelKind.Dedicated };
  if (s.name === 'build') task.group = vscode.TaskGroup.Build;
  if (s.name === 'test') task.group = vscode.TaskGroup.Test;
  return task;
}

type Row = { project: Project } | { project: Project; script: BackendScript };

class ScriptsView implements vscode.TreeDataProvider<Row> {
  readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;
  constructor(private readonly backends: () => Project[]) {}

  getChildren(row?: Row): Row[] {
    if (!row) return this.backends().map((project) => ({ project }));
    if ('script' in row) return [];
    return backendScripts(row.project.root).map((script) => ({ project: row.project, script }));
  }

  getTreeItem(row: Row): vscode.TreeItem {
    if (!('script' in row)) {
      const item = new vscode.TreeItem(row.project.name, vscode.TreeItemCollapsibleState.Expanded);
      item.description = row.project.dialect;
      item.tooltip = row.project.root;
      item.iconPath = new vscode.ThemeIcon('server-environment');
      return item;
    }
    const item = new vscode.TreeItem(row.script.name, vscode.TreeItemCollapsibleState.None);
    item.description = `nuclear ${row.script.args.join(' ')}`;
    item.tooltip = l10n.t(row.script.detail);
    item.iconPath = new vscode.ThemeIcon(row.script.background ? 'play' : 'terminal');
    item.contextValue = 'nuclearScript';
    item.command = { command: 'nuclear.scripts.run', title: l10n.t('Run Script'), arguments: [row] };
    return item;
  }
}

/** `projects`: the projects of the workspace (its folders and the tabs of the Nuclear workspace). */
export function activateScripts(context: vscode.ExtensionContext, projects: () => Project[], changed: vscode.Event<void>): void {
  const backends = () => projects().filter((p) => p.platform === 'backend');
  const view = new ScriptsView(backends);
  const update = () => {
    void vscode.commands.executeCommand('setContext', 'nuclear.hasBackend', backends().length > 0);
    view.changed.fire();
  };
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('nuclear.scripts', view),
    vscode.tasks.registerTaskProvider(TYPE, {
      provideTasks: () => backends().flatMap((p) => backendScripts(p.root).map((s) => taskOf(p, s))),
      resolveTask: (task) => {
        const def = task.definition as ScriptTask;
        const p = backends().find((x) => x.root === def.project);
        const s = p && backendScripts(p.root).find((x) => x.name === def.script);
        return p && s ? taskOf(p, s) : undefined;
      },
    }),
    vscode.commands.registerCommand('nuclear.scripts.run', (row?: Row) => {
      if (row && 'script' in row) return vscode.tasks.executeTask(taskOf(row.project, row.script));
    }),
    vscode.commands.registerCommand('nuclear.scripts.refresh', update),
    changed(update),
    vscode.workspace.onDidChangeWorkspaceFolders(update),
  );
  const migrations = vscode.workspace.createFileSystemWatcher('**/migrations');
  context.subscriptions.push(migrations, migrations.onDidCreate(update), migrations.onDidDelete(update));
  update();
}
