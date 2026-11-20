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
  /** This system (`process.platform`): the steps to install each toolchain are this system's. */
  os: NodeJS.Platform;
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
    os: process.platform,
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
    'tc.intro': 'What builds and runs each platform. Only the platforms you build need theirs: none is needed to write, check and build Nuclear. NuclearLang finds the ones already on this machine (its setting, the environment, its own, the PATH, the usual folders); Python comes with NuclearLang.',
    'tc.platforms': 'Which platforms will you build?',
    'tc.platformsHint': 'Only their toolchains are needed; the defaults come from the projects of this workspace. You can change it any time.',
    'tc.p.mobile': 'Mobile (Flutter)',
    'tc.p.backend': 'Backend (FastAPI or NestJS)',
    'tc.p.web': 'Web (React)',
    'tc.for.python': 'backend: fastapi',
    'tc.for.node': 'TypeScript, NestJS, React',
    'tc.for.flutter': 'mobile',
    'tc.required': 'needed for {0}',
    'tc.optional': 'only for {0}',
    'tc.how': 'How to install it',
    'tc.untested': 'Not tried yet on a clean {0}: if it stops, install it with the steps above.',
    'tc.choose': 'Choose the platforms you will build: no toolchain is needed until then.',
    'tc.os.darwin': 'Mac',
    'tc.os.linux': 'Linux',
    'tc.steps.flutter.darwin': 'Apple\'s command line tools: xcode-select --install\nFlutter: brew install --cask flutter (Homebrew), or the zip of docs.flutter.dev/get-started/install/macos unpacked in ~/development and its bin on your PATH\nCheck it in a new terminal: flutter doctor (iOS needs Xcode from the App Store; Android needs Android Studio)\nBack here: Check again',
    'tc.steps.flutter.linux': 'sudo snap install flutter --classic, or the archive of docs.flutter.dev/get-started/install/linux unpacked in ~/development and its bin on your PATH\nCheck it in a new terminal: flutter doctor (Android needs Android Studio)\nBack here: Check again',
    'tc.steps.flutter.win32': 'Follow docs.flutter.dev/get-started/install/windows (the SDK zip in C:\\src\\flutter, its bin on your Path)\nCheck it in a new terminal: flutter doctor\nBack here: Check again',
    'tc.steps.node.darwin': 'brew install node (Homebrew), or the LTS installer of nodejs.org\nCheck it in a new terminal: node --version (20 or newer)\nBack here: Check again',
    'tc.steps.node.linux': 'Your distribution\'s nodejs package (20 or newer), or the LTS of nodejs.org\nCheck it in a new terminal: node --version\nBack here: Check again',
    'tc.steps.node.win32': 'winget install OpenJS.NodeJS.LTS, or the LTS installer of nodejs.org\nCheck it in a new terminal: node --version\nBack here: Check again',
    'tc.steps.python.darwin': 'It comes with NuclearLang\'s AI services. Another one: brew install python@3.12, or python.org\nBack here: Check again',
    'tc.steps.python.linux': 'It comes with NuclearLang\'s AI services. Another one: your distribution\'s python3 (3.12 or newer)\nBack here: Check again',
    'tc.steps.python.win32': 'It comes with NuclearLang\'s AI services. Another one: winget install Python.Python.3.12, or python.org\nBack here: Check again',
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
    'tc.laterNote': 'Later: Settings and integrations › Toolchains (the editor says it again when a project needs it)',
    'tc.check': 'Check again',
    'tc.none': 'No platform chosen: nothing to install.',
    'tc.override': 'Optional: another Python than the one included.',
  },
  es: {
    'tc.title': 'Toolchains',
    'tc.intro': 'Lo que construye y ejecuta cada plataforma. Solo las plataformas que construyes necesitan la suya: ninguna hace falta para escribir, revisar y compilar Nuclear. NuclearLang encuentra las que ya están en esta máquina (su ajuste, el entorno, la suya, el PATH, las carpetas habituales); Python viene con NuclearLang.',
    'tc.platforms': '¿Qué plataformas vas a construir?',
    'tc.platformsHint': 'Solo hacen falta sus toolchains; los valores por defecto salen de los proyectos de este espacio de trabajo. Puedes cambiarlo cuando quieras.',
    'tc.p.mobile': 'Móvil (Flutter)',
    'tc.p.backend': 'Backend (FastAPI o NestJS)',
    'tc.p.web': 'Web (React)',
    'tc.for.python': 'backend: fastapi',
    'tc.for.node': 'TypeScript, NestJS, React',
    'tc.for.flutter': 'móvil',
    'tc.required': 'necesario para {0}',
    'tc.optional': 'solo para {0}',
    'tc.how': 'Cómo instalarla',
    'tc.untested': 'Aún no probado en un {0} limpio: si se detiene, instálala con los pasos de arriba.',
    'tc.choose': 'Elige las plataformas que vas a construir: ninguna toolchain hace falta hasta entonces.',
    'tc.os.darwin': 'Mac',
    'tc.os.linux': 'Linux',
    'tc.steps.flutter.darwin': 'Las herramientas de línea de comandos de Apple: xcode-select --install\nFlutter: brew install --cask flutter (Homebrew), o el zip de docs.flutter.dev/get-started/install/macos descomprimido en ~/development y su bin en tu PATH\nCompruébalo en una terminal nueva: flutter doctor (iOS necesita Xcode de la App Store; Android, Android Studio)\nDe vuelta aquí: Comprobar de nuevo',
    'tc.steps.flutter.linux': 'sudo snap install flutter --classic, o el archivo de docs.flutter.dev/get-started/install/linux descomprimido en ~/development y su bin en tu PATH\nCompruébalo en una terminal nueva: flutter doctor (Android necesita Android Studio)\nDe vuelta aquí: Comprobar de nuevo',
    'tc.steps.flutter.win32': 'Sigue docs.flutter.dev/get-started/install/windows (el zip del SDK en C:\\src\\flutter, su bin en tu Path)\nCompruébalo en una terminal nueva: flutter doctor\nDe vuelta aquí: Comprobar de nuevo',
    'tc.steps.node.darwin': 'brew install node (Homebrew), o el instalador LTS de nodejs.org\nCompruébalo en una terminal nueva: node --version (20 o más reciente)\nDe vuelta aquí: Comprobar de nuevo',
    'tc.steps.node.linux': 'El paquete nodejs de tu distribución (20 o más reciente), o el LTS de nodejs.org\nCompruébalo en una terminal nueva: node --version\nDe vuelta aquí: Comprobar de nuevo',
    'tc.steps.node.win32': 'winget install OpenJS.NodeJS.LTS, o el instalador LTS de nodejs.org\nCompruébalo en una terminal nueva: node --version\nDe vuelta aquí: Comprobar de nuevo',
    'tc.steps.python.darwin': 'Viene con los servicios de IA de NuclearLang. Otro: brew install python@3.12, o python.org\nDe vuelta aquí: Comprobar de nuevo',
    'tc.steps.python.linux': 'Viene con los servicios de IA de NuclearLang. Otro: el python3 de tu distribución (3.12 o más reciente)\nDe vuelta aquí: Comprobar de nuevo',
    'tc.steps.python.win32': 'Viene con los servicios de IA de NuclearLang. Otro: winget install Python.Python.3.12, o python.org\nDe vuelta aquí: Comprobar de nuevo',
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
    'tc.laterNote': 'Más tarde: Ajustes e integraciones › Toolchains (el editor lo vuelve a decir cuando un proyecto la necesite)',
    'tc.check': 'Comprobar de nuevo',
    'tc.none': 'Ninguna plataforma elegida: nada que instalar.',
    'tc.override': 'Opcional: otro Python que el incluido.',
  },
});

