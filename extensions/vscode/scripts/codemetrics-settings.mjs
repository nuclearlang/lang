// Code metrics settings for the editors, from the single source of truth: `nuclear-lsp --codemetrics-defaults`
// (lsp/src/metrics.rs). Writes:
//   vscode/package.json                                the "Code Metrics" settings (nuclear.codemetrics.*)
//   vscode/package.nls.json, package.nls.es.json       their texts in English and Spanish
//   jetbrains/resources/codemetrics-defaults.json      the defaults the plugin's settings page shows
//
// Usage: node scripts/codemetrics-settings.mjs   (needs target/release/nuclear-lsp of the working tree)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// the extensions' folder: the server is built at the working tree's root, one level up
const editors = join(dirname(fileURLToPath(import.meta.url)), '../..');

export function writeCodeMetricsSettings() {
  const exe = process.platform === 'win32' ? 'nuclear-lsp.exe' : 'nuclear-lsp';
  const raw = execFileSync(join(editors, '..', 'target', 'release', exe), ['--codemetrics-defaults'], { encoding: 'utf8' });
  const defaults = JSON.parse(raw);

  // the JetBrains plugin's copy, when that repository is checked out beside this one
  const jb = join(editors, 'jetbrains', 'resources', 'codemetrics-defaults.json');
  if (existsSync(join(editors, 'jetbrains'))) {
    mkdirSync(dirname(jb), { recursive: true });
    writeFileSync(jb, JSON.stringify(defaults, null, 2) + '\n');
  }

  // the texts are %keys% of package.nls*.json: English from the server, Spanish from SPANISH below
  const en = {}, es = {};
  const text = (key, english, spanish) => {
    en[key] = english;
    es[key] = spanish ?? english;
    return `%${key}%`;
  };
  const properties = {};
  for (const [name, { default: value, description }] of Object.entries(defaults.basics)) {
    const p = { default: value, description: text(`codemetrics.basics.${name}`, description, SPANISH[name]) };
    if (typeof value === 'boolean') p.type = 'boolean';
    else if (typeof value === 'number') p.type = 'number';
    else if (Array.isArray(value)) Object.assign(p, { type: 'array', items: { type: 'string' } });
    else p.type = 'string';
    if (name.startsWith('ComplexityColor')) p.format = 'color-hex';
    properties[`nuclear.codemetrics.basics.${name}`] = p;
  }
  for (const [name, { default: cost, description, nuclear }] of Object.entries(defaults.nodeconfiguration)) {
    properties[`nuclear.codemetrics.nodeconfiguration.${name}`] = {
      type: 'number',
      default: cost,
      markdownDescription: text(`codemetrics.node.${name}`, `Complexity increment of ${nuclear}`, `Incremento de complejidad de ${nuclear}`),
    };
    properties[`nuclear.codemetrics.nodeconfiguration.${name}Description`] = {
      type: 'string',
      default: description,
      markdownDescription: text(`codemetrics.node.${name}Description`, `Text of ${nuclear} in the details list`, `Texto de ${nuclear} en la lista de detalles`),
    };
  }

  const pkgPath = join(editors, 'vscode', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const sections = Array.isArray(pkg.contributes.configuration)
    ? pkg.contributes.configuration
    : [pkg.contributes.configuration];
  // every section of the tools stays as it is; only the code metrics' one is written again
  const own = sections.filter((s) => !Object.keys(s.properties ?? {}).some((k) => k.startsWith('nuclear.codemetrics.')));
  pkg.contributes.configuration = [...own, { id: 'codemetrics', title: '%config.codemetrics%', order: own.length + 1, properties }];
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  for (const [file, texts, title] of [['package.nls.json', en, 'Code Metrics'], ['package.nls.es.json', es, 'Métricas de código']]) {
    const nlsPath = join(editors, 'vscode', file);
    const old = JSON.parse(readFileSync(nlsPath, 'utf8'));
    const kept = Object.fromEntries(Object.entries(old).filter(([k]) => !k.startsWith('codemetrics.')));
    writeFileSync(nlsPath, JSON.stringify({ ...kept, 'config.codemetrics': title, ...texts }, null, 2) + '\n');
  }
  console.log(`code metrics settings: ${Object.keys(properties).length} in package.json, defaults in ${jb}`);
}

/** The Spanish of the basic settings' descriptions (the server writes them in English). */
const SPANISH = {
  CodeLensEnabled: 'Indica si las métricas de código se muestran como code lens',
  CodeLensHiddenUnder: 'Umbral para mostrar el code lens de las métricas de código',
  ComplexityColorExtreme: 'Color del nivel de complejidad extremo',
  ComplexityColorHigh: 'Color del nivel de complejidad alto',
  ComplexityColorLow: 'Color del nivel de complejidad bajo',
  ComplexityColorNormal: 'Color del nivel de complejidad normal',
  ComplexityLevelExtreme: 'Umbral del nivel de complejidad extremo',
  ComplexityLevelExtremeDescription: 'Mensaje del code lens para el nivel de complejidad extremo',
  ComplexityLevelHigh: 'Umbral del nivel de complejidad alto',
  ComplexityLevelHighDescription: 'Mensaje del code lens para el nivel de complejidad alto',
  ComplexityLevelLow: 'Umbral del nivel de complejidad bajo',
  ComplexityLevelLowDescription: 'Mensaje del code lens para el nivel de complejidad bajo',
  ComplexityLevelNormal: 'Umbral del nivel de complejidad normal',
  ComplexityLevelNormalDescription: 'Mensaje del code lens para el nivel de complejidad normal',
  ComplexityTemplate: 'Plantilla del mensaje del code lens: {0} es el valor y {1} la descripción del nivel de complejidad',
  DecorationModeEnabled: 'Indica si las métricas de código se muestran como decoración en línea',
  DecorationTemplate: 'Plantilla de la decoración en línea de las métricas de código',
  DiagnosticsEnabled: 'Indica si las métricas de código se muestran como diagnósticos',
  Exclude: 'Patrones de exclusión (formato glob)',
  FileSizeLimitMB: 'Tamaño máximo de archivo en megabytes: por encima no se calculan las métricas; un número negativo admite cualquier tamaño',
  IgnoredFunctionNames: 'Nombres de funciones que no se cuentan',
  MetricsForArrowFunctionsToggled: 'Indica si hay métricas para las funciones flecha (también con un comando)',
  MetricsForClassDeclarationsToggled: 'Indica si hay métricas para las declaraciones de clase',
  MetricsForConstructorsToggled: 'Indica si hay métricas para los constructores',
  MetricsForEnumDeclarationsToggled: 'Indica si hay métricas para las declaraciones de enum',
  MetricsForFunctionDeclarationsToggled: 'Indica si hay métricas para las declaraciones de función',
  MetricsForFunctionExpressionsToggled: 'Indica si hay métricas para las expresiones de función',
  MetricsForMethodDeclarationsToggled: 'Indica si hay métricas para las declaraciones de método',
  OverviewRulerModeEnabled: 'Indica si las métricas de código se muestran en la regla de vista general',
};

if (process.argv[1] === fileURLToPath(import.meta.url)) writeCodeMetricsSettings();
