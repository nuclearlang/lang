// The texts of the Nuclear workspace's welcome page and of a tool's template page (`workspace.ts`), built host-side.
import { dictionary } from './i18n';

export const WELCOME = dictionary({
  en: {
    title: 'Nuclear workspace',
    noProjects: 'No Nuclear project in this window yet: open one below, or a folder with a <code>config.nuc</code>.',
    lead: 'Everything of Nuclear meets in one place: the <b>Nuclear</b> container of the activity bar (<kbd>Ctrl+Alt+N</kbd>).',
    intro: `Every tab of its strip is a workspace of its own: a <b>project</b> (its files, and the actions of its platform: run,
debug, hot reload, device, build, test, check) or a <b>tool</b> (the HTTP client with its endpoints tree, the devices, …).
Switching tabs swaps the editor area; only the devices stay beside the code, like emulators. Opening a project adds a
tab, not a window. VS Code's explorer, search and git stay as they are; <i>Nuclear: Add the Active Project to the VS Code
Workspace</i> adds a tab's folder when you want them.`,
    projects: 'Projects',
    openTab: 'Open a project as a tab…',
    keyboard: 'Keyboard first',
    keyboardNote: 'Clicking a tab or an action shows the shortcut that does the same; the bindings can be changed in <i>Keyboard Shortcuts</i> (search "nuclear").',
    tools: 'Tools',
    templateTag: '(template)',
    startup: 'Startup',
    startupLabel: 'Show this page when VS Code starts with no editor open (<code>nuclear.workspace.welcome</code>)',
    scWorkspace: 'show the Nuclear workspace (the strip and the pane)',
    scTabs: 'the first to the ninth project tab',
    scOpen: 'open a project as a new tab',
    scRun: 'run, debug, hot reload the active project (what its platform has)',
    scBuild: 'build, test, check the active project',
    scPage: 'this page',
    toolShortcut: 'Shortcut <kbd>{0}</kbd> · the strip of the Nuclear workspace (<kbd>Ctrl+Alt+N</kbd>), at the bottom.',
    toolTemplate: '<b>This tool is a template.</b> The window layout is in place; what it will do:',
    openSettings: 'Open the extension settings for now',
  },
  es: {
    title: 'Espacio de trabajo Nuclear',
    noProjects: 'Aún no hay ningún proyecto Nuclear en esta ventana: abre uno abajo, o una carpeta con un <code>config.nuc</code>.',
    lead: 'Todo lo de Nuclear se reúne en un solo lugar: el contenedor <b>Nuclear</b> de la barra de actividades (<kbd>Ctrl+Alt+N</kbd>).',
    intro: `Cada pestaña de su franja es un espacio de trabajo propio: un <b>proyecto</b> (sus archivos y las acciones de su plataforma:
ejecutar, depurar, hot reload, dispositivo, compilar, probar, revisar) o una <b>herramienta</b> (el cliente HTTP con su árbol de
endpoints, los dispositivos, …). Cambiar de pestaña cambia el área del editor; solo los dispositivos se quedan junto al código,
como emuladores. Abrir un proyecto añade una pestaña, no una ventana. El explorador, la búsqueda y git de VS Code siguen igual;
<i>Nuclear: Add the Active Project to the VS Code Workspace</i> añade la carpeta de una pestaña cuando los quieras usar.`,
    projects: 'Proyectos',
    openTab: 'Abrir un proyecto como pestaña…',
    keyboard: 'Primero el teclado',
    keyboardNote: 'Al hacer clic en una pestaña o una acción se muestra el atajo que hace lo mismo; los atajos se cambian en <i>Métodos abreviados de teclado</i> (busca "nuclear").',
    tools: 'Herramientas',
    templateTag: '(plantilla)',
    startup: 'Inicio',
    startupLabel: 'Mostrar esta página cuando VS Code arranca sin ningún editor abierto (<code>nuclear.workspace.welcome</code>)',
    scWorkspace: 'mostrar el espacio de trabajo Nuclear (la franja y el panel)',
    scTabs: 'de la primera a la novena pestaña de proyecto',
    scOpen: 'abrir un proyecto en una pestaña nueva',
    scRun: 'ejecutar, depurar, hot reload del proyecto activo (lo que tenga su plataforma)',
    scBuild: 'compilar, probar, revisar el proyecto activo',
    scPage: 'esta página',
    toolShortcut: 'Atajo <kbd>{0}</kbd> · la franja del espacio de trabajo Nuclear (<kbd>Ctrl+Alt+N</kbd>), abajo.',
    toolTemplate: '<b>Esta herramienta es una plantilla.</b> La disposición de la ventana ya está; lo que hará:',
    openSettings: 'Abrir por ahora los ajustes de la extensión',
  },
});
