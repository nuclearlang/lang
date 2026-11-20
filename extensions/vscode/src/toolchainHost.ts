// The platforms' toolchains in the editor (toolchains.ts has the rules): the settings `nuclear.toolchains.*` become the
// variables `nuclear` reads (`NUCLEAR_PYTHON`, `NUCLEAR_NODE`, `FLUTTER`/`FLUTTER_ROOT`) in the extension host's own
// environment, so every process the extension starts has them (the language server, `nuclear`, the Builder, the
// debuggers), and in every terminal and task (`environmentVariableCollection`). Settings and integrations and the
// welcome draw them with TC_JS and send what the user chose here: Browse…, Install Nuclear's own (`nuclear setup <id>`
// in a terminal the user sees), Use the one on PATH.
import { execFile } from 'node:child_process';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { dictionary, l10n } from './i18n';
import { readCard } from './card';
import { dartFlutterRoot, onPath, parseDoctor, Paths, Platform, probe, Status, ToolchainId, toolchainEnv, TOOLCHAINS } from './toolchains';
import { toolEnv } from '../../tools/nuclear-builder/src/support';

const VARS = ['NUCLEAR_PYTHON', 'NUCLEAR_NODE', 'FLUTTER', 'FLUTTER_ROOT'] as const;
/** The editor's environment before the settings: what the user set, and where the status looks. */
const ORIGINAL: NodeJS.ProcessEnv = Object.fromEntries(VARS.map((k) => [k, process.env[k]]));
const IDS: ToolchainId[] = ['python', 'node', 'flutter'];
const PLATFORMS: Platform[] = ['mobile', 'backend', 'web'];

export function toolchainPaths(): Paths {
  const c = vscode.workspace.getConfiguration('nuclear.toolchains');
  return Object.fromEntries(IDS.map((id) => [id, c.get<string>(id, '')])) as Paths;
}

/** The editor's environment, with the Dart extension's Flutter as FLUTTER_ROOT when the user set no Flutter variable. */
const original = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env, ...ORIGINAL };
  if (!env.FLUTTER && !env.FLUTTER_ROOT) {
    const dart = vscode.workspace.getConfiguration('dart');
    const root = dartFlutterRoot(dart.get('flutterSdkPath'), dart.get('flutterSdkPaths'));
    if (root) env.FLUTTER_ROOT = root;
  }
  return env;
};

/** The settings into the extension host's environment and the terminals'; again on every change. */
export function applyToolchains(context: vscode.ExtensionContext): void {
  const apply = () => {
    const env = toolchainEnv(toolchainPaths(), original());
    const terminals = context.environmentVariableCollection;
    for (const k of VARS) {
      const v = env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
      if (v !== undefined && v !== ORIGINAL[k]) terminals.replace(k, v);
      else terminals.delete(k);
    }
  };
  apply();
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => (e.affectsConfiguration('nuclear.toolchains') || e.affectsConfiguration('dart.flutterSdkPath') || e.affectsConfiguration('dart.flutterSdkPaths')) && apply()));
}

export interface ToolchainState {
  statuses: Status[];
  paths: Paths;
  /** The executable each would get from the PATH (for *Use the one on PATH*). */
  onPath: Partial<Record<ToolchainId, string>>;
  platforms: Platform[];
  /** The platforms of the workspace's projects (their cards). */
  workspace: Platform[];
}

/** `nuclear doctor --json`'s toolchains when the CLI has them, else the same order probed without running anything. */
async function statuses(paths: Paths): Promise<Status[]> {
  const text = await new Promise<string>((resolve) => execFile('nuclear', ['doctor', '--json'], { timeout: 15000, env: toolEnv(), shell: process.platform === 'win32' }, (_e, out) => resolve(String(out ?? ''))));
  return parseDoctor(text, paths) ?? IDS.map((id) => probe(id, paths, original()));
}

async function workspacePlatforms(): Promise<Platform[]> {
  const cards = await vscode.workspace.findFiles('**/.nuclear/project.json', '**/{node_modules,build}/**', 50);
  const found = new Set(cards.map((u) => readCard(path.dirname(path.dirname(u.fsPath)))?.platform));
  return PLATFORMS.filter((p) => found.has(p));
}

