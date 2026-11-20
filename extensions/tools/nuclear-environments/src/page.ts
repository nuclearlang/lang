// The Environments page's HTML: a strict CSP (a nonce), the theme's colours (and the `nuclearHttpConnections.*`
// ones of the extension, with VS Code's `charts.*` as fallbacks), so it reads in light, dark and the Chernobyl
// themes. Its script is pageScript.ts's, inlined by its source with `filterRows` of env.ts.

import { lang, langButton, pageI18n, texts } from '../../../vscode/src/i18n';
import { ENV_RE, filterRows, NAME_RE } from './env';
import { ICONS } from './icons';
import { ENV } from './l10n';
import { envPage } from './pageScript';

const CSS = /* css */ `
  :root {
    --c-env: var(--vscode-nuclearHttpConnections-platform, var(--vscode-charts-green, #89d185));
    --c-shared: var(--vscode-nuclearHttpConnections-project, var(--vscode-charts-yellow, #cca700));
    --c-file: var(--vscode-nuclearHttpConnections-get, var(--vscode-charts-blue, #75beff));
    --c-local: var(--vscode-nuclearHttpConnections-component, var(--vscode-charts-purple, #b180d7));
    --c-secret: var(--vscode-nuclearHttpConnections-put, var(--vscode-charts-yellow, #cca700));
    --c-client: var(--vscode-nuclearHttpConnections-patch, var(--vscode-charts-orange, #d18616));
    --c-miss: var(--vscode-errorForeground, var(--vscode-charts-red, #f14c4c));
    --line: var(--vscode-widget-border, color-mix(in srgb, var(--vscode-foreground) 14%, transparent));
    --soft: color-mix(in srgb, var(--vscode-foreground) 5%, transparent);
    --mono: var(--vscode-editor-font-family); --radius: 6px;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { display: flex; flex-direction: column; font-family: var(--vscode-font-family); font-size: 13px; color: var(--vscode-foreground); background: var(--vscode-editor-background); overflow: hidden; }
  [hidden] { display: none !important; }
  .ico { display: inline-flex; flex: none; } .ico svg { display: block; }
  button { font: inherit; font-size: 12px; color: inherit; background: none; border: 1px solid transparent; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; white-space: nowrap; }
  button:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground); }
  button:disabled { opacity: .45; cursor: default; }
  :focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
  button.icon { padding: 3px; opacity: .7; } button.icon:hover:not(:disabled) { opacity: 1; }
  button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); font-weight: 600; }
  button.primary:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
  button.toggle { border-color: var(--line); } button.toggle.on { border-color: var(--vscode-focusBorder); background: color-mix(in srgb, var(--vscode-focusBorder) 18%, transparent); }
  button.link { color: var(--vscode-textLink-foreground); padding: 0 3px; font-family: var(--mono); font-size: 11px; }
  button.link:hover { text-decoration: underline; background: none; }
  input, select { font-family: var(--mono); font-size: 12px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--line)); padding: 4px 7px; border-radius: 4px; min-width: 0; }
  select { font-family: inherit; }
  input:focus, select:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
  input.bad { outline: 1px solid var(--vscode-inputValidation-errorBorder, var(--c-miss)); }
  .bad-text { color: var(--c-miss); font-size: 12px; }
  kbd { font-family: var(--mono); font-size: 10px; padding: 1px 5px; border-radius: 3px; border: 1px solid var(--line); opacity: .75; }

  header { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px 14px; flex: none; background: var(--vscode-editorGroupHeader-tabsBackground); border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder, var(--line)); }
  h1 { display: flex; align-items: center; gap: 7px; margin: 0 6px 0 0; font-size: 13px; font-weight: 600; color: var(--c-env); }
  h1 .ico svg { width: 18px; height: 18px; }
  .pick { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; } .pick > span { opacity: .7; }
  .pick.proj .ico { color: var(--c-shared); } .pick.act .ico { color: var(--c-env); }
  .pick select { max-width: 220px; }
  .search { display: inline-flex; align-items: center; gap: 4px; position: relative; } .search > svg { position: absolute; left: 7px; opacity: .6; pointer-events: none; }
  .search input { padding-left: 26px; width: 190px; }
  .spacer { flex: 1; }
  #localBtn .ico { color: var(--c-local); } #missingBtn .ico { color: var(--c-miss); }
  #addVar .ico, #addEnv .ico { color: var(--c-env); }

  .sub { display: flex; align-items: center; gap: 14px; padding: 6px 14px; font-size: 12px; flex: none; }
  #summary { display: flex; align-items: center; gap: 14px; opacity: .85; } #summary .miss { display: inline-flex; gap: 5px; align-items: center; color: var(--c-miss); font-weight: 600; }
  #summary .busy { opacity: .7; font-style: italic; }
  #keys { opacity: .55; margin-left: auto; }
  .adder { display: flex; align-items: center; gap: 6px; padding: 6px 14px; flex: none; border-bottom: 1px solid var(--line); } .adder input { width: 240px; } .adder > .ico { color: var(--c-env); }

  .notice { display: flex; align-items: flex-start; gap: 10px; margin: 8px 14px 0; padding: 10px 12px; border-radius: var(--radius); border: 1px solid var(--line); flex: none; }
  .notice .text { flex: 1; min-width: 0; } .notice pre { margin: 4px 0 0; font-family: var(--mono); font-size: 12px; white-space: pre-wrap; word-break: break-word; }
  .notice.err { border-color: var(--vscode-inputValidation-errorBorder, var(--c-miss)); background: var(--vscode-inputValidation-errorBackground, color-mix(in srgb, var(--c-miss) 10%, transparent)); } .notice.err > .ico { color: var(--c-miss); }
  .notice.warn { border-color: var(--vscode-inputValidation-warningBorder, var(--c-secret)); background: var(--vscode-inputValidation-warningBackground, color-mix(in srgb, var(--c-secret) 10%, transparent)); } .notice.warn > .ico { color: var(--c-secret); }

  main { flex: 1; min-height: 0; overflow: auto; padding: 4px 14px 70px; }
  .empty { margin: 40px auto; max-width: 440px; text-align: center; opacity: .75; line-height: 1.6; }
  table.grid { border-collapse: separate; border-spacing: 0; min-width: 100%; }
  table.grid th, table.grid td { border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
  thead th { position: sticky; top: 0; z-index: 2; background: var(--vscode-editor-background); padding: 8px 10px 6px; font-weight: 600; border-bottom: 2px solid var(--line); }
  thead th.corner { left: 0; z-index: 3; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; opacity: .7; vertical-align: bottom; }
  th.col { min-width: 170px; } th.col.active { border-bottom-color: var(--c-env); }
  .colhead { display: flex; align-items: center; gap: 6px; } .colhead .ico { color: var(--c-file); } th.shared .colhead .ico { color: var(--c-shared); } th.active .colhead > .ico { color: var(--c-env); }
  .colhead .cname { font-family: var(--mono); } .colhead button { margin-left: auto; }
  .tag { font-size: 10px; font-weight: 600; padding: 0 6px; border-radius: 8px; line-height: 16px; color: var(--vscode-badge-foreground); background: var(--c-env); }
  .file { font-family: var(--mono); font-size: 10.5px; font-weight: 400; opacity: .55; margin-top: 2px; }
  tbody th.name { position: sticky; left: 0; z-index: 1; background: var(--vscode-editor-background); padding: 7px 12px 7px 10px; min-width: 240px; max-width: 360px; font-weight: 400; border-right: 1px solid var(--line); }
  .vname { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; } .vname code { font-family: var(--mono); font-size: 12.5px; font-weight: 600; margin-right: 3px; }
  .uses { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 4px; margin-top: 3px; font-size: 11px; } .dim { opacity: .55; } .uses .ico svg { width: 12px; height: 12px; }
  .badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; padding: 0 6px 0 4px; line-height: 16px; border-radius: 8px; border: 1px solid color-mix(in srgb, currentColor 40%, transparent); background: color-mix(in srgb, currentColor 10%, transparent); }
  .badge svg, .src svg { width: 11px; height: 11px; }
  .b-required { color: var(--c-file); } .b-missing { color: var(--c-miss); font-weight: 600; } .b-secret { color: var(--c-secret); } .b-client { color: var(--c-client); } .b-unused { color: var(--vscode-descriptionForeground); border-style: dashed; }
  tr.row-missing th.name { box-shadow: inset 3px 0 0 var(--c-miss); }
  tr.row-unused th.name code { opacity: .7; }
  td.cell { padding: 6px 10px; cursor: text; min-width: 170px; max-width: 320px; }
  td.cell.active { background: color-mix(in srgb, var(--c-env) 4%, transparent); }
  tr:hover td.cell, tr:hover th.name { background: var(--vscode-list-hoverBackground); }
  td.cell:focus, th.name:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; background: var(--vscode-list-focusBackground, var(--soft)); }
  .val { display: flex; align-items: center; gap: 5px; min-height: 18px; } .v { font-family: var(--mono); font-size: 12px; overflow-wrap: anywhere; } .v.mask { letter-spacing: .1em; }
  .ph { font-family: var(--mono); font-size: 12px; opacity: .45; font-style: italic; }
  .miss { color: var(--c-miss); } .ph.miss { opacity: 1; font-style: normal; font-weight: 600; } .sec { color: var(--c-secret); }
  td.cell.missing { background: color-mix(in srgb, var(--c-miss) 7%, transparent); }
  .meta { display: flex; align-items: center; gap: 4px; margin-top: 3px; } .meta .del { margin-left: auto; opacity: 0; } td.cell:hover .del, td.cell:focus-within .del, td.cell:focus .del { opacity: .7; }
  .src { display: inline-flex; align-items: center; gap: 3px; font-family: var(--mono); font-size: 10px; padding: 0 6px; line-height: 15px; border-radius: 8px; border: 1px solid color-mix(in srgb, currentColor 35%, transparent); background: color-mix(in srgb, currentColor 9%, transparent); }
  .s-shared { color: var(--c-shared); } .s-file { color: var(--c-file); } .s-local { color: var(--c-local); } .s-keyring { color: var(--c-secret); } .s-process { color: var(--vscode-descriptionForeground); border-style: dashed; }
  td.editing { background: var(--vscode-editorWidget-background, var(--soft)); } td.editing input:not([type="checkbox"]) { width: 100%; }
  .lock { display: flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 11px; cursor: pointer; } .lock .ico { color: var(--c-secret); } .lock svg { width: 12px; height: 12px; }
  .hint { font-size: 10.5px; opacity: .55; margin-top: 2px; }
`;

