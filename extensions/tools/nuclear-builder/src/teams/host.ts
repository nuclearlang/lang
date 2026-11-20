// The host of the squad screen: it answers the page's `team:*` messages with `nuclear-builder team` (cli.ts), asks
// what only the editor can ask (a name, a file, a confirmation, an API key) and gives the page its state. Shared by the
// squad's own panel (panel.ts) and the onboarding (vscode/src/setupPanel.ts).
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { lang, l10n } from '../../../../vscode/src/i18n';
import { addMembers, Agent, cloneSkill, createSkill, deleteSkill, setSkills, updateSkill, agentsHere, modelsHere, ModelsHere, CommandMissing, createTeam, removeMember, updateMember, deleteTeam, duplicateTeam, exportTeam, importTeam, clearTeamLogo, logoData, renameTeam, rosterFaces, Screen, suggestMembers, suggestNames, saveTeam, setDefaultTeam, setTeamLogo, Team, TeamDraft, TeamEntry, teamScreen, vaultList, vaultSet } from './cli';
import { teamWork } from '../workbench';
import { memberActivity, teamSpend } from './hud';
import { teamNumbers } from '../reports/metrics';

/** A run as the company screen needs it: whose team, its spec, where it is. */
type WorkRun = Parameters<typeof teamWork>[0][number] & Parameters<typeof memberActivity>[0][number] & { costUsd?: number };

export class TeamsHost {
  private id: string | undefined;
  /** What the screen draws, read in one process (`team screen`) when the page loads, a team is made, deleted, imported
   * or made the default; a command that changes one team gives that team back, and only it is replaced. */
  private screen: (Screen & { lang: string }) | undefined;
  /** The agents of this machine (the wizard's), asked beside the screen when the page loads: never in its way. */
  private agents: Promise<Agent[]> | undefined;
  /** Each provider's models and this machine's memory (the model pickers'), asked when a picker first needs them. */
  private models: Promise<ModelsHere> | undefined;
  /** The roster's faces reach a page once (as the page's URLs of the files when the panel gives `faceUrl`), again when
   * it loads anew. */
  private facesSent = false;

  /** `work`: the runs of the projects the editor knows, for the company screen (what each team works on); without
   * it (the onboarding) the screen opens straight to a team. */
  constructor(
    private readonly post: (m: unknown) => void,
    private readonly work?: () => WorkRun[],
    /** A portrait's URL for the page (a webview URI of the file); `data:` URLs without it. */
    private readonly faceUrl?: (face?: string | null) => string | null,
  ) {}

  /** The page's messages, one after the other: two writes of the same team never overlap. */
  private queue: Promise<void> = Promise.resolve();

  /** Answers a page message; false when it was not the squad's. */
  async handle(m: { type: string; [k: string]: unknown }): Promise<boolean> {
    if (!m.type.startsWith('team:')) return false;
    const done = this.queue.then(() => this.receive(m)).catch((e) => {
      if (e instanceof CommandMissing) this.post({ type: 'team:missing', text: l10n.t('This nuclear-builder has no teams yet ({0}).', e.message) });
      else this.post({ type: 'team:error', text: e instanceof Error ? e.message : String(e) });
    });
    this.queue = done;
    await done;
    return true;
  }

  /** The team the screen shows (the onboarding's summary). */
  current(): string | undefined {
    return this.id;
  }