export async function toolchainState(): Promise<ToolchainState> {
  const paths = toolchainPaths();
  const env = toolEnv(original());
  const [list, workspace] = await Promise.all([statuses(paths), workspacePlatforms()]);
  return {
    statuses: list,
    paths,
    onPath: Object.fromEntries(IDS.map((id) => [id, onPath(id, env)]).filter(([, p]) => p)),
    platforms: vscode.workspace.getConfiguration('nuclear.toolchains').get<Platform[]>('platforms', []).filter((p) => PLATFORMS.includes(p)),
    workspace,
  };
}

const setPath = (id: ToolchainId, value: string) => vscode.workspace.getConfiguration('nuclear.toolchains').update(id, value, vscode.ConfigurationTarget.Global);

/** A toolchain message of a page (`tc*`); false when it is not one. The page is a trust boundary: ids and platforms are
 * checked, a path comes only from the dialog or the PATH. */
export async function handleToolchain(m: { type: string; [k: string]: unknown }, refresh: () => void): Promise<boolean> {
  if (!m.type.startsWith('tc')) return false;
  const id = m.id as ToolchainId;
  if (m.type === 'tcPlatforms') {
    const list = Array.isArray(m.platforms) ? PLATFORMS.filter((p) => (m.platforms as unknown[]).includes(p)) : [];
    await vscode.workspace.getConfiguration('nuclear.toolchains').update('platforms', list, vscode.ConfigurationTarget.Global);
    return true;
  }
  if (m.type === 'tcCheck') return refresh(), true;
  if (!IDS.includes(id)) return true;
  const name = TOOLCHAINS.find((t) => t.id === id)!.name;
  if (m.type === 'tcBrowse') {
    const picked = await vscode.window.showOpenDialog({
      title: id === 'flutter' ? l10n.t("Flutter's SDK folder, or its flutter executable") : l10n.t('The {0} executable', name),
      canSelectFiles: true,
      canSelectFolders: id === 'flutter',
      canSelectMany: false,
    });
    if (picked?.[0]) await setPath(id, picked[0].fsPath);
  } else if (m.type === 'tcPath') {
    const found = onPath(id, toolEnv(original()));
    if (found) await setPath(id, found);
    else void vscode.window.showWarningMessage(l10n.t('{0} is not on the PATH.', name));
  } else if (m.type === 'tcClear') {
    await setPath(id, '');
  } else if (m.type === 'tcInstall') {
    // in a terminal the user sees (the extension never installs hidden); the page checks again when it closes
    const t = vscode.window.createTerminal({ name: l10n.t('Install {0}', name), env: toolEnv() as Record<string, string> });
    t.show();
    t.sendText(`nuclear setup ${id}`);
    const sub = vscode.window.onDidCloseTerminal((x) => {
      if (x !== t) return;
      sub.dispose();
      refresh();
    });
  }
  return true;
}

