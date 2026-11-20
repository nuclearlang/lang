// @ts-nocheck
// The Environments page's script (page.ts inlines it by its source): the bar (project, active environment, filter,
// local, add), the grid of variables × environments with inline editing and keyboard navigation, and the notices.
// It only posts messages: the host runs `nuclear env` and sends the state again. Every value, name and message is set
// as text, never as HTML; the only markup inserted is the static icons.
/* eslint-disable */

export function envPage(api, H, ICON, RE) {
  const { t, vscode } = api;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text !== undefined) d.textContent = text;
    return d;
  };
  const icon = (name, cls) => {
    const s = el('span', 'ico' + (cls ? ' ' + cls : ''));
    s.innerHTML = ICON[name] || '';
    return s;
  };
  const button = (cls, iconName, label, title) => {
    const b = el('button', cls);
    b.type = 'button';
    if (iconName) b.appendChild(icon(iconName));
    if (label) b.appendChild(el('span', '', label));
    if (title) {
      b.title = title;
      b.setAttribute('aria-label', title);
    }
    return b;
  };
  const NAME_RE = new RegExp(RE.name);
  const ENV_RE = new RegExp(RE.env);

  let S = { projects: [], project: '', loading: true, local: false, busy: false, pendingEnvs: [], pendingVars: [] };
  let query = '';
  let missingOnly = false;
  let focus = { row: null, col: null }; // by name and environment, so a redraw keeps it
  let editing = null; // { row, col }
  let adding = null; // 'var' | 'env'

  const colName = (c) => (c === '' ? t('shared') : c);
  const fileOf = (c) => (c === '' ? '.env' : '.env.' + c) + (S.local ? '.local' : '');
  const sourceLabel = (s) => (s === 'keyring' ? t('source.keyring') : s === 'process' ? t('source.process') : s);
  const sourceKind = (s) => (s === 'keyring' ? 'keyring' : s === 'process' ? 'process' : s.endsWith('.local') ? 'local' : s === '.env' ? 'shared' : 'file');

  // ---------- the bar ----------

  function drawBar() {
    const sel = $('project');
    sel.textContent = '';
    for (const p of S.projects) {
      const o = el('option', '', p.name + (p.platform ? '  ·  ' + p.platform : ''));
      o.value = p.root;
      o.selected = p.root === S.project;
      sel.appendChild(o);
    }
    sel.disabled = S.projects.length < 2;
    const g = S.grid;
    const act = $('active');
    act.textContent = '';
    if (g) for (const c of g.columns.filter((c) => c !== '')) {
      const o = el('option', '', c);
      o.value = c;
      o.selected = c === g.active;
      act.appendChild(o);
    }
    act.disabled = !g || S.busy;
    $('activeBox').hidden = !g;
    $('localBtn').setAttribute('aria-pressed', String(!!S.local));
    $('localBtn').classList.toggle('on', !!S.local);
    for (const id of ['addVar', 'addEnv', 'localBtn', 'missingBtn', 'filter']) $(id).disabled = !g;
    $('missingBtn').setAttribute('aria-pressed', String(missingOnly));
    $('missingBtn').classList.toggle('on', missingOnly);
    $('refresh').disabled = !S.project || S.busy;
  }

  function drawSummary() {
    const g = S.grid;
    const box = $('summary');
    box.textContent = '';
    if (!g) return;
    box.appendChild(el('span', '', t('summary', g.rows.length, g.columns.length - 1)));
    const missing = g.rows.filter((r) => r.badges.includes('missing')).length;
    if (missing) {
      const m = el('span', 'miss');
      m.appendChild(icon('missing'));
      m.appendChild(el('span', '', t('summaryMissing', missing, g.active)));
      box.appendChild(m);
    }
    if (S.busy) box.appendChild(el('span', 'busy', t('saving')));
  }

  function drawNotice() {
    const box = $('notice');
    box.textContent = '';
    box.hidden = true;
    const f = S.failure || (S.error && { kind: 'error', detail: S.error }) || (S.note && { kind: 'note', detail: S.note });
    if (!f) return;
    box.hidden = false;
    box.className = 'notice ' + (f.kind === 'error' ? 'err' : 'warn');
    box.appendChild(icon(f.kind === 'error' ? 'missing' : 'update'));
    const text = el('div', 'text');
    if (f.kind === 'outdated') text.appendChild(el('b', '', t('outdated')));
    else if (f.kind === 'missing') text.appendChild(el('b', '', t('noCli')));
    else if (f.kind === 'note') text.appendChild(el('pre', '', f.detail));
    else {
      text.appendChild(el('b', '', t('error')));
      text.appendChild(el('pre', '', f.detail));
    }
    box.appendChild(text);
    if (f.kind === 'outdated' || f.kind === 'missing') {
      const b = button('primary', 'update', t('updateNow'));
      b.onclick = () => vscode.postMessage({ type: 'update' });
      box.appendChild(b);
    } else {
      const b = button('icon', null, '✕', t('dismiss'));
      b.onclick = () => vscode.postMessage({ type: 'dismiss' });
      box.appendChild(b);
    }
  }

  function drawAdd() {
    const box = $('adder');
    box.textContent = '';
    box.hidden = !adding;
    if (!adding) return;
    const label = adding === 'var' ? t('newVar') : t('newEnv');
    const input = el('input');
    input.placeholder = label;
    input.setAttribute('aria-label', label);
    input.spellcheck = false;
    const err = el('span', 'bad-text');
    err.setAttribute('role', 'alert');
    const ok = button('primary', 'plus', t('add'));
    const no = button('', null, t('cancel'));
    const submit = () => {
      const v = input.value.trim();
      const good = adding === 'var' ? NAME_RE.test(v) : ENV_RE.test(v);
      if (!good) {
        input.classList.add('bad');
        err.textContent = adding === 'var' ? t('badName') : t('badEnv');
        return;
      }
      vscode.postMessage({ type: adding === 'var' ? 'addVar' : 'addEnv', name: v });
      if (adding === 'var') focus = { row: v, col: S.grid ? S.grid.active : '' };
      else focus = { row: focus.row, col: v };
      adding = null;
      drawAdd();
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') ((adding = null), drawAdd());
    };
    ok.onclick = submit;
    no.onclick = () => ((adding = null), drawAdd());
    box.append(icon(adding === 'var' ? 'plus' : 'env'), input, ok, no, err);
    input.focus();
  }

  // ---------- the grid ----------

  function badge(kind) {
    const b = el('span', 'badge b-' + kind);
    b.title = t('badgeTitle.' + kind);
    b.appendChild(icon(kind));
    b.appendChild(el('span', '', t('badge.' + kind)));
    return b;
  }

  function headCell(c, g) {
    const th = el('th', 'col' + (c === g.active ? ' active' : '') + (c === '' ? ' shared' : ''));
    th.scope = 'col';
    const top = el('div', 'colhead');
    top.appendChild(icon(c === '' ? 'shared' : c === g.active ? 'active' : 'env'));
    const name = el('span', 'cname', colName(c));
    if (c === '') name.title = t('sharedTitle');
    top.appendChild(name);
    if (c === g.active) top.appendChild(el('span', 'tag', t('active')));
    const open = button('icon', 'open', null, t('openFile', fileOf(c)));
    open.onclick = () => vscode.postMessage({ type: 'openFile', env: c });
    top.appendChild(open);
    th.appendChild(top);
    const file = el('div', 'file', fileOf(c));
    if (c !== '' && S.pendingEnvs.includes(c)) file.textContent = t('pendingEnv', fileOf(c));
    th.appendChild(file);
    return th;
  }

  function nameCell(r, ri) {
    const th = el('th', 'name');
    th.scope = 'row';
    th.tabIndex = -1;
    th.dataset.r = ri;
    th.dataset.c = 0;
    const top = el('div', 'vname');
    top.appendChild(el('code', '', r.name));
    for (const b of r.badges) top.appendChild(badge(b));
    th.appendChild(top);
    const uses = el('div', 'uses');
    if (S.pendingVars.includes(r.name) && !r.uses.length) uses.appendChild(el('span', 'dim', t('pendingVar')));
    else if (!r.uses.length) uses.appendChild(el('span', 'dim', t('noUses')));
    else {
      uses.appendChild(icon('use', 'dim'));
      for (const u of r.uses) {
        const a = button('link use', null, u.file + ':' + u.line, t('uses') + ' ' + u.file + ':' + u.line);
        a.tabIndex = -1;
        a.onclick = (e) => (e.stopPropagation(), vscode.postMessage({ type: 'openUse', file: u.file, line: u.line }));
        uses.appendChild(a);
      }
    }
    th.appendChild(uses);
    return th;
  }

  function valueCell(r, ri, cell, ci) {
    const td = el('td', 'cell' + (cell.missing ? ' missing' : '') + (cell.env === S.grid.active ? ' active' : ''));
    td.tabIndex = -1;
    td.dataset.r = ri;
    td.dataset.c = ci;
    td.setAttribute('role', 'gridcell');
    const shown = cell.secret ? t('hidden') : cell.value !== undefined ? cell.value : cell.missing ? t('missingCell') : cell.placeholder !== undefined ? t('defaultIs', cell.placeholder) : t('noValue');
    td.setAttribute('aria-label', t('cellLabel', r.name, colName(cell.env), shown + (cell.source ? ' (' + sourceLabel(cell.source) + ')' : '')));
    if (editing && editing.row === r.name && editing.col === cell.env) return editor(td, r, cell);
    const line = el('div', 'val');
    if (cell.secret) {
      line.appendChild(icon('secret', 'sec'));
      line.appendChild(el('span', 'v mask', t('hidden')));
    } else if (cell.value !== undefined) line.appendChild(el('span', 'v', cell.value === '' ? '""' : cell.value));
    else if (cell.missing) {
      line.appendChild(icon('missing', 'miss'));
      line.appendChild(el('span', 'ph miss', t('missingCell')));
    } else line.appendChild(el('span', 'ph', cell.placeholder !== undefined ? t('defaultIs', cell.placeholder) : '—'));
    td.appendChild(line);
    if (cell.source) {
      const src = el('span', 'src s-' + sourceKind(cell.source), sourceLabel(cell.source));
      src.title = t('source.title', sourceLabel(cell.source));
      if (sourceKind(cell.source) === 'keyring') src.prepend(icon('secret'));
      const meta = el('div', 'meta');
      meta.appendChild(src);
      const del = button('icon del', 'trash', null, cell.source === 'process' ? t('unsetProcess') : t('unset'));
      del.tabIndex = -1;
      del.disabled = cell.source === 'process' || S.busy;
      del.onclick = (e) => (e.stopPropagation(), unset(r, cell));
      meta.appendChild(del);
      td.appendChild(meta);
    }
    td.ondblclick = () => edit(r.name, cell.env);
    return td;
  }

  function editor(td, r, cell) {
    td.classList.add('editing');
    const secretRow = r.badges.includes('secret');
    let secret = editing.secret !== undefined ? editing.secret : cell.secret || secretRow;
    const input = el('input');
    input.type = secret ? 'password' : 'text';
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.value = editing.draft !== undefined ? editing.draft : secret ? '' : cell.value !== undefined ? cell.value : '';
    input.oninput = () => (editing.draft = input.value);
    input.placeholder = cell.placeholder !== undefined ? t('defaultIs', cell.placeholder) : '';
    input.setAttribute('aria-label', t('cellLabel', r.name, colName(cell.env), t('editHint')));
    const lock = el('label', 'lock');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = secret;
    box.onchange = () => {
      secret = box.checked;
      editing.secret = secret;
      input.type = secret ? 'password' : 'text';
      input.focus();
    };
    lock.append(box, icon('secret'), el('span', '', t('secretField')));
    const hint = el('div', 'hint', t('editHint'));
    const done = (save) => {
      if (save) vscode.postMessage({ type: 'set', name: r.name, env: cell.env, value: input.value, secret });
      editing = null;
      focus = { row: r.name, col: cell.env };
      render();
      focusCell();
    };
    input.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') (e.preventDefault(), done(true));
      if (e.key === 'Escape') (e.preventDefault(), done(false));
    };
    box.onkeydown = input.onkeydown;
    td.append(input, lock, hint);
    setTimeout(() => (input.focus(), input.select()), 0);
    return td;
  }

  function unset(r, cell) {
    if (!cell.source || cell.source === 'process') return;
    vscode.postMessage({ type: 'unset', name: r.name, env: cell.env, source: cell.source });
  }

  function edit(row, col) {
    if (S.busy) return;
    editing = { row, col };
    focus = { row, col };
    render();
  }

  function render() {
    drawBar();
    drawSummary();
    drawNotice();
    const wrap = $('gridWrap');
    const g = S.grid;
    $('loading').hidden = !S.loading || !!g;
    $('noProjects').hidden = S.projects.length > 0;
    $('keys').hidden = !g;
    if (!g) return ((wrap.textContent = ''), undefined);
    const rows = H.filterRows(g.rows, query, missingOnly);
    const table = el('table', 'grid');
    table.setAttribute('role', 'grid');
    table.setAttribute('aria-label', t('grid'));
    table.setAttribute('aria-rowcount', String(rows.length + 1));
    const head = el('thead');
    const hr = el('tr');
    const corner = el('th', 'corner', t('variable'));
    corner.scope = 'col';
    hr.appendChild(corner);
    for (const c of g.columns) hr.appendChild(headCell(c, g));
    head.appendChild(hr);
    table.appendChild(head);
    const body = el('tbody');
    rows.forEach((r, ri) => {
      const tr = el('tr', r.badges.includes('missing') ? 'row-missing' : r.badges.includes('unused') ? 'row-unused' : '');
      tr.appendChild(nameCell(r, ri));
      r.cells.forEach((cell, ci) => tr.appendChild(valueCell(r, ri, cell, ci + 1)));
      body.appendChild(tr);
    });
    table.appendChild(body);
    wrap.textContent = '';
    wrap.appendChild(table);
    if (!rows.length) wrap.appendChild(el('div', 'empty', g.rows.length ? t('noMatch') : t('noVariables')));
    wrap.__rows = rows;
    // the roving tab stop: the focused cell, else the first one
    const target = cellOf(focus) || wrap.querySelector('[data-r="0"][data-c="1"]');
    if (target) target.tabIndex = 0;
  }

  function cellOf(f) {
    const rows = $('gridWrap').__rows || [];
    const ri = rows.findIndex((r) => r.name === f.row);
    if (ri < 0 || !S.grid) return null;
    const ci = f.col === '#name' ? 0 : S.grid.columns.indexOf(f.col) + 1;
    return $('gridWrap').querySelector('[data-r="' + ri + '"][data-c="' + Math.max(0, ci) + '"]');
  }
  function focusCell() {
    const c = cellOf(focus);
    if (c) (c.tabIndex = 0), c.focus();
  }
  function moveTo(ri, ci) {
    const rows = $('gridWrap').__rows || [];
    if (!rows.length || !S.grid) return;
    ri = Math.max(0, Math.min(rows.length - 1, ri));
    ci = Math.max(0, Math.min(S.grid.columns.length, ci));
    for (const x of $('gridWrap').querySelectorAll('[tabindex="0"]')) x.tabIndex = -1;
    focus = { row: rows[ri].name, col: ci === 0 ? '#name' : S.grid.columns[ci - 1] };
    focusCell();
  }

  $('gridWrap').addEventListener('keydown', (e) => {
    const cell = e.target.closest && e.target.closest('[data-r]');
    if (!cell || editing) return;
    const ri = +cell.dataset.r, ci = +cell.dataset.c;
    const rows = $('gridWrap').__rows;
    const r = rows[ri];
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[e.key]) return (e.preventDefault(), moveTo(ri + moves[e.key][0], ci + moves[e.key][1]));
    if (e.key === 'Home') return (e.preventDefault(), moveTo(e.ctrlKey ? 0 : ri, 0));
    if (e.key === 'End') return (e.preventDefault(), moveTo(e.ctrlKey ? rows.length - 1 : ri, S.grid.columns.length));
    if (ci === 0) {
      if ((e.key === 'Enter' || e.key === ' ') && r.uses.length) (e.preventDefault(), vscode.postMessage({ type: 'openUse', file: r.uses[0].file, line: r.uses[0].line }));
      return;
    }
    const c = r.cells[ci - 1];
    if (e.key === 'Enter' || e.key === 'F2') return (e.preventDefault(), edit(r.name, c.env));
    if (e.key === 'Delete' || e.key === 'Backspace') return (e.preventDefault(), unset(r, c));
  });
  $('gridWrap').addEventListener('focusin', (e) => {
    const cell = e.target.closest && e.target.closest('[data-r]');
    if (!cell || !S.grid) return;
    const r = $('gridWrap').__rows[+cell.dataset.r];
    if (r) focus = { row: r.name, col: +cell.dataset.c === 0 ? '#name' : S.grid.columns[+cell.dataset.c - 1] };
  });
  $('gridWrap').addEventListener('click', (e) => {
    const cell = e.target.closest && e.target.closest('[data-r]');
    if (cell && !editing) {
      for (const x of $('gridWrap').querySelectorAll('[tabindex="0"]')) x.tabIndex = -1;
      cell.tabIndex = 0;
      cell.focus();
    }
  });

  // ---------- the bar's controls ----------

  $('project').onchange = (e) => vscode.postMessage({ type: 'project', root: e.target.value });
  $('active').onchange = (e) => vscode.postMessage({ type: 'use', env: e.target.value });
  $('filter').oninput = (e) => ((query = e.target.value), render());
  $('missingBtn').onclick = () => ((missingOnly = !missingOnly), render());
  $('localBtn').onclick = () => vscode.postMessage({ type: 'local', on: !S.local });
  $('addVar').onclick = () => ((adding = 'var'), drawAdd());
  $('addEnv').onclick = () => ((adding = 'env'), drawAdd());
  $('refresh').onclick = () => vscode.postMessage({ type: 'refresh' });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') (e.preventDefault(), $('filter').focus());
  });

  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || m.type !== 'state') return;
    const hadFocus = $('gridWrap').contains(document.activeElement);
    S = m.state;
    if (editing && S.busy) editing = null;
    render();
    if (hadFocus) focusCell();
  });
  render();
  vscode.postMessage({ type: 'ready' });
}
