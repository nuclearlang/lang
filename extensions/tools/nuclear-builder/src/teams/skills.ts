// What the skills' screens compute (page.ts, spec 011 requirement 34), the same in the tests: a skill's markdown drawn
// as HTML (the preview and the editor's live preview), a SKILL.md from the editor's fields and back, the library
// grouped by kind and searched, and what a member gets with where each skill comes from (library.nuc `sharedSkills`:
// the member's own wins over the team's, the team's over the library's). Inlined in the page's script by
// `toString()`: no import, each function uses nothing outside itself.

/** A skill's file as safe HTML: its front matter dropped, headings, lists (a `- [ ]` as a box), fenced code, inline
 * code, bold and italics, links as their text; everything else escaped. */
export function mdHtml(md: string): string {
  const e = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const inline = (x: string) => e(x)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '<u>$1</u>');
  let text = String(md ?? '').replace(/\r\n/g, '\n');
  if (text.startsWith('---\n')) { const end = text.indexOf('\n---', 4); if (end >= 0) text = text.slice(text.indexOf('\n', end + 1) + 1); }
  const out: string[] = [];
  // the open lists, outermost first (each its kind and indent), and the item being read (its lines join before drawing)
  const lists: { kind: string; indent: number }[] = [];
  let item: string | null = null, para: string[] = [], code: string[] | null = null;
  const drawItem = () => {
    if (item === null) return;
    const box = item.match(/^\[([ xX])\]\s+([\s\S]*)$/);
    out.push(box ? '<li class="task"><span class="box">' + (box[1] === ' ' ? '☐' : '☑') + '</span> ' + inline(box[2]) : '<li>' + inline(item));
    item = null;
  };
  const closeTo = (depth: number) => { drawItem(); while (lists.length > depth) { out.push('</li></' + lists.pop()!.kind + '>'); } };
  const flush = () => { if (para.length) out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; };
  for (const line of text.split('\n')) {
    if (code) { if (/^\s*```/.test(line)) { out.push('<pre><code>' + e(code.join('\n')) + '</code></pre>'); code = null; } else code.push(line.replace(/^ {0,3}/, '')); continue; }
    if (/^\s*```/.test(line)) { flush(); closeTo(0); code = []; continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flush(); closeTo(0); out.push('<h' + (h[1].length + 1) + '>' + inline(h[2]) + '</h' + (h[1].length + 1) + '>'); continue; }
    const li = line.match(/^(\s*)(?:[-*]|\d+\.)\s+(.*)$/);
    if (li) {
      flush();
      const indent = li[1].length, kind = /^\s*\d+\./.test(line) ? 'ol' : 'ul';
      while (lists.length && indent < lists[lists.length - 1].indent) closeTo(lists.length - 1);
      const top = lists[lists.length - 1];
      if (!top || indent > top.indent) { drawItem(); out.push('<' + kind + '>'); lists.push({ kind, indent }); }
      else { drawItem(); out.push('</li>'); if (top.kind !== kind) { out.pop(); closeTo(lists.length - 1); out.push('<' + kind + '>'); lists.push({ kind, indent }); } }
      item = li[2];
      continue;
    }
    if (!line.trim()) { flush(); if (item !== null || lists.length) { drawItem(); } continue; }
    // a line indented under a list item goes on with it
    if (lists.length && /^\s{2,}/.test(line)) { if (item !== null) item += ' ' + line.trim(); else out.push(' ' + inline(line.trim())); continue; }
    closeTo(0); para.push(line.trim());
  }
  if (code) out.push('<pre><code>' + e(code.join('\n')) + '</code></pre>');
  flush(); closeTo(0);
  return out.join('');
}

/** A skill's id from its name: lowercase letters, digits and dashes (library.nuc `skillSlug`). */
export function skillSlug(text: string): string {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 64).replace(/^-+|-+$/g, '');
}

/** The editor's fields: an own skill (`name` its title, `text` its markdown body). */
export interface SkillFields { id: string; name: string; description: string; text: string; title_es?: string; description_es?: string; kind?: string; tags?: string[]; from?: string }

/** An own skill as its SKILL.md (library.nuc `ownSkillMarkdown`): what `skills create` and `skills update` read. */
export function skillMarkdown(s: SkillFields): string {
  const one = (x: unknown) => String(x ?? '').replace(/\s*\n\s*/g, ' ').trim();
  const lines = ['---', 'name: ' + (s.id || skillSlug(s.name)), 'description: ' + one(s.description), 'title: ' + one(s.name)];
  if (s.title_es?.trim()) lines.push('title_es: ' + one(s.title_es));
  if (s.description_es?.trim()) lines.push('description_es: ' + one(s.description_es));
  if (s.kind) lines.push('kind: ' + s.kind);
  if (s.tags?.length) lines.push('tags: [' + s.tags.map(one).filter(Boolean).join(', ') + ']');
  if (s.from) lines.push('from: ' + s.from);
  return lines.join('\n') + '\n---\n\n' + String(s.text ?? '').trim() + '\n';
}