/** The texts of the toolchains' cards, for both pages. */
export const TC_TEXTS = dictionary({
  en: {
    'tc.title': 'Toolchains',
    'tc.intro': 'What builds and runs each platform. NuclearLang looks for each in its setting, then its own, then the PATH. Python comes with NuclearLang; Flutter and Node.js are yours to install, or NuclearLang installs its own.',
    'tc.platforms': 'Which platforms will you build?',
    'tc.platformsHint': 'Only their toolchains are asked; the defaults come from the projects of this workspace.',
    'tc.p.mobile': 'Mobile (Flutter)',
    'tc.p.backend': 'Backend (FastAPI or NestJS)',
    'tc.p.web': 'Web (React)',
    'tc.for.python': 'backend: fastapi',
    'tc.for.node': 'TypeScript, NestJS, React',
    'tc.for.flutter': 'mobile',
    'tc.required': 'required for mobile',
    'tc.where.setting': 'Your setting',
    'tc.where.env': 'The environment variable',
    'tc.where.nuclear': "NuclearLang's own",
    'tc.where.included': 'Included with NuclearLang',
    'tc.where.path': 'The PATH',
    'tc.where.missing': 'Not found',
    'tc.where.broken': 'Not found at your setting',
    'tc.where.fails': 'Found, but it does not run',
    'tc.browse': 'Browse…',
    'tc.install': "Install NuclearLang's own",
    'tc.usePath': 'Use the one on PATH',
    'tc.default': 'Back to the default',
    'tc.myself': "I'll install it myself (I'll point to it)",
    'tc.later': 'Later',
    'tc.laterNote': 'Later: Settings and integrations › Toolchains, or nuclear setup {0}',
    'tc.check': 'Check again',
    'tc.none': 'No platform chosen: nothing to install.',
    'tc.override': 'Optional: another Python than the one included.',
  },
  es: {
    'tc.title': 'Toolchains',
    'tc.intro': 'Lo que construye y ejecuta cada plataforma. NuclearLang busca cada una en su ajuste, después la suya propia, después el PATH. Python viene con NuclearLang; Flutter y Node.js los instalas tú, o NuclearLang instala los suyos.',
    'tc.platforms': '¿Qué plataformas vas a construir?',
    'tc.platformsHint': 'Solo se preguntan sus toolchains; los valores por defecto salen de los proyectos de este espacio de trabajo.',
    'tc.p.mobile': 'Móvil (Flutter)',
    'tc.p.backend': 'Backend (FastAPI o NestJS)',
    'tc.p.web': 'Web (React)',
    'tc.for.python': 'backend: fastapi',
    'tc.for.node': 'TypeScript, NestJS, React',
    'tc.for.flutter': 'móvil',
    'tc.required': 'obligatorio para móvil',
    'tc.where.setting': 'Tu ajuste',
    'tc.where.env': 'La variable de entorno',
    'tc.where.nuclear': 'La de NuclearLang',
    'tc.where.included': 'Incluido con NuclearLang',
    'tc.where.path': 'El PATH',
    'tc.where.missing': 'No encontrado',
    'tc.where.broken': 'No está donde dice tu ajuste',
    'tc.where.fails': 'Encontrado, pero no funciona',
    'tc.browse': 'Examinar…',
    'tc.install': 'Instalar la de NuclearLang',
    'tc.usePath': 'Usar la del PATH',
    'tc.default': 'Volver al valor por defecto',
    'tc.myself': 'Lo instalo yo (y lo indico)',
    'tc.later': 'Más tarde',
    'tc.laterNote': 'Más tarde: Ajustes e integraciones › Toolchains, o nuclear setup {0}',
    'tc.check': 'Comprobar de nuevo',
    'tc.none': 'Ninguna plataforma elegida: nada que instalar.',
    'tc.override': 'Opcional: otro Python que el incluido.',
  },
});

