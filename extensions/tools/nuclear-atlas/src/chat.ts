// Nuclear Atlas without VS Code: the templates built from the project's map (the prompts to start from, put in the
// chat's composer by panel.ts). The conversation itself is Nuclear Chat's (`dm-atlas`, the project's `.nuclear/chat/`).

export interface Template {
  label: string;
  text: string;
}

/** The prompts to start from and their labels, in the editor's language (the agents and providers answer in either).
 * Atlas informs and routes (spec 023): no prompt asks it to do work; a task is asked of a team's tech lead. */
export const TEMPLATES = {
  en: {
    explain: 'Explain {0}', how: 'How {0} works', where: 'Where {0} reads its data', route: 'Who can do a task?', why: 'Why work with a team?', security: 'Security of {0}', kinds: 'Kinds of {0}', platform: 'the platform',
    'text.explain': 'Explain the component `{0}`: what it does and how its pieces fit together.',
    'text.how': 'How does `{0}` work, which errors can it return, and who calls it?',
    'text.where': 'Where does `{0}` get its data from, step by step?',
    'text.route': 'I want to … in {0}. Which team\'s tech lead should I ask, and which teams are free?', 'text.routeIn': 'the component `{0}`', 'text.routeNew': 'the project',
    'text.why': 'Why work with a team of the factory: how does it work, and what does it cost?',
    'text.security': 'Review the component `{0}` for security: validation, guards, secrets, errors that leak.',
    'text.kinds': 'Which kinds does the {0} platform have, and when do I use each one?', 'text.kindsOf': "project's",
    noTask: 'Atlas does not run tasks: ask a tech lead. {0}', noTaskNone: 'Atlas does not run tasks: ask a tech lead. No team has one yet: tell me what the team is for and I will help you make it.',
  },
  es: {
    explain: 'Explicar {0}', how: 'Cómo funciona {0}', where: 'De dónde lee {0} sus datos', route: '¿Quién puede hacer una tarea?', why: '¿Por qué trabajar con un equipo?', security: 'Seguridad de {0}', kinds: 'Tipos de {0}', platform: 'la plataforma',
    'text.explain': 'Explica el componente `{0}`: qué hace y cómo encajan sus piezas.',
    'text.how': '¿Cómo funciona `{0}`, qué errores puede devolver y quién lo llama?',
    'text.where': '¿De dónde saca `{0}` sus datos, paso a paso?',
    'text.route': 'Quiero … en {0}. ¿A qué tech lead de qué equipo se lo pido, y qué equipos están libres?', 'text.routeIn': 'el componente `{0}`', 'text.routeNew': 'el proyecto',
    'text.why': '¿Por qué trabajar con un equipo de la fábrica: cómo funciona y cuánto cuesta?',
    'text.security': 'Revisa la seguridad del componente `{0}`: validación, guards, secretos, errores que filtran datos.',
    'text.kinds': '¿Qué tipos tiene la plataforma {0} y cuándo uso cada uno?', 'text.kindsOf': 'del proyecto',
    noTask: 'Atlas no ejecuta tareas: pídeselo a un tech lead. {0}', noTaskNone: 'Atlas no ejecuta tareas: pídeselo a un tech lead. Aún ningún equipo tiene uno: dime para qué es el equipo y te ayudo a crearlo.',
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
  if (c) out.push({ label: label('security', c), text: label('text.security', c) });
  out.push({ label: label('route'), text: label('text.route', c ? label('text.routeIn', c) : L['text.routeNew']) });
  out.push({ label: label('why'), text: L['text.why'] });
  out.push({ label: label('kinds', platform || L.platform), text: label('text.kinds', platform || L['text.kindsOf']) });
  return out;
}

/** What Atlas says to a `/task` in its direct message (spec 023: Atlas does not run tasks): ask a tech lead, each
 * lead's conversation as a channel link (`#dm-<lead>`, which the chat opens) with its name and team. */
export function noTaskText(leads: { id: string; name: string; team: string }[], lang: 'en' | 'es' = 'en'): string {
  const L = TEMPLATES[lang];
  return leads.length ? L.noTask.replace('{0}', leads.map((l) => `#dm-${l.id} (${l.name}, ${l.team})`).join(' · ')) : L.noTaskNone;
}

export interface ChatRoot {
  root: string;
  name: string;
}

/** The folders Atlas's chat can open on, and the one it opens: the open workspace first (its own channel, the team
 * assigned to the whole workspace), then the projects, then the folder it was opened on that is not one (`extra`: the
 * welcome's folder); with none, the `fallback` (the welcome's folder), so the chat mounts before there is any app.
 * `current` stays when it is one of them; else the workspace's. A folder deleted from the disk is never one. */
export function chatRoots(projects: ChatRoot[], extra: ChatRoot | undefined, fallback: ChatRoot | undefined, current: string, workspace?: ChatRoot, exists: (dir: string) => boolean = () => true): { roots: ChatRoot[]; root: string } {
  const roots: ChatRoot[] = [];
  for (const r of [workspace, ...projects, extra]) if (r && exists(r.root) && !roots.some((x) => x.root === r.root)) roots.push(r);
  if (!roots.length && fallback) roots.push(fallback);
  return { roots, root: roots.some((r) => r.root === current) ? current : roots[0]?.root ?? '' };
}