/** A SKILL.md (the library's file, a clone's start) as the editor's fields. */
export function skillFields(md: string): SkillFields {
  const text = String(md ?? '').replace(/\r\n/g, '\n');
  const head: Record<string, string> = {};
  let body = text;
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---', 4);
    if (end >= 0) {
      for (const line of text.slice(4, end).split('\n')) { const at = line.indexOf(':'); if (at > 0 && !line.startsWith(' ')) head[line.slice(0, at).trim()] = line.slice(at + 1).trim(); }
      body = text.slice(text.indexOf('\n', end + 1) + 1);
    }
  }
  const tags = (head.tags ?? '').replace(/^\[|\]$/g, '').split(',').map((x) => x.trim()).filter(Boolean);
  return { id: head.name ?? '', name: head.title || (head.name ?? '').replace(/-/g, ' '), description: head.description ?? '', text: body.trim(), title_es: head.title_es ?? '', description_es: head.description_es ?? '', kind: head.kind ?? '', tags, from: head.from || undefined };
}

/** The library by kind (domains, technologies, practices, then any other), each one whose id, title, description or
 * tags hold every word of `q`; never Nuclear's base skills (`base`: every member has them, nobody chooses them). */
export function libraryGroups<S extends { id: string; title: string; description?: string; kind?: string; tags?: string[]; base?: boolean }>(library: S[], q: string): { kind: string; skills: S[] }[] {
  const words = String(q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (s: S) => { if (s.base) return false; const t = [s.id, s.title, s.description ?? '', ...(s.tags ?? [])].join(' ').toLowerCase(); return words.every((w) => t.includes(w)); };
  const kinds = ['domain', 'technology', 'practice'];
  for (const s of library ?? []) if (s.kind && !kinds.includes(s.kind)) kinds.push(s.kind);
  return kinds.map((kind) => ({ kind, skills: (library ?? []).filter((s) => (s.kind || 'practice') === kind && hit(s)) })).filter((g) => g.skills.length);
}

/** A skill as a member's Skills tab lists it: where it comes from (`member`: its own; `team`: the team's own;
 * `library`: attached by the member, the team or its base agent, `via`), whether it is inherited from the team, and what
 * it overrides. */
export interface SkillRow { id: string; title: string; description: string; from: 'member' | 'team' | 'library'; via: 'member' | 'team' | 'agent' | 'base'; inherited: boolean; overrides: string[] }

/** What a member gets beside its role's skills, the member's own first, then its library skills, then what it
 * inherits: the team's, then Nuclear's base skills (library.nuc `sharedSkills`, ordered for the screen). `roleNames`:
 * its role's skills (not these). */
export function memberSkills(
  team: { skills?: string[]; ownSkills?: { id: string; name: string; description?: string }[] },
  member: { skills?: string[]; ownSkills?: { id: string; name: string; description?: string }[]; agent?: string },
  library: { id: string; title: string; description?: string; base?: boolean }[],
  agents: { id: string; skills?: string[] }[],
  roleNames: string[],
): SkillRow[] {
  const lib = (id: string) => (library ?? []).find((s) => s.id === id);
  const teamOwn = (id: string) => (team.ownSkills ?? []).find((s) => s.id === id);
  const rows: SkillRow[] = [];
  const seen = new Set<string>();
  const push = (r: SkillRow) => { if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); } };
  for (const s of member.ownSkills ?? []) push({ id: s.id, title: s.name, description: s.description ?? '', from: 'member', via: 'member', inherited: false, overrides: [teamOwn(s.id) ? 'team' : '', lib(s.id) ? 'library' : ''].filter(Boolean) });
  const fromLib = (id: string, via: SkillRow['via']) => {
    const own = teamOwn(id);
    if (own) return push({ id, title: own.name, description: own.description ?? '', from: 'team', via, inherited: via === 'team', overrides: lib(id) ? ['library'] : [] });
    const l = lib(id);
    // a base skill a team or member of before 0.87 lists is shown once, as the base's (the last loop)
    if (l?.base && via !== 'base') return;
    if (l) push({ id, title: l.title, description: l.description ?? '', from: 'library', via, inherited: via === 'team' || via === 'base', overrides: [] });
  };
  for (const id of member.skills ?? []) if (!roleNames.includes(id)) fromLib(id, 'member');
  for (const id of (agents ?? []).find((a) => a.id === member.agent)?.skills ?? []) fromLib(id, 'agent');
  for (const id of team.skills ?? []) fromLib(id, 'team');
  for (const s of team.ownSkills ?? []) fromLib(s.id, 'team');
  for (const s of library ?? []) if (s.base) fromLib(s.id, 'base');
  return rows;
}