/** The page's side: `toolchainCards(tc, onboarding, later)` (needs `esc`, `t`); the buttons post `tc*` messages. */
export const TC_JS = String.raw`
const TC = [{ id: 'python', name: 'Python', platforms: ['backend'], required: false }, { id: 'node', name: 'Node.js', platforms: ['backend', 'web'], required: false }, { id: 'flutter', name: 'Flutter', platforms: ['mobile'], required: true }];
/** The platforms the onboarding asks: the setting, else the workspace's projects, else all three. */
const tcPlatforms = (tc) => tc.platforms.length ? tc.platforms : tc.workspace.length ? tc.workspace : ['mobile', 'backend', 'web'];
function tcWhere(s) {
  if (s.where === 'broken') return t('tc.where.fails');
  if (s.where === 'missing' && s.path) return t('tc.where.broken');
  if (s.where === 'missing') return t('tc.where.missing');
  return t(s.id === 'python' && (s.where === 'included' || (s.where === 'nuclear' && /[\\/]ai[\\/]python[\\/]/.test(s.path || ''))) ? 'tc.where.included' : 'tc.where.' + s.where);
}
function toolchainCards(tc, onboarding, later) {
  const want = onboarding ? tcPlatforms(tc) : null;
  const list = TC.filter((x) => !want || x.platforms.some((p) => want.includes(p)));
  if (!list.length) return '<div class="muted">' + esc(t('tc.none')) + '</div>';
  return list.map((x) => {
    const s = tc.statuses.find((y) => y.id === x.id) || { id: x.id, where: 'missing' };
    const ok = s.where !== 'missing', set = !!(tc.paths[x.id] || '').trim();
    const mark = ok ? '<span class="ok">✓</span>' : (later || {})[x.id] ? '<span class="muted">○</span>' : '<span class="' + (x.required ? 'bad' : 'warn') + '">✗</span>';
    const btn = (type, label, primary) => '<button data-tc="' + type + '" data-tc-id="' + x.id + '"' + (primary ? ' class="primary"' : '') + '>' + esc(label) + '</button>';
    let buttons = '';
    if (onboarding && !ok) buttons = btn('tcBrowse', t('tc.myself')) + btn('tcInstall', t('tc.install'), true) + btn('tcLater', t('tc.later'));
    else if (onboarding) buttons = x.id === 'python' ? '' : btn('tcBrowse', t('tc.browse'));
    else buttons = btn('tcBrowse', t('tc.browse')) + (ok && (x.id === 'python' || s.where === 'nuclear') ? '' : btn('tcInstall', t('tc.install'), !ok)) + (tc.onPath[x.id] && tc.paths[x.id] !== tc.onPath[x.id] ? btn('tcPath', t('tc.usePath')) : '') + (set ? btn('tcClear', t('tc.default')) : '');
    return '<div class="card plain tc-card"><div class="row">' + mark + '<div class="grow"><b>' + esc(x.name) + '</b> <span class="muted">' + esc(t('tc.for.' + x.id)) + '</span>' + (x.required ? ' <span class="badge' + (ok ? '' : ' bad') + '">' + esc(t('tc.required')) + '</span>' : '')
      + '<div class="' + (ok ? 'muted' : x.required && !(later || {})[x.id] ? 'bad' : 'warn') + '">' + esc(tcWhere(s)) + (s.version ? ' · ' + esc(s.version) : '') + '</div>' + (s.path ? '<div class="line">' + esc(s.path) + '</div>' : '')
      + ((later || {})[x.id] && !ok ? '<div class="muted">' + esc(t('tc.laterNote', x.id)) + '</div>' : '') + '</div><div class="tc-btns">' + buttons + '</div></div></div>';
  }).join('');
}
function platformChecks(tc) {
  const on = tcPlatforms(tc);
  return '<div class="tc-plat">' + ['mobile', 'backend', 'web'].map((p) => '<label><input type="checkbox" data-tc-platform="' + p + '"' + (on.includes(p) ? ' checked' : '') + '> ' + esc(t('tc.p.' + p)) + '</label>').join('') + '</div>';
}
document.addEventListener('change', (e) => {
  if (!e.target.dataset || !e.target.dataset.tcPlatform) return;
  const platforms = [...document.querySelectorAll('[data-tc-platform]')].filter((x) => x.checked).map((x) => x.dataset.tcPlatform);
  vscode.postMessage({ type: 'tcPlatforms', platforms });
});
`;

export const TC_CSS = `
.tc-card .row { display: flex; gap: 12px; align-items: flex-start; width: 100%; } .tc-card .grow { flex: 1; min-width: 0; }
.tc-card .ok { color: var(--vscode-testing-iconPassed, #3fb950); } .tc-card .bad { color: var(--vscode-errorForeground); } .tc-card .warn { color: var(--vscode-editorWarning-foreground); } .tc-card .badge.bad { border-color: var(--vscode-errorForeground); }
.tc-card .line { font-family: var(--vscode-editor-font-family); font-size: 12px; opacity: .75; word-break: break-all; } .tc-btns { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; max-width: 60%; }
.tc-plat { display: flex; flex-wrap: wrap; gap: 8px 22px; margin: 8px 0 4px; } .tc-plat label { display: flex; gap: 6px; align-items: center; cursor: pointer; }
`;