/** The page's side: `toolchainCards(tc, onboarding, later)` (needs `esc`, `t`); the buttons post `tc*` messages. */
export const TC_JS = String.raw`
// none is required by itself: a toolchain is needed only for the platforms the user builds (\`tcPlatforms\`)
const TC = [{ id: 'python', name: 'Python', platforms: ['backend'] }, { id: 'node', name: 'Node.js', platforms: ['backend', 'web'] }, { id: 'flutter', name: 'Flutter', platforms: ['mobile'] }];
/** The platforms the user builds: the setting, else the workspace's projects, else none (nothing is needed yet). */
const tcPlatforms = (tc) => tc.platforms.length ? tc.platforms : tc.workspace;
/** \`nuclear setup <id>\` installs NuclearLang's own on Linux and macOS (tried on a clean Linux only: Flutter). */
const tcCanInstall = (tc) => tc.os === 'linux' || tc.os === 'darwin';
function tcWhere(s) {
  if (s.where === 'broken') return t('tc.where.fails');
  if (s.where === 'missing' && s.path) return t('tc.where.broken');
  if (s.where === 'missing') return t('tc.where.missing');
  return t(s.id === 'python' && (s.where === 'included' || (s.where === 'nuclear' && /[\\/]ai[\\/]python[\\/]/.test(s.path || ''))) ? 'tc.where.included' : 'tc.where.' + s.where);
}
/** How to install a toolchain on this system, in steps; and when NuclearLang can install its own, that it was not tried there. */
function tcSteps(tc, x) {
  const steps = t('tc.steps.' + x.id + '.' + (tc.os === 'darwin' || tc.os === 'win32' ? tc.os : 'linux')).split('\n');
  const untested = tcCanInstall(tc) && x.id !== 'python' && !(x.id === 'flutter' && tc.os === 'linux') ? '<div class="muted">' + esc(t('tc.untested', t('tc.os.' + tc.os))) + '</div>' : '';
  return '<details class="tc-how"><summary>' + esc(t('tc.how')) + '</summary><ol>' + steps.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ol>' + untested + '</details>';
}
function toolchainCards(tc, onboarding, later) {
  const want = tcPlatforms(tc);
  const list = onboarding && want.length ? TC.filter((x) => x.platforms.some((p) => want.includes(p))) : TC;
  const head = onboarding && !want.length ? '<div class="muted">' + esc(t('tc.choose')) + '</div>' : '';
  return head + list.map((x) => {
    const s = tc.statuses.find((y) => y.id === x.id) || { id: x.id, where: 'missing' };
    const ok = s.where !== 'missing', set = !!(tc.paths[x.id] || '').trim();
    const needed = x.platforms.filter((p) => want.includes(p));
    const plats = (ps) => ps.map((p) => t('tc.p.' + p)).join(', ');
    const waiting = !ok && needed.length && !(later || {})[x.id];
    const mark = ok ? '<span class="ok">✓</span>' : waiting ? '<span class="warn">!</span>' : '<span class="muted">○</span>';
    const btn = (type, label, primary) => '<button data-tc="' + type + '" data-tc-id="' + x.id + '"' + (primary ? ' class="primary"' : '') + '>' + esc(label) + '</button>';
    const install = tcCanInstall(tc) && x.id !== 'python' ? btn('tcInstall', t('tc.install')) : '';
    let buttons = '';
    if (!ok) buttons = btn('tcBrowse', t('tc.myself'), !!waiting) + install + (onboarding ? btn('tcLater', t('tc.later')) : '') + (tc.onPath[x.id] ? btn('tcPath', t('tc.usePath')) : '');
    else if (onboarding) buttons = x.id === 'python' ? '' : btn('tcBrowse', t('tc.browse'));
    else buttons = btn('tcBrowse', t('tc.browse')) + (tc.onPath[x.id] && tc.paths[x.id] !== tc.onPath[x.id] ? btn('tcPath', t('tc.usePath')) : '') + (set ? btn('tcClear', t('tc.default')) : '');
    const badge = needed.length ? ' <span class="badge' + (waiting ? ' warn' : '') + '">' + esc(t('tc.required', plats(needed))) + '</span>' : ' <span class="badge">' + esc(t('tc.optional', plats(x.platforms))) + '</span>';
    return '<div class="card plain tc-card"><div class="row">' + mark + '<div class="grow"><b>' + esc(x.name) + '</b> <span class="muted">' + esc(t('tc.for.' + x.id)) + '</span>' + badge
      + '<div class="' + (ok ? 'muted' : waiting ? 'warn' : 'muted') + '">' + esc(tcWhere(s)) + (s.version ? ' · ' + esc(s.version) : '') + '</div>' + (s.path ? '<div class="line">' + esc(s.path) + '</div>' : '')
      + (ok ? '' : tcSteps(tc, x))
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
.tc-card .ok { color: var(--vscode-testing-iconPassed, #3fb950); } .tc-card .bad { color: var(--vscode-errorForeground); } .tc-card .warn { color: var(--vscode-editorWarning-foreground); } .tc-card .badge.warn { border-color: var(--vscode-editorWarning-foreground); }
.tc-how { margin-top: 6px; } .tc-how summary { cursor: pointer; } .tc-how ol { margin: 6px 0; padding-left: 20px; } .tc-how li { margin: 2px 0; user-select: text; }
.tc-card .line { font-family: var(--vscode-editor-font-family); font-size: 12px; opacity: .75; word-break: break-all; } .tc-btns { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; max-width: 60%; }
.tc-plat { display: flex; flex-wrap: wrap; gap: 8px 22px; margin: 8px 0 4px; } .tc-plat label { display: flex; gap: 6px; align-items: center; cursor: pointer; }
`;
