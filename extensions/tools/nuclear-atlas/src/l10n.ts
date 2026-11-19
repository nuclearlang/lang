// The texts of the Nuclear Atlas page (panel.ts) and of what Atlas says in the chat, in English and Spanish. `noMap`
// holds the page's own markup (`<code>`): the page puts it in with innerHTML.
import { dictionary } from '../../../vscode/src/i18n';

export const ATLAS = dictionary({
  en: {
    project: 'The project',
    loading: 'Connecting to Nuclear Chat…',
    noProject: 'No Nuclear project open',
    noMap: 'This project has no map yet: run <code>nuclear check .</code> once so the agent knows its declarations.',
    taskEmpty: 'Write what to do after `/task`, and its acceptance criteria.',
    taskStarted: 'On it: run:{0}. Its stations are told in #{1}, each by the member who works it.',
    taskPassed: 'Done: every station of run:{0} passed.',
    taskWaits: 'run:{0} waits for you: {1} (answer it in its thread, or on the Builder page).',
    taskFailed: 'run:{0} failed: its thread says where; *Retry* on the Builder page goes on from there.',
    taskNotStarted: 'The run did not start: {0}',
  },
  es: {
    project: 'El proyecto',
    loading: 'Conectando con Nuclear Chat…',
    noProject: 'No hay ningún proyecto Nuclear abierto',
    noMap: 'Este proyecto aún no tiene mapa: ejecuta <code>nuclear check .</code> una vez para que el agente conozca sus declaraciones.',
    taskEmpty: 'Escribe qué hacer después de `/task`, y sus criterios de aceptación.',
    taskStarted: 'En ello: run:{0}. Sus estaciones se cuentan en #{1}, cada una por el miembro que la trabaja.',
    taskPassed: 'Hecho: pasaron todas las estaciones de run:{0}.',
    taskWaits: 'run:{0} te espera: {1} (respóndelo en su hilo, o en la página del Builder).',
    taskFailed: 'run:{0} falló: su hilo dice dónde; *Reintentar* en la página del Builder sigue desde ahí.',
    taskNotStarted: 'La ejecución no empezó: {0}',
  },
});
