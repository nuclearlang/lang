// The company screen and a team's screen (spec 011, design.md "Teams", requirements 26-30), drawn as a cyberpunk HUD in
// the platform's colours: thin neon frames, corner brackets, monospace labels, dark panels (light ones in a light
// theme). The company: every team as a framed panel (its logo in a hexagon, its five operatives, what it works on as
// status lines, its run's budget as a gauge); a panel opens the team. *New team* opens the wizard (ADR-platform-0010):
// five steps, Next, Next — identity (logo, a name with the name dice, description), purpose and skills, the members
// suggested, the roster to add from (filters, several at once, any number per role), who works each member (local by
// default, a paid one said as such, the cost warning) — then `team create`. A team: its members grouped by role (N per
// role, the roles it lacks flagged), the selected member's character sheet (the portrait, who they are, their
// temperament, who works them, the stats as segmented bars, the dossier) with its settings in tabs (the person, who
// does the work, the skills, instructions, behaviours and tasks), and the role's hiring pool as a grid of portraits
// with an inspector. The page only draws and sends the user's choices (`team:*` messages); the host (host.ts) talks to
// `nuclear-builder team`. Mounted whole in its own panel (panel.ts) or as a step of the onboarding: `Squad.mount(el,
// post, { company })`, then `Squad.receive(message)`. Plain HTML and script; its texts are the page's `t('sq.…')`
// (l10n.ts); what it computes is hud.ts's, tested.
import { initials, teamColor } from '../workbench';
import { budgetGauge, filterRoster, statLevel } from './hud';
import { differences, draftOf, filterPool, missingRoles, paidMembers, roleCounts, rosterSkills, sameForAll } from './wizard';
import { libraryGroups, mdHtml, memberSkills, skillFields, skillMarkdown, skillSlug } from './skills';

const CUT = 'polygon(var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut))';
const HEX = 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)';
// the corner brackets: eight thin bars, two per corner, over a panel's frame
const BRACKETS = ['0 0/12px 2px', '0 0/2px 12px', '100% 0/12px 2px', '100% 0/2px 12px', '0 100%/12px 2px', '0 100%/2px 12px', '100% 100%/12px 2px', '100% 100%/2px 12px'].map((p) => 'linear-gradient(var(--brk), var(--brk)) ' + p).join(', ');

