// Nuclear Atlas without VS Code: the templates built from the project's map (the prompts to start from, put in the
// chat's composer by panel.ts). The conversation itself is Nuclear Chat's (`dm-atlas`, the project's `.nuclear/chat/`).

export interface Template {
  label: string;
  text: string;
}

/** The labels of the prompts to start from, in the editor's language (the prompts stay English: the local agents'). */
const TEMPLATE_LABELS = {
  en: { explain: 'Explain {0}', how: 'How {0} works', where: 'Where {0} reads its data', feature: 'Add a feature', tests: 'Tests of {0}', bug: 'Fix a bug', security: 'Security of {0}', kinds: 'Kinds of {0}', platform: 'the platform' },
  es: { explain: 'Explicar {0}', how: 'Cómo funciona {0}', where: 'De dónde lee {0} sus datos', feature: 'Añadir una funcionalidad', tests: 'Pruebas de {0}', bug: 'Arreglar un fallo', security: 'Seguridad de {0}', kinds: 'Tipos de {0}', platform: 'la plataforma' },
};

/** Prompts to start from, filled with the project's own names (its map), so the first message is one click away. */
export function templatesOf(map: string, platform: string, lang: 'en' | 'es' = 'en'): Template[] {
  const L = TEMPLATE_LABELS[lang];
  const label = (k: keyof typeof L, v = '') => L[k].replace('{0}', v);
  const components = [...map.matchAll(/^## Component `([^`]+)`/gm)].map((m) => m[1]);
  const decl = (kind: string) => map.match(new RegExp(`^\\s+- ${kind} \`([A-Za-z0-9_]+)`, 'm'))?.[1];
  const c = components[0];
  const usecase = decl('usecase');
  const screen = decl('screen') ?? decl('controller');
  const out: Template[] = [];
  if (c) out.push({ label: label('explain', c), text: `Explain the component \`${c}\`: what it does and how its pieces fit together.` });
  if (usecase) out.push({ label: label('how', usecase), text: `How does \`${usecase}\` work, which errors can it return, and who calls it?` });
  if (screen) out.push({ label: label('where', screen), text: `Where does \`${screen}\` get its data from, step by step?` });
  out.push({ label: label('feature'), text: `/task Add to ${c ? `the component \`${c}\`` : 'a new component'} … Acceptance: …` });
  if (usecase) out.push({ label: label('tests', usecase), text: `/task Write the tests of \`${usecase}\`: the normal case, a missing row and a repeated one.` });
  out.push({ label: label('bug'), text: '/task Fix: when … it does … but it should …' });
  if (c) out.push({ label: label('security', c), text: `Review the component \`${c}\` for security: validation, guards, secrets, errors that leak.` });
  out.push({ label: label('kinds', platform || L.platform), text: `Which kinds does the ${platform || 'project\'s'} platform have, and when do I use each one?` });
  return out;
}