const RE = { name: NAME_RE.source, env: ENV_RE.source };

export function envPageHtml(): string {
  const nonce = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('');
  const L = texts(ENV);
  const I = ICONS;
  const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
  return /* html */ `<!DOCTYPE html>
<html lang="${lang()}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>${CSS}</style>
</head>
<body>
<header>
  <h1>${I.env}<span>${L.title}</span></h1>
  <label class="pick proj">${I.project}<span>${L.project}</span><select id="project" aria-label="${L.project}"></select></label>
  <label class="pick act" id="activeBox" title="${L.activeTitle}">${I.active}<span>${L.active}</span><select id="active" aria-label="${L.activeTitle}"></select></label>
  <span class="spacer"></span>
  <label class="search">${I.search}<input id="filter" type="search" placeholder="${L.search}" aria-label="${L.search}" spellcheck="false"></label>
  <button type="button" class="toggle" id="missingBtn" aria-pressed="false">${I.missing}<span>${L.missingOnly}</span></button>
  <button type="button" class="toggle" id="localBtn" aria-pressed="false" title="${L.localTitle}">${I.local}<span>${L.local}</span></button>
  <button type="button" id="addVar" title="${L.addVarTitle}">${I.plus}<span>${L.addVar}</span></button>
  <button type="button" id="addEnv" title="${L.addEnvTitle}">${I.plus}<span>${L.addEnv}</span></button>
  <button type="button" class="icon" id="refresh" title="${L.refresh}" aria-label="${L.refresh}">${I.refresh}</button>
  ${langButton()}
</header>
<div class="adder" id="adder" hidden></div>
<div class="notice" id="notice" role="alert" hidden></div>
<div class="sub"><div id="summary" aria-live="polite"></div><span id="keys">${L.keys}</span></div>
<main>
  <div class="empty" id="loading">${L.loading}</div>
  <div class="empty" id="noProjects" hidden>${L.noProjects}</div>
  <div id="gridWrap"></div>
</main>
<script nonce="${nonce}">
${pageI18n(ENV)}
(${envPage.toString()})({ t, vscode }, { filterRows: ${filterRows.toString()} }, ${json(ICONS)}, ${json(RE)});
</script>
</body>
</html>`;
}