export const SQUAD_CSS = String.raw`
.sq { --hud: #a7ff00; --hud2: #2fe0f0; --warn: #ffd600; --bad: #ff4b4b; --on-hud: #071006;
  --bg: var(--vscode-editor-background, #0b0f0b); --fg: var(--vscode-foreground, #d9e4d2); --mut: var(--vscode-descriptionForeground, #8a9a8a);
  --panel: color-mix(in srgb, var(--bg) 93%, var(--hud)); --panel2: color-mix(in srgb, var(--bg) 86%, var(--hud));
  --line: color-mix(in srgb, var(--hud) 24%, transparent); --line2: color-mix(in srgb, var(--hud) 50%, transparent); --grid: color-mix(in srgb, var(--hud) 5%, transparent);
  --mono: var(--vscode-editor-font-family, ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace); --brk: var(--hud); --cut: 8px;
  display: grid; grid-template-columns: minmax(330px, 400px) minmax(0, 1fr); align-content: start; gap: 12px; height: 100%; min-height: 0; overflow: auto; padding: 2px 4px 16px 2px;
  color: var(--fg); font: 13px/1.45 var(--vscode-font-family, system-ui, sans-serif);
  background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px); background-size: 24px 24px; }
.vscode-light .sq { --hud: #3d7a00; --hud2: #00838f; --warn: #a86b00; --bad: #c62828; --on-hud: #fff; --panel: color-mix(in srgb, var(--bg) 96%, var(--hud)); --panel2: color-mix(in srgb, var(--bg) 91%, var(--hud)); --line: color-mix(in srgb, var(--hud) 30%, transparent); }
.vscode-high-contrast .sq { --line: var(--vscode-contrastBorder, #fff); --line2: var(--vscode-contrastBorder, #fff); --grid: transparent; }
.sq * { box-sizing: border-box; }
.sq button, .sq select, .sq input, .sq textarea { font: inherit; color: var(--vscode-input-foreground, var(--fg)); background: var(--vscode-input-background, var(--panel2)); border: 1px solid var(--vscode-input-border, var(--line)); border-radius: 2px; padding: 5px 8px; }
.sq input:focus, .sq select:focus, .sq textarea:focus { border-color: var(--hud); outline: none; box-shadow: 0 0 0 1px var(--hud); }
/* the native lists drawn in the page's scheme: never a white list or a white autofilled field */
.sq { color-scheme: dark; } .vscode-light .sq { color-scheme: light; }
.sq option, .sq optgroup { background: var(--vscode-dropdown-background, var(--bg)); color: var(--vscode-dropdown-foreground, var(--fg)); }
.sq input:-webkit-autofill { -webkit-text-fill-color: var(--vscode-input-foreground, var(--fg)); box-shadow: 0 0 0 40px var(--vscode-input-background, var(--panel2)) inset; }
.sq-model { display: flex; gap: 6px; min-width: 0; } .sq-model select { flex: 1; min-width: 0; } .sq-model input { flex: 1; min-width: 90px; }
.sq select.ram-warn { border-color: var(--warn); color: var(--warn); } .sq select.ram-bad { border-color: var(--bad); color: var(--bad); box-shadow: 0 0 0 1px var(--bad); }
.sq option.ram-warn { color: var(--warn); } .sq option.ram-bad { color: var(--bad); }
.sq-ram { grid-column: 1 / -1; font-size: 12px; padding: 5px 8px; border-left: 3px solid var(--warn); color: var(--warn); background: color-mix(in srgb, var(--warn) 8%, transparent); }
.sq-ram.bad { border-left-color: var(--bad); color: var(--bad); background: color-mix(in srgb, var(--bad) 10%, transparent); font-weight: 600; }
.mp-brain .sq-ram, .mp-brain .sq-model { grid-column: 2; } .wz-same .sq-ram { flex-basis: 100%; }
.sq-ask { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; background: #000a; }
.sq-ask > div { max-width: 460px; margin: 16px; padding: 16px 18px; background: var(--vscode-editor-background, var(--bg)); border: 1px solid var(--bad); --brk: var(--bad); box-shadow: 0 10px 40px #000a; }
.sq-ask h3 { margin: 0 0 8px; color: var(--bad); font: 700 14px var(--mono); letter-spacing: .06em; text-transform: uppercase; }
.sq-ask p { margin: 0 0 6px; font-size: 13px; } .sq-ask .sq-row { justify-content: flex-end; margin-top: 12px; }
.sq button { cursor: pointer; background: transparent; color: var(--fg); border: 1px solid var(--line2); font: 600 10.5px/1.5 var(--mono); text-transform: uppercase; letter-spacing: .09em; padding: 5px 10px; transition: background .15s, border-color .15s, color .15s; }
.sq button:hover:not(:disabled) { border-color: var(--hud); background: color-mix(in srgb, var(--hud) 12%, transparent); color: var(--fg); }
.sq button:disabled { opacity: .5; cursor: default; }
.sq button.primary { background: var(--hud); border-color: var(--hud); color: var(--on-hud); }
.sq button.primary:hover:not(:disabled) { background: color-mix(in srgb, var(--hud) 85%, var(--fg)); color: var(--on-hud); }
.sq button.danger:hover:not(:disabled) { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 14%, transparent); color: var(--bad); }
.sq :focus-visible { outline: 1px solid var(--hud); outline-offset: 2px; box-shadow: 0 0 0 3px color-mix(in srgb, var(--hud) 25%, transparent); }
.sq-muted { color: var(--mut); }
.mono { font-family: var(--mono); }
.sq-grow { flex: 1; }
/* the HUD's pieces: a framed panel, its corner brackets, its header strip, a tag, a LED */
.hud { position: relative; background: var(--panel); border: 1px solid var(--line); }
.brk::before { content: ''; position: absolute; inset: -1px; pointer-events: none; z-index: 1; background: ${BRACKETS}; background-repeat: no-repeat; }
.hs { display: flex; align-items: center; gap: 7px; min-width: 0; overflow: hidden; padding: 6px 12px; border-bottom: 1px solid var(--line); font: 600 10.5px/1.4 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--hud);
  background: linear-gradient(90deg, color-mix(in srgb, var(--hud) 13%, transparent), transparent 75%); white-space: nowrap; }
.hs > span { flex-shrink: 0; } .hs > span.fit { flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; } .hs i { font-style: normal; color: var(--mut); }
.hs .sq-grow { min-width: 4px; }
.tag { display: inline-flex; align-items: center; gap: 4px; padding: 1px 6px; border: 1px solid var(--line2); font: 600 9.5px/1.5 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--fg); white-space: nowrap; --cut: 4px; clip-path: ${CUT}; }
.tag.lead { background: var(--hud); border-color: var(--hud); color: var(--on-hud); }
.tag.tmp { border-color: color-mix(in srgb, var(--hud2) 55%, transparent); color: color-mix(in srgb, var(--hud2) 70%, var(--fg)); }
.tag.def { border-color: color-mix(in srgb, var(--warn) 60%, transparent); color: color-mix(in srgb, var(--warn) 75%, var(--fg)); }
.led { display: inline-block; width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--mut); }
.led.on, .led.st-passed { background: var(--hud); box-shadow: 0 0 6px var(--hud); }
.led.paid, .led.st-running, .led.st-waiting { background: var(--warn); box-shadow: 0 0 6px var(--warn); }
.led.off, .led.st-failed { background: var(--bad); box-shadow: 0 0 6px var(--bad); }
.led.st-stopped, .led.st-pending, .led.st-skipped, .led.idle { background: color-mix(in srgb, var(--mut) 60%, transparent); }
.lbl { font: 600 9.5px/1.4 var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--mut); }
/* a portrait: square, angled corners, the role's colour as a thin rim; its initials in a frame without one */
.pf { --s: 40px; position: relative; display: inline-block; flex-shrink: 0; width: var(--s); height: var(--s); padding: 1.5px; clip-path: ${CUT};
  background: linear-gradient(135deg, var(--rc, var(--hud)), color-mix(in srgb, var(--rc, var(--hud)) 25%, transparent) 50%, var(--rc, var(--hud))); }
.pf .face { display: grid; place-items: center; width: 100%; height: 100%; object-fit: cover; clip-path: ${CUT}; background: var(--panel2); }
.pf .ini { font: 700 calc(var(--s) * .3) / 1 var(--mono); letter-spacing: .04em; color: color-mix(in srgb, var(--rc, var(--hud)) 70%, var(--fg)); }
.pf.scan::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, transparent 0 2px, rgb(0 0 0 / .18) 2px 3px), linear-gradient(180deg, transparent 55%, color-mix(in srgb, var(--rc, var(--hud)) 30%, transparent)); }
.pf.vacant { background: repeating-linear-gradient(135deg, var(--line) 0 4px, transparent 4px 8px); }
.pf.vacant .face { color: var(--mut); font: 600 calc(var(--s) * .4) / 1 var(--mono); }
/* a team's logo in a hexagon */
.hex { --s: 44px; display: inline-grid; flex-shrink: 0; width: var(--s); height: calc(var(--s) * .9); padding: 1.5px; background: var(--hud); clip-path: ${HEX}; }
.hex > * { width: 100%; height: 100%; display: grid; place-items: center; clip-path: ${HEX}; object-fit: cover; color: #fff; font: 700 calc(var(--s) * .32) / 1 var(--mono); letter-spacing: .03em; }
/* the bar: the team, its actions */
.sq-bar { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 12px; }
.sq-team { display: flex; flex-direction: column; margin-right: 6px; }
.sq-team select { font-size: 14px; font-weight: 600; padding: 2px 6px; min-width: 200px; }
.sq-saved { font: 10.5px var(--mono); letter-spacing: .06em; color: var(--mut); text-transform: uppercase; }
.sq-saved.on { color: var(--hud); }
.sq-menu { position: relative; } .sq-pop { display: none; position: absolute; top: 110%; left: 0; z-index: 20; min-width: 270px; background: var(--vscode-menu-background, var(--panel)); border: 1px solid var(--line2); padding: 4px; box-shadow: 0 10px 30px #0008; }
.sq-pop.open { display: block; } .sq-pop a { display: block; padding: 7px 10px; cursor: pointer; } .sq-pop a:hover { background: color-mix(in srgb, var(--hud) 12%, transparent); } .sq-pop a small { display: block; color: var(--mut); }
.sq-logobtn { padding: 0 !important; border: none !important; background: none !important; line-height: 0; }
.sq-logobtn:hover .hex { background: var(--hud2); }
.sq-logoclear { padding: 0 5px !important; margin-left: -6px; border: none !important; align-self: flex-start; color: var(--mut) !important; }
.sq-about { grid-column: 1 / -1; margin-top: -6px; } .sq-about input { width: 100%; background: transparent; border-color: transparent; color: var(--mut); padding: 4px 8px; } .sq-about input:hover, .sq-about input:focus { border-color: var(--line); color: var(--fg); background: var(--vscode-input-background); }
/* the operations roster: the five slots in station order */
.op-list { align-self: start; position: sticky; top: 0; z-index: 3; }
.op-slot { position: relative; display: grid; grid-template-columns: 20px 52px minmax(0, 1fr) auto; gap: 4px 10px; align-items: center; padding: 9px 12px 9px 10px; border-bottom: 1px solid var(--line); cursor: pointer; transition: background .15s; }
.op-slot:last-child { border-bottom: none; }
.op-slot::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: var(--rc); opacity: .5; }
.op-slot:hover { background: color-mix(in srgb, var(--rc) 7%, transparent); }
.op-slot.sel { background: linear-gradient(90deg, color-mix(in srgb, var(--rc) 16%, transparent), transparent 80%); }
.op-slot.sel::before { opacity: 1; box-shadow: 0 0 8px var(--rc); }
.op-slot.drop { outline: 1px dashed var(--hud); outline-offset: -3px; background: color-mix(in srgb, var(--hud) 10%, transparent); }
.op-n { font: 600 11px var(--mono); color: var(--mut); align-self: start; padding-top: 2px; }
.op-who { min-width: 0; display: grid; gap: 2px; }
.op-who b { font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.op-who .lbl { color: color-mix(in srgb, var(--rc) 65%, var(--fg)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.op-meta { display: flex; gap: 6px; align-items: center; min-width: 0; }
.op-meta .mono { font-size: 11px; color: var(--mut); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.op-st { display: grid; justify-items: end; gap: 6px; align-self: start; padding-top: 3px; }
/* the member's profile: a summed-up LinkedIn profile as a HUD (requirement 31) */
.sq-side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.li-banner { position: relative; height: 92px; overflow: hidden; padding: 10px 14px; display: flex; justify-content: space-between; align-items: flex-start;
  --night: #070a06; background: linear-gradient(180deg, transparent 40%, rgb(7 10 6 / .7)),
    repeating-linear-gradient(90deg, rgb(7 10 6 / .9) 0 14px, transparent 14px 17px, rgb(7 10 6 / .9) 17px 23px, transparent 23px 41px, rgb(7 10 6 / .9) 41px 52px, transparent 52px 57px) bottom / 100% 30% no-repeat,
    repeating-linear-gradient(90deg, rgb(7 10 6 / .55) 0 26px, transparent 26px 33px, rgb(7 10 6 / .55) 33px 40px, transparent 40px 61px) bottom / 100% 56% no-repeat,
    linear-gradient(115deg, color-mix(in srgb, var(--rc) 60%, var(--night)) 0%, color-mix(in srgb, #2fe0f0 32%, var(--night)) 55%, color-mix(in srgb, #a7ff00 24%, var(--night)) 100%); }
.li-banner::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, transparent 0 2px, rgb(0 0 0 / .12) 2px 3px); }
.li-banner .eyebrow { position: relative; z-index: 1; font: 600 10.5px/1.3 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: #fff; text-shadow: 0 0 8px var(--rc), 0 1px 2px #000; }
.li-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 4px 16px; padding: 0 16px 12px; border-bottom: 1px solid var(--line); }
.li-pf { --s: 128px; --cut: 12px; margin-top: -56px; z-index: 2; padding: 2px; }
.li-pf::before { content: attr(data-code); position: absolute; left: 0; bottom: 0; z-index: 3; padding: 2px 8px 2px 6px; background: var(--rc); color: #0b0f0b; font: 700 9.5px/1.4 var(--mono); letter-spacing: .1em; }
.li-id { min-width: 0; padding-top: 10px; display: flex; flex-direction: column; gap: 4px; }
.li-id h2 { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 22px; line-height: 1.15; font-weight: 750; letter-spacing: -.01em; }
.li-headline { font-size: 13.5px; } .li-headline span { color: var(--mut); }
.li-meta { font: 11.5px var(--mono); color: var(--mut); } .li-meta b { color: var(--hud); font-weight: 600; }
.li-act { padding-top: 12px; display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
.li-cols { display: grid; grid-template-columns: minmax(0, 1fr) 250px; }
.li-main { min-width: 0; } .li-rail { border-left: 1px solid var(--line); min-width: 0; }
.li-sec { padding: 12px 16px; border-bottom: 1px solid var(--line); } .li-sec:last-child { border-bottom: none; }
.li-sec > .lbl { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--hud); }
.li-sec > .lbl::after { content: ''; flex: 1; height: 1px; background: var(--line); }
.li-sec p { margin: 0; font-size: 12.5px; }
.li-item { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; padding: 6px 0; font-size: 12px; }
.li-item + .li-item { border-top: 1px dashed var(--line); }
.li-item b { font-size: 13px; } .li-item .mono { font-size: 11px; color: var(--mut); }
.li-logo { width: 34px; height: 34px; display: grid; place-items: center; color: #fff; font: 700 11px var(--mono); --cut: 6px; clip-path: ${CUT}; }
.sq button.li-rec { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; width: 100%; text-align: left; padding: 9px 10px; margin-top: 6px; font: inherit; text-transform: none; letter-spacing: 0; border: 1px solid var(--line); background: var(--panel2); }
.li-rec q { display: block; font-size: 12.5px; font-style: italic; } .li-rec small { display: block; margin-top: 4px; color: var(--mut); font: 10.5px var(--mono); letter-spacing: .06em; text-transform: uppercase; }
.li-feed { display: grid; grid-template-columns: 7px minmax(0, 1fr) auto; gap: 4px 8px; align-items: center; font-size: 12px; padding: 3px 0; }
.li-feed small { font: 10.5px var(--mono); color: var(--mut); }
.li-none { font-size: 12px; color: var(--mut); padding: 6px 10px; border: 1px dashed var(--line); }
.li-skill { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 8px; padding: 4px 0; font-size: 12.5px; } .li-skill small { font: 10.5px var(--mono); color: var(--mut); }
.li-skill .gauge { grid-column: 1 / -1; }
.sq button.li-link { border: none; padding: 4px 0 0; color: var(--hud); }
.li-open { padding: 8px 10px; border: 1px solid color-mix(in srgb, var(--hud) 45%, transparent); background: color-mix(in srgb, var(--hud) 8%, transparent); font-size: 12.5px; }
.li-hr { position: relative; margin-top: 4px; padding: 16px 10px 8px; border: 1px dashed color-mix(in srgb, var(--bad) 55%, transparent); font-size: 12px; color: var(--mut); }
.li-hr::before { content: attr(data-stamp); position: absolute; top: -9px; left: 8px; padding: 1px 7px; background: var(--panel); border: 1.5px solid var(--bad); color: var(--bad); font: 700 9.5px/1.4 var(--mono); letter-spacing: .14em; transform: rotate(-3deg); }
.li-stats { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: center; }
.li-stats .bars { display: grid; gap: 5px; }
.li-stats .st b { font-size: 11px; }
.cs-voice { margin: 6px 0 0; font-size: 12px; color: var(--mut); }
.rows { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 3px 14px; margin: 2px 0 0; font-size: 12px; }
.rows dt { font: 600 9.5px/1.9 var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--mut); } .rows dd { margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ring { --v: 0; display: grid; place-items: center; width: 64px; height: 64px; align-self: start; }
.ring > * { grid-area: 1 / 1; }
.ring i { width: 100%; height: 100%; border-radius: 50%; background: repeating-conic-gradient(var(--panel) 0 1.5deg, transparent 1.5deg 12deg), conic-gradient(var(--hud) calc(var(--v) * 1%), var(--line) 0);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px)); mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px)); filter: drop-shadow(0 0 4px color-mix(in srgb, var(--hud) 45%, transparent)); }
.ring b { font: 700 18px/1 var(--mono); text-align: center; } .ring b small { display: block; margin-top: 3px; font: 600 7.5px/1 var(--mono); letter-spacing: .12em; color: var(--mut); }
.st { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 8px; align-items: baseline; }
.st span { font: 600 9.5px/1.4 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--mut); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st b { font: 700 12px var(--mono); color: var(--c); }
.seg { grid-column: 1 / -1; position: relative; height: 5px; background: repeating-linear-gradient(90deg, var(--line) 0 6px, transparent 6px 8px); }
.seg i { position: absolute; left: 0; top: 0; bottom: 0; width: calc(var(--v) * 1%); background: repeating-linear-gradient(90deg, var(--c) 0 6px, transparent 6px 8px); filter: drop-shadow(0 0 3px color-mix(in srgb, var(--c) 60%, transparent)); transform-origin: left; animation: sq-grow .7s cubic-bezier(.2,.8,.3,1) both; }
.lv-hi { --c: var(--hud); } .lv-mid { --c: var(--hud2); } .lv-low { --c: var(--warn); } .lv-crit { --c: var(--bad); }
.cs-vacant { padding: 22px 16px; }
.cs-vacant h2 { margin: 0 0 4px; font-size: 17px; }
/* the settings, in tabs */
.sq-box { padding: 0 14px 14px; }
.mp-head { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; padding: 12px 14px 8px; }
.mp-id { min-width: 0; } .mp-id h2 { margin: 0; font-size: 17px; display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
.mp-sub { font: 600 10.5px/1.6 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--mut); }
.mp-line { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mp-act { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
.mp-brain { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 12px; align-items: center; padding: 8px 14px 12px; border-top: 1px solid var(--line); }
.mp-brain select { font: 12.5px var(--mono); min-width: 0; padding: 5px 6px; border-color: color-mix(in srgb, var(--rc) 55%, var(--line2)); }
.mp-brain select:focus { outline: 1px solid var(--rc); box-shadow: 0 0 10px color-mix(in srgb, var(--rc) 35%, transparent); }
.mp-brain .sq-muted { grid-column: 2; font-size: 11.5px; }
.ov { display: grid; gap: 0; }
.ov-r { display: grid; grid-template-columns: 130px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 6px 0; border-bottom: 1px dashed var(--line); min-height: 26px; }
.ov-r .lbl, .ov-h { font: 600 10px/1.3 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--mut); }
.ov-v { min-width: 0; overflow: hidden; text-overflow: ellipsis; } .ov-r button { padding: 2px 9px; font-size: 11.5px; }
.ov-h { margin: 14px 0 6px; } .li-where { margin: 0 0 10px; }
.op-chip:hover { color: var(--hud); }
.sq .op-chip { text-transform: none; letter-spacing: 0; min-height: 0; line-height: 1.4; border: 1px solid transparent; background: none; padding: 0 4px; margin-left: -4px; font: 11px var(--mono); color: var(--mut); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.sq .op-chip:hover, .sq .op-chip:focus-visible { border-color: var(--line2); background: none; }
.sq-tabs { display: flex; flex-wrap: wrap; margin: 0 -14px 12px; border-bottom: 1px solid var(--line); }
.sq-tabs button { border: none; border-bottom: 2px solid transparent; padding: 8px 12px 7px; color: var(--mut); }
.sq-tabs button.sel { color: var(--hud); border-bottom-color: var(--hud); background: linear-gradient(0deg, color-mix(in srgb, var(--hud) 10%, transparent), transparent); }
.sq-seg { display: inline-flex; border: 1px solid var(--line2); }
.sq-seg button { border: none; border-right: 1px solid var(--line); padding: 5px 11px; color: var(--mut); } .sq-seg button:last-child { border-right: none; }
.sq-seg button.sel { background: var(--hud); color: var(--on-hud); }
.sq-grid { display: grid; grid-template-columns: 130px 1fr; gap: 9px 12px; align-items: center; margin-top: 10px; }
.sq-grid > label { font: 600 10px/1.3 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--mut); }
.sq-grid input, .sq-grid select { width: 100%; }
.sq-hint { font-size: 11.5px; color: var(--mut); grid-column: 2; margin-top: -5px; }
.sq-toggle { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 2px; border-bottom: 1px dashed var(--line); }
.sq-toggle:last-child { border-bottom: none; }
.sq-switch { position: relative; width: 32px; height: 16px; flex-shrink: 0; } .sq-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
.sq-switch span { position: absolute; inset: 0; border: 1px solid var(--line2); background: transparent; transition: background .2s; cursor: pointer; }
.sq-switch span::after { content: ''; position: absolute; left: 2px; top: 2px; width: 10px; height: 10px; background: var(--mut); transition: transform .2s, background .2s; }
.sq-switch input:checked + span { border-color: var(--hud); background: color-mix(in srgb, var(--hud) 18%, transparent); } .sq-switch input:checked + span::after { transform: translateX(16px); background: var(--hud); box-shadow: 0 0 6px var(--hud); }
.sq-switch input:focus-visible + span { outline: 1px solid var(--hud); outline-offset: 2px; }
.sq textarea { width: 100%; resize: vertical; min-height: 90px; }
.sq-row { display: flex; gap: 8px; align-items: center; margin-top: 8px; } .sq-row input { flex: 1; }
.sq-extra { border: 1px solid var(--line); padding: 8px; margin-top: 8px; display: grid; gap: 6px; }
.sq-key { font-size: 12px; } .sq-key.ok { color: var(--hud); } .sq-key.bad { color: var(--warn); }
.sq-box h4 { margin: 12px 0 4px; font: 600 10.5px var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--mut); }
/* the hiring pool: a grid of portraits, its filters, an inspector */
.sq-roster { grid-column: 1 / -1; min-width: 0; }
.ro-filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--line); }
.ro-filters input { width: 240px; } .ro-filters .sq-muted { font-size: 11.5px; }
.ro-main { display: grid; grid-template-columns: minmax(0, 1fr) 300px; }
.ro-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; padding: 12px; align-content: start; }
.ro-t { position: relative; display: grid; gap: 4px; padding: 5px 5px 6px; border: 1px solid var(--line); background: var(--panel2); cursor: grab; transition: border-color .15s, background .15s; }
.ro-t:hover, .ro-t:focus-visible, .ro-t.peek { border-color: var(--rc); background: color-mix(in srgb, var(--rc) 8%, var(--panel2)); }
.ro-t.dragging { opacity: .4; }
.ro-t .pf { --s: 100%; width: 100%; height: auto; aspect-ratio: 1; --cut: 9px; }
.ro-t .pf .ini { font-size: 26px; }
.ro-t b { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ro-t .tag { justify-self: start; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.ro-t .hired { position: absolute; top: 9px; right: 9px; z-index: 2; }
.ro-t .hire { position: absolute; left: 10px; right: 10px; top: calc(50% - 30px); z-index: 2; opacity: 0; transition: opacity .15s; }
.ro-t:hover .hire, .ro-t:focus-within .hire { opacity: 1; }
.ro-peek { border-left: 1px solid var(--line); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; min-width: 0; font-size: 12px; }
.ro-peek .top { display: flex; gap: 10px; align-items: center; } .ro-peek .top b { display: block; font-size: 15px; } .ro-peek p { margin: 0; }
.ro-peek .mini { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 12px; }
.ro-peek .seg { height: 4px; }
.sq-empty { grid-column: 1 / -1; display: grid; place-items: center; text-align: center; padding: 40px 10px; }
.sq-empty h2 { margin: 12px 0 4px; }
.sk { border: 1px solid var(--line); background: linear-gradient(90deg, var(--panel2) 0 40%, color-mix(in srgb, var(--hud) 6%, var(--panel2)) 50%, var(--panel2) 60% 100%) 0 0 / 300% 100%; animation: sk 1.4s linear infinite; }
.sk-bar { height: 34px; margin-bottom: 12px; }
.sk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.sk-card { height: 210px; }
.sk-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@keyframes sk { to { background-position: -150% 0; } }
@media (prefers-reduced-motion: reduce) { .sk { animation: none; } }
.sq-missing { grid-column: 1 / -1; padding: 16px; border-color: var(--warn); --brk: var(--warn); }
/* the company: a framed panel per team */
.sq.sq-company { display: block; }
.co-head { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; padding: 12px 14px; }
.co-head h1 { margin: 2px 0 0; font-size: 20px; font-weight: 750; }
.co-head .eyebrow { font: 600 10.5px var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--hud); }
.co-kpis { display: flex; gap: 0; margin-left: 8px; }
.co-kpi { display: grid; gap: 2px; padding: 0 16px; border-left: 1px solid var(--line); } .co-kpi b { font: 700 18px/1 var(--mono); }
.co-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 12px; }
.co-card { display: flex; flex-direction: column; cursor: pointer; transition: border-color .15s, background .15s; }
.co-card:hover { border-color: var(--line2); background: color-mix(in srgb, var(--panel) 92%, var(--hud)); }
.co-card:hover::before { --brk: var(--hud2); }
.co-top { display: flex; gap: 12px; align-items: center; padding: 12px 14px 4px; } .co-id { min-width: 0; flex: 1; }
.co-id b { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.co-desc { font-size: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 2px; }
.co-ms { display: flex; gap: 6px; padding: 8px 14px 10px; }
.co-m { position: relative; display: grid; justify-items: center; gap: 3px; }
.co-m .tag { font-size: 8px; padding: 0 4px; }
.co-sec { padding: 0 14px; display: grid; gap: 4px; }
.co-sec + .co-sec { margin-top: 10px; }
.co-w { display: grid; grid-template-columns: 7px minmax(0, 1fr) auto; gap: 8px; align-items: center; font-size: 12px; }
.co-wt { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; } .co-w small { font: 10px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--mut); }
.gauge { height: 3px; background: var(--line); position: relative; margin-top: 2px; } .gauge i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--hud); box-shadow: 0 0 6px var(--hud); }
.gauge.warn i { background: var(--warn); box-shadow: 0 0 6px var(--warn); } .gauge.over i { background: var(--bad); box-shadow: 0 0 6px var(--bad); }
.co-budget { display: flex; justify-content: space-between; gap: 8px; } .co-budget .mono { font-size: 11px; color: var(--mut); }
.co-open { margin-top: auto; padding: 10px 14px 10px; display: flex; justify-content: flex-end; font: 600 10.5px var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--mut); }
.co-card:hover .co-open, .co-card:focus-visible .co-open { color: var(--hud); }
.sq-toast { position: fixed; right: 16px; bottom: 16px; z-index: 60; max-width: 420px; padding: 9px 12px; background: var(--vscode-notifications-background, var(--panel)); border: 1px solid var(--hud); font-size: 12.5px; box-shadow: 0 6px 20px #0008; }
.sq-toast.err { border-color: var(--bad); }
/* the members of a team, grouped by role */
.op-role { display: flex; align-items: center; gap: 8px; padding: 7px 12px 5px; border-bottom: 1px solid var(--line); font: 600 10px/1.4 var(--mono); letter-spacing: .12em; text-transform: uppercase; color: color-mix(in srgb, var(--rc) 70%, var(--fg)); background: color-mix(in srgb, var(--rc) 6%, transparent); }
.op-role b { font: 700 11px var(--mono); color: var(--fg); }
.op-role.lack { color: var(--warn); background: color-mix(in srgb, var(--warn) 8%, transparent); }
.sq .op-role button { margin-left: auto; padding: 1px 7px; font-size: 9.5px; }
.tag.paid { border-color: var(--warn); color: var(--warn); }
/* the new-team wizard: a step bar, the step, Back and Next */
.wz { grid-column: 1 / -1; display: flex; flex-direction: column; min-width: 0; }
.wz-steps { display: grid; grid-template-columns: repeat(var(--n, 5), minmax(0, 1fr)); border-bottom: 1px solid var(--line); }
.sq button.wz-step { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 10px 12px; border: none; border-right: 1px solid var(--line); text-align: left; color: var(--mut); text-transform: none; letter-spacing: 0; font: 12px/1.3 var(--vscode-font-family, system-ui, sans-serif); }
.sq button.wz-step:last-child { border-right: none; }
.wz-step i { flex-shrink: 0; display: grid; place-items: center; width: 22px; height: 22px; font: 700 11px var(--mono); font-style: normal; border: 1px solid var(--line2); --cut: 5px; clip-path: ${CUT}; }
.wz-step span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wz-step.now { color: var(--fg); background: linear-gradient(0deg, color-mix(in srgb, var(--hud) 12%, transparent), transparent); box-shadow: inset 0 -2px 0 var(--hud); }
.wz-step.now i { background: var(--hud); border-color: var(--hud); color: var(--on-hud); }
.wz-step.done i { border-color: var(--hud); color: var(--hud); }
.wz-body { padding: 16px; min-height: 320px; display: flex; flex-direction: column; gap: 12px; }
.wz-body h2 { margin: 0; font-size: 18px; font-weight: 750; } .wz-body > .sq-muted { margin-top: -6px; }
.wz-nav { display: flex; gap: 8px; align-items: center; padding: 10px 16px; border-top: 1px solid var(--line); }
.wz-id { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 18px; align-items: start; }
.wz-logo { display: grid; justify-items: center; gap: 6px; }
.wz-logo .hex { cursor: pointer; }
.wz-name { display: flex; gap: 8px; } .wz-name input { flex: 1; font-size: 16px; font-weight: 650; }
.sq button.wz-dice { display: inline-flex; align-items: center; gap: 6px; border-color: var(--hud2); color: color-mix(in srgb, var(--hud2) 75%, var(--fg)); }
.sq button.wz-dice:hover { background: color-mix(in srgb, var(--hud2) 14%, transparent); border-color: var(--hud2); }
.wz-dice svg { transition: transform .35s cubic-bezier(.2,.8,.3,1.4); } .wz-dice.roll svg { transform: rotate(200deg); }
.wz-field { display: grid; gap: 5px; } .wz-field input, .wz-field textarea { width: 100%; }
.wz-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 5px; border: 1px solid var(--vscode-input-border, var(--line)); background: var(--vscode-input-background, var(--panel2)); }
.wz-tags input { flex: 1; min-width: 160px; border: none !important; box-shadow: none !important; background: transparent; }
.wz-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 4px 2px 8px; border: 1px solid var(--hud); color: var(--fg); font: 600 11px var(--mono); background: color-mix(in srgb, var(--hud) 10%, transparent); }
.sq .wz-chip button { border: none; padding: 0 4px; color: var(--mut); font-size: 11px; }
.sq button.wz-sugg { padding: 2px 8px; border-style: dashed; text-transform: none; letter-spacing: 0; font: 11px var(--mono); color: var(--mut); }
/* the skills (spec 011 req. 34): the library's chips by kind, the chosen ones, the team's, the member's rows, the drawer */
.sk-lib { display: grid; gap: 10px; } .sk-search { width: 100%; }
.sk-group { display: grid; gap: 6px; } .sk-group > .lbl i { font-style: normal; color: var(--hud); }
.sk-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.sk-chip { display: inline-flex; align-items: stretch; border: 1px solid var(--line2); background: var(--panel); --cut: 5px; clip-path: ${CUT}; }
.sk-chip.on { border-color: var(--hud); background: color-mix(in srgb, var(--hud) 12%, transparent); }
.sk-chip.own { border-color: var(--hud2); background: color-mix(in srgb, var(--hud2) 10%, transparent); }
.sq .sk-chip button { border: none; clip-path: none; text-transform: none; letter-spacing: 0; font: 12px/1.4 var(--vscode-font-family, system-ui, sans-serif); padding: 3px 8px; }
.sq .sk-chip button.sk-box { font: 700 11px/1.4 var(--mono); color: var(--mut); border-right: 1px solid var(--line); min-width: 24px; }
.sq .sk-chip.on button.sk-box { color: var(--hud); }
.sq .sk-chip button.sk-name:hover { text-decoration: underline; }
.sk-chosen { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 10px; border: 1px dashed var(--line2); margin: 2px 0 4px; }
.sk-chosen > .lbl { margin-right: 4px; }
.sk-team { grid-column: 1 / -1; } .sk-team .sk-chosen { border: none; margin: 0; padding: 8px 12px; }
.sk-team .hs button { padding: 2px 8px; font-size: 10px; }
.sk-from { display: inline-block; margin-left: 6px; padding: 0 5px; font: 600 9.5px/1.6 var(--mono); letter-spacing: .08em; text-transform: uppercase; border: 1px solid var(--line2); color: var(--mut); vertical-align: middle; }
.sk-from.sk-own { border-color: var(--hud2); color: var(--hud2); } .sk-from.sk-team { border-color: var(--hud); color: var(--hud); }
.sk-from.sk-library { border-color: var(--line2); color: var(--fg); } .sk-from.sk-agent { border-color: var(--warn); color: var(--warn); }
.sk-over { display: inline-block; margin-left: 6px; font: 10px var(--mono); color: var(--warn); }
.sk-rows { display: grid; gap: 0; border: 1px solid var(--line); }
.sk-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 7px 10px; border-bottom: 1px dashed var(--line); }
.sk-row:last-child { border-bottom: none; } .sk-row.inh { opacity: .78; } .sk-row .sq-muted { font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sk-row-a { display: flex; gap: 4px; } .sk-row-a button { padding: 2px 7px; font-size: 10px; }
.sk-base { display: flex; align-items: center; gap: 8px; margin: 4px 0; } .sk-base select { flex: 1; min-width: 0; }
.sk-drawer { position: fixed; inset: 0; z-index: 60; display: flex; justify-content: flex-end; }
.sk-shade { position: absolute; inset: 0; background: #0008; }
.sk-panel { position: relative; width: min(620px, 100%); height: 100%; overflow: auto; background: var(--vscode-editor-background, var(--bg)); border-left: 1px solid var(--hud); box-shadow: -10px 0 40px #0009; display: flex; flex-direction: column; }
.sk-panel.wide { width: min(1080px, 100%); }
.sk-panel > .hs { position: sticky; top: 0; z-index: 1; background: var(--vscode-editor-background, var(--bg)); }
.sq button.sk-x, .sk-x { border: none; padding: 0 6px; font-size: 13px; color: var(--mut); background: transparent; cursor: pointer; }
.sk-body { padding: 14px 18px 22px; display: grid; gap: 10px; align-content: start; }
.sk-head { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; } .sk-head h2 { margin: 0; font-size: 18px; }
.sk-tags { display: flex; flex-wrap: wrap; gap: 4px; } .sk-tags span { font: 10px var(--mono); padding: 1px 6px; border: 1px solid var(--line); color: var(--mut); }
.sk-acts { flex-wrap: wrap; gap: 6px; margin: 2px 0 4px; } .sk-clone-m { display: inline-flex; gap: 4px; } .sk-clone-m select { max-width: 180px; }
.sk-md { font-size: 13px; line-height: 1.55; border-top: 1px solid var(--line); padding-top: 8px; }
.sk-md h2 { font-size: 17px; margin: 10px 0 6px; } .sk-md h3 { font-size: 13px; margin: 16px 0 6px; color: var(--hud); font-family: var(--mono); letter-spacing: .06em; text-transform: uppercase; }
.sk-md h4, .sk-md h5 { font-size: 13px; margin: 12px 0 4px; } .sk-md p { margin: 6px 0; } .sk-md ul, .sk-md ol { margin: 6px 0; padding-left: 22px; } .sk-md li { margin: 3px 0; }
.sk-md li.task { list-style: none; margin-left: -18px; } .sk-md .box { color: var(--hud); }
.sk-md code { font: 12px var(--mono); padding: 0 4px; background: var(--panel2); border: 1px solid var(--line); }
.sk-md pre { padding: 8px 10px; overflow: auto; background: var(--panel2); border: 1px solid var(--line); } .sk-md pre code { border: none; padding: 0; background: none; }
.sk-edit { gap: 12px; } .sk-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } .sk-fields .wide { grid-column: 1 / -1; }
.sk-fields details summary { cursor: pointer; }
.sk-split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; min-height: 380px; }
.sk-split > .wz-field { grid-template-rows: auto minmax(0, 1fr); }
.sk-split textarea { min-height: 380px; height: 100%; font: 12px/1.5 var(--mono); resize: vertical; }
.sk-live { border: 1px solid var(--line); padding: 4px 12px; min-height: 380px; max-height: 60vh; overflow: auto; }
@media (max-width: 760px) { .sk-split, .sk-fields { grid-template-columns: 1fr; } }
.wz-roles { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.wz-role > .hs { color: color-mix(in srgb, var(--rc) 70%, var(--fg)); background: linear-gradient(90deg, color-mix(in srgb, var(--rc) 14%, transparent), transparent 75%); }
.wz-cand { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 4px 10px; align-items: center; padding: 9px 12px; border-bottom: 1px dashed var(--line); }
.wz-cand:last-child { border-bottom: none; }
.wz-cand b { font-size: 13px; } .wz-cand .sq-muted { font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wz-why { grid-column: 2 / -1; display: flex; flex-wrap: wrap; gap: 4px; }
.wz-why span { font: 10px var(--mono); padding: 1px 5px; border: 1px solid var(--line); color: var(--mut); } .wz-why span b { color: var(--hud); font-weight: 600; font-size: inherit; }
.wz-pool { display: grid; grid-template-columns: minmax(0, 1fr) 300px; border: 1px solid var(--line); }
.wz-pool .ro-filters select, .wz-pool .ro-filters input { max-width: 170px; }
.wz-pool .ro-grid { max-height: 520px; overflow: auto; }
.ro-t.picked { border-color: var(--hud); background: color-mix(in srgb, var(--hud) 12%, var(--panel2)); box-shadow: 0 0 0 1px var(--hud); }
.ro-t.taken { opacity: .45; cursor: default; }
.ro-t .pick { position: absolute; top: 9px; left: 9px; z-index: 2; width: 18px; height: 18px; display: grid; place-items: center; border: 1px solid var(--line2); background: var(--panel); font: 700 11px var(--mono); color: var(--on-hud); }
.ro-t.picked .pick { background: var(--hud); border-color: var(--hud); }
.wz-sel { border-left: 1px solid var(--line); display: flex; flex-direction: column; min-width: 0; }
.wz-sel .list { overflow: auto; max-height: 470px; }
.wz-counts { display: grid; grid-template-columns: repeat(5, 1fr); border-bottom: 1px solid var(--line); }
.wz-count { display: grid; justify-items: center; padding: 7px 2px; border-right: 1px solid var(--line); } .wz-count:last-child { border-right: none; }
.wz-count b { font: 700 16px/1 var(--mono); color: var(--rc); } .wz-count.lack b { color: var(--warn); } .wz-count .lbl { font-size: 8.5px; }
.wz-m { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 6px 10px; border-bottom: 1px dashed var(--line); font-size: 12px; }
.wz-m small { display: block; font: 10px var(--mono); color: var(--mut); text-transform: uppercase; letter-spacing: .08em; }
.wz-lack { padding: 8px 10px; font-size: 12px; color: var(--warn); border-bottom: 1px solid var(--line); }
.wz-work { display: grid; grid-template-columns: auto minmax(130px, 1fr) auto minmax(150px, 1fr) minmax(140px, 1fr) auto auto; gap: 8px 10px; align-items: center; padding: 8px 12px; border-bottom: 1px dashed var(--line); }
.wz-work select, .wz-work input { width: 100%; }
.wz-work .who b { display: block; font-size: 13px; } .wz-work .who small { font: 10px var(--mono); color: var(--mut); text-transform: uppercase; letter-spacing: .08em; }
.wz-lead { display: flex; align-items: center; gap: 4px; font: 600 9.5px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--mut); white-space: nowrap; }
.wz-warn { padding: 12px 14px; border: 1px solid var(--warn); --brk: var(--warn); background: color-mix(in srgb, var(--warn) 8%, var(--panel)); font-size: 12.5px; }
.wz-warn b { color: var(--warn); }
.wz-ok { padding: 10px 14px; border: 1px solid var(--line2); font-size: 12.5px; }
.wz-budget { display: flex; align-items: center; gap: 8px; } .wz-budget input { width: 90px; }
/* step 5: one agent for everyone, and what makes each member different */
.wz-same { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 12px; border-color: var(--line2); }
.wz-same select, .wz-same input { max-width: 220px; }
.sq .wz-work .wz-open { display: block; margin-top: 3px; border-style: dashed; padding: 1px 7px; font-size: 9.5px; color: var(--mut); }
.sq .wz-work .wz-open.on { color: var(--hud); border-color: var(--hud); border-style: solid; }
.wz-work.bad { background: color-mix(in srgb, var(--bad) 7%, transparent); }
.wz-badwhy { grid-column: 1 / -1; font-size: 12px; color: var(--bad); }
.wz-diff { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 10px 14px; padding: 10px 12px; border: 1px solid var(--line); border-left: 2px solid var(--hud); background: var(--panel2); }
.wz-diff .wide { grid-column: 1 / -1; } .wz-diff textarea { min-height: 52px; }
.wz-skills { display: flex; flex-wrap: wrap; gap: 5px; }
.sq button.wz-sk { padding: 2px 8px; text-transform: none; letter-spacing: 0; font: 11px var(--mono); color: var(--mut); border-style: dashed; }
.sq button.wz-sk.on { color: var(--fg); border-style: solid; border-color: var(--hud); background: color-mix(in srgb, var(--hud) 12%, transparent); }
.wz-extra { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto; gap: 6px; margin-bottom: 6px; }
@media (max-width: 1100px) { .wz-pool { grid-template-columns: 1fr; } .wz-sel { border-left: none; border-top: 1px solid var(--line); } .wz-work { grid-template-columns: auto minmax(0, 1fr) auto; } .wz-work > .wide { grid-column: 2 / -1; } }
@keyframes sq-grow { from { transform: scaleX(0); } }
@keyframes sq-sweep { from { transform: translateY(-100%); } to { transform: translateY(260%); } }
@keyframes sq-blink { 50% { opacity: .35; } }
@media (prefers-reduced-motion: no-preference) {
  .li-pf .sweep { position: absolute; inset: 0 0 auto; height: 38%; z-index: 1; pointer-events: none; background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--rc) 22%, transparent), transparent); animation: sq-sweep 4.5s linear infinite; }
  .led.st-running, .led.st-waiting { animation: sq-blink 1.2s infinite; }
}
@media (prefers-reduced-motion: reduce) { .sq *, .sq *::before, .sq *::after { animation: none !important; transition: none !important; } }
@media (max-width: 1100px) { .ro-main { grid-template-columns: 1fr; } .ro-peek { border-left: none; border-top: 1px solid var(--line); } }
@media (max-width: 900px) { .sq { grid-template-columns: 1fr; } .co-kpis { display: none; } }
@media (max-width: 1280px) { .li-cols { grid-template-columns: 1fr; } .li-rail { border-left: none; border-top: 1px solid var(--line); } }
@media (max-width: 560px) { .li-head { grid-template-columns: 1fr; } .li-pf { margin-top: -40px; } }
`;

