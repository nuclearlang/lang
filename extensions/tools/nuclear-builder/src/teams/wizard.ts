// What the new-team wizard computes (page.ts, ADR-platform-0010), the same in the tests: the members by role, the
// roles a team lacks, the paid members, the pool's filter, the roster's skills, the draft of `team create`. Inlined in
// the page's script by `toString()`: no import, each function uses nothing outside itself.

/** A member as the wizard holds it: an employee of a role and who works them (an agent or an API: no local kind, ADR-platform-0013). */
export interface WizardMember {
  role: string;
  employee?: string;
  name?: string;
  kind: string;
  provider: string;
  model: string;
  /** Its id in the team, when it is a member already (editing a team). */
  id?: string;
  /** What makes it different (ADR-platform-0010: a member is its profile, not its model); each one left out is the
   * default: no instructions, every skill of its role, none of its own, the employee's temperament, no note. */
  instructions?: string;
  skills?: string[];
  extraSkills?: { name: string; text: string }[];
  /** Its own skills (cloned from the library or the team, or written in the skills editor). */
  ownSkills?: { id: string; name: string; description: string; text: string; from?: string }[];
  temperament?: string;
  note?: string;
}

/** How many of a member's differences are set (the row's count). */
export function differences(m: WizardMember): number {
  return [m.instructions?.trim(), m.skills, (m.extraSkills ?? []).some((x) => x.name.trim()), m.temperament, m.note?.trim()].filter(Boolean).length;
}

/** The same agent and model for every member of `role` (empty: everyone): the team may be worked by one agent. */
export function sameForAll<M extends { role: string; kind: string; provider: string; model: string }>(members: M[], role: string, w: { kind: string; provider: string; model: string }): M[] {
  for (const m of members) if (!role || m.role === role) Object.assign(m, { kind: w.kind, provider: w.provider, model: w.model });
  return members;
}

/** How many members each role has, in the roles' order (every role, 0 included). */
export function roleCounts(members: { role: string }[]): Record<string, number> {
  const out: Record<string, number> = { analyst: 0, architect: 0, developer: 0, qa: 0, devops: 0 };
  for (const m of members) out[m.role] = (out[m.role] ?? 0) + 1;
  return out;
}

/** The roles the six stations need that no member has (the team cannot run without them). */
export function missingRoles(members: { role: string }[]): string[] {
  return ['analyst', 'architect', 'developer', 'qa', 'devops'].filter((r) => !members.some((m) => m.role === r));
}

/** The members a provider works (an agent's command or an API): each run of theirs costs money. */
export function paidMembers<M extends { kind?: string }>(members: M[]): M[] {
  return members.filter((m) => !!m.kind && m.kind !== 'local');
}

/** The roster as the wizard's pool shows it: a role (empty: every role), a temperament, a gender, a skill, the words
 * searched (name, headline, profile, skills). */
export function filterPool<P extends { role: string; name: string; headline?: string; profile?: string; skills?: string[]; temperament?: string; gender?: string }>(pool: P[], f: { role?: string; temper?: string; gender?: string; skill?: string; q?: string }): P[] {
  const words = String(f.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const skill = String(f.skill ?? '').toLowerCase();
  return pool.filter((p) => {
    if (f.role && p.role !== f.role) return false;
    if (f.temper && p.temperament !== f.temper) return false;
    if (f.gender && p.gender !== f.gender) return false;
    if (skill && !(p.skills ?? []).some((s) => s.toLowerCase() === skill)) return false;
    const text = [p.name, p.headline, p.profile, ...(p.skills ?? [])].join(' ').toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** Every skill of the roster's employees, the most common first (the skills' suggestions). */
export function rosterSkills(roster: Record<string, { employees?: { skills?: string[] }[] }>): string[] {
  const n: Record<string, number> = {};
  for (const r of Object.values(roster ?? {})) for (const e of r?.employees ?? []) for (const s of e.skills ?? []) n[s] = (n[s] ?? 0) + 1;
  return Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b));
}

/** The draft `team create` reads: who works a member always written (an older `local` one becomes the default agent);
 * the tech lead is the index of its member. */
export function draftOf(w: { name: string; description: string; purpose: string; skills: string[]; ownSkills?: { id: string; name: string; description: string; text: string; from?: string }[]; budgetUsd: number; lead: number; logoFile?: string; members: WizardMember[] }): Record<string, unknown> {
  const members = w.members.map((m) => {
    const out: Record<string, unknown> = { role: m.role };
    if (m.employee) out.employee = m.employee;
    if (m.name) out.name = m.name;
    const local = m.kind === 'local' || !m.kind;
    out.kind = local ? 'agent' : m.kind;
    out.provider = local ? 'claude-code' : m.provider;
    if (m.model && !local) out.model = m.model;
    // what makes it different, each one only when it is set
    if (m.instructions?.trim()) out.instructions = m.instructions.trim();
    if (m.skills) out.skills = m.skills;
    const extra = (m.extraSkills ?? []).filter((x) => x.name.trim() && x.text.trim());
    if (extra.length) out.extraSkills = extra;
    if (m.ownSkills?.length) out.ownSkills = m.ownSkills;
    if (m.temperament || m.note?.trim()) out.personality = { ...(m.temperament ? { temperament: m.temperament } : {}), ...(m.note?.trim() ? { note: m.note.trim() } : {}) };
    return out;
  });
  const draft: Record<string, unknown> = { name: w.name.trim(), description: w.description.trim(), purpose: w.purpose.trim(), skills: w.skills, budgetUsd: w.budgetUsd, members };
  if (w.ownSkills?.length) draft.ownSkills = w.ownSkills;
  if (w.lead >= 0 && w.lead < members.length) draft.techLead = w.lead;
  if (w.logoFile) draft.logoFile = w.logoFile;
  return draft;
}
