// The texts of the Nuclear Atlas page (panel.ts) and of what Atlas says in the chat, in English and Spanish. `noMap`
// holds the page's own markup (`<code>`): the page puts it in with innerHTML.
import { dictionary } from '../../../vscode/src/i18n';

export const ATLAS = dictionary({
  en: {
    project: 'The project',
    loading: 'Connecting to Nuclear Chat…',
    noProject: 'No Nuclear project open',
    role: 'Atlas explains Nuclear and your project. For work (code, specs, a project) it sends you to a team\'s tech lead and says which teams are free.',
    noMap: 'This project has no map yet: run <code>nuclear check .</code> once so the agent knows its declarations.',
    noProvider: 'No agent nor provider can answer on this machine: Atlas needs one (Claude Code, Codex, Gemini CLI, Cursor, OpenCode, Grok Build, or a model through an API with its key).',
    pickProvider: 'Pick one in Settings and integrations → Nuclear Builder (who works the chat)',
  },
  es: {
    project: 'El proyecto',
    loading: 'Conectando con Nuclear Chat…',
    noProject: 'No hay ningún proyecto Nuclear abierto',
    role: 'Atlas explica Nuclear y tu proyecto. Para el trabajo (código, specs, un proyecto) te envía al tech lead de un equipo y te dice qué equipos están libres.',
    noMap: 'Este proyecto aún no tiene mapa: ejecuta <code>nuclear check .</code> una vez para que el agente conozca sus declaraciones.',
    noProvider: 'Ningún agente ni proveedor puede responder en esta máquina: Atlas necesita uno (Claude Code, Codex, Gemini CLI, Cursor, OpenCode, Grok Build, o un modelo por API con su clave).',
    pickProvider: 'Elige uno en Ajustes e integraciones → Nuclear Builder (quién atiende el chat)',
  },
});