export const SQUAD_SCRIPT = String.raw`
window.Squad = (() => {
  const initials = ${initials.toString()};
  const teamColor = ${teamColor.toString()};
  const statLevel = ${statLevel.toString()};
  const budgetGauge = ${budgetGauge.toString()};
  const filterRoster = ${filterRoster.toString()};
  const roleCounts = ${roleCounts.toString()};
  const missingRoles = ${missingRoles.toString()};
  const paidMembers = ${paidMembers.toString()};
  const filterPool = ${filterPool.toString()};
  const rosterSkills = ${rosterSkills.toString()};
  const mdHtml = ${mdHtml.toString()};
  const skillSlug = ${skillSlug.toString()};
  const skillMarkdown = ${skillMarkdown.toString()};
  const skillFields = ${skillFields.toString()};
  const libraryGroups = ${libraryGroups.toString()};
  const memberSkills = ${memberSkills.toString()};
  const draftOf = ${draftOf.toString()};
  const differences = ${differences.toString()};
  const sameForAll = ${sameForAll.toString()};
  const ROLES = ['analyst', 'architect', 'developer', 'qa', 'devops'];
  const COLOR = { analyst: '#a970ff', architect: '#3b9dff', developer: '#f5a524', qa: '#14c8d8', devops: '#ff4d6d' };
  // the stations each role works (roles.nuc's STATION_ROLE), the roles' order
  const WORKS = { analyst: ['analysis'], architect: ['design'], developer: ['tests', 'code'], qa: ['quality'], devops: ['delivery'] };
  const PROVIDERS = { local: ['nuclear-developer'], agent: ['claude-code', 'codex', 'gemini-cli', 'opencode', 'cursor', 'grok'], api: ['anthropic', 'openai', 'google', 'openrouter'] };
  const PNAME = { 'nuclear-developer': 'Nuclear Developer', 'claude-code': 'Claude Code', codex: 'Codex', 'gemini-cli': 'Gemini CLI', cursor: 'Cursor', grok: 'Grok Build', opencode: 'OpenCode', anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', openrouter: 'OpenRouter' };
  const MODELS = { 'nuclear-developer': ['qwen2.5-coder:3b', 'gemma4:e2b', 'qwen2.5-coder:1.5b'], 'claude-code': ['haiku', 'sonnet', 'opus'] };
  const STATIONS = ['analysis', 'design', 'tests', 'code', 'quality', 'delivery'];
  const BEHAVIOURS = ['askBeforeWriting', 'explainDecisions', 'stopAtFirstFailure'];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let el = null, post = () => undefined;
  let S = { teams: [], team: null, roster: null, vault: null, missing: null, loading: true };
  // the company (every team as a panel), one team, or the wizard; the onboarding has no company, only its team
  let view = 'team', companyMode = false;
  // sel: the member on the sheet (its id); role: the hiring pool's role
  let sel = null, role = 'developer', tab = 'overview', filter = '', ftemper = '', fgender = '', peek = null, viewing = null, skillsAll = false, saveTimer = null, savedAt = 0;
  // the wizard's state (null: closed); AGENTS: who can work a member on this machine (agents --json)
  let W = null, AGENTS = null, autoWizard = false, agentsAsked = false;
  // the skills' drawer (null: closed): a preview, the editor or the library's picker, for a place (skPlace)
  let SD = null, SQ = '';
  // HERE: each provider's models and this machine's memory (models --json); ask: the confirmation of a model too big
  // for this machine's memory ({ m, yes }); brainOther: the provider whose model is typed in the brain ({ kind, provider })
  let HERE = null, ask = null, brainOther = null;
  // NUMBERS: each member's numbers of the shown team, from the factory's ledger (metrics --view people), by member id
  let NUMBERS = {};

  // ---------- an employee's portrait (the roster's, sent once), else their initials in the frame ----------
  // THUMBS: the 128 px thumbnails (tiles, cards, rows, avatars); FACES: the 512 px portraits (the open profile only)
  let FACES = {}, THUMBS = {};
  /** A portrait in its angled frame, the role's colour as its rim; full: the portrait itself, else its thumbnail. */
  function pf(id, name, rc, size, cls, full) {
    const src = id ? (full ? FACES[id] ?? THUMBS[id] : THUMBS[id] ?? FACES[id]) : null, px = full && FACES[id] ? 512 : 128;
    const inner = src ? '<img class="face" src="' + esc(src) + '" alt="" width="' + px + '" height="' + px + '" loading="lazy" decoding="async">' : id ? '<span class="face ini">' + esc(initials(name || id)) + '</span>' : '<span class="face">+</span>';
    return '<span class="pf' + (id ? '' : ' vacant') + (cls ? ' ' + cls : '') + '" style="--rc:' + rc + (size ? ';--s:' + size : '') + '">' + inner + '</span>';
  }
  /** The platform's mark: a hexagon with the atom's three orbits. */
  const mark = (size) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 32 32" aria-hidden="true" style="flex-shrink:0;color:var(--hud)"><path d="M16 2 28.1 9v14L16 30 3.9 23V9z" fill="none" stroke="currentColor" stroke-width="1.4"/><g fill="none" stroke="currentColor" stroke-width="1"><ellipse cx="16" cy="16" rx="8" ry="3.2"/><ellipse cx="16" cy="16" rx="8" ry="3.2" transform="rotate(60 16 16)"/><ellipse cx="16" cy="16" rx="8" ry="3.2" transform="rotate(-60 16 16)"/></g><circle cx="16" cy="16" r="1.6" fill="currentColor"/></svg>';

  /** The name dice: a die in the HUD's line, not an emoji. */
  const dice = '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="5" cy="5" r="1.2" fill="currentColor"/><circle cx="11" cy="5" r="1.2" fill="currentColor"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="5" cy="11" r="1.2" fill="currentColor"/><circle cx="11" cy="11" r="1.2" fill="currentColor"/></svg>';

  // ---------- reading the state ----------
  const people = (r) => S.roster?.[r]?.employees ?? [];
  const members = () => S.team?.members ?? [];
  const memberById = (id) => members().find((x) => x.id === id) ?? null;
  const cur = () => memberById(sel);
  const empOf = (x) => x ? people(x.role).find((p) => p.id === x.employee) ?? null : null;
  const ovr = (p) => { const v = Object.values(p?.stats ?? {}); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0; };
  const statName = (s) => T['sq.stat.' + s] ?? s;
  // a role's skill as the roster gives it in the page's language (the front matter's title_es), else its name in words
  const skillTitle = (r, s) => S.roster?.[r]?.skillTexts?.[s]?.title ?? String(s).replace(/[-_]/g, ' ');
  const skillAbout = (r, s) => S.roster?.[r]?.skillTexts?.[s]?.description ?? '';
  const statsOf = (r, p) => S.roster?.[r]?.stats?.length ? S.roster[r].stats : Object.keys(p?.stats ?? {});
  const fill = (x) => { x.skills ??= []; x.ownSkills ??= []; x.behaviour ??= {}; x.tasks ??= []; x.instructions ??= ''; return x; };
  // an age is a number, or already a sentence of the roster ("41 sprints")
  const ageText = (a) => /^\d+$/.test(String(a ?? '')) ? t('sq.age', a) : String(a ?? '');
  const whoText = (x) => x ? (PNAME[x.provider] ?? x.provider) + (x.model ? ' · ' + x.model : '') : t('sq.nobody');
  const temperOf = (id) => (S.temperaments ?? []).find((m) => m.id === id);
  const temperName = (id) => { const m = temperOf(id); return m ? (m.name?.[t('sq.lang')] ?? m.name?.en ?? id) : id || ''; };
  // what people read of a temperament (its description in the page's language; its voice is the prompt's, English)
  const temperAbout = (id) => { const m = temperOf(id); return m ? (m.description?.[t('sq.lang')] ?? m.description?.en ?? '') : ''; };
  const memberTemper = (x, p) => x?.personality?.temperament || p?.temperament || '';
  const memberName = (x) => x?.name || empOf(x)?.name || t('sq.role.' + x?.role);
  const opCode = (id) => String(id || '').toUpperCase();
  const worksText = (r) => WORKS[r].map((s) => t('sq.station.' + s)).join(' · ');
  const ledOf = (x) => x?.kind === 'local' ? ['on', t('sq.led.local')] : ['paid', t('sq.led.paid')];
  const leadOf = (team) => team?.techLead || '';
  const sep = '<i>//</i>', dot = '<i>·</i>';
  const isPaid = (x) => !!x?.kind && x.kind !== 'local';
  const paidTag = (x) => isPaid(x) ? '<span class="tag paid" title="' + esc(t('sq.wz.paidHint')) + '">' + esc(t('sq.wz.paid')) + '</span>' : '';

  // ---------- drawing ----------
  function draw() {
    if (!el) return;
    const keep = el.querySelector('.sq')?.scrollTop ?? 0;
    const a = document.activeElement, focusKey = a && el.contains(a) ? (a.dataset?.f ?? null) : null, caret = focusKey && typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null;
    if (S.missing) { el.innerHTML = '<div class="sq"><div class="sq-missing hud brk"><b>' + esc(t('sq.missingTitle')) + '</b><div>' + esc(S.missing) + '</div><div class="sq-muted" style="margin-top:6px">' + esc(t('sq.missingHelp')) + '</div><div class="sq-row"><button data-a="retry">' + esc(t('sq.tryAgain')) + '</button></div></div></div>'; return; }
    if (S.loading) { el.innerHTML = skeleton(); return; }
    if (view === 'wizard' && W) el.innerHTML = '<div class="sq">' + wizard() + '</div>' + toastHtml();
    else if (view === 'company') el.innerHTML = '<div class="sq sq-company">' + company() + '</div>' + toastHtml();
    else if (!S.team) el.innerHTML = '<div class="sq">' + bar() + empty() + '</div>' + toastHtml();
    else el.innerHTML = '<div class="sq" style="--rc:' + COLOR[cur()?.role ?? role] + '">' + bar() + about() + teamSkills() + crew() + side() + rosterRow() + '</div>' + toastHtml();
    const sq = el.querySelector('.sq'); if (sq) sq.scrollTop = keep;
    if (focusKey) { const b = el.querySelector('[data-f="' + focusKey + '"]'); if (b) { b.focus({ preventScroll: true }); if (caret) try { b.setSelectionRange(caret[0], caret[1]); } catch {} } }
    if (ask) { (el.querySelector('.sq') ?? el).insertAdjacentHTML('beforeend', askHtml()); el.querySelector('[data-a="ramNo"]')?.focus(); }
    if (SD && !S.loading && !S.missing) { const keepD = el.querySelector('.sk-panel')?.scrollTop ?? 0; (el.querySelector('.sq') ?? el).insertAdjacentHTML('beforeend', skillDrawer()); const pnl = el.querySelector('.sk-panel'); if (pnl) pnl.scrollTop = keepD; if (focusKey) { const b = el.querySelector('.sk-drawer [data-f="' + focusKey + '"]'); if (b) { b.focus({ preventScroll: true }); if (caret) try { b.setSelectionRange(caret[0], caret[1]); } catch {} } } }
  }
  /** The page's frame while its data comes (one team screen): the panels' places, shimmering; the text for readers. */
  const skeleton = () => '<div class="sq' + (view === 'company' ? ' sq-company' : '') + '" aria-busy="true"><span class="sk-sr" role="status">' + esc(t('sq.loading')) + '</span><div class="sk sk-bar"></div><div class="sk-grid">' + '<div class="sk sk-card"></div>'.repeat(view === 'company' ? 3 : 6) + '</div></div>';
  let toast = null;
  const toastHtml = () => toast ? '<div class="sq-toast' + (toast.err ? ' err' : '') + '" role="status">' + esc(toast.text) + '</div>' : '';
  function say(text, err) { toast = { text, err }; draw(); clearTimeout(say.h); say.h = setTimeout(() => { toast = null; el?.querySelector('.sq-toast')?.remove(); }, 5000); }

  /** A team's logo in its hexagon: its image, else its initials in its colour. */
  const logo = (name, id, data, size) => '<span class="hex" style="--s:' + size + 'px">' + (data ? '<img src="' + esc(data) + '" alt="" decoding="async">' : '<span style="background:' + teamColor(id || name) + '">' + esc(initials(name || '?')) + '</span>') + '</span>';
  /** A team's header strip: TEAM // ID · N OPERATIVES · LEAD: NAME. */
  const strip = (id, count, leader) => '<div class="hs"><span>' + esc(t('sq.team')) + ' ' + sep + ' ' + esc(id) + '</span>' + dot + '<span>' + esc(t('sq.hud.operatives', count)) + '</span>' + (leader ? dot + '<span class="fit">' + esc(t('sq.hud.lead', leader)) + '</span>' : '') + '</div>';
  /** The page's language button, in the squad's own panel (the onboarding has its own, in its header). */
  const globe = () => (companyMode && typeof langButton === 'function' ? langButton() : '');
  const newButton = () => '<button class="primary" data-a="wizard">+ ' + esc(t('sq.new')) + '</button>';

  // ---------- the company: every team as a framed panel ----------
  function company() {
    const list = S.company ?? [];
    const staffed = list.reduce((n, c) => n + c.members.length, 0), active = list.reduce((n, c) => n + c.work.filter((w) => w.status === 'running' || w.status === 'waiting').length, 0);
    const cards = list.map((c) => {
      const nameOf = (m) => m.name || people(m.role).find((e) => e.id === m.employee)?.name || t('sq.role.' + m.role);
      const shown = c.members.slice(0, 7);
      const faces = shown.map((m) => '<span class="co-m" title="' + esc(nameOf(m) + ' · ' + t('sq.role.' + m.role) + (m.provider ? ' · ' + (PNAME[m.provider] ?? m.provider) + (m.model ? ' · ' + m.model : '') : '') + (m.id === c.techLead ? ' · ' + t('sq.techLead') : '')) + '">'
        + pf(m.employee, nameOf(m), COLOR[m.role], '46px') + (m.id === c.techLead ? '<span class="tag lead">' + esc(t('sq.hud.leadTag')) + '</span>' : '<span class="lbl">' + esc(t('sq.abbr.' + m.role)) + '</span>') + '</span>').join('')
        + (c.members.length > shown.length ? '<span class="co-m"><span class="pf vacant" style="--s:46px"><span class="face">+' + (c.members.length - shown.length) + '</span></span><span class="lbl">' + esc(t('sq.wz.more')) + '</span></span>' : '');
      const counts = roleCounts(c.members), lack = c.missing ?? [];
      const byRole = '<div class="co-sec"><span class="lbl">' + ROLES.map((r) => esc(t('sq.abbr.' + r)) + ' ' + counts[r]).join(' · ') + '</span>' + (lack.length ? '<span class="lbl" style="color:var(--warn)">' + esc(t('sq.wz.lacks', lack.map((r) => t('sq.role.' + r)).join(', '))) + '</span>' : '') + '</div>';
      const leader = c.members.find((m) => m.id === c.techLead);
      const work = c.work.length ? c.work.map((w) => '<div class="co-w"><span class="led st-' + esc(w.status) + '"></span><span class="co-wt">' + esc(w.title) + '</span><small>' + esc(T['sq.st.' + w.status] ?? w.status) + '</small></div>').join('') : '<div class="co-w"><span class="led idle"></span><span class="co-wt sq-muted">' + esc(t('sq.hud.idle')) + '</span><small></small></div>';
      const g = budgetGauge(c.spentUsd ?? 0, c.budgetUsd ?? 0);
      const budget = '<div class="co-sec"><div class="co-budget"><span class="lbl">' + esc(t('sq.hud.budget')) + '</span><span class="mono">$' + (c.spentUsd ?? 0).toFixed(2) + ' / $' + Number(c.budgetUsd ?? 0).toFixed(2) + '</span></div><div class="gauge ' + g.level + '" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + g.pct + '" aria-label="' + esc(t('sq.hud.budget')) + '"><i style="width:' + g.pct + '%"></i></div></div>';
      return '<div class="co-card hud brk" data-team="' + esc(c.id) + '" tabindex="0" role="button" aria-label="' + esc(t('sq.openTeamOf', c.name)) + '">'
        + strip(c.id, c.members.length, leader ? nameOf(leader) : '')
        + '<div class="co-top">' + logo(c.name, c.id, c.logo, 46) + '<div class="co-id"><b>' + esc(c.name) + (c.default ? ' <span class="tag def" title="' + esc(t('sq.isDefault')) + '">★ ' + esc(t('sq.default')) + '</span>' : '') + '</b><div class="co-desc' + (c.description ? '' : ' sq-muted') + '">' + esc(c.description || t('sq.noDescription')) + '</div></div></div>'
        + '<div class="co-ms">' + faces + '</div>' + byRole
        + '<div class="co-sec"><span class="lbl">' + esc(t('sq.worksOn')) + '</span>' + work + '</div>' + budget
        + '<div class="co-open">' + esc(t('sq.openTeam')) + ' ›</div></div>';
    }).join('');
    const kpi = (n, label) => '<div class="co-kpi"><b>' + String(n).padStart(2, '0') + '</b><span class="lbl">' + esc(label) + '</span></div>';
    return '<div class="co-head hud brk">' + mark(38) + '<div><div class="eyebrow">Nuclear Builder ' + sep.replace(/<\/?i>/g, '') + ' ' + esc(t('sq.hud.company')) + '</div><h1>' + esc(t('sq.company')) + '</h1><div class="sq-muted">' + esc(list.length === 1 ? t('sq.companyOne') : t('sq.companyHint', list.length)) + '</div></div>'
      + '<div class="co-kpis">' + kpi(list.length, t('sq.hud.teams')) + kpi(staffed, t('sq.hud.staff')) + kpi(active, t('sq.hud.active')) + '</div><div class="sq-grow"></div>'
      + newButton() + '<button data-a="import">' + esc(t('sq.import')) + '</button>' + globe() + '</div>'
      + (cards ? '<div class="co-grid">' + cards + '</div>' : empty());
  }
  /** The team's description, under its bar. */
  const about = () => '<div class="sq-about"><input data-f="tdesc" value="' + esc(S.team.description ?? '') + '" placeholder="' + esc(t('sq.descPlaceholder')) + '" aria-label="' + esc(t('sq.description')) + '"></div>';
  function bar() {
    const opts = S.teams.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === S.team?.id ? ' selected' : '') + '>' + (x.default ? '★ ' : '') + esc(x.name) + '</option>').join('');
    const entry = S.teams.find((x) => x.id === S.team?.id);
    return '<div class="sq-bar hud brk">' + (companyMode ? '<button data-a="company" title="' + esc(t('sq.backHint')) + '">‹ ' + esc(t('sq.hud.company')) + '</button>' : '')
      + (S.team ? '<button class="sq-logobtn" data-a="logo" title="' + esc(t('sq.logoHint')) + '" aria-label="' + esc(t('sq.logoHint')) + '">' + logo(S.team.name, S.team.id, S.logo, 38) + '</button>' : mark(30))
      + (S.team && S.logo ? '<button class="sq-logoclear" data-a="logoClear" title="' + esc(t('sq.logoClearHint')) + '" aria-label="' + esc(t('sq.logoClear')) + '">✕</button>' : '')
      + '<div class="sq-team"><span class="lbl">' + esc(t('sq.team')) + '</span>' + (S.teams.length ? '<select data-a="open" aria-label="' + esc(t('sq.team')) + '">' + opts + '</select>' : '<b>' + esc(t('sq.noTeams')) + '</b>') + '</div>'
      + (entry?.default ? '<span class="tag def" title="' + esc(t('sq.isDefault')) + '">★ ' + esc(t('sq.default')) + '</span>' : S.team ? '<button data-a="default" title="' + esc(t('sq.setDefaultHint')) + '">☆ ' + esc(t('sq.setDefault')) + '</button>' : '')
      + newButton()
      + (S.team ? '<button data-a="editMembers" title="' + esc(t('sq.wz.editHint')) + '">' + esc(t('sq.wz.edit')) + '</button><button data-a="rename">' + esc(t('sq.rename')) + '</button><button data-a="duplicate">' + esc(t('sq.duplicate')) + '</button><button data-a="export">' + esc(t('sq.export')) + '</button>' : '')
      + '<button data-a="import">' + esc(t('sq.import')) + '</button>'
      + (S.team ? '<button class="danger" data-a="delete">' + esc(t('sq.delete')) + '</button>' : '')
      + '<div class="sq-grow"></div>'
      + (S.team ? '<span class="sq-saved' + (Date.now() - savedAt < 2500 ? ' on' : '') + '">' + esc(saveTimer ? t('sq.saving') : savedAt ? '✓ ' + t('sq.saved') : t('sq.keptBy')) + '</span>' : '')
      + globe() + '</div>';
  }
  function empty() {
    return '<div class="sq-empty"><div>' + mark(56) + '<h2>' + esc(t('sq.emptyTitle')) + '</h2><div class="sq-muted">' + esc(t('sq.emptyText')) + '</div><div class="sq-row" style="justify-content:center;margin-top:14px">' + newButton() + '</div></div></div>';
  }
  /** The team's members, grouped by role in station order (N per role); a role the stations need and the team lacks
   * is flagged; each role adds more from the pool. */
  function crew() {
    const lead = memberById(leadOf(S.team)), counts = roleCounts(members());
    const rows = ROLES.map((r) => {
      const head = '<div class="op-role' + (counts[r] ? '' : ' lack') + '" style="--rc:' + COLOR[r] + '">' + esc(t('sq.role.' + r)) + ' <b>' + counts[r] + '</b>' + (counts[r] ? '' : ' · ' + esc(t('sq.wz.lackRole'))) + '<button data-addrole="' + r + '" title="' + esc(t('sq.wz.addRoleHint', t('sq.role.' + r))) + '">+ ' + esc(t('sq.wz.add')) + '</button></div>';
      return head + members().filter((x) => x.role === r).map((x, i) => {
        const p = empOf(x), name = memberName(x), [led, ledText] = ledOf(x), tm = memberTemper(x, p);
        return '<div class="op-slot' + (x.id === sel ? ' sel' : '') + '" style="--rc:' + COLOR[r] + '" data-member="' + esc(x.id) + '" tabindex="0" role="button" aria-pressed="' + (x.id === sel) + '" aria-label="' + esc(t('sq.role.' + r) + ': ' + name) + '">'
          + '<span class="op-n">' + String(i + 1).padStart(2, '0') + '</span>' + pf(p?.id, name, COLOR[r], '52px')
          + '<div class="op-who"><b>' + esc(name) + '</b><span class="lbl">' + esc(t('sq.role.' + r)) + ' ' + sep.replace(/<\/?i>/g, '') + ' ' + esc(worksText(r)) + '</span>'
          + '<div class="op-meta">' + (tm ? '<span class="tag tmp">' + esc(temperName(tm)) + '</span>' : '') + paidTag(x) + '<button class="op-chip" data-cfg="' + esc(x.id) + '" title="' + esc(t('sq.mp.brainHint')) + '">' + esc(whoText(x)) + '</button></div></div>'
          + '<div class="op-st"><span class="led ' + led + '" title="' + esc(ledText) + '" role="img" aria-label="' + esc(ledText) + '"></span>' + (lead?.id === x.id ? '<span class="tag lead">' + esc(t('sq.hud.leadTag')) + '</span>' : '') + '</div></div>';
      }).join('');
    }).join('');
    return '<div class="op-list hud brk">' + strip(S.team.id, members().length, lead ? memberName(lead) : '') + rows + '</div>';
  }
  /** Six stats as segmented bars. */
  const statBars = (r, p) => statsOf(r, p).map((s) => { const v = p.stats?.[s] ?? 0; return '<div class="st lv-' + statLevel(v) + '"><span>' + esc(statName(s)) + '</span><b>' + v + '</b><div class="seg" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + v + '" aria-label="' + esc(statName(s)) + '"><i style="--v:' + v + '"></i></div></div>'; }).join('');
  /** An employee of any role's roster, by id: who wrote a recommendation. */
  const findEmp = (id) => { for (const r of ROLES) { const p = people(r).find((e) => e.id === id); if (p) return { role: r, p }; } return null; };
  const sec = (title, body) => '<section class="li-sec"><div class="lbl">' + esc(title) + '</div>' + body + '</section>';
  const connText = (n) => n == null ? '' : Number(n) >= 500 ? t('sq.li.connectionsMany') : t('sq.li.connections', n);
  const inTeam = (id) => members().some((x) => x.employee === id);
  /** The member's profile (requirement 31): the selected member, or the candidate opened from the pool or a
   * recommendation. */
  function sheet(bodyOnly) {
    const x = cur(), r = x?.role ?? role, hired = empOf(x), cand = viewing ? people(r).find((e) => e.id === viewing) : null, p = cand ?? hired, isHired = !!x && !cand;
    const head = '<div class="hs"><span>' + esc(t('sq.li.profile')) + ' ' + sep + ' ' + esc(t('sq.role.' + r)) + '</span><span class="sq-grow"></span><span class="led ' + (isHired ? 'on' : p ? 'idle' : 'off') + '"></span><span>' + esc(isHired ? t('sq.hud.onDuty') : p ? t('sq.li.candidate') : t('sq.vacant')) + '</span></div>';
    const lead = isHired && leadOf(S.team) === x.id;
    const leadBtn = lead ? '<span class="tag lead">' + esc(t('sq.isLead')) + '</span>' : '<button data-a="lead">' + esc(t('sq.makeLead')) + '</button>';
    if (!p) {
      if (!x) return '<div class="hud brk">' + head + '<div class="cs-vacant"><h2>' + esc(t('sq.wz.noMembers')) + '</h2><div class="sq-muted">' + esc(t('sq.wz.noMembersHelp')) + '</div></div></div>';
      return '<div class="hud brk">' + head + '<div class="cs-vacant"><h2>' + esc(memberName(x)) + ' ' + paidTag(x) + '</h2><div class="sq-muted">' + esc(t('sq.wz.noEmployee')) + '</div><div class="sq-row">' + leadBtn + '<button class="danger" data-a="remove">' + esc(t('sq.wz.letGo')) + '</button></div></div></div>';
    }
    const name = isHired ? memberName(x) : p.name, tm = isHired ? memberTemper(x, p) : p.temperament || '', v = ovr(p);
    const meta = [p.location, ageText(p.age)].filter(Boolean).map(esc).join(' · ') + (p.connections != null ? ' · <b>' + esc(connText(p.connections)) + '</b>' : '');
    const buttons = isHired
      ? leadBtn + '<button class="danger" data-a="remove">' + esc(t('sq.wz.letGo')) + '</button>'
      : (inTeam(p.id) ? '<span class="tag lead">' + esc(t('sq.wz.inTeam')) + '</span>' : '<button class="primary" data-addemp="' + esc(p.id) + '">+ ' + esc(t('sq.wz.addAs', t('sq.role.' + r))) + '</button>' + (x ? '<button data-hire="' + esc(p.id) + '">' + esc(t('sq.li.replace', memberName(x))) + '</button>' : ''))
        + (x ? '<button data-a="back">‹ ' + esc(t('sq.li.back', memberName(x))) + '</button>' : '');
    const banner = '<div class="li-banner" style="--rc:' + COLOR[r] + '"><span class="eyebrow">' + esc(t('sq.hud.operative')) + ' // ' + esc(opCode(p.id)) + '</span><span class="eyebrow">' + esc(worksText(r)) + '</span></div>';
    const face = pf(p.id, name, COLOR[r], '', 'scan li-pf', true).replace('<span class="pf', '<span data-code="' + esc(t('sq.abbr.' + r)) + '" class="pf').replace(/<\/span>$/, '<span class="sweep"></span></span>');
    const top = '<div class="li-head">' + face + '<div class="li-id"><h2>' + esc(name) + (lead ? '<span class="tag lead">' + esc(t('sq.techLead')) + '</span>' : '') + (isHired ? paidTag(x) : '') + (tm ? '<span class="tag tmp" title="' + esc(t('sq.temperament')) + '">' + esc(temperName(tm)) + '</span>' : '') + '</h2>'
      + '<div class="li-headline">' + esc(p.headline || p.profile) + (isHired && x.name && x.name !== p.name ? ' <span>· ' + esc(t('sq.hud.employee', p.name)) + '</span>' : '') + '</div>'
      + '<div class="li-meta">' + meta + '</div>' + (isHired ? '<div class="li-meta">' + esc(t('sq.hud.workedBy')) + ': ' + esc(t('sq.kind.' + x.kind) + ' · ' + whoText(x)) + '</div>' : '') + '</div>'
      + '<div class="li-act">' + buttons + '</div></div>';
    const tile = (label) => '<span class="li-logo" style="background:' + teamColor(label || '?') + '">' + esc(initials(label || '?')) + '</span>';
    const exp = (p.experience ?? []).map((e) => '<div class="li-item">' + tile(e.company) + '<div><b>' + esc(e.title) + '</b><div class="mono">' + esc(e.company) + (e.years ? ' · ' + esc(e.years) : '') + '</div>' + (e.line ? '<div class="sq-muted">' + esc(e.line) + '</div>' : '') + '</div></div>').join('');
    const edu = (p.education?.length ? p.education : p.university ? [{ school: p.university }] : []).map((e) => '<div class="li-item">' + tile(e.school) + '<div><b>' + esc(e.school) + '</b>' + (e.degree || e.years ? '<div class="mono">' + esc([e.degree, e.years].filter(Boolean).join(' · ')) + '</div>' : '') + '</div></div>').join('');
    const recs = (p.recommendations ?? []).map((rc) => { const f = findEmp(rc.from); const who = f?.p.name ?? rc.from; return '<button class="li-rec" data-view="' + esc(rc.from) + '" title="' + esc(t('sq.li.openProfile', who)) + '">' + pf(f ? rc.from : '', who, f ? COLOR[f.role] : 'var(--mut)', '34px') + '<span><q>' + esc(rc.text) + '</q><small>' + esc(who) + (f ? ' · ' + esc(t('sq.role.' + f.role)) : '') + '</small></span></button>'; }).join('');
    const acts = isHired ? (S.activity?.[x.id] ?? []) : [];
    const activity = acts.length ? acts.map((a) => '<div class="li-feed"><span class="led st-' + esc(a.status) + '"></span><span>' + esc(a.step) + ' <span class="sq-muted">· ' + esc(a.station) + ' · ' + esc(a.spec) + '</span></span><small>' + esc(new Date(a.at).toLocaleDateString(t('sq.lang'))) + '</small></div>').join('') : '<div class="li-none">' + esc(isHired ? t('sq.li.noActivity') : t('sq.li.noActivityCand')) + '</div>';
    const end = p.endorsements ?? {}, skills = [...(p.skills ?? [])].sort((a, b) => (end[b] ?? 0) - (end[a] ?? 0)), most = Math.max(1, ...skills.map((s) => end[s] ?? 0));
    const skillRows = (skillsAll ? skills : skills.slice(0, 3)).map((s) => '<div class="li-skill"><span>' + esc(s) + '</span><small>' + esc(t('sq.li.endorsed', end[s] ?? 0)) + '</small><div class="gauge"><i style="width:' + Math.round(((end[s] ?? 0) / most) * 100) + '%"></i></div></div>').join('')
      + (skills.length > 3 ? '<button class="li-link" data-a="skillsAll">' + esc(skillsAll ? t('sq.li.fewer') : t('sq.li.allSkills', skills.length)) + '</button>' : '');
    const stats = '<div class="li-stats"><div class="ring" style="--v:' + v + '" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + v + '" aria-label="' + esc(t('sq.ovr')) + '"><i></i><b>' + v + '<small>' + esc(t('sq.ovr')) + '</small></b></div><div class="bars">' + statBars(r, p) + '</div></div>';
    const main = sec(t('sq.li.about'), '<p>' + esc(p.bio) + '</p>')
      + (exp ? sec(t('sq.li.experience'), exp) : '') + (edu ? sec(t('sq.li.education'), edu) : '')
      + (recs ? sec(t('sq.li.recommendations'), recs) : '')
      + sec(t('sq.li.activity'), activity);
    const rail = sec(t('sq.hud.stats'), stats)
      + (skills.length ? sec(t('sq.li.skills'), skillRows) : '')
      + (tm && temperOf(tm) ? sec(t('sq.temperament'), '<span class="tag tmp">' + esc(temperName(tm)) + '</span>' + (temperAbout(tm) ? '<p class="cs-voice">' + esc(temperAbout(tm)) + '</p>' : '')) : '')
      + (p.openTo ? sec(t('sq.li.openTo'), '<div class="li-open">' + esc(p.openTo) + '</div>') : '')
      + (p.hrNote ? sec(t('sq.hud.hrNote'), '<div class="li-hr" data-stamp="' + esc(t('sq.li.hrStamp')) + '">' + esc(p.hrNote) + '</div>') : '');
    const cols = '<div class="li-cols"><div class="li-main">' + main + '</div><div class="li-rail">' + rail + '</div></div>';
    // the member panel's Profile tab: the card's whole story, the line of where, age and connections with it
    if (bodyOnly) return '<div class="li-meta li-where">' + meta + '</div>' + cols;
    return '<div class="hud brk">' + head + banner + top + cols + '</div>';
  }
  function side() {
    const x = cur();
    // a candidate's profile has no settings: they are the member's
    if (!x || viewing) return '<div class="sq-side">' + sheet() + '</div>';
    return '<div class="sq-side">' + memberPanel(fill(x)) + '</div>';
  }
  /** A member as one works with it: a compact header (portrait, name, role, headline, status, its brain, tech lead, let
   * go), then the tabs: an overview, the settings, and the fun profile last. */
  function memberPanel(x) {
    const p = empOf(x), r = x.role, name = memberName(x), lead = leadOf(S.team) === x.id;
    const acts = S.activity?.[x.id] ?? [], working = acts.some((a) => a.status === 'running' || a.status === 'waiting');
    const head = '<div class="hs"><span>' + esc(t('sq.hud.operative')) + ' ' + sep + ' ' + esc(t('sq.role.' + r)) + '</span><span class="sq-grow"></span><span class="led ' + (working ? 'on' : 'idle') + '"></span><span>' + esc(working ? t('sq.mp.working') : t('sq.hud.onDuty')) + '</span></div>';
    const top = '<div class="mp-head">' + pf(p?.id, name, COLOR[r], '64px') + '<div class="mp-id"><h2>' + esc(name) + (lead ? '<span class="tag lead">' + esc(t('sq.techLead')) + '</span>' : '') + paidTag(x) + '</h2>'
      + '<div class="mp-sub"><span style="color:' + COLOR[r] + '">' + esc(t('sq.role.' + r)) + '</span> · ' + esc(worksText(r)) + '</div>'
      + (p ? '<div class="mp-line" title="' + esc(p.headline || p.profile) + '">' + esc(p.headline || p.profile) + '</div>' : '<div class="mp-line sq-muted">' + esc(t('sq.wz.noEmployee')) + '</div>') + '</div>'
      + '<div class="mp-act">' + (lead ? '' : '<button data-a="lead">' + esc(t('sq.makeLead')) + '</button>') + '<button class="danger" data-a="remove">' + esc(t('sq.wz.letGo')) + '</button></div></div>';
    const level = ramLevel(modelInfo(x.provider, x.model)), typing = brainOther?.provider === x.provider ? brainOther : null;
    const brain = '<div class="mp-brain"><label for="sqBrain" class="lbl">' + esc(t('sq.mp.brain')) + '</label><select id="sqBrain" data-f="brain" aria-describedby="sqBrainHint"' + (level ? ' class="ram-' + level + '"' : '') + '>' + brainOptions(x) + '</select>'
      + (typing ? '<span class="sq-model"><input data-f="brainother" value="' + esc(x.model ?? '') + '" placeholder="' + esc(t('sq.model.otherPlaceholder')) + '" aria-label="' + esc(t('sq.model.other')) + '"></span>' : '')
      + ramLine(x.provider, x.model)
      + '<span id="sqBrainHint" class="sq-muted">' + esc(isPaid(x) ? t('sq.mp.brainPaid') : t('sq.mp.brainFree')) + '</span></div>';
    const tabs = ['overview', 'person', 'skills', 'instructions', 'behaviour', 'tasks', 'profile'].map((id) => '<button data-tab="' + id + '" role="tab" aria-selected="' + (tab === id) + '" class="' + (tab === id ? 'sel' : '') + '">' + esc(t('sq.tab.' + id)) + '</button>').join('');
    const body = tab === 'overview' ? overview(x, p, acts) : tab === 'profile' ? (p ? sheet(true) : '<div class="li-none">' + esc(t('sq.wz.noEmployee')) + '</div>') : pane(x);
    return '<div class="hud brk mp" style="--rc:' + COLOR[r] + '">' + head + top + brain + '</div><div class="sq-box hud brk"><div class="sq-tabs" role="tablist">' + tabs + '</div>' + body + '</div>';
  }
  /** Every agent and model this machine offers as one list ("Claude Code · opus"): the model names the agent. Grouped by
   * agent, the paid ones marked, the ones that cannot work here disabled with why (the wizard's rules). */
  function brainOptions(x) {
    const kindOf = (prov) => Object.keys(PROVIDERS).find((k) => PROVIDERS[k].includes(prov)) ?? (AGENTS ?? []).find((a) => a.provider === prov)?.kind ?? 'api';
    const ids = [...new Set([...PROVIDERS.local, ...PROVIDERS.agent, ...PROVIDERS.api, ...(AGENTS ?? []).map((a) => a.provider)])];
    const cur = (x.kind || 'local') + '|' + x.provider + '|' + (x.model ?? '');
    let found = false;
    const groups = ids.map((prov) => {
      const k = kindOf(prov), ok = usable(prov), label = provKind(prov);
      // the provider's default, then every model it lists (a too-big one in red), then *Other…* where any is taken
      const list = [{ id: '' }, ...(ok ? modelsFor(prov) : [])];
      const opts = list.map((m) => { const v = k + '|' + prov + '|' + m.id, on = v === cur || (!found && prov === x.provider && !m.id && !x.model); if (on) found = true; const level = ramLevel(m); return '<option value="' + esc(v) + '"' + (on ? ' selected' : '') + (ok && m.priced !== false ? '' : ' disabled') + (level ? ' class="ram-' + level + '"' : '') + '>' + esc((k !== 'local' ? '$ ' : '') + label + ' · ' + (m.id ? modelText(m) : k === 'local' ? t('sq.wz.modelLocal') : t('sq.modelDefault')) + (ok ? '' : ' — ' + whyNot(prov))) + '</option>'; }).join('')
        + (ok && freeModel(prov) ? '<option value="' + esc(k + '|' + prov + '|__other__') + '">' + esc((k !== 'local' ? '$ ' : '') + label + ' · ' + t('sq.model.other')) + '</option>' : '');
      return '<optgroup label="' + esc(provGroup(prov)) + '">' + opts + '</optgroup>';
    }).join('');
    // a choice this machine does not list (a model typed in the wizard, another machine's agent) stays shown
    return (found ? '' : '<option value="' + esc(cur) + '" selected>' + esc(whoText(x)) + '</option>') + groups;
  }
  /** The member at a glance: its brain, status, teams, lead, cost and budget, temperament, skills and last work. */
  function overview(x, p, acts) {
    const ro = (label, value, action) => '<div class="ov-r"><span class="lbl">' + esc(label) + '</span><span class="ov-v">' + value + '</span>' + (action ?? '') + '</div>';
    const teams = (S.company ?? []).filter((c) => (c.members ?? []).some((m) => x.employee && m.employee === x.employee)).map((c) => c.name);
    if (!teams.includes(S.team.name)) teams.unshift(S.team.name);
    const roleSk = S.roster?.[x.role]?.skills ?? [], on = x.skills.filter((s) => roleSk.includes(s)).length, own = (x.ownSkills ?? []).length;
    const tm = memberTemper(x, p), lead = leadOf(S.team) === x.id;
    const key = x.kind === 'api' ? (S.vault === null ? '<span class="sq-muted">' + esc(t('sq.vaultUnknown')) + '</span>' : S.vault?.[x.provider] ? '<span class="sq-key ok">✓ ' + esc(t('sq.keyKept')) + '</span>' : '<span class="sq-key bad">' + esc(t('sq.keyMissing')) + '</span>') : '';
    const keyBtn = x.kind === 'api' && S.vault !== null ? '<button data-a="key">' + esc(S.vault?.[x.provider] ? t('sq.keyChange') : t('sq.keySet')) + '</button>' : '';
    const budget = Number(S.team.budgetUsd ?? 0);
    const feed = acts.length ? acts.slice(0, 4).map((a) => '<div class="li-feed"><span class="led st-' + esc(a.status) + '"></span><span>' + esc(a.step) + ' <span class="sq-muted">· ' + esc(a.station) + ' · ' + esc(a.spec) + '</span></span><small>' + esc(new Date(a.at).toLocaleDateString(t('sq.lang'))) + '</small></div>').join('') : '<div class="li-none">' + esc(t('sq.li.noActivity')) + '</div>';
    return '<div class="ov">'
      + ro(t('sq.mp.brain'), esc(whoText(x)) + ' ' + paidTag(x), '<button data-a="brain">' + esc(t('sq.mp.change')) + '</button>')
      + (key ? ro(t('sq.apiKey'), key, keyBtn) : '')
      + ro(t('sq.mp.cost'), esc(isPaid(x) ? t('sq.mp.paidBudget', budget > 0 ? budget.toFixed(2) + ' USD' : t('sq.mp.noLimit')) : t('sq.mp.free')))
      + numbersRow(x, ro)
      + ro(t('sq.mp.teams'), esc(teams.join(' · ')))
      + ro(t('sq.techLead'), esc(lead ? t('sq.mp.yes') : t('sq.mp.no')), lead ? '' : '<button data-a="lead">' + esc(t('sq.makeLead')) + '</button>')
      + ro(t('sq.temperament'), tm ? '<span class="tag tmp">' + esc(temperName(tm)) + '</span>' : '—', '<button data-tab="person">' + esc(t('sq.mp.change')) + '</button>')
      + ro(t('sq.tab.skills'), esc(t('sq.mp.skillsOn', on, roleSk.length) + (own ? ' · ' + t('sq.mp.ownSkills', own) : '')), '<button data-tab="skills">' + esc(t('sq.mp.change')) + '</button>')
      + '</div><div class="lbl ov-h">' + esc(t('sq.li.activity')) + '</div>' + feed;
  }
  /** The member's numbers from the factory's ledger: steps, answers, lines, passed and failed, tokens, money. */
  function numbersRow(x, ro) {
    const n = NUMBERS[x.id];
    if (!n) return '';
    const k = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e4 ? (v / 1e3).toFixed(1) + 'k' : String(v));
    return ro(t('sq.mp.numbers'), esc(t('sq.mp.numbersText', n.steps, n.answers, n.added, n.removed, n.passed, n.failed, k(n.inTokens + n.outTokens), '$' + Number(n.costUsd).toFixed(2))), '<button data-a="reports">' + esc(t('sq.mp.reports')) + '</button>');
  }
  /** The brain's list, focused (the roster's chip, the overview's *Change*). */
  function focusBrain() { tab = 'overview'; askAgents(); draw(); const b = el.querySelector('#sqBrain'); if (b) { b.scrollIntoView?.({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); b.focus({ preventScroll: true }); } }
  const sw = (key, on, label, hint) => '<div class="sq-toggle"><div>' + esc(label) + (hint ? '<div class="sq-muted" style="font-size:11.5px">' + esc(hint) + '</div>' : '') + '</div><label class="sq-switch"><input type="checkbox" data-sw="' + esc(key) + '"' + (on ? ' checked' : '') + ' aria-label="' + esc(label) + '"><span></span></label></div>';
  function pane(x) {
    if (tab === 'person') {
      const p = empOf(x), pe = x.personality ?? {}, lead = leadOf(S.team) === x.id;
      return '<div class="sq-grid" style="margin-top:0"><label>' + esc(t('sq.memberName')) + '</label><input data-f="mname" value="' + esc(x.name ?? '') + '" placeholder="' + esc(p?.name ?? t('sq.role.' + x.role)) + '">'
        + '<div class="sq-hint">' + esc(t('sq.memberNameHint')) + '</div>'
        + '<label>' + esc(t('sq.techLead')) + '</label><div>' + (lead ? '<span class="tag lead">' + esc(t('sq.isLead')) + '</span>' : '<button data-a="lead">' + esc(t('sq.makeLead')) + '</button>') + '</div>'
        + '<div class="sq-hint">' + esc(t('sq.techLeadHint')) + '</div>'
        + (S.temperaments?.length ? '<label>' + esc(t('sq.temperament')) + '</label><select data-f="temper" aria-label="' + esc(t('sq.temperament')) + '">' + S.temperaments.map((m) => '<option value="' + esc(m.id) + '"' + ((pe.temperament ?? p?.temperament) === m.id ? ' selected' : '') + ' title="' + esc(temperAbout(m.id)) + '">' + esc(m.name?.[t('sq.lang')] ?? m.name?.en ?? m.id) + (m.id === p?.temperament ? ' · ' + esc(t('sq.temperamentOwn')) : '') + '</option>').join('') + '</select><div class="sq-hint">' + esc(t('sq.temperamentHint')) + '</div>' : '')
        + '<label>' + esc(t('sq.gifs')) + '</label><div><div class="sq-seg" role="group" aria-label="' + esc(t('sq.gifs')) + '">' + ['never', 'sometimes', 'often'].map((g) => '<button data-gifs="' + g + '" aria-pressed="' + ((pe.gifs ?? 'sometimes') === g) + '" class="' + ((pe.gifs ?? 'sometimes') === g ? 'sel' : '') + '">' + esc(t('sq.gifs.' + g)) + '</button>').join('') + '</div></div>'
        + '<label>' + esc(t('sq.gifsOn')) + '</label><input data-f="pon" value="' + esc(pe.on ?? '') + '" placeholder="' + esc(t('sq.gifsOnPlaceholder')) + '"' + ((pe.gifs ?? 'sometimes') === 'never' ? ' disabled' : '') + '>'
        + '<label style="align-self:start;margin-top:6px">' + esc(t('sq.note')) + '</label><textarea data-f="pnote" rows="3" style="min-height:64px" placeholder="' + esc(t('sq.notePlaceholder')) + '">' + esc(pe.note ?? '') + '</textarea>'
        + '</div>';
    }
    if (tab === 'skills') {
      // the role's skills (switched on or off), then the skills of the library and the user's: its own first, then what
      // it inherits from the team (spec 011 requirement 34)
      const known = [...new Set([...(S.roster?.[x.role]?.skills ?? []), ...(seenSkills[x.role] ?? [])])];
      return '<h4 style="margin-top:0">' + esc(t('sq.sk.roleSkills')) + '</h4><div class="sq-muted">' + esc(t('sq.skillsHint')) + '</div>'
        + (known.length ? known.map((s) => sw('skill:' + s, x.skills.includes(s), skillTitle(x.role, s), skillAbout(x.role, s))).join('') : '<div class="sq-muted" style="margin:8px 0">' + esc(t('sq.noSkills')) + '</div>')
        + memberSkillsHtml(x);
    }
    if (tab === 'instructions') return '<div class="sq-muted" style="margin-bottom:6px">' + esc(t('sq.instructionsHint')) + '</div><textarea data-f="instructions" rows="8" placeholder="' + esc(t('sq.instructionsPlaceholder')) + '">' + esc(x.instructions) + '</textarea>';
    if (tab === 'behaviour') return '<div class="sq-muted">' + esc(t('sq.behaviourHint')) + '</div>' + [...new Set([...BEHAVIOURS, ...Object.keys(x.behaviour)])].map((b) => sw('b:' + b, !!x.behaviour[b], T['sq.b.' + b] ?? b, T['sq.b.' + b + '.hint'] ?? '')).join('');
    return '<div class="sq-muted">' + esc(t('sq.tasksHint')) + '</div>'
      + x.tasks.map((k, i) => '<div class="sq-row"><label class="sq-switch"><input type="checkbox" data-task-on="' + i + '"' + (k.on !== false ? ' checked' : '') + ' aria-label="' + esc(t('sq.taskOn')) + '"><span></span></label><input data-f="task-title-' + i + '" value="' + esc(k.title) + '" placeholder="' + esc(t('sq.taskTitle')) + '"><select data-f="task-station-' + i + '">' + STATIONS.map((s) => '<option value="' + s + '"' + (s === k.station ? ' selected' : '') + '>' + esc(t('sq.station.' + s)) + '</option>').join('') + '</select><button data-deltask="' + i + '" title="' + esc(t('sq.remove')) + '" aria-label="' + esc(t('sq.remove')) + '">✕</button></div>').join('')
      + '<div class="sq-row"><button data-a="addTask">+ ' + esc(t('sq.addTask')) + '</button></div>';
  }
  const seenSkills = {};
  /** The inspector of the hiring pool: the candidate under the pointer (or the focused one), else the selected member. */
  function peekHtml(r) {
    const all = people(r), p = all.find((e) => e.id === peek) ?? (cur()?.role === r ? empOf(cur()) : null) ?? all[0];
    if (!p) return '<div class="ro-peek"></div>';
    const tm = p.temperament;
    return '<div class="ro-peek" aria-live="polite"><div class="lbl">' + esc(t('sq.hud.dossier')) + ' // ' + esc(opCode(p.id)) + '</div><div class="top">' + pf(p.id, p.name, COLOR[r], '64px', 'scan') + '<div><b>' + esc(p.name) + '</b><div class="sq-muted">' + esc(p.profile) + '</div>' + (tm ? '<span class="tag tmp">' + esc(temperName(tm)) + '</span>' : '') + '</div></div>'
      + '<dl class="rows"><dt>' + esc(t('sq.hud.location')) + '</dt><dd>' + esc(p.location) + '</dd><dt>' + esc(t('sq.hud.age')) + '</dt><dd>' + esc(ageText(p.age)) + '</dd><dt>' + esc(t('sq.hud.university')) + '</dt><dd>' + esc(p.university) + '</dd></dl>'
      + '<div class="mini">' + statBars(r, p) + '</div><p>“' + esc(p.bio) + '”</p><p class="sq-muted">' + esc(p.hrNote) + '</p></div>';
  }
  function rosterRow() {
    const all = people(role);
    const list = filterRoster(all, filter, ftemper, fgender);
    const tempers = [...new Set(all.map((p) => p.temperament).filter(Boolean))], genders = [...new Set(all.map((p) => p.gender).filter(Boolean))];
    const tiles = list.map((p) => '<div class="ro-t' + (p.id === peek ? ' peek' : '') + '" style="--rc:' + COLOR[role] + '" draggable="true" data-drag="' + esc(p.id) + '" data-cand="' + esc(p.id) + '" data-view="' + esc(p.id) + '" tabindex="0" role="button" aria-label="' + esc(p.name + (p.temperament ? ' · ' + temperName(p.temperament) : '') + ' · ' + p.profile) + '">'
      + pf(p.id, p.name, COLOR[role], '', 'scan') + '<b>' + esc(p.name) + '</b>' + (p.temperament ? '<span class="tag tmp">' + esc(temperName(p.temperament)) + '</span>' : '')
      + (inTeam(p.id) ? '<span class="tag lead hired">' + esc(t('sq.wz.inTeam')) + '</span>' : '<button class="primary hire" data-addemp="' + esc(p.id) + '">+ ' + esc(t('sq.wz.add')) + '</button>') + '</div>').join('');
    const sel0 = (f, anyText, values, value, label) => '<select data-f="' + f + '" aria-label="' + esc(anyText) + '"><option value="">' + esc(anyText) + '</option>' + values.map((v) => '<option value="' + esc(v) + '"' + (v === value ? ' selected' : '') + '>' + esc(label(v)) + '</option>').join('') + '</select>';
    const roleSel = '<select data-f="prole" aria-label="' + esc(t('sq.wz.role')) + '">' + ROLES.map((r) => '<option value="' + r + '"' + (r === role ? ' selected' : '') + '>' + esc(t('sq.role.' + r)) + '</option>').join('') + '</select>';
    return '<div class="sq-roster hud brk"><div class="hs"><span>' + esc(t('sq.rosterOf', t('sq.role.' + role))) + '</span>' + dot + '<span>' + esc(t('sq.hud.shown', list.length, all.length)) + '</span></div>'
      + '<div class="ro-filters">' + roleSel + '<input data-f="filter" placeholder="' + esc(t('sq.search')) + '" value="' + esc(filter) + '" aria-label="' + esc(t('sq.search')) + '">'
      + (tempers.length ? sel0('ftemper', t('sq.hud.anyTemper'), tempers, ftemper, temperName) : '') + (genders.length ? sel0('fgender', t('sq.hud.anyGender'), genders, fgender, (g) => T['sq.gender.' + g] ?? g) : '')
      + '<span class="sq-muted">' + esc(t('sq.rosterHint')) + '</span></div>'
      + (all.length ? '<div class="ro-main"><div class="ro-grid">' + (tiles || '<div class="sq-muted">' + esc(t('sq.hud.noMatch')) + '</div>') + '</div>' + peekHtml(role) + '</div>' : '<div class="sq-muted" style="padding:12px">' + esc(t('sq.noRoster')) + '</div>') + '</div>';
  }
  /** What typing in a search redraws, once the typing pauses: the pool is not drawn again on every key. */
  function later(f) { clearTimeout(later.h); later.h = setTimeout(f, 120); }
  function redrawRoster(keepFocus) {
    const q = el.querySelector('.sq-roster'); if (!q) return;
    const a = keepFocus ? document.activeElement : null, f = a?.dataset?.f, caret = a && typeof a.selectionStart === 'number' ? a.selectionStart : null;
    q.outerHTML = rosterRow();
    if (f) { const n = el.querySelector('[data-f="' + f + '"]'); n?.focus(); if (caret !== null) try { n.setSelectionRange(caret, caret); } catch {} }
  }
  function onPeek(e) {
    const c = e.target.closest?.('[data-cand]'); if (!c || c.dataset.cand === peek) return;
    peek = c.dataset.cand;
    el.querySelectorAll('.ro-t.peek').forEach((x) => x.classList.remove('peek')); c.classList.add('peek');
    const p = el.querySelector('.ro-peek'); if (p) p.outerHTML = peekHtml(view === 'wizard' ? (findEmp(peek)?.role ?? role) : role);
  }

  // ---------- the skills (spec 011 requirement 34): the library, the team's and the member's, a preview, an editor ----------
  // A place of skills: 'w' the wizard's team, 'w:<i>' a member of the wizard, 't' the open team, 't:<id>' its member.
  const KIND_TEXT = (k) => T['sq.sk.kind.' + k] ?? k;
  const libOf = (id) => (S.library ?? []).find((s) => s.id === id) ?? null;
  const agentLib = (id) => (S.agents ?? []).find((a) => a.id === id) ?? null;
  /** What holds a place's skills (skills, ownSkills): the wizard, a wizard's member, the team or one of its members. */
  function skHolder(place) {
    const [w, m] = String(place).split(':');
    if (w === 'w') return m === undefined ? W : W?.members[+m] ?? null;
    return m === undefined ? S.team : memberById(m);
  }
  const skTeamOf = (place) => String(place).startsWith('w') ? W : S.team;
  const isMemberPlace = (place) => String(place).includes(':');
  const ownTitle = (s) => (t('sq.lang') === 'es' && s.title_es) ? s.title_es : s.name;
  const ownAbout = (s) => (t('sq.lang') === 'es' && s.description_es) ? s.description_es : (s.description ?? '');
  /** A skill as a place sees it: the member's own, the team's own, else the library's. */
  function skEntry(id, place) {
    const h = skHolder(place), team = skTeamOf(place);
    const mine = isMemberPlace(place) ? (h?.ownSkills ?? []).find((s) => s.id === id) : null;
    if (mine) return { id, title: ownTitle(mine), description: ownAbout(mine), markdown: skillMarkdown(mine), from: 'member', own: mine, clonedFrom: mine.from };
    const teams = (team?.ownSkills ?? []).find((s) => s.id === id);
    if (teams) return { id, title: ownTitle(teams), description: ownAbout(teams), markdown: skillMarkdown(teams), from: 'team', own: isMemberPlace(place) ? null : teams, inherited: isMemberPlace(place), clonedFrom: teams.from };
    const l = libOf(id);
    return l ? { id, title: l.title, description: l.description, markdown: l.markdown ?? '', from: 'library', kind: l.kind, tags: l.tags } : null;
  }
  /** The library skills a place has (a member's: those of its skills that are not its role's). */
  function skAttached(place) {
    const h = skHolder(place); if (!h) return [];
    if (!isMemberPlace(place)) return h.skills ?? [];
    const roleNames = S.roster?.[h.role]?.skills ?? [];
    return (h.skills ?? []).filter((s) => !roleNames.includes(s));
  }
  const skBadge = (from, extra) => '<span class="sk-from sk-' + esc(from) + '">' + esc(t('sq.sk.from.' + from)) + (extra ? ' · ' + esc(extra) : '') + '</span>';
  /** A chip of the library: its box switches it on for the place, its name opens its file. */
  const skChip = (place, s, on) => '<span class="sk-chip' + (on ? ' on' : '') + '"><button class="sk-box" data-skt="' + esc(place + '|' + s.id) + '" aria-pressed="' + on + '" aria-label="' + esc((on ? t('sq.sk.detach') : t('sq.sk.attach')) + ': ' + s.title) + '">' + (on ? '✓' : '+') + '</button><button class="sk-name" data-skv="' + esc(place + '|' + s.id) + '" title="' + esc(s.description ?? '') + '">' + esc(s.title) + '</button></span>';
  /** The library grouped by kind (domains, technologies, practices), searched: the wizard's step 2 and the picker. */
  function libraryChips(place, on, field, q) {
    const groups = libraryGroups(S.library ?? [], q);
    return '<div class="sk-lib"><input class="sk-search" data-f="' + field + '" value="' + esc(q) + '" placeholder="' + esc(t('sq.sk.search', (S.library ?? []).length)) + '" aria-label="' + esc(t('sq.sk.searchLabel')) + '">'
      + (groups.length ? groups.map((g) => '<div class="sk-group"><span class="lbl">' + esc(KIND_TEXT(g.kind)) + ' <i>' + g.skills.length + '</i></span><div class="sk-chips">' + g.skills.map((s) => skChip(place, s, on.includes(s.id))).join('') + '</div></div>').join('')
        : '<div class="sq-muted" style="padding:8px 0">' + esc((S.library ?? []).length ? t('sq.hud.noMatch') : t('sq.sk.noLibrary')) + '</div>') + '</div>';
  }
  /** What a place has chosen: its library skills and its own, each opening its file; New skill opens the editor. */
  function skillChosen(place, attached, own) {
    const libs = (attached ?? []).filter((id) => !(own ?? []).some((o) => o.id === id)).map((id) => libOf(id)).filter(Boolean);
    const chips = libs.map((s) => '<span class="sk-chip on"><button class="sk-name" data-skv="' + esc(place + '|' + s.id) + '">' + esc(s.title) + '</button><button class="sk-box" data-skt="' + esc(place + '|' + s.id) + '" aria-label="' + esc(t('sq.sk.detach') + ': ' + s.title) + '">✕</button></span>').join('')
      + (own ?? []).map((s) => '<span class="sk-chip own"><button class="sk-name" data-skv="' + esc(place + '|' + s.id) + '">✎ ' + esc(ownTitle(s)) + '</button></span>').join('');
    return '<div class="sk-chosen"><span class="lbl">' + esc(t('sq.sk.chosen', libs.length + (own ?? []).length)) + '</span>' + (chips || '<span class="sq-muted">' + esc(t('sq.sk.noneChosen')) + '</span>') + '<span class="sq-grow"></span><button data-sknew="' + esc(place) + '">+ ' + esc(t('sq.sk.new')) + '</button></div>';
  }
  /** The team's skills, inherited by every member: under the team's description. */
  function teamSkills() {
    const own = S.team.ownSkills ?? [], attached = S.team.skills ?? [];
    return '<div class="sk-team hud"><div class="hs"><span>' + esc(t('sq.sk.teamSkills')) + '</span>' + dot + '<span class="fit">' + esc(t('sq.sk.teamSkillsHint')) + '</span><span class="sq-grow"></span><button data-skpick="t">+ ' + esc(t('sq.sk.addLibrary')) + '</button></div>'
      + skillChosen('t', attached, own) + '</div>';
  }
  /** A member's skills beside its role's: its own first, then its library skills, then what it inherits from the team
   * (marked), what each overrides; its base agent. */
  function memberSkillsHtml(x) {
    const place = 't:' + x.id, rows = memberSkills(S.team, x, S.library ?? [], S.agents ?? [], S.roster?.[x.role]?.skills ?? []);
    // an own skill's title in the page's language (its title_es)
    for (const r of rows) { const own = r.from === 'member' ? (x.ownSkills ?? []).find((s) => s.id === r.id) : r.from === 'team' ? (S.team.ownSkills ?? []).find((s) => s.id === r.id) : null; if (own) { r.title = ownTitle(own); r.description = ownAbout(own); } }
    const agents = (S.agents ?? []).filter((a) => !a.role || a.role === x.role);
    const agentSel = (S.agents ?? []).length ? '<label class="sk-base"><span class="lbl">' + esc(t('sq.sk.agent')) + '</span><select data-f="magent" aria-label="' + esc(t('sq.sk.agent')) + '"><option value="">' + esc(t('sq.sk.noAgent')) + '</option>' + agents.map((a) => '<option value="' + esc(a.id) + '"' + (x.agent === a.id ? ' selected' : '') + ' title="' + esc(a.description) + '">' + esc(a.title) + '</option>').join('') + '</select>' + (x.agent ? '<button data-skv="' + esc(place + '|agent:' + x.agent) + '">' + esc(t('sq.sk.preview')) + '</button>' : '') + '</label><div class="sq-muted" style="font-size:11.5px">' + esc(t('sq.sk.agentHint')) + '</div>' : '';
    const row = (r) => '<div class="sk-row' + (r.inherited ? ' inh' : '') + '"><div class="sk-row-t"><b>' + esc(r.title) + '</b>' + skBadge(r.from === 'member' ? 'own' : r.inherited ? 'inherited' : r.via === 'agent' ? 'agent' : 'library', r.from === 'team' && !r.inherited ? t('sq.sk.from.team') : '')
      + (r.overrides.length ? '<span class="sk-over">' + esc(t('sq.sk.overrides', r.overrides.map((o) => t('sq.sk.from.' + o)).join(', '))) + '</span>' : '') + '<div class="sq-muted">' + esc(r.description) + '</div></div>'
      + '<div class="sk-row-a"><button data-skv="' + esc(place + '|' + r.id) + '">' + esc(t('sq.sk.preview')) + '</button>'
      + (r.from === 'member' ? '<button data-ske="' + esc(place + '|' + r.id) + '">' + esc(t('sq.sk.edit')) + '</button><button class="danger" data-skd="' + esc(place + '|' + r.id) + '" aria-label="' + esc(t('sq.sk.delete') + ': ' + r.title) + '">✕</button>'
        : '<button data-skc="' + esc(place + '|' + r.id) + '" title="' + esc(t('sq.sk.cloneMemberHint')) + '">' + esc(t('sq.sk.cloneHere')) + '</button>' + (r.via === 'member' ? '<button data-skt="' + esc(place + '|' + r.id) + '" aria-label="' + esc(t('sq.sk.detach') + ': ' + r.title) + '">✕</button>' : '')) + '</div></div>';
    return '<h4>' + esc(t('sq.sk.memberSkills')) + '</h4>' + agentSel
      + '<div class="sk-rows">' + (rows.length ? rows.map(row).join('') : '<div class="sq-muted" style="margin:6px 0">' + esc(t('sq.sk.memberNone')) + '</div>') + '</div>'
      + '<div class="sq-row"><button data-skpick="' + esc(place) + '">+ ' + esc(t('sq.sk.addLibrary')) + '</button><button data-sknew="' + esc(place) + '">+ ' + esc(t('sq.sk.new')) + '</button></div>';
  }
  /** The members a skill can be cloned into, from a place. */
  const skMembers = (place) => String(place).startsWith('w') ? (W?.members ?? []).map((m, i) => ({ key: 'w:' + i, name: m.name || people(m.role).find((e) => e.id === m.employee)?.name || t('sq.role.' + m.role) })) : members().map((m) => ({ key: 't:' + m.id, name: memberName(m) }));
  /** The drawer: a skill's file rendered (the preview), the editor with its live preview, or the library's picker. */
  function skillDrawer() {
    const close = '<button class="sk-x" data-sd="close" aria-label="' + esc(t('sq.sk.close')) + '">✕</button>';
    const wrap = (title, body, wide) => '<div class="sk-drawer" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="sk-shade" data-sd="close"></div><div class="sk-panel hud brk' + (wide ? ' wide' : '') + '">' + body + '</div></div>';
    if (SD.mode === 'pick') {
      return wrap(t('sq.sk.addLibrary'), '<div class="hs"><span>' + esc(t('sq.sk.library')) + '</span>' + dot + '<span class="fit">' + esc(isMemberPlace(SD.place) ? t('sq.sk.pickMember', memberName(skHolder(SD.place))) : t('sq.sk.pickTeam')) + '</span><span class="sq-grow"></span>' + close + '</div><div class="sk-body">' + libraryChips(SD.place, skAttached(SD.place), 'sdq', SD.q ?? '') + '</div>');
    }
    if (SD.mode === 'edit') {
      const f = SD.fields, isNew = SD.isNew;
      const kinds = ['domain', 'technology', 'practice'];
      const fld = (key, label, value, ph, extra) => '<label class="wz-field"><span class="lbl">' + esc(label) + '</span><input data-f="sd-' + key + '" value="' + esc(value ?? '') + '" placeholder="' + esc(ph ?? '') + '"' + (extra ?? '') + '></label>';
      const where = isMemberPlace(SD.place) ? t('sq.sk.forMember', memberName(skHolder(SD.place)) || '') : t('sq.sk.forTeam');
      return wrap(t('sq.sk.editor'), '<div class="hs"><span>' + esc(t('sq.sk.editor')) + '</span>' + dot + '<span class="fit">' + esc(where) + (f.from ? ' · ' + esc(t('sq.sk.clonedFrom', f.from)) : '') + '</span><span class="sq-grow"></span>' + close + '</div>'
        + '<div class="sk-body sk-edit"><div class="sk-fields">' + fld('name', t('sq.sk.name'), f.name, t('sq.sk.namePh'), ' maxlength="80"')
        + '<label class="wz-field"><span class="lbl">' + esc(t('sq.sk.id')) + '</span><input value="' + esc(f.id || skillSlug(f.name)) + '" readonly aria-readonly="true" class="mono"></label>'
        + '<label class="wz-field wide"><span class="lbl">' + esc(t('sq.sk.description')) + '</span><input data-f="sd-description" value="' + esc(f.description) + '" placeholder="' + esc(t('sq.sk.descriptionPh')) + '"></label>'
        + '<label class="wz-field"><span class="lbl">' + esc(t('sq.sk.kind')) + '</span><select data-f="sd-kind"><option value="">—</option>' + kinds.map((k) => '<option value="' + k + '"' + (f.kind === k ? ' selected' : '') + '>' + esc(KIND_TEXT(k)) + '</option>').join('') + '</select></label>'
        + fld('tags', t('sq.sk.tags'), (f.tags ?? []).join(', '), 'payments, refunds')
        + '<details class="wz-field wide"' + (f.title_es || f.description_es ? ' open' : '') + '><summary class="lbl">' + esc(t('sq.sk.spanish')) + '</summary><div class="sk-fields" style="margin-top:6px">' + fld('title_es', t('sq.sk.titleEs'), f.title_es, '') + fld('description_es', t('sq.sk.descriptionEs'), f.description_es, '') + '</div></details></div>'
        + '<div class="sk-split"><label class="wz-field"><span class="lbl">' + esc(t('sq.sk.body')) + '</span><textarea data-f="sd-text" spellcheck="false" placeholder="' + esc(t('sq.sk.bodyPh')) + '">' + esc(f.text) + '</textarea></label>'
        + '<div class="wz-field"><span class="lbl">' + esc(t('sq.sk.livePreview')) + '</span><div class="sk-md sk-live">' + mdHtml(f.text) + '</div></div></div>'
        + (SD.error ? '<div class="wz-badwhy">⚠ ' + esc(SD.error) + '</div>' : '')
        + '<div class="sq-row" style="justify-content:flex-end">' + (!isNew ? '<button class="danger" data-sd="delete">' + esc(t('sq.sk.delete')) + '</button><span class="sq-grow"></span>' : '') + '<button data-sd="close">' + esc(t('sq.sk.cancel')) + '</button><button class="primary" data-sd="save"' + (f.name.trim() && f.text.trim() ? '' : ' disabled') + '>' + esc(isNew ? t('sq.sk.create') : t('sq.sk.save')) + '</button></div></div>', true);
    }
    const e = SD.entry;
    if (!e) return wrap('', '<div class="hs"><span>' + esc(t('sq.sk.library')) + '</span><span class="sq-grow"></span>' + close + '</div><div class="sk-body sq-muted">' + esc(t('sq.sk.gone')) + '</div>');
    const place = SD.place, onLib = e.from === 'library' || e.from === 'agent';
    const attached = skAttached(place).includes(e.id), others = skMembers(place).filter((m) => m.key !== place);
    const canAttach = e.from === 'library' && !isMemberPlace(place) || (e.from === 'library' && isMemberPlace(place));
    const acts = (e.from === 'agent' ? '' : (canAttach ? '<button class="' + (attached ? '' : 'primary') + '" data-skt="' + esc(place + '|' + e.id) + '" aria-pressed="' + attached + '">' + esc(attached ? '✓ ' + t(isMemberPlace(place) ? 'sq.sk.attachedMember' : 'sq.sk.attachedTeam') : '+ ' + t(isMemberPlace(place) ? 'sq.sk.attachMember' : 'sq.sk.attachTeam')) + '</button>' : '')
      + (e.from === 'library' || (e.from === 'team' && isMemberPlace(place)) ? '' : '')
      + (e.from === 'library' && !(skTeamOf(place)?.ownSkills ?? []).some((s) => s.id === e.id) ? '<button data-sd="cloneTeam">' + esc(t('sq.sk.cloneTeam')) + '</button>' : '')
      + (e.from !== 'member' && others.length ? '<span class="sk-clone-m"><select data-f="sdmember" aria-label="' + esc(t('sq.sk.cloneMember')) + '">' + others.map((m) => '<option value="' + esc(m.key) + '"' + (SD.member === m.key ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('') + '</select><button data-sd="cloneMember">' + esc(t('sq.sk.cloneMember')) + '</button></span>' : e.from !== 'member' && String(place).startsWith('w') ? '<span class="sq-muted" style="font-size:11.5px">' + esc(t('sq.sk.noMembersYet')) + '</span>' : '')
      + '<button data-sd="edit">' + esc(e.own ? t('sq.sk.edit') : t('sq.sk.cloneEdit')) + '</button>'
      + (e.own ? '<button class="danger" data-sd="delete">' + esc(t('sq.sk.delete')) + '</button>' : ''));
    return wrap(e.title, '<div class="hs"><span>' + esc(onLib ? t('sq.sk.library') : t('sq.sk.skill')) + ' ' + sep + ' ' + esc(e.id) + '</span><span class="sq-grow"></span>' + close + '</div>'
      + '<div class="sk-body"><div class="sk-head"><h2>' + esc(e.title) + '</h2>' + skBadge(e.from === 'member' ? 'own' : e.inherited ? 'inherited' : e.from, e.clonedFrom ? t('sq.sk.clonedFrom', e.clonedFrom) : e.kind ? KIND_TEXT(e.kind) : '') + '</div>'
      + '<div class="sq-muted">' + esc(e.description) + '</div>' + ((e.tags ?? []).length ? '<div class="sk-tags">' + e.tags.map((g) => '<span>' + esc(g) + '</span>').join('') + '</div>' : '')
      + '<div class="sq-row sk-acts">' + acts + '</div><div class="sk-md">' + mdHtml(e.markdown) + '</div></div>');
  }
  /** Opens a skill's file for a place (agent:<id>: a library agent's). */
  function skPreview(place, id) {
    if (id.startsWith('agent:')) { const a = agentLib(id.slice(6)); SD = { mode: 'preview', place, entry: a ? { id: a.id, title: a.title, description: a.description, markdown: a.markdown ?? '', from: 'agent', tags: a.skills } : null }; return draw(); }
    SD = { mode: 'preview', place, entry: skEntry(id, place), member: skMembers(place).find((m) => m.key !== place)?.key };
    draw();
  }
  /** The editor, on a place's own skill, a copy to make (from: the library's or the team's), or a new one. */
  function skEdit(place, id, isNew) {
    const e = id ? skEntry(id, place) : null;
    const fields = e ? skillFields(e.markdown) : { id: '', name: '', description: '', text: '## When to use\n\n## Steps\n\n1. \n\n## Checklist\n\n- [ ] ', title_es: '', description_es: '', kind: '', tags: [] };
    if (e && !e.own) { fields.id = e.id; fields.from = e.from + ':' + e.id; }
    if (e?.own) fields.from = e.own.from;
    SD = { mode: 'edit', place, fields, isNew: isNew || !e?.own, error: '' };
    draw(); el.querySelector('[data-f="sd-' + (e ? 'text' : 'name') + '"]')?.focus();
  }
  /** The library skill id switched on or off for a place (the wizard's in its draft; a team's through its command). */
  function skToggle(place, id) {
    const h = skHolder(place); if (!h) return;
    if (String(place).startsWith('w')) {
      if (isMemberPlace(place)) { const roleNames = S.roster?.[h.role]?.skills ?? [], cur0 = h.skills ?? roleNames; h.skills = cur0.includes(id) ? cur0.filter((s) => s !== id) : [...cur0, id]; }
      else { const i = W.skills.indexOf(id); i >= 0 ? W.skills.splice(i, 1) : W.skills.push(id); W.suggestions = null; }
      return draw();
    }
    flush();
    const now = skAttached(place), next = now.includes(id) ? now.filter((s) => s !== id) : [...now, id];
    // drawn at once; the command's team replaces it
    if (isMemberPlace(place)) { const roleNames = S.roster?.[h.role]?.skills ?? []; h.skills = [...(h.skills ?? []).filter((s) => roleNames.includes(s)), ...next]; } else h.skills = next;
    draw();
    post({ type: 'team:skillsSet', id: S.team.id, skills: next, ...(isMemberPlace(place) ? { member: String(place).split(':')[1] } : {}) });
  }
  /** A copy of id (as from sees it) into the place to: the wizard's in its draft; a team's through skills clone. */
  function skClone(from, id, to) {
    const e = skEntry(id, from); if (!e) return;
    const target = skHolder(to); if (!target) return;
    if ((target.ownSkills ?? []).some((s) => s.id === id)) { say(t('sq.sk.already'), true); return; }
    if (String(to).startsWith('w')) {
      const f = skillFields(e.markdown);
      (target.ownSkills ??= []).push({ ...f, id, from: (e.from === 'member' ? 'member' : e.from) + ':' + id, kind: f.kind || undefined, tags: f.tags?.length ? f.tags : undefined, title_es: f.title_es || undefined, description_es: f.description_es || undefined });
      SD = null; say(t('sq.sk.cloned', e.title, isMemberPlace(to) ? skMembers(to).find((m) => m.key === to)?.name ?? '' : t('sq.sk.theTeam'))); return;
    }
    flush(); SD = null; S.loading = false; draw();
    post({ type: 'team:skillClone', id: S.team.id, skill: id, ...(isMemberPlace(to) ? { member: String(to).split(':')[1] } : {}) });
  }
  /** The editor's Save: the wizard's skill in its draft; a team's through skills create or skills update. */
  function skSave() {
    const f = SD.fields, place = SD.place, h = skHolder(place);
    const id = f.id || skillSlug(f.name);
    if (!id) { SD.error = t('sq.sk.needName'); return draw(); }
    const own = { id, name: f.name.trim(), description: f.description.trim(), text: f.text.trim() + '\n', ...(f.from ? { from: f.from } : {}), ...(f.title_es?.trim() ? { title_es: f.title_es.trim() } : {}), ...(f.description_es?.trim() ? { description_es: f.description_es.trim() } : {}), ...(f.kind ? { kind: f.kind } : {}), ...(f.tags?.length ? { tags: f.tags } : {}) };
    const list = h.ownSkills ??= [];
    const at = list.findIndex((s) => s.id === id);
    if (SD.isNew && at >= 0) { SD.error = t('sq.sk.exists', id); return draw(); }
    if (String(place).startsWith('w')) { at >= 0 ? (list[at] = own) : list.push(own); SD = null; return draw(); }
    flush();
    const markdown = skillMarkdown(own);
    // drawn at once; the command's team replaces it
    at >= 0 ? (list[at] = own) : list.push(own);
    SD = null; draw();
    post({ type: at >= 0 ? 'team:skillUpdate' : 'team:skillCreate', id: S.team.id, skill: id, markdown, ...(isMemberPlace(place) ? { member: String(place).split(':')[1] } : {}) });
  }
  /** An own skill deleted: the wizard's at once; a team's asked by the host first (the user's decision). */
  function skDelete(place, id) {
    const h = skHolder(place), s0 = (h?.ownSkills ?? []).find((s) => s.id === id); if (!s0) return;
    if (String(place).startsWith('w')) { h.ownSkills = h.ownSkills.filter((s) => s.id !== id); SD = null; return draw(); }
    flush(); SD = null; draw();
    post({ type: 'team:skillDelete', id: S.team.id, skill: id, title: ownTitle(s0), ...(isMemberPlace(place) ? { member: String(place).split(':')[1] } : {}) });
  }
  /** The skills' clicks, in the wizard and the team alike; true when it was one. */
  function skillClick(ds) {
    const two = (v) => { const at = v.lastIndexOf('|'); return [v.slice(0, at), v.slice(at + 1)]; };
    if (ds.skt) { const [p0, id] = two(ds.skt); skToggle(p0, id); return true; }
    if (ds.skv) { const [p0, id] = two(ds.skv); skPreview(p0, id); return true; }
    if (ds.ske) { const [p0, id] = two(ds.ske); skEdit(p0, id, false); return true; }
    if (ds.skd) { const [p0, id] = two(ds.skd); skDelete(p0, id); return true; }
    if (ds.skc) { const [p0, id] = two(ds.skc); skClone(p0, id, p0); return true; }
    if (ds.sknew !== undefined) { skEdit(ds.sknew, null, true); return true; }
    if (ds.skpick !== undefined) { SD = { mode: 'pick', place: ds.skpick, q: '' }; draw(); el.querySelector('[data-f="sdq"]')?.focus(); return true; }
    if (!ds.sd || !SD) return false;
    const e = SD.entry;
    switch (ds.sd) {
      case 'close': SD = null; draw(); return true;
      case 'save': skSave(); return true;
      case 'edit': { const p0 = SD.place, id = e?.id; if (!id) return true; if (e.own) skEdit(p0, id, false); else skEdit(isMemberPlace(p0) ? p0 : String(p0).startsWith('w') ? 'w' : 't', id, true); return true; }
      case 'delete': skDelete(SD.place, SD.mode === 'edit' ? (SD.fields.id || skillSlug(SD.fields.name)) : e?.id); return true;
      case 'cloneTeam': skClone(SD.place, e.id, String(SD.place).startsWith('w') ? 'w' : 't'); return true;
      case 'cloneMember': { const to = SD.member ?? skMembers(SD.place).find((m) => m.key !== SD.place)?.key; if (to) skClone(SD.place, e.id, to); return true; }
    }
    return false;
  }
  /** The editor's fields and the searches, as they are typed: the live preview follows without a redraw. */
  function skillInput(f, v) {
    if (f === 'wzskq') { SQ = v; later(draw); return true; }
    if (f === 'sdq' && SD) { SD.q = v; later(draw); return true; }
    if (!SD || SD.mode !== 'edit' || !f.startsWith('sd-')) return false;
    const key = f.slice(3);
    SD.fields[key] = key === 'tags' ? v.split(',').map((x) => x.trim()).filter(Boolean) : v;
    if (key === 'text') { const live = el.querySelector('.sk-live'); if (live) live.innerHTML = mdHtml(v); }
    if (key === 'name' && SD.isNew && !SD.fields.from) { const idBox = el.querySelector('.sk-fields input[readonly]'); if (idBox) idBox.value = skillSlug(v); }
    const save = el.querySelector('[data-sd="save"]'); if (save) save.disabled = !(SD.fields.name.trim() && SD.fields.text.trim());
    return true;
  }

  // ---------- the new-team wizard (ADR-platform-0010): five steps, Next, Next ----------
  const STEPS = ['identity', 'purpose', 'suggested', 'roster', 'work'];
  /** Who works a member by default: the local agents of this machine. */
  const localWorker = () => ({ kind: 'local', provider: 'nuclear-developer', model: '' });
  function openWizard(mode) {
    const editing = mode === 'edit' && S.team;
    W = { mode: editing ? 'edit' : 'new', step: editing ? 3 : 0, name: '', description: '', purpose: '', skills: [], ownSkills: [], skillText: '', logoFile: '', logoData: null, names: [], nameAt: -1, rolling: false,
      members: editing ? members().map((x) => ({ id: x.id, role: x.role, employee: x.employee, name: x.name, kind: x.kind, provider: x.provider, model: x.model ?? '', instructions: x.instructions ?? '', skills: x.skills, extraSkills: (x.extraSkills ?? []).map((e) => ({ ...e })), temperament: x.personality?.temperament && x.personality.temperament !== empOf(x)?.temperament ? x.personality.temperament : '', note: x.personality?.note ?? '' })) : [],
      lead: null, same: { role: '', kind: 'local', provider: 'nuclear-developer', model: '' }, open: [], suggestions: null, picked: [], fRole: '', fTemper: '', fGender: '', fSkill: '', fq: '', budgetUsd: editing ? S.team.budgetUsd ?? 5 : 5, creating: false };
    view = 'wizard'; peek = null; SD = null; SQ = '';
    askAgents();
    draw();
  }
  /** The steps this wizard shows: all five for a new team, the members and who works them for one being edited. */
  const steps = () => W.mode === 'edit' ? [3, 4] : [0, 1, 2, 3, 4];
  function wizard() {
    const list = steps(), at = list.indexOf(W.step);
    const bar = '<div class="wz-steps" style="--n:' + list.length + '">' + list.map((n, i) => '<button class="wz-step' + (n === W.step ? ' now' : i < at ? ' done' : '') + '" data-wzgo="' + n + '"' + (n > W.step && !canLeave() ? ' disabled' : '') + '><i>' + (i < at ? '✓' : i + 1) + '</i><span>' + esc(t('sq.wz.step.' + STEPS[n])) + '</span></button>').join('') + '</div>';
    const body = [stepIdentity, stepPurpose, stepSuggested, stepRoster, stepWork][W.step]();
    const last = at === list.length - 1;
    const nav = '<div class="wz-nav"><button data-a="wzCancel">' + esc(t('sq.wz.cancel')) + '</button><span class="sq-grow"></span>'
      + (at > 0 ? '<button data-a="wzBack">‹ ' + esc(t('sq.wz.back')) + '</button>' : '')
      + (last ? '<button class="primary" data-a="wzFinish"' + (W.creating || !canLeave() ? ' disabled' : '') + '>' + esc(W.mode === 'edit' ? t('sq.wz.save') : W.creating ? t('sq.wz.creating') : t('sq.wz.create')) + '</button>'
        : '<button class="primary" data-a="wzNext"' + (canLeave() ? '' : ' disabled') + '>' + esc(t('sq.wz.next')) + ' ›</button>') + '</div>';
    const title = W.mode === 'edit' ? t('sq.wz.editTitle', S.team.name) : t('sq.wz.title');
    return '<div class="wz hud brk"><div class="hs"><span>' + esc(t('sq.team')) + ' ' + sep + ' ' + esc(title) + '</span>' + dot + '<span>' + esc(t('sq.wz.stepOf', at + 1, list.length)) + '</span></div>' + bar + '<div class="wz-body">' + body + '</div>' + nav + '</div>';
  }
  /** Step 1 needs a name; the rest can always be left (a team may lack a role: it is said, and it cannot run yet). */
  const canLeave = () => (W.step !== 0 || !!W.name.trim()) && (W.step !== 4 || W.members.every((m) => usable(m.provider)));
  function stepIdentity() {
    return '<h2>' + esc(t('sq.wz.identityTitle')) + '</h2><div class="sq-muted">' + esc(t('sq.wz.identityHint')) + '</div>'
      + '<div class="wz-id"><div class="wz-logo"><button class="sq-logobtn" data-a="wzLogo" title="' + esc(t('sq.wz.logoPick')) + '" aria-label="' + esc(t('sq.wz.logoPick')) + '">' + logo(W.name || '?', W.name, W.logoData, 112) + '</button><span class="lbl">' + esc(W.logoData ? t('sq.wz.logoChange') : t('sq.wz.logoPick')) + '</span>' + (W.logoData ? '<button data-a="wzLogoClear">' + esc(t('sq.logoClear')) + '</button>' : '') + '</div>'
      + '<div style="display:grid;gap:12px"><div class="wz-field"><span class="lbl">' + esc(t('sq.wz.name')) + '</span><div class="wz-name"><input data-f="wzname" value="' + esc(W.name) + '" placeholder="' + esc(t('sq.wz.namePlaceholder')) + '" maxlength="60" aria-label="' + esc(t('sq.wz.name')) + '">'
      + '<button class="wz-dice' + (W.rolling ? ' roll' : '') + '" data-a="wzDice" title="' + esc(t('sq.wz.diceHint')) + '">' + dice + esc(t('sq.wz.dice')) + '</button></div>'
      + (W.names.length ? '<div class="sq-muted" style="font-size:11.5px">' + esc(t('sq.wz.diceMore')) + '</div>' : '') + '</div>'
      + '<div class="wz-field"><span class="lbl">' + esc(t('sq.description')) + '</span><input data-f="wzdesc" value="' + esc(W.description) + '" placeholder="' + esc(t('sq.descPlaceholder')) + '"></div></div></div>';
  }
  function stepPurpose() {
    return '<h2>' + esc(t('sq.wz.purposeTitle')) + '</h2><div class="sq-muted">' + esc(t('sq.wz.purposeHint')) + '</div>'
      + '<div class="wz-field"><span class="lbl">' + esc(t('sq.wz.purpose')) + '</span><textarea data-f="wzpurpose" rows="3" placeholder="' + esc(t('sq.wz.purposePlaceholder')) + '">' + esc(W.purpose) + '</textarea></div>'
      + '<div class="wz-field"><span class="lbl">' + esc(t('sq.wz.skills')) + '</span><div class="sq-muted" style="font-size:12px">' + esc(t('sq.sk.wizardHint')) + '</div>'
      + skillChosen('w', W.skills, W.ownSkills) + libraryChips('w', W.skills, 'wzskq', SQ) + '</div>';
  }
  const chosenIndex = (role0, emp) => W.members.findIndex((m) => m.role === role0 && m.employee === emp);
  const whyText = (w) => '<span><b>' + esc(w.term) + '</b> · ' + esc(t('sq.wz.in.' + w.in)) + (w.in === 'skill' || w.in === 'endorsement' ? ': ' + esc(w.text) : '') + '</span>';
  function stepSuggested() {
    const head = '<h2>' + esc(t('sq.wz.suggestedTitle')) + '</h2><div class="sq-muted">' + esc(W.purpose || W.skills.length ? t('sq.wz.suggestedHint') : t('sq.wz.suggestedNoPurpose')) + '</div>';
    if (!W.suggestions) return head + '<div class="sq-muted mono">' + esc(t('sq.loading')) + '</div>';
    const roles = W.suggestions.map((g) => '<div class="wz-role hud" style="--rc:' + COLOR[g.role] + '"><div class="hs"><span>' + esc(t('sq.role.' + g.role)) + '</span>' + dot + '<span>' + esc(worksText(g.role)) + '</span></div>'
      + (g.candidates.length ? g.candidates.map((c) => { const on = chosenIndex(g.role, c.employee) >= 0; return '<div class="wz-cand">' + pf(c.employee, c.name, COLOR[g.role], '40px') + '<div style="min-width:0"><b>' + esc(c.name) + '</b><div class="sq-muted">' + esc(c.headline) + '</div></div>'
        + '<button class="' + (on ? '' : 'primary') + '" data-wztoggle="' + esc(g.role + '|' + c.employee) + '" aria-pressed="' + on + '">' + esc(on ? '✓ ' + t('sq.wz.added') : '+ ' + t('sq.wz.add')) + '</button>'
        + '<div class="wz-why">' + (c.why.length ? c.why.slice(0, 4).map(whyText).join('') : '<span>' + esc(t('sq.wz.allRounder')) + '</span>') + '</div></div>'; }).join('') : '<div class="li-none" style="margin:10px">' + esc(t('sq.noRoster')) + '</div>') + '</div>').join('');
    return head + '<div class="sq-row" style="margin:0"><button data-a="wzBest">' + esc(t('sq.wz.addBest')) + '</button><span class="sq-muted">' + esc(t('sq.wz.chosen', W.members.length)) + '</span></div><div class="wz-roles">' + roles + '</div>';
  }
  /** The selected members by role, with the roles the stations need and the team lacks. */
  function chosenList() {
    const counts = roleCounts(W.members), lack = missingRoles(W.members);
    return '<div class="wz-sel"><div class="hs"><span>' + esc(t('sq.wz.selected')) + '</span>' + dot + '<span>' + W.members.length + '</span></div>'
      + '<div class="wz-counts">' + ROLES.map((r) => '<div class="wz-count' + (counts[r] ? '' : ' lack') + '" style="--rc:' + COLOR[r] + '" title="' + esc(t('sq.role.' + r)) + '"><b>' + counts[r] + '</b><span class="lbl">' + esc(t('sq.abbr.' + r)) + '</span></div>').join('') + '</div>'
      + (lack.length ? '<div class="wz-lack">⚠ ' + esc(t('sq.wz.lacks', lack.map((r) => t('sq.role.' + r)).join(', '))) + '</div>' : '')
      + '<div class="list">' + (W.members.length ? W.members.map((m, i) => { const p = people(m.role).find((e) => e.id === m.employee); return '<div class="wz-m">' + pf(m.employee, p?.name ?? m.name, COLOR[m.role], '30px') + '<div style="min-width:0"><b>' + esc(m.name || p?.name || t('sq.role.' + m.role)) + '</b><small>' + esc(t('sq.role.' + m.role)) + '</small></div><button data-wzdel="' + i + '" title="' + esc(t('sq.remove')) + '" aria-label="' + esc(t('sq.remove')) + '">✕</button></div>'; }).join('') : '<div class="li-none" style="margin:10px">' + esc(t('sq.wz.noneChosen')) + '</div>') + '</div></div>';
  }
  function poolOf() {
    const all = []; for (const r of ROLES) for (const p of people(r)) all.push({ ...p, role: r });
    return all;
  }
  function stepRoster() {
    const all = poolOf(), list = filterPool(all, { role: W.fRole, temper: W.fTemper, gender: W.fGender, skill: W.fSkill, q: W.fq });
    const tempers = [...new Set(all.map((p) => p.temperament).filter(Boolean))], genders = [...new Set(all.map((p) => p.gender).filter(Boolean))], skills = rosterSkills(S.roster ?? {}).slice(0, 300);
    const sel0 = (f, anyText, values, value, label) => '<select data-f="' + f + '" aria-label="' + esc(anyText) + '"><option value="">' + esc(anyText) + '</option>' + values.map((v) => '<option value="' + esc(v) + '"' + (v === value ? ' selected' : '') + '>' + esc(label(v)) + '</option>').join('') + '</select>';
    const shown = list.slice(0, 120);
    const tiles = shown.map((p) => { const taken = chosenIndex(p.role, p.id) >= 0, on = W.picked.includes(p.role + '|' + p.id); return '<div class="ro-t' + (on ? ' picked' : '') + (taken ? ' taken' : '') + '" style="--rc:' + COLOR[p.role] + '" data-cand="' + esc(p.id) + '"' + (taken ? '' : ' data-wzpick="' + esc(p.role + '|' + p.id) + '"') + ' tabindex="0" role="checkbox" aria-checked="' + (on || taken) + '" aria-label="' + esc(p.name + ' · ' + t('sq.role.' + p.role)) + '">'
      + (taken ? '' : '<span class="pick">' + (on ? '✓' : '') + '</span>') + pf(p.id, p.name, COLOR[p.role], '', 'scan') + '<b>' + esc(p.name) + '</b><span class="lbl" style="color:' + COLOR[p.role] + '">' + esc(t('sq.role.' + p.role)) + '</span>'
      + (taken ? '<span class="tag lead hired">' + esc(t('sq.wz.added')) + '</span>' : p.temperament ? '<span class="tag tmp">' + esc(temperName(p.temperament)) + '</span>' : '') + '</div>'; }).join('');
    return '<h2>' + esc(t('sq.wz.rosterTitle')) + '</h2><div class="sq-muted">' + esc(t('sq.wz.rosterHint')) + '</div>'
      + '<div class="wz-pool"><div style="min-width:0"><div class="ro-filters">' + sel0('wzrole', t('sq.wz.anyRole'), ROLES, W.fRole, (r) => t('sq.role.' + r)) + (tempers.length ? sel0('wztemper', t('sq.hud.anyTemper'), tempers, W.fTemper, temperName) : '') + (genders.length ? sel0('wzgender', t('sq.hud.anyGender'), genders, W.fGender, (g) => T['sq.gender.' + g] ?? g) : '') + (skills.length ? sel0('wzfskill', t('sq.wz.anySkill'), skills, W.fSkill, (s) => s) : '')
      + '<input data-f="wzq" placeholder="' + esc(t('sq.search')) + '" value="' + esc(W.fq) + '" aria-label="' + esc(t('sq.search')) + '"><span class="sq-muted">' + esc(t('sq.hud.shown', list.length, all.length)) + '</span></div>'
      + '<div class="sq-row" style="margin:8px 12px 0"><button class="primary" data-a="wzAddPicked"' + (W.picked.length ? '' : ' disabled') + '>+ ' + esc(t('sq.wz.addPicked', W.picked.length)) + '</button>' + (W.picked.length ? '<button data-a="wzClearPicked">' + esc(t('sq.wz.clearPicked')) + '</button>' : '') + '<button data-a="wzPickAll"' + (shown.length ? '' : ' disabled') + '>' + esc(t('sq.wz.pickShown')) + '</button></div>'
      + '<div class="ro-grid">' + (tiles || '<div class="sq-muted">' + esc(t('sq.hud.noMatch')) + '</div>') + '</div>' + (list.length > shown.length ? '<div class="sq-muted" style="padding:0 12px 12px">' + esc(t('sq.wz.narrow', shown.length, list.length)) + '</div>' : '') + '</div>' + chosenList() + '</div>';
  }
  /** An agent of this machine (agents --json), or what is known of it before the list comes. */
  const agentOf = (p) => (AGENTS ?? []).find((x) => x.provider === p);
  /** Whether a provider can work here: every one until the list comes (the command refuses one that cannot). */
  const usable = (p) => p === 'nuclear-developer' || !AGENTS || !!agentOf(p)?.available;
  // why a provider cannot work here, in the page's language (agents --json gives its key and arguments)
  const whyNot = (p) => { const a = agentOf(p); return a?.whyKey && T['sq.why.' + a.whyKey] ? t('sq.why.' + a.whyKey, ...(a.whyArgs ?? [])) : a?.why || t('sq.wz.notHere'); };
  /** A kind's providers, the ones this machine lacks disabled with why (as the chat's agent picker): never chosen. */
  function providerOptions(m) {
    const ids = [...new Set([...(AGENTS ?? []).filter((a) => a.kind === m.kind).map((a) => a.provider), ...(PROVIDERS[m.kind] ?? [])])];
    return ids.map((p) => { const ok = usable(p); return '<option value="' + esc(p) + '"' + (p === m.provider ? ' selected' : '') + (ok ? '' : ' disabled title="' + esc(whyNot(p)) + '"') + '>' + esc(provKind(p) + (ok ? '' : ' · ' + whyNot(p))) + '</option>'; }).join('');
  }
  /** The first provider of a kind this machine has; null when it has none. */
  const firstUsable = (k) => [...(AGENTS ?? []).filter((a) => a.kind === k).map((a) => a.provider), ...PROVIDERS[k]].find(usable) ?? null;
  /** A provider's models as the pickers list them: the provider's own (models --json), else the names agents --json
   * gives, else the few known before either comes. */
  const modelsFor = (p) => HERE?.providers?.[p]?.models ?? [...new Set([...(agentOf(p)?.models ?? []), ...(MODELS[p] ?? [])])].map((id) => ({ id }));
  /** What a provider is: local, agent (an agent's command line) or api (a model paid per token with a key). */
  const kindOfProvider = (p) => Object.keys(PROVIDERS).find((k) => PROVIDERS[k].includes(p)) ?? agentOf(p)?.kind ?? 'api';
  // the account an agent's command line works on (its group says it)
  const ACCOUNT = { 'claude-code': 'Claude', opencode: 'OpenCode', codex: 'ChatGPT', 'gemini-cli': 'Google', cursor: 'Cursor', grok: 'xAI' };
  const provName = (p) => agentOf(p)?.label ?? (PNAME[p] ?? p) + (kindOfProvider(p) === 'api' ? ' API' : '');
  /** A provider with its kind: "Claude Code (agent)", "Anthropic API (model)", "Nuclear Developer (local)". */
  const provKind = (p) => provName(p) + ' (' + t('sq.kindWord.' + kindOfProvider(p)) + ')';
  /** A provider's group: what it is and how it is paid ("Claude Code — agent, your Claude account"). */
  const provGroup = (p) => t('sq.group.' + kindOfProvider(p), provName(p), ACCOUNT[p] ?? provName(p));
  /** Whether a provider takes a model typed by hand (an agent's command line: any model it knows). */
  const freeModel = (p) => HERE?.providers?.[p]?.free ?? PROVIDERS.agent.includes(p);
  const modelInfo = (p, id) => (id && modelsFor(p).find((x) => x.id === id)) || null;
  /** The memory a model says: 'bad' (too big for this machine), 'warn' (tight now), else ''. */
  const ramLevel = (x) => x?.fit === 'too-big' ? 'bad' : x?.fit === 'tight' ? 'warn' : '';
  /** A model as an option says it: its parameters, the memory it needs and how it fits, what it downloads, no price. */
  function modelText(x) {
    // its family and version ("opus 5.5"; an alias: "opus — latest"), the id beside a label that is not it (not a local tag)
    const name = x.alias ? x.family + ' — ' + t('sq.model.latest') : x.label ?? x.id;
    const bits = [name + (x.label && !x.alias && x.label !== x.id && x.installed === undefined ? ' (' + x.id + ')' : '')];
    if (x.params) bits.push(x.params);
    if (x.needGb) bits.push(t('sq.ram.needs', x.needGb));
    if (x.installed === false) bits.push(t('sq.ram.download', x.downloadGb ?? x.sizeGb ?? '?'));
    if (x.priced === false) bits.push(t('sq.model.noPrice'));
    const level = ramLevel(x);
    return (level === 'bad' ? '⛔ ' : level === 'warn' ? '⚠ ' : '') + bits.join(' · ') + (level === 'bad' ? ' — ' + t('sq.ram.optBig') : level === 'warn' ? ' — ' + t('sq.ram.optTight') : '');
  }
  const modelOption = (value, x, on) => '<option value="' + esc(value) + '"' + (on ? ' selected' : '') + (x.priced === false ? ' disabled' : '') + (ramLevel(x) ? ' class="ram-' + ramLevel(x) + '"' : '') + '>' + esc(modelText(x)) + '</option>';
  /** Every model of a provider, always (a select, not a filtered datalist): the default first, the installed and the
   * downloadable apart for the local agents, a model chosen elsewhere kept, and *Other…* where any model is taken. */
  function modelOptions(p, cur, kind, typing) {
    // typing: *Other…* is the one selected, its field beside it holds the model
    const list = modelsFor(p), on = (id) => !typing && id === cur, known = typing || !cur || list.some((x) => x.id === cur);
    const group = (label, xs) => xs.length ? '<optgroup label="' + esc(label) + '">' + xs.map((x) => modelOption(x.id, x, on(x.id))).join('') + '</optgroup>' : '';
    const local = list.some((x) => x.installed !== undefined);
    return '<option value=""' + (on('') || (!cur && !typing) ? ' selected' : '') + '>' + esc(kind === 'local' ? t('sq.wz.modelLocal') : t('sq.modelDefault')) + '</option>'
      + (known ? '' : '<option value="' + esc(cur) + '" selected>' + esc(cur) + '</option>')
      + (local ? group(provGroup(p) + ' · ' + t('sq.model.installed'), list.filter((x) => x.installed !== false)) + group(provGroup(p) + ' · ' + t('sq.model.pullable'), list.filter((x) => x.installed === false)) : group(provGroup(p), list))
      + (freeModel(p) ? '<option value="__other__"' + (typing ? ' selected' : '') + '>' + esc(t('sq.model.other')) + '</option>' : '');
  }
  /** The model's picker: its select, coloured by the memory the chosen one needs, and the field of a typed model. */
  function modelPicker(f, p, cur, kind, typing) {
    const level = ramLevel(modelInfo(p, cur));
    return '<span class="sq-model"><select data-f="' + f + '" aria-label="' + esc(t('sq.model')) + '"' + (level ? ' class="ram-' + level + '"' : '') + '>' + modelOptions(p, cur, kind, typing) + '</select>'
      + (typing ? '<input data-f="' + f + '-other" value="' + esc(cur) + '" placeholder="' + esc(t('sq.model.otherPlaceholder')) + '" aria-label="' + esc(t('sq.model.other')) + '">' : '') + '</span>';
  }
  /** The red (too big: it can make the computer freeze or restart) or amber (tight) line of a chosen local model. */
  function ramLine(p, id) {
    const x = modelInfo(p, id), level = ramLevel(x), mem = HERE?.memory ?? {};
    if (!level) return '';
    return '<div class="sq-ram ' + level + '" role="' + (level === 'bad' ? 'alert' : 'status') + '">' + (level === 'bad' ? '⛔ ' + esc(t('sq.ram.tooBig', x.needGb, mem.totalGb ?? '?')) : '⚠ ' + esc(t('sq.ram.tight', x.needGb, mem.availableGb ?? '?'))) + '</div>';
  }
  /** A model chosen: one too big for this machine's memory only after the user's confirmation (ask). */
  function pickModel(p, id, apply) {
    const x = modelInfo(p, id);
    if (ramLevel(x) === 'bad') { ask = { m: x, yes: apply }; return draw(); }
    apply(); draw();
  }
  const askHtml = () => '<div class="sq-ask" role="alertdialog" aria-modal="true" aria-labelledby="sqAskT" aria-describedby="sqAskD"><div class="hud brk"><h3 id="sqAskT">⛔ ' + esc(t('sq.ram.confirmTitle')) + '</h3><p id="sqAskD">' + esc(t('sq.ram.tooBig', ask.m.needGb, HERE?.memory?.totalGb ?? '?')) + '</p><p class="sq-muted">' + esc(t('sq.ram.confirmHint')) + '</p>'
    + '<div class="sq-row"><button class="primary" data-a="ramNo">' + esc(t('sq.wz.cancel')) + '</button><button class="danger" data-a="ramYes">' + esc(t('sq.ram.useAnyway')) + '</button></div></div></div>';
  /** This machine's agents and every provider's models, asked once (the wizard, the member's brain). */
  function askAgents() { if (!AGENTS) post({ type: 'team:wizard' }); if (!HERE) post({ type: 'team:models' }); }
  const kindButtons = (attr, cur) => '<div class="sq-seg" role="group" aria-label="' + esc(t('sq.whoWorks')) + '">' + ['local', 'agent', 'api'].map((k) => { const none = !firstUsable(k); return '<button ' + attr + k + '" aria-pressed="' + (cur === k) + '" class="' + (cur === k ? 'sel' : '') + '"' + (none && cur !== k ? ' disabled title="' + esc(t('sq.wz.noneHere')) + '"' : '') + '>' + esc(t('sq.wz.kind.' + k)) + '</button>'; }).join('') + '</div>';
  /** Who works a member, the same for everyone or for a role's members (a member is its profile, not its model). */
  function sameBar() {
    const a = W.same, counts = roleCounts(W.members);
    const scope = '<select data-f="wzsamerole" aria-label="' + esc(t('sq.wz.sameFor')) + '"><option value="">' + esc(t('sq.wz.everyone', W.members.length)) + '</option>' + ROLES.filter((r) => counts[r]).map((r) => '<option value="' + r + '"' + (a.role === r ? ' selected' : '') + '>' + esc(t('sq.wz.allOf', t('sq.role.' + r), counts[r])) + '</option>').join('') + '</select>';
    return '<div class="wz-same hud"><span class="lbl">' + esc(t('sq.wz.same')) + '</span>' + scope + kindButtons('data-wzsamekind="', a.kind)
      + '<select data-f="wzsameprov" aria-label="' + esc(t('sq.provider')) + '">' + providerOptions(a) + '</select>'
      + modelPicker('wzsamemodel', a.provider, a.model, a.kind, a.typing)
      + '<button class="primary" data-a="wzSame"' + (W.members.length && usable(a.provider) ? '' : ' disabled') + '>' + esc(t('sq.wz.apply')) + '</button>'
      + '<button data-a="wzAllLocal"' + (paidMembers(W.members).length ? '' : ' disabled') + '>' + esc(t('sq.wz.setAllLocal')) + '</button>' + ramLine(a.provider, a.model) + '</div>';
  }
  /** What makes a member different: instructions, skills, temperament, characteristics (folded under its row). */
  function differentPanel(m, i) {
    const p = people(m.role).find((e) => e.id === m.employee), roleSkills = S.roster?.[m.role]?.skills ?? [], on = m.skills ?? roleSkills;
    const tempers = S.temperaments ?? [];
    return '<div class="wz-diff">'
      + '<label class="wz-field"><span class="lbl">' + esc(t('sq.temperament')) + '</span><select data-f="wztemper-' + i + '"><option value="">' + esc(t('sq.wz.ownTemper', temperName(p?.temperament) || '—')) + '</option>' + tempers.filter((x) => x.id !== p?.temperament).map((x) => '<option value="' + esc(x.id) + '"' + (m.temperament === x.id ? ' selected' : '') + ' title="' + esc(x.description?.[t('sq.lang')] ?? x.voice ?? '') + '">' + esc(x.name?.[t('sq.lang')] ?? x.name?.en ?? x.id) + '</option>').join('') + '</select></label>'
      + '<label class="wz-field"><span class="lbl">' + esc(t('sq.wz.traits')) + '</span><input data-f="wznote-' + i + '" value="' + esc(m.note ?? '') + '" placeholder="' + esc(t('sq.wz.traitsPlaceholder')) + '"></label>'
      + '<label class="wz-field wide"><span class="lbl">' + esc(t('sq.wz.instructions')) + '</span><textarea data-f="wzinstr-' + i + '" rows="2" placeholder="' + esc(t('sq.wz.instructionsPlaceholder')) + '">' + esc(m.instructions ?? '') + '</textarea></label>'
      + '<div class="wz-field wide"><span class="lbl">' + esc(t('sq.wz.roleSkills')) + '</span><div class="wz-skills">' + (roleSkills.length ? roleSkills.map((sk) => '<button class="wz-sk' + (on.includes(sk) ? ' on' : '') + '" data-wzsk="' + i + '|' + esc(sk) + '" aria-pressed="' + on.includes(sk) + '" title="' + esc(skillAbout(m.role, sk)) + '">' + esc(skillTitle(m.role, sk)) + '</button>').join('') : '<span class="sq-muted">' + esc(t('sq.noSkills')) + '</span>') + '</div></div>'
      + '<div class="wz-field wide"><span class="lbl">' + esc(t('sq.extraSkills')) + '</span>' + (m.extraSkills ?? []).map((x, j) => '<div class="wz-extra"><input data-f="wzxn-' + i + '-' + j + '" value="' + esc(x.name) + '" placeholder="' + esc(t('sq.skillName')) + '"><input data-f="wzxt-' + i + '-' + j + '" value="' + esc(x.text) + '" placeholder="' + esc(t('sq.skillText')) + '"><button data-wzxdel="' + i + '|' + j + '" aria-label="' + esc(t('sq.remove')) + '">✕</button></div>').join('') + '<div><button data-wzxadd="' + i + '">+ ' + esc(t('sq.addSkill')) + '</button></div></div></div>';
  }
  function stepWork() {
    const paid = paidMembers(W.members), removed = W.mode === 'edit' ? members().filter((x) => !W.members.some((m) => m.id === x.id)) : [];
    const rows = W.members.map((m, i) => {
      const p = people(m.role).find((e) => e.id === m.employee), open = W.open.includes(m), n = differences(m), bad = !usable(m.provider);
      return '<div class="wz-work' + (bad ? ' bad' : '') + '">' + pf(m.employee, p?.name ?? m.name, COLOR[m.role], '36px') + '<div class="who"><b>' + esc(m.name || p?.name || t('sq.role.' + m.role)) + '</b><small>' + esc(t('sq.role.' + m.role)) + '</small>'
        + '<button class="wz-open' + (open ? ' on' : '') + '" data-wzopen="' + i + '" aria-expanded="' + open + '" title="' + esc(t('sq.wz.differentHint')) + '">' + (open ? '▾ ' : '▸ ') + esc(n ? t('sq.wz.differentN', n) : t('sq.wz.different')) + '</button></div>'
        + kindButtons('data-wzkind="' + i + '|', m.kind) + '<select data-f="wzprov-' + i + '" aria-label="' + esc(t('sq.provider')) + '">' + providerOptions(m) + '</select>'
        + modelPicker('wzmodel-' + i, m.provider, m.model, m.kind, m.typing)
        + (paidTag(m) || '<span class="tag tmp">' + esc(t('sq.wz.free')) + '</span>')
        + (W.mode === 'new' ? '<label class="wz-lead"><input type="radio" name="wzlead" data-wzlead="' + i + '"' + (W.lead === m || (!W.members.includes(W.lead) && i === defaultLead()) ? ' checked' : '') + '> ' + esc(t('sq.techLead')) + '</label>' : '<span></span>')
        + (bad ? '<div class="wz-badwhy">⚠ ' + esc(t('sq.wz.cannotHere', agentOf(m.provider)?.label ?? PNAME[m.provider] ?? m.provider, whyNot(m.provider))) + '</div>' : '')
        + ramLine(m.provider, m.model)
        + (open ? differentPanel(m, i) : '') + '</div>';
    }).join('');
    const warn = paid.length
      ? '<div class="wz-warn hud brk"><b>⚠ ' + esc(t('sq.wz.paidCount', paid.length, W.members.length)) + '</b><div>' + esc(t('sq.wz.costWarn', Number(W.budgetUsd || 0) > 0 ? Number(W.budgetUsd).toFixed(2) + ' USD' : t('sq.wz.noLimit'))) + '</div></div>'
      : '<div class="wz-ok hud">✓ ' + esc(t('sq.wz.allLocal')) + '</div>';
    return '<h2>' + esc(t('sq.wz.workTitle')) + '</h2><div class="sq-muted">' + esc(t('sq.wz.workHint')) + '</div>' + warn + sameBar()
      + (W.mode === 'new' ? '<div class="sq-row" style="margin:0;justify-content:flex-end"><label class="wz-budget lbl">' + esc(t('sq.wz.budget')) + ' <input data-f="wzbudget" type="number" min="0" step="0.5" value="' + esc(W.budgetUsd) + '"> USD</label></div>' : '')
      + (removed.length ? '<div class="wz-lack hud">' + esc(t('sq.wz.leaving', removed.map((x) => memberName(x)).join(', '))) + '</div>' : '')
      + '<div class="hud">' + (rows || '<div class="li-none" style="margin:10px">' + esc(t('sq.wz.noneChosen')) + '</div>') + '</div>';
  }
  /** The tech lead when the user chose none: the first Architect, else the first member (teams.nuc's rule). */
  const defaultLead = () => { const a = W.members.findIndex((m) => m.role === 'architect'); return a >= 0 ? a : W.members.length ? 0 : -1; };
  /** A member of the roster put in the wizard's team, kept in the roles' order (the steps show them grouped). */
  function addToWizard(role0, emp) {
    if (chosenIndex(role0, emp) >= 0) return;
    W.members.push({ role: role0, employee: emp, name: '', ...localWorker() });
    W.members.sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
  }
  function wzGo(n) {
    W.step = n; peek = null;
    if (n === 2 && !W.suggestions) post({ type: 'team:suggest', purpose: W.purpose, skills: W.skills });
    draw(); el.querySelector('.sq')?.scrollTo?.(0, 0);
  }
  function rollName() {
    W.rolling = !W.rolling;
    if (W.nameAt + 1 < W.names.length) { W.nameAt += 1; W.name = W.names[W.nameAt]; return draw(); }
    post({ type: 'team:names', purpose: W.purpose || W.description }); draw();
  }
  function finishWizard() {
    if (W.mode === 'new') {
      W.creating = true; draw();
      return post({ type: 'team:create', draft: draftOf({ ...W, lead: W.members.includes(W.lead) ? W.members.indexOf(W.lead) : defaultLead() }) });
    }
    // editing: who leaves, who joins, whose worker changed; one command each, in order (the host keeps that order)
    const id = S.team.id, ops = [];
    for (const x of members()) if (!W.members.some((m) => m.id === x.id)) ops.push({ type: 'team:memberRemove', id, member: x.id, fromWizard: true });
    const fresh = W.members.filter((m) => !m.id);
    if (fresh.length) ops.push({ type: 'team:memberAdd', id, members: draftOf({ ...W, name: '-', lead: -1, members: fresh }).members });
    for (const m of W.members) {
      const x = m.id && memberById(m.id); if (!x) continue;
      const c = {};
      if (x.kind !== m.kind || x.provider !== m.provider || (x.model ?? '') !== m.model) Object.assign(c, { kind: m.kind, provider: m.provider, model: m.model });
      if ((x.instructions ?? '') !== (m.instructions ?? '')) c.instructions = m.instructions ?? '';
      if (m.skills && JSON.stringify(x.skills ?? []) !== JSON.stringify(m.skills)) c.skills = m.skills;
      if (JSON.stringify(x.extraSkills ?? []) !== JSON.stringify((m.extraSkills ?? []).filter((e) => e.name.trim()))) c.extraSkills = (m.extraSkills ?? []).filter((e) => e.name.trim());
      const own = empOf(x)?.temperament ?? '', was = x.personality?.temperament ?? own;
      if ((m.temperament || own) !== was) c.temperament = m.temperament || own;
      if ((x.personality?.note ?? '') !== (m.note ?? '')) c.note = m.note ?? '';
      if (Object.keys(c).length) ops.push({ type: 'team:memberUpdate', id, member: m.id, change: c, last: false });
    }
    if (ops.length) ops[ops.length - 1].last = true;
    W = null; view = 'team'; S.loading = !!ops.length; draw();
    for (const o of ops) post(o);
  }
  /** A kind chosen for a member (or the same-for-all bar): its first provider this machine has; none, nothing changes. */
  function setKind(m, k) {
    if (m.kind === k) return;
    const p = firstUsable(k); if (!p) return;
    m.kind = k; m.provider = p; m.model = k === 'local' ? '' : agentOf(p)?.defaultModel ?? ''; m.typing = false;
  }
  function wizardClick(ds) {
    if (ds.wzgo !== undefined) return wzGo(+ds.wzgo);
    if (ds.wzpick) { const i = W.picked.indexOf(ds.wzpick); i >= 0 ? W.picked.splice(i, 1) : W.picked.push(ds.wzpick); return draw(); }
    if (ds.wztoggle) { const [r, e] = ds.wztoggle.split('|'), i = chosenIndex(r, e); i >= 0 ? W.members.splice(i, 1) : addToWizard(r, e); return draw(); }
    if (ds.wzdel !== undefined) { W.members.splice(+ds.wzdel, 1); return draw(); }
    if (ds.wzdelskill !== undefined) { W.skills.splice(+ds.wzdelskill, 1); W.suggestions = null; return draw(); }
    if (ds.wzskill) { W.skills.push(ds.wzskill); W.suggestions = null; return draw(); }
    if (ds.wzkind) { const [i, k] = ds.wzkind.split('|'); setKind(W.members[+i], k); return draw(); }
    if (ds.wzsamekind) { setKind(W.same, ds.wzsamekind); return draw(); }
    if (ds.wzopen !== undefined) { const m = W.members[+ds.wzopen], j = W.open.indexOf(m); j >= 0 ? W.open.splice(j, 1) : W.open.push(m); return draw(); }
    if (ds.wzsk) { const [i, ...rest] = ds.wzsk.split('|'), sk = rest.join('|'), m = W.members[+i], all = S.roster?.[m.role]?.skills ?? [], on = m.skills ?? all; m.skills = on.includes(sk) ? on.filter((x) => x !== sk) : [...on, sk]; return draw(); }
    if (ds.wzxadd !== undefined) { const m = W.members[+ds.wzxadd]; (m.extraSkills ??= []).push({ name: '', text: '' }); draw(); return el.querySelector('[data-f="wzxn-' + ds.wzxadd + '-' + (m.extraSkills.length - 1) + '"]')?.focus(); }
    if (ds.wzxdel) { const [i, j] = ds.wzxdel.split('|'); W.members[+i].extraSkills.splice(+j, 1); return draw(); }
    if (ds.wzlead !== undefined) { W.lead = W.members[+ds.wzlead]; return; }
    switch (ds.a) {
      case 'wzNext': { const list = steps(); return wzGo(list[list.indexOf(W.step) + 1]); }
      case 'wzBack': { const list = steps(); return wzGo(list[list.indexOf(W.step) - 1]); }
      case 'wzCancel': W = null; view = companyMode ? 'company' : 'team'; draw(); return companyMode ? post({ type: 'team:ready' }) : undefined;
      case 'wzFinish': return finishWizard();
      case 'wzDice': return rollName();
      case 'wzLogo': return post({ type: 'team:wizardLogo' });
      case 'wzLogoClear': W.logoFile = ''; W.logoData = null; return draw();
      case 'wzBest': for (const g of W.suggestions ?? []) if (g.candidates[0] && !W.members.some((m) => m.role === g.role)) addToWizard(g.role, g.candidates[0].employee); return draw();
      case 'wzAddPicked': for (const k of W.picked) { const [r, e] = k.split('|'); addToWizard(r, e); } W.picked = []; return draw();
      case 'wzClearPicked': W.picked = []; return draw();
      case 'wzPickAll': for (const p of filterPool(poolOf(), { role: W.fRole, temper: W.fTemper, gender: W.fGender, skill: W.fSkill, q: W.fq }).slice(0, 120)) { const k = p.role + '|' + p.id; if (chosenIndex(p.role, p.id) < 0 && !W.picked.includes(k)) W.picked.push(k); } return draw();
      case 'wzAllLocal': for (const m of W.members) Object.assign(m, localWorker()); return draw();
      case 'wzSame': sameForAll(W.members, W.same.role, W.same); return draw();
    }
  }
  function wizardInput(f, v) {
    let m;
    if (f === 'wzname') { W.name = v; const b = el.querySelector('[data-a="wzNext"]'); if (b) b.disabled = !v.trim(); el.querySelectorAll('[data-wzgo]').forEach((x) => { if (+x.dataset.wzgo > W.step) x.disabled = !v.trim(); }); return; }
    if (f === 'wzdesc') { W.description = v; return; }
    if (f === 'wzpurpose') { W.purpose = v; W.suggestions = null; return; }
    if (f === 'wzskill') { if (/[,\n]/.test(v)) { for (const s of v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean)) if (!W.skills.includes(s)) W.skills.push(s); W.skillText = ''; W.suggestions = null; } else W.skillText = v; return draw(); }
    if (f === 'wzq') { W.fq = v; return later(draw); }
    if (f === 'wzbudget') { W.budgetUsd = Math.max(0, Number(v) || 0); const w = el.querySelector('.wz-warn div'); if (w) w.textContent = t('sq.wz.costWarn', W.budgetUsd > 0 ? W.budgetUsd.toFixed(2) + ' USD' : t('sq.wz.noLimit')); return; }
    if ((m = f.match(/^wzmodel-(\d+)-other$/))) { W.members[+m[1]].model = v.trim(); return; }
    if (f === 'wzsamemodel-other') { W.same.model = v.trim(); return; }
    if ((m = f.match(/^wznote-(\d+)$/))) { W.members[+m[1]].note = v; return; }
    if ((m = f.match(/^wzinstr-(\d+)$/))) { W.members[+m[1]].instructions = v; return; }
    if ((m = f.match(/^wzx([nt])-(\d+)-(\d+)$/))) { W.members[+m[2]].extraSkills[+m[3]][m[1] === 'n' ? 'name' : 'text'] = v; return; }
  }
  function wizardChange(f, v) {
    let m;
    if (f === 'wzrole') W.fRole = v; else if (f === 'wztemper') W.fTemper = v; else if (f === 'wzgender') W.fGender = v; else if (f === 'wzfskill') W.fSkill = v;
    else if ((m = f.match(/^wzprov-(\d+)$/))) { const x = W.members[+m[1]]; if (!usable(v)) return false; x.provider = v; x.model = x.kind === 'local' ? '' : agentOf(v)?.defaultModel ?? ''; x.typing = false; }
    else if (f === 'wzsameprov') { if (!usable(v)) return false; W.same.provider = v; W.same.model = W.same.kind === 'local' ? '' : agentOf(v)?.defaultModel ?? ''; W.same.typing = false; }
    // a model chosen (a select: every model, every time); *Other…* opens its field; too big: confirmed first
    else if ((m = f.match(/^wzmodel-(\d+)$/)) || f === 'wzsamemodel') {
      const x = m ? W.members[+m[1]] : W.same;
      if (v === '__other__') { x.typing = true; draw(); el.querySelector('[data-f="' + f + '-other"]')?.focus(); return true; }
      x.typing = false; pickModel(x.provider, v, () => { x.model = v; }); return true;
    }
    else if (f === 'wzsamerole') W.same.role = v;
    else if ((m = f.match(/^wztemper-(\d+)$/))) W.members[+m[1]].temperament = v;
    else return false;
    draw(); return true;
  }

  // ---------- the user's choices ----------
  function changed() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; post({ type: 'team:save', team: S.team }); }, 600);
    const s = el.querySelector('.sq-saved'); if (s) { s.textContent = t('sq.saving'); s.classList.remove('on'); }
  }
  /** What is typed is kept before the team is read again. */
  function flush() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; post({ type: 'team:save', team: S.team }); } }
  function select(id) { const x = memberById(id); brainOther = null; sel = x?.id ?? null; if (x) role = x.role; filter = ''; ftemper = ''; fgender = ''; peek = null; viewing = null; skillsAll = false; }
  function onClick(e) {
    const d = e.target.closest('[data-a],[data-cfg],[data-view],[data-member],[data-tab],[data-hire],[data-addemp],[data-addrole],[data-delxs],[data-deltask],[data-team],[data-gifs],[data-wzgo],[data-wzpick],[data-wztoggle],[data-wzdel],[data-wzdelskill],[data-wzskill],[data-wzkind],[data-wzlead],[data-wzsamekind],[data-wzopen],[data-wzsk],[data-wzxadd],[data-wzxdel],[data-skt],[data-skv],[data-ske],[data-skd],[data-skc],[data-sknew],[data-skpick],[data-sd]');
    if (!d || !el.contains(d) || d.disabled) return;
    const ds = d.dataset;
    if (ds.a === 'ramYes' || ds.a === 'ramNo') { const yes = ds.a === 'ramYes' ? ask?.yes : null; ask = null; yes?.(); return draw(); }
    if (ask) return;
    if (ds.a === 'wizard') { flush(); return openWizard('new'); }
    if (ds.a === 'editMembers') { flush(); return openWizard('edit'); }
    if (skillClick(ds)) return;
    if (view === 'wizard' && W) return wizardClick(ds);
    if (ds.team) { view = 'team'; S.loading = true; draw(); return post({ type: 'team:open', id: ds.team }); }
    const x = cur();
    if (ds.gifs) { x.personality = { gifs: 'sometimes', on: '', note: '', ...x.personality, gifs: ds.gifs }; changed(); return draw(); }
    if (ds.view) { const f = findEmp(ds.view); if (!f) return; if (f.role !== role) { role = f.role; filter = ''; ftemper = ''; fgender = ''; } const own = members().find((m) => m.employee === f.p.id); if (own) { sel = own.id; viewing = null; } else viewing = f.p.id; peek = f.p.id; skillsAll = false; draw(); return el.querySelector('.sq-side')?.scrollIntoView?.({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
    if (ds.cfg) { select(ds.cfg); return focusBrain(); }
    if (ds.a === 'brain') return focusBrain();
    if (ds.a === 'reports') return post({ type: 'team:reports', team: S.team.id, member: x.id });
    if (ds.member) { select(ds.member); return draw(); }
    if (ds.addrole) { role = ds.addrole; filter = ''; ftemper = ''; fgender = ''; peek = null; draw(); return el.querySelector('.sq-roster')?.scrollIntoView?.({ block: 'start' }); }
    if (ds.addemp) { flush(); S.loading = true; draw(); const f = findEmp(ds.addemp); return post({ type: 'team:memberAdd', id: S.team.id, members: [{ role: f?.role ?? role, employee: ds.addemp }] }); }
    if (ds.tab) { tab = ds.tab; return draw(); }
    if (ds.hire) return hire(ds.hire);
    if (ds.delxs) { x.extraSkills.splice(+ds.delxs, 1); changed(); return draw(); }
    if (ds.deltask) { x.tasks.splice(+ds.deltask, 1); changed(); return draw(); }
    const id = S.team?.id;
    switch (ds.a) {
      case 'retry': S.missing = null; S.loading = true; draw(); return post({ type: 'team:ready' });
      case 'default': return post({ type: 'team:default', id });
      case 'rename': return post({ type: 'team:rename', id, name: S.team.name });
      case 'duplicate': return post({ type: 'team:duplicate', id });
      case 'export': return post({ type: 'team:export', id });
      case 'import': return post({ type: 'team:import' });
      case 'company': flush(); view = 'company'; draw(); return post({ type: 'team:ready' });
      case 'logo': return post({ type: 'team:logo', id });
      case 'logoClear': return post({ type: 'team:logoClear', id });
      case 'lead': S.team.techLead = x.id; changed(); return draw();
      case 'remove': flush(); return post({ type: 'team:memberRemove', id, member: x.id, name: memberName(x) });
      case 'back': viewing = null; return draw();
      case 'skillsAll': skillsAll = !skillsAll; return draw();
      case 'delete': return post({ type: 'team:delete', id, name: S.team.name });
      case 'key': return post({ type: 'team:key', provider: x.provider });
      case 'addSkill': x.extraSkills.push({ name: '', text: '' }); draw(); return el.querySelector('[data-f="xs-name-' + (x.extraSkills.length - 1) + '"]')?.focus();
      case 'addTask': x.tasks.push({ id: 'task-' + Date.now().toString(36), title: '', station: 'code', on: true }); draw(); return el.querySelector('[data-f="task-title-' + (x.tasks.length - 1) + '"]')?.focus();
    }
  }
  function onInput(e) {
    const f = e.target.dataset?.f; if (!f || !el.contains(e.target)) return;
    if (skillInput(f, e.target.value)) return;
    if (view === 'wizard' && W) return wizardInput(f, e.target.value);
    if (f === 'filter') { filter = e.target.value; return later(() => redrawRoster(true)); }
    if (f === 'ftemper' || f === 'fgender' || f === 'prole') return;
    if (f === 'tdesc') { S.team.description = e.target.value; return changed(); }
    const x = cur(), v = e.target.value;
    if (!x) return;
    let m;
    const pe = () => (x.personality = { gifs: 'sometimes', on: '', note: '', ...x.personality });
    if (f === 'mname') x.name = v.trim() || undefined;
    else if (f === 'pon') pe().on = v;
    else if (f === 'pnote') pe().note = v;
    else if (f === 'instructions') x.instructions = v;
    else if ((m = f.match(/^xs-(name|text)-(\d+)$/))) x.extraSkills[+m[2]][m[1]] = v;
    else if ((m = f.match(/^task-title-(\d+)$/))) x.tasks[+m[1]].title = v;
    else return;
    changed();
  }
  function onChange(e) {
    const t0 = e.target; if (!el.contains(t0)) return;
    if (t0.dataset.f === 'sdmember' && SD) { SD.member = t0.value; return; }
    if (t0.dataset.f === 'sd-kind' && SD?.fields) { SD.fields.kind = t0.value; return; }
    if (t0.dataset.f === 'magent' && S.team) { const x0 = cur(); if (!x0) return; flush(); x0.agent = t0.value || undefined; draw(); return post({ type: 'team:memberUpdate', id: S.team.id, member: x0.id, change: { agent: t0.value } }); }
    if (view === 'wizard' && W) { if (t0.dataset.wzlead !== undefined) { W.lead = W.members[+t0.dataset.wzlead]; return; } return wizardChange(t0.dataset.f ?? '', t0.value); }
    if (t0.dataset.a === 'open') { flush(); S.loading = true; draw(); return post({ type: 'team:open', id: t0.value }); }
    if (t0.dataset.f === 'ftemper') { ftemper = t0.value; return redrawRoster(true); }
    if (t0.dataset.f === 'fgender') { fgender = t0.value; return redrawRoster(true); }
    if (t0.dataset.f === 'prole') { role = t0.value; filter = ''; ftemper = ''; fgender = ''; peek = null; return redrawRoster(true); }
    const x = cur(); if (!x) return;
    if (t0.dataset.f === 'temper') { x.personality = { gifs: 'sometimes', on: '', note: '', ...x.personality, temperament: t0.value }; changed(); return draw(); }
    if (t0.dataset.f === 'brain') {
      const [kind, provider, model] = t0.value.split('|');
      // *Other…*: the model is typed in its field, saved when it is left
      if (model === '__other__') { brainOther = { kind, provider }; draw(); return el.querySelector('[data-f="brainother"]')?.focus(); }
      brainOther = null;
      return pickModel(provider, model, () => setBrain(x, kind, provider, model));
    }
    if (t0.dataset.f === 'brainother' && brainOther) { const { kind, provider } = brainOther, model = t0.value.trim(); brainOther = null; setBrain(x, kind, provider, model); return draw(); }
    let m;
    if ((m = (t0.dataset.f ?? '').match(/^task-station-(\d+)$/))) { x.tasks[+m[1]].station = t0.value; return changed(); }
    if (t0.dataset.taskOn !== undefined) { x.tasks[+t0.dataset.taskOn].on = t0.checked; return changed(); }
    const k = t0.dataset.sw; if (!k) return;
    if (k.startsWith('skill:')) { const s = k.slice(6); (seenSkills[x.role] ??= []).includes(s) || seenSkills[x.role].push(s); x.skills = t0.checked ? [...new Set([...x.skills, s])] : x.skills.filter((y) => y !== s); }
    else if (k.startsWith('b:')) x.behaviour[k.slice(2)] = t0.checked;
    changed();
  }
  /** Who works a member, saved by its command (team member update). */
  function setBrain(x, kind, provider, model) { flush(); Object.assign(x, { kind, provider, model }); post({ type: 'team:memberUpdate', id: S.team.id, member: x.id, change: { kind, provider, model } }); }
  // the selected member takes another employee of their role: they bring their own temperament (the roster's)
  function hire(id) { const x = cur(); if (!x || inTeam(id)) return; x.employee = id; if (x.personality) delete x.personality.temperament; peek = id; viewing = null; changed(); say(t('sq.signedBang', empOf(x)?.name ?? id, t('sq.role.' + x.role))); }
  // the pool's tile dragged onto a member of its role: that member takes the employee
  const spotOf = (e) => e.target.closest?.('.op-slot[data-member]');
  function onDragStart(e) { const c = e.target.closest?.('[data-drag]'); if (!c) return; e.dataTransfer.setData('text/plain', c.dataset.drag); e.dataTransfer.effectAllowed = 'copy'; c.classList.add('dragging'); }
  function onDragEnd() { el.querySelectorAll('.dragging,.drop').forEach((x) => x.classList.remove('dragging', 'drop')); }
  function onDragOver(e) { const s0 = spotOf(e); if (s0 && memberById(s0.dataset.member)?.role === role) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; s0.classList.add('drop'); } }
  function onDrop(e) { const s0 = spotOf(e); if (!s0) return; e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); onDragEnd(); if (memberById(s0.dataset.member)?.role === role && people(role).some((p) => p.id === id)) { select(s0.dataset.member); hire(id); } }
  function onKey(e) {
    if (SD && e.key === 'Escape') { SD = null; return draw(); }
    if (ask && e.key === 'Escape') { ask = null; return draw(); }
    if (view === 'wizard' && W && e.key === 'Enter' && e.target.dataset?.f === 'wzskill') { e.preventDefault(); const v = W.skillText.trim(); if (v && !W.skills.includes(v)) { W.skills.push(v); W.suggestions = null; } W.skillText = ''; return draw(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.op-slot,.ro-t,.co-card')) { e.preventDefault(); e.target.click(); }
  }

  return {
    mount(root, send, opts) {
      el = root; post = send;
      companyMode = !!opts?.company; view = companyMode ? 'company' : 'team';
      root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange); root.addEventListener('keydown', onKey);
      root.addEventListener('mouseover', onPeek); root.addEventListener('focusin', onPeek);
      root.addEventListener('dragstart', onDragStart); root.addEventListener('dragend', onDragEnd); root.addEventListener('dragover', onDragOver); root.addEventListener('drop', onDrop);
      draw(); post({ type: 'team:ready' });
    },
    /** A message of the host; true when it was the squad's. */
    receive(m) {
      if (!m || typeof m.type !== 'string' || !m.type.startsWith('team:')) return false;
      if (m.type === 'team:state') {
        if (m.faces) FACES = m.faces; if (m.thumbs) THUMBS = m.thumbs; delete m.faces; delete m.thumbs;
        const other = S.team?.id !== m.team?.id; S = { ...S, ...m, loading: false, missing: null };
        if (other) { peek = null; viewing = null; savedAt = 0; NUMBERS = {}; }
        if (W?.creating && m.team) { W = null; view = 'team'; }
        if (!memberById(sel)) select(members()[0]?.id ?? null);
        // the member panel's brain lists this machine's agents: asked once
        if (S.team && !AGENTS && !agentsAsked) { agentsAsked = true; askAgents(); }
        // the onboarding with no team yet: straight to the wizard
        if (!companyMode && !S.team && !W && !autoWizard) { autoWizard = true; return openWizard('new'); }
        draw();
      }
      else if (m.type === 'team:numbers') { if (S.team?.id === m.team) { NUMBERS = m.numbers ?? {}; draw(); } }
      else if (m.type === 'team:agents') { AGENTS = m.agents ?? []; draw(); }
      else if (m.type === 'team:models') { HERE = m.models ?? { memory: {}, providers: {} }; draw(); }
      else if (m.type === 'team:names') { if (!W) return true; W.names = m.names ?? []; W.nameAt = W.names.length ? 0 : -1; if (W.names.length) W.name = W.names[0]; draw(); }
      else if (m.type === 'team:suggestions') { if (W) { W.suggestions = m.roles ?? []; draw(); } }
      else if (m.type === 'team:wizardLogo') { if (W) { W.logoFile = m.file; W.logoData = m.data; draw(); } }
      else if (m.type === 'team:saved') { if (S.team && m.team.id === S.team.id && !saveTimer) S.team.updated = m.team.updated; savedAt = Date.now(); const s = el?.querySelector('.sq-saved'); if (s && !saveTimer) { s.textContent = '✓ ' + t('sq.saved'); s.classList.add('on'); } if (m.teams) S.teams = m.teams; }
      else if (m.type === 'team:missing') { S.missing = m.text; S.loading = false; draw(); }
      else if (m.type === 'team:error') { if (W) W.creating = false; if (S.loading) S.loading = false; say(m.text, true); }
      else if (m.type === 'team:info') say(m.text, false);
      return true;
    },
    /** The team on the screen (the onboarding's summary). */
    team: () => S.team,
    /** Opens the new-team wizard (the onboarding's team step, a test). */
    wizard: () => openWizard('new'),
  };
})();
`;