  private async receive(m: { type: string; [k: string]: unknown }): Promise<void> {
    const id = typeof m.id === 'string' ? m.id : undefined;
    switch (m.type) {
      case 'team:ready':
        this.facesSent = false;
        this.agents = agentsHere();
        this.models = undefined;
        await this.load();
        return this.state();
      case 'team:open':
        // read again: an agent may have changed the team through the Builder's tools
        this.id = id;
        await this.load();
        return this.state();
      // the new-team wizard (ADR-platform-0010): what this machine can work a member with, names, suggestions, the logo
      case 'team:wizard':
        this.post({ type: 'team:agents', agents: await (this.agents ??= agentsHere()) });
        return;
      // each provider's models (from the provider) and this machine's memory: the pickers' red too-big models
      // (not awaited: an API's list may take seconds, the page's other messages do not wait for it)
      case 'team:models':
        void (this.models ??= modelsHere()).then((models) => this.post({ type: 'team:models', models }));
        return;
      case 'team:names':
        this.post({ type: 'team:names', names: await suggestNames(String(m.purpose ?? ''), lang()) });
        return;
      case 'team:suggest': {
        const skills = Array.isArray(m.skills) ? m.skills.map(String) : [];
        this.post({ type: 'team:suggestions', roles: (await suggestMembers(String(m.purpose ?? ''), skills, lang())).roles });
        return;
      }
      case 'team:wizardLogo': {
        const from = await vscode.window.showOpenDialog({ title: l10n.t('The logo of the team'), canSelectMany: false, filters: { [l10n.t('Images')]: ['png', 'jpg', 'jpeg', 'svg'] } });
        if (!from?.[0]) return;
        // only shown here: `team create` copies it beside the team
        this.post({ type: 'team:wizardLogo', file: from[0].fsPath, data: logoData({ logo: from[0].fsPath }) });
        return;
      }
      case 'team:create': {
        const made = await createTeam(m.draft as TeamDraft);
        this.id = made.id;
        this.post({ type: 'team:info', text: l10n.t('The team "{0}" is ready.', made.name) });
        await this.load();
        return this.state();
      }
      case 'team:save': {
        const saved = await saveTeam(m.team as Team);
        this.id = saved.id;
        // the roles it lacks change only with its members, which their own commands add and remove
        this.put({ ...saved, missing: saved.missing ?? this.screen?.shown[saved.id]?.missing });
        this.post({ type: 'team:saved', team: saved, teams: this.screen?.teams ?? [] });
        return;
      }
      // a team's members: hired from the pool or the wizard, let go (the user's decision), who works one changed
      case 'team:memberAdd': {
        if (!id || !Array.isArray(m.members)) return;
        this.put(await addMembers(id, m.members as Parameters<typeof addMembers>[1]));
        return this.state();
      }
      case 'team:memberRemove': {
        const member = String(m.member ?? '');
        if (!id || !member) return;
        // the wizard's list of who leaves was the user's choice already; the profile's button asks
        if (m.fromWizard !== true) {
          const yes = l10n.t('Let them go');
          const ok = await vscode.window.showWarningMessage(l10n.t('Let {0} go from the team?', String(m.name ?? member)), { modal: true, detail: l10n.t('Their settings go with them (the team\'s last version stays as {0}.json.bak).', id) }, yes);
          if (ok !== yes) return;
        }
        this.put(await removeMember(id, member));
        return this.state();
      }
      case 'team:memberUpdate': {
        const member = String(m.member ?? '');
        if (!id || !member) return;
        this.put(await updateMember(id, member, m.change as Parameters<typeof updateMember>[2]));
        return m.last === false ? undefined : this.state();
      }
      // the skills of a team and its members (spec 011 requirement 34): each through its command
      case 'team:skillsSet': {
        if (!id || !Array.isArray(m.skills)) return;
        this.put(await setSkills(id, m.skills.map(String), m.member ? String(m.member) : undefined));
        return this.state();
      }
      case 'team:skillClone': {
        if (!id || !m.skill) return;
        this.put(await cloneSkill(id, String(m.skill), m.member ? String(m.member) : undefined));
        return this.state();
      }
      case 'team:skillCreate':
      case 'team:skillUpdate': {
        if (!id || typeof m.markdown !== 'string') return;
        const member = m.member ? String(m.member) : undefined;
        this.put(m.type === 'team:skillCreate' ? await createSkill(id, m.markdown, member) : await updateSkill(id, String(m.skill ?? ''), m.markdown, member));
        return this.state();
      }
      case 'team:skillDelete': {
        if (!id || !m.skill) return;
        // deleting a skill of the user's is the user's decision: asked here, as a tool's needsUser is asked in the chat
        const yes = l10n.t('Delete');
        const ok = await vscode.window.showWarningMessage(l10n.t('Delete the skill "{0}"?', String(m.title ?? m.skill)), { modal: true, detail: l10n.t('The team\'s last version stays as {0}.json.bak.', id) }, yes);
        if (ok !== yes) return;
        this.put(await deleteSkill(id, String(m.skill), m.member ? String(m.member) : undefined));
        return this.state();
      }
      case 'team:rename': {
        if (!id) return;
        const name = await vscode.window.showInputBox({ title: l10n.t('Rename the team'), value: String(m.name ?? ''), validateInput: (v) => (v.trim() ? undefined : l10n.t('A team needs a name')) });
        if (!name?.trim()) return;
        this.put(await renameTeam(id, name.trim()));
        return this.state();
      }
      case 'team:duplicate': {
        if (!id) return;
        const name = this.screen?.shown[id]?.name ?? this.screen?.teams.find((t) => t.id === id)?.name ?? id;
        const copy = await duplicateTeam(id, l10n.t('{0} (copy)', name));
        this.id = copy.id;
        await this.load();
        return this.state();
      }
      case 'team:delete': {
        if (!id) return;
        const yes = l10n.t('Delete the team');
        const ok = await vscode.window.showWarningMessage(l10n.t('Delete the team "{0}"?', String(m.name ?? id)), { modal: true, detail: l10n.t('Its file goes to {0}.json.bak in the factory\'s teams folder: it can be brought back by hand.', id) }, yes);
        if (ok !== yes) return;
        await deleteTeam(id);
        this.id = undefined;
        await this.load();
        return this.state();
      }
      case 'team:default':
        if (!id) return;
        await setDefaultTeam(id);
        await this.load();
        this.post({ type: 'team:info', text: l10n.t('The default team is now "{0}".', this.screen?.shown[id]?.name ?? id) });
        return this.state();
      case 'team:export': {
        if (!id) return;
        const to = await vscode.window.showSaveDialog({ title: l10n.t('Export the team'), defaultUri: vscode.Uri.file(path.join(os.homedir(), `${id}.team.json`)), filters: { JSON: ['json'] } });
        if (!to) return;
        await exportTeam(id, to.fsPath);
        this.post({ type: 'team:info', text: l10n.t('Exported to {0}', to.fsPath) });
        return;
      }
      case 'team:import': {
        const from = await vscode.window.showOpenDialog({ title: l10n.t('Import a team'), canSelectMany: false, filters: { JSON: ['json'] } });
        if (!from?.[0]) return;
        const t = await importTeam(from[0].fsPath);
        this.id = t.id;
        await this.load();
        return this.state();
      }
      case 'team:logo': {
        if (!id) return;
        const from = await vscode.window.showOpenDialog({ title: l10n.t('The logo of the team'), canSelectMany: false, filters: { [l10n.t('Images')]: ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'] } });
        if (!from?.[0]) return;
        // the command copies the image beside the team; the editor never writes there
        this.put(await setTeamLogo(id, from[0].fsPath));
        return this.state();
      }
      case 'team:logoClear':
        if (!id) return;
        this.put(await clearTeamLogo(id));
        return this.state();
      case 'team:chat': {
        // a member's direct message or the team's channel, in Nuclear Atlas (the chat's ids: `<team>-<member>`, `<team>`)
        const team = String(m.team ?? ''), member = m.member ? String(m.member) : '';
        if (!/^[\w-]+$/.test(team) || (member && !/^[\w-]+$/.test(member))) return;
        void vscode.commands.executeCommand('nuclear.atlas.open', undefined, member ? `dm-${team}-${member}` : team);
        return;
      }
      case 'team:reports':
        // the Reports page, filtered to the member
        void vscode.commands.executeCommand('nuclear.builder.reports', { team: m.team, member: m.member });
        return;
      case 'team:key': {
        const provider = String(m.provider ?? '');
        if (!/^[a-z-]+$/.test(provider)) return;
        if (await askKey(provider)) {
          this.post({ type: 'team:info', text: l10n.t('The key of {0} is in the vault.', provider) });
          if (this.screen) this.screen.vault = await vaultList().catch(() => null);
        }
        return this.state();
      }
    }
  }

  /** Reads everything the screen draws again, in one process. */
  private async load(): Promise<void> {
    const l = lang();
    this.screen = { ...(await teamScreen(l)), lang: l };
  }

  /** A team a command gave back replaces its old one on the screen (and its line in the list). */
  private put(t: Team): void {
    if (!this.screen) return;
    this.screen.shown[t.id] = t;
    this.screen.teams = this.screen.teams.map((e) => (e.id === t.id ? { ...e, name: t.name, members: t.members?.length ?? e.members, updated: t.updated ?? e.updated } : e));
  }

  /** The page's state, from what was read: no process, unless the language changed (the roster's texts). */
  private async state(): Promise<void> {
    if (!this.screen || this.screen.lang !== lang()) await this.load();
    const s = this.screen!;
    const teams = s.teams;
    if (!this.id || !teams.some((t) => t.id === this.id)) this.id = (teams.find((t) => t.default) ?? teams[0])?.id;
    const team = this.id ? s.shown[this.id] ?? null : null;
    // the tiles, cards and avatars draw the thumbnails; the open profile, the portrait
    const faces = this.facesSent ? undefined : rosterFaces(s.roster, this.faceUrl);
    const thumbs = this.facesSent ? undefined : rosterFaces(s.roster, this.faceUrl, 'thumb');
    this.facesSent = true;
    // each member's steps in this team's runs (the profile's Activity); the onboarding knows no runs
    const runs = this.work?.() ?? [];
    const activity = team ? Object.fromEntries((team.members ?? []).map((x) => [x.id, memberActivity(runs, team.id, x.employee ?? '')])) : {};
    this.post({ type: 'team:state', teams, team, logo: team ? logoData(team) : null, roster: s.roster, temperaments: s.temperaments, faces, thumbs, vault: s.vault, library: s.library ?? [], agents: s.agents ?? [], warnings: [...(s.warnings ?? []), ...(team?.warnings ?? [])], activity, company: this.work ? this.company(teams, s.shown) : null });
    // each member's numbers from the factory's ledger (the member panel's Summary): after the page is drawn, never
    // holding it; an older nuclear-builder without `metrics` leaves them out
    if (team) void teamNumbers(team.id).then((numbers) => this.post({ type: 'team:numbers', team: team.id, numbers })).catch(() => undefined);
  }

  /** The company screen's panels: each team with its logo, description, members, tech lead, what it works on, and its
   * run's budget with what its latest run spent. */
  private company(teams: TeamEntry[], shown: Record<string, Team | null>): unknown[] {
    const runs = this.work?.() ?? [];
    return teams.map((e) => {
      const t = shown[e.id];
      return { id: e.id, name: t?.name ?? e.name, default: e.default, description: t?.description ?? '', logo: t ? logoData(t) : null, techLead: t?.techLead ?? null, members: (t?.members ?? []).map((x) => ({ id: x.id, role: x.role, employee: x.employee ?? '', name: x.name ?? '', kind: x.kind, provider: x.provider ?? '', model: x.model ?? '' })), missing: t?.missing ?? [], work: teamWork(runs, e.id), budgetUsd: t?.budgetUsd ?? 0, spentUsd: teamSpend(runs, e.id) };
    });
  }
}


/** Asks for a provider's API key (hidden) and hands it to the vault on stdin: never kept by the editor. */
export async function askKey(provider: string): Promise<boolean> {
  const key = await vscode.window.showInputBox({ title: l10n.t('The API key of {0}', provider), prompt: l10n.t("Kept in the system's keyring by nuclear-builder vault, never in a file or the settings."), password: true, ignoreFocusOut: true });
  if (!key?.trim()) return false;
  await vaultSet(provider, key.trim());
  return true;
}
