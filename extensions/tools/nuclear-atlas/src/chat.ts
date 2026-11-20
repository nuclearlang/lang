// Nuclear Atlas without VS Code: the templates built from the project's map (the prompts to start from, put in the
// chat's composer by panel.ts). The conversation itself is Nuclear Chat's (`dm-atlas`, the project's `.nuclear/chat/`).

export interface Template {
  label: string;
  text: string;
}

/** The prompts to start from and their labels, in the editor's language (the agents and providers answer in either). */
export const TEMPLATES = {
  en: {
    explain: 'Explain {0}', how: 'How {0} works', where: 'Where {0} reads its data', feature: 'Add a feature', tests: 'Tests of {0}', bug: 'Fix a bug', security: 'Security of {0}', kinds: 'Kinds of {0}', platform: 'the platform',
    'text.explain': 'Explain the component `{0}`: what it does and how its pieces fit together.',
    'text.how': 'How does `{0}` work, which errors can it return, and who calls it?',
    'text.where': 'Where does `{0}` get its data from, step by step?',
    'text.feature': '/task Add to {0} … Acceptance: …', 'text.featureIn': 'the component `{0}`', 'text.featureNew': 'a new component',
    'text.tests': '/task Write the tests of `{0}`: the normal case, a missing row and a repeated one.',
    'text.bug': '/task Fix: when … it does … but it should …',
    'text.security': 'Review the component `{0}` for security: validation, guards, secrets, errors that leak.',
    'text.kinds': 'Which kinds does the {0} platform have, and when do I use each one?', 'text.kindsOf': "project's",
  },
  es: {
    explain: 'Explicar {0}', how: 'Cómo funciona {0}', where: 'De dónde lee {0} sus datos', feature: 'Añadir una funcionalidad', tests: 'Pruebas de {0}', bug: 'Arreglar un fallo', security: 'Seguridad de {0}', kinds: 'Tipos de {0}', platform: 'la plataforma',
    'text.explain': 'Explica el componente `{0}`: qué hace y cómo encajan sus piezas.',
    'text.how': '¿Cómo funciona `{0}`, qué errores puede devolver y quién lo llama?',
    'text.where': '¿De dónde saca `{0}` sus datos, paso a paso?',
    'text.feature': '/task Añadir a {0} … Aceptación: …', 'text.featureIn': 'el componente `{0}`', 'text.featureNew': 'un componente nuevo',
    'text.tests': '/task Escribe las pruebas de `{0}`: el caso normal, una fila que falta y una repetida.',
    'text.bug': '/task Arreglar: cuando … hace … pero debería …',
    'text.security': 'Revisa la seguridad del componente `{0}`: validación, guards, secretos, errores que filtran datos.',
    'text.kinds': '¿Qué tipos tiene la plataforma {0} y cuándo uso cada uno?', 'text.kindsOf': 'del proyecto',
  },
};

/** Prompts to start from, filled with the project's own names (its map), so the first message is one click away. */
export function templatesOf(map: string, platform: string, lang: 'en' | 'es' = 'en'): Template[] {
  const L = TEMPLATES[lang];
  const label = (k: keyof typeof L, v = '') => L[k].replace('{0}', v);
  const components = [...map.matchAll(/^## Component `([^`]+)`/gm)].map((m) => m[1]);
  const decl = (kind: string) => map.match(new RegExp(`^\\s+- ${kind} \`([A-Za-z0-9_]+)`, 'm'))?.[1];
  const c = components[0];
  const usecase = decl('usecase');
  const screen = decl('screen') ?? decl('controller');
  const out: Template[] = [];
  if (c) out.push({ label: label('explain', c), text: label('text.explain', c) });
  if (usecase) out.push({ label: label('how', usecase), text: label('text.how', usecase) });
  if (screen) out.push({ label: label('where', screen), text: label('text.where', screen) });
  out.push({ label: label('feature'), text: label('text.feature', c ? label('text.featureIn', c) : L['text.featureNew']) });
  if (usecase) out.push({ label: label('tests', usecase), text: label('text.tests', usecase) });
  out.push({ label: label('bug'), text: L['text.bug'] });
  if (c) out.push({ label: label('security', c), text: label('text.security', c) });
  out.push({ label: label('kinds', platform || L.platform), text: label('text.kinds', platform || L['text.kindsOf']) });
  return out;
}

export interface ChatRoot {
  root: string;
  name: string;
}

/** The folders Atlas's chat can open on, and the one it opens: the projects, then the folder it was opened on that is
 * not one (`extra`: a workspace, the welcome's folder); with neither, the `fallback` (the open workspace, else the
 * welcome's folder), so the chat mounts before there is any app. `current` stays when it is one of them. */
export function chatRoots(projects: ChatRoot[], extra: ChatRoot | undefined, fallback: ChatRoot | undefined, current: string): { roots: ChatRoot[]; root: string } {
  const roots = [...projects, ...(extra && !projects.some((p) => p.root === extra.root) ? [extra] : [])];
  if (!roots.length && fallback) roots.push(fallback);
  return { roots, root: roots.some((r) => r.root === current) ? current : roots[0]?.root ?? '' };
}
