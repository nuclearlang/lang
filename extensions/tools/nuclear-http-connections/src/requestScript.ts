// @ts-nocheck
// The request page's script (panel.ts inlines it by its source, with its arguments): the inner tabs, the
// request (params, header rows, body editor, auth, post-response rules), the response (status, JSON tree, highlighted
// source, HTML preview, headers), the variables drawer and the notices. It runs in the webview: it reads and posts
// messages, and never writes a file nor sends a request itself. Untrusted text (a response, a header) is only ever
// set as text, never as HTML; the only markup inserted is the static icons.
/* eslint-disable */

export function requestPage(api, H, ICON) {
  const { t, vscode } = api;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text !== undefined) d.textContent = text;
    return d;
  };
  const icon = (name, cls) => {
    const s = document.createElement('span');
    s.className = 'ico' + (cls ? ' ' + cls : '');
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
  const VERBS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  const SCOPES = ['global', 'project', 'component'];
  const BIG = 300000;

  let envs = { active: 'local', names: [], vars: {}, origins: {}, baseUrls: {}, scopes: { global: { vars: {}, headers: {}, secrets: [] }, project: null, component: null }, project: '', component: '' };
  // state: { tabs: [{ endpoint, form, response }], active, layout, split }
  let tabs = [];
  let active = -1;
  let layout = 'auto';
  let split = 0.5;
  let saveTimer;
  let drawerScope = 'component';
  let pending = {};
  const expanded = new Map();
  const revealed = new Set();
  const keyOf = (e) => e.verb + ' ' + e.path + ' ' + e.owner;
  const tab = () => tabs[active];

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => vscode.postMessage({ type: 'state', state: { tabs, active, layout, split } }), 150);
  }

  // ---------- the form ----------

  function baseOf(e) {
    return envs.baseUrls[e.connection || ''] || envs.baseUrls[e.project] || '{{baseUrl}}';
  }
  function sample(ty) {
    ty = ty.replace(/\?$/, '');
    return ty === 'int' || ty === 'number' || ty === 'double' || ty === 'integer' ? '1' : ty === 'boolean' || ty === 'bool' ? 'true' : '';
  }
  function newForm(e) {
    const path = {};
    const query = {};
    for (const p of e.params) if (p.in === 'path') path[p.name] = sample(p.type);
    else if (p.in === 'query') query[p.name] = p.default !== undefined ? String(p.default) : '';
    return H.migrateForm({ method: e.verb.toUpperCase(), url: '', path, query, headers: [], body: e.body !== undefined ? JSON.stringify(e.body, null, 2) : '', pane: e.body !== undefined ? 'body' : 'params', view: 'pretty' });
  }
  function scopeHeaders() {
    return SCOPES.filter((s) => envs.scopes[s]).map((s) => [s, envs.scopes[s].headers]);
  }
  /** The auto rows again (guards, body, environment): the tab's rows merged with them. */
  function refreshHeaders(render) {
    const tb = tab();
    if (!tb) return;
    const before = JSON.stringify(tb.form.headers);
    tb.form.headers = H.mergeHeaderRows(tb.form.headers, H.defaultHeaders(tb.endpoint.guardHeaders || [], scopeHeaders(), tb.form.body), tb.form.removed);
    if (render !== false && before !== JSON.stringify(tb.form.headers)) renderHeaders();
    counts();
  }
  function buildUrl() {
    const tb = tab();
    if (!tb) return;
    let p = tb.endpoint.path;
    for (const [k, v] of Object.entries(tb.form.path)) p = p.replace('{' + k + '}', /^\{\{.*\}\}$/.test(v) ? v : encodeURIComponent(v));
    const q = [];
    for (const [k, v] of Object.entries(tb.form.query)) if (v !== '') q.push(encodeURIComponent(k) + '=' + (/^\{\{.*\}\}$/.test(v) ? v : encodeURIComponent(v)));
    tb.form.url = baseOf(tb.endpoint).replace(/\/$/, '') + p + (q.length ? '?' + q.join('&') : '');
    $('url').value = tb.form.url;
    urlPreview();
  }
  function resolve(s) {
    return String(s || '').replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}/g, (all, n) => (envs.vars[n] !== undefined ? envs.vars[n] : all));
  }
  function urlPreview() {
    const box = $('urlPreview');
    box.textContent = '';
    const url = $('url').value;
    if (!/\{\{/.test(url)) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.appendChild(el('span', 'arrow', '→ '));
    let last = 0;
    for (const m of url.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}/g)) {
      box.appendChild(document.createTextNode(url.slice(last, m.index)));
      const known = envs.vars[m[1]] !== undefined;
      const secret = known && isSecret(m[1]);
      const s = el('span', known ? 'var ok' : 'var missing', known ? (secret ? '••••' : envs.vars[m[1]]) : m[0]);
      s.title = known ? t('fromScope', '{{' + m[1] + '}}', t('scope.' + (envs.origins[m[1]] || 'global'))) : t('unknownVar', m[1]);
      box.appendChild(s);
      last = m.index + m[0].length;
    }
    box.appendChild(document.createTextNode(url.slice(last)));
  }
  function isSecret(name) {
    const o = envs.origins[name];
    return !!(o && envs.scopes[o] && envs.scopes[o].secrets.includes(name));
  }

  // ---------- inner tabs ----------

  function renderTabs() {
    const bar = $('tabsBar');
    bar.textContent = '';
    tabs.forEach((tb, i) => {
      const d = el('div', 't' + (i === active ? ' on' : ''));
      d.setAttribute('role', 'tab');
      d.setAttribute('aria-selected', String(i === active));
      d.tabIndex = i === active ? 0 : -1;
      d.appendChild(el('span', 'verb ' + tb.endpoint.verb.toLowerCase(), tb.endpoint.verb.toUpperCase()));
      d.appendChild(el('span', 'tpath', tb.endpoint.path));
      if (tb.sending) d.appendChild(el('span', 'spin'));
      const x = button('x', 'close', '', t('close'));
      x.tabIndex = -1;
      x.addEventListener('click', (ev) => {
        ev.stopPropagation();
        close(i);
      });
      d.appendChild(x);
      d.title = tb.endpoint.owner || tb.endpoint.path;
      d.addEventListener('click', () => show(i));
      d.addEventListener('keydown', (ev) => {
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
          const n = (i + (ev.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          show(n);
          bar.children[n]?.focus();
        }
        if (ev.key === 'Delete') close(i);
      });
      bar.appendChild(d);
    });
  }
  function close(i) {
    if (tabs[i]?.sending) vscode.postMessage({ type: 'cancel', tab: keyOf(tabs[i].endpoint) });
    tabs.splice(i, 1);
    const next = tabs.length ? Math.min(active >= i ? Math.max(active - 1, 0) : active, tabs.length - 1) : -1;
    active = -1;
    show(next);
  }
  function open(e) {
    const i = tabs.findIndex((x) => keyOf(x.endpoint) === keyOf(e));
    if (i >= 0) return show(i);
    tabs.push({ endpoint: e, form: newForm(e), response: null });
    show(tabs.length - 1);
  }
  function show(i) {
    active = i;
    const tb = tab();
    $('empty').hidden = !!tb;
    $('work').hidden = !tb;
    renderTabs();
    if (!tb) return save();
    const e = tb.endpoint;
    const f = tb.form;
    crumbs(e);
    $('desc').textContent = [e.description, e.owner, e.returns ? t('returns', e.returns) : ''].filter(Boolean).join(' · ');
    $('method').value = VERBS.includes(f.method) ? f.method : 'GET';
    methodColor();
    renderParams();
    refreshHeaders(false);
    renderHeaders();
    $('body').value = f.body;
    $('bodyMode').value = f.bodyMode || 'json';
    bodyChanged(false);
    renderAuth();
    renderRules();
    if (f.url) {
      $('url').value = f.url;
      urlPreview();
    } else buildUrl();
    showPane(f.pane || 'params');
    sending(!!tb.sending);
    renderResponse();
    counts();
    save();
  }
  function crumbs(e) {
    const c = $('crumbs');
    c.textContent = '';
    const part = (iconName, text, cls) => {
      const s = el('span', 'crumb ' + cls);
      s.appendChild(icon(iconName));
      s.appendChild(el('span', '', text));
      return s;
    };
    const project = e.kind === 'openapi' ? 'OpenAPI' : e.project.split('/').pop();
    c.append(part('project', project, 'c-project'), el('span', 'sep', '›'), part('component', e.component, 'c-component'), el('span', 'sep', '›'));
    const last = el('span', 'crumb c-endpoint');
    last.append(el('span', 'verb ' + e.verb.toLowerCase(), e.verb.toUpperCase()), el('span', '', e.path));
    last.setAttribute('aria-current', 'page');
    c.appendChild(last);
  }
  function methodColor() {
    $('method').className = 'method verb ' + $('method').value.toLowerCase();
  }

  // ---------- request panes ----------

  function showPane(name) {
    document.querySelectorAll('#reqTabs [data-pane]').forEach((s) => {
      s.classList.toggle('on', s.dataset.pane === name);
      s.setAttribute('aria-selected', String(s.dataset.pane === name));
      s.tabIndex = s.dataset.pane === name ? 0 : -1;
    });
    document.querySelectorAll('.rpane').forEach((p) => (p.hidden = p.id !== 'p-' + name));
    if (tab()) tab().form.pane = name;
  }
  function counts() {
    const tb = tab();
    if (!tb) return;
    const f = tb.form;
    const set = (pane, n) => {
      const c = document.querySelector('#reqTabs [data-pane="' + pane + '"] .count');
      c.textContent = n ? String(n) : '';
      c.hidden = !n;
    };
    set('params', Object.values(f.path).filter((v) => v !== '').length + Object.values(f.query).filter((v) => v !== '').length);
    set('headers', f.headers.filter((r) => r.on && r.name.trim()).length);
    set('rules', f.rules.filter((r) => r.on && r.name.trim()).length);
    const b = document.querySelector('#reqTabs [data-pane="body"] .count');
    b.textContent = f.body.trim() ? '●' : '';
    b.hidden = !f.body.trim();
    const a = document.querySelector('#reqTabs [data-pane="auth"] .count');
    a.textContent = f.auth.type === 'inherit' || f.auth.type === 'none' ? '' : t('auth.' + f.auth.type + '.short');
    a.hidden = !a.textContent;
  }
  function paramRows(table, params, values, kind) {
    table.textContent = '';
    if (!params.length) {
      const tr = el('tr');
      const td = el('td', 'none', t('none'));
      td.colSpan = 2;
      tr.appendChild(td);
      table.appendChild(tr);
      return;
    }
    for (const p of params) {
      const tr = el('tr');
      const td = el('td', 'pname');
      td.append(el('span', 'k', p.name + (p.optional ? '?' : '')), el('span', 'ptype', p.type));
      const td2 = el('td');
      const i = el('input');
      i.value = values[p.name] ?? '';
      i.placeholder = p.type;
      i.spellcheck = false;
      i.setAttribute('aria-label', kind + ' ' + p.name);
      i.addEventListener('input', () => {
        values[p.name] = i.value;
        buildUrl();
        counts();
        save();
      });
      td2.appendChild(i);
      tr.append(td, td2);
      table.appendChild(tr);
    }
  }
  function renderParams() {
    const tb = tab();
    paramRows($('pathParams'), tb.endpoint.params.filter((p) => p.in === 'path'), tb.form.path, 'Path');
    paramRows($('queryParams'), tb.endpoint.params.filter((p) => p.in === 'query'), tb.form.query, 'Query');
  }
  const SOURCE_ICON = { code: 'code', body: 'body', global: 'global', project: 'project', component: 'component' };
  function renderHeaders() {
    const tb = tab();
    const table = $('headers');
    table.textContent = '';
    const head = el('tr', 'th');
    head.append(el('th', 'chk', ''), el('th', '', t('name')), el('th', '', t('value')), el('th', '', ''));
    table.appendChild(head);
    tb.form.headers.forEach((r, idx) => {
      const tr = el('tr', r.on ? '' : 'off');
      const c = el('td', 'chk');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = r.on;
      box.setAttribute('aria-label', t('enabled') + ' ' + r.name);
      box.addEventListener('change', () => {
        r.on = box.checked;
        tr.classList.toggle('off', !r.on);
        counts();
        save();
      });
      c.appendChild(box);
      const n = el('td');
      const ni = el('input', 'k');
      ni.value = r.name;
      ni.placeholder = t('name');
      ni.spellcheck = false;
      ni.setAttribute('aria-label', t('name'));
      const v = el('td');
      const wrap = el('div', 'cellwrap');
      const vi = el('input', 's');
      vi.value = r.value;
      vi.placeholder = t('value');
      vi.spellcheck = false;
      vi.setAttribute('aria-label', t('value') + ' ' + r.name);
      const edit = () => {
        r.name = ni.value;
        r.value = vi.value;
        if (r.source) r.edited = true;
        counts();
        save();
      };
      ni.addEventListener('input', edit);
      vi.addEventListener('input', edit);
      n.appendChild(ni);
      wrap.appendChild(vi);
      if (r.source) {
        const badge = el('span', 'src src-' + r.source);
        badge.appendChild(icon(SOURCE_ICON[r.source] || 'code'));
        badge.appendChild(el('span', '', t('from.' + r.source)));
        badge.title = r.edited ? t('fromEdited', t('from.' + r.source)) : t('from.' + r.source);
        if (r.edited) badge.classList.add('edited');
        wrap.appendChild(badge);
      }
      v.appendChild(wrap);
      const d = el('td', 'act');
      const del = button('icon', 'trash', '', t('delete'));
      del.addEventListener('click', () => {
        if (r.source) tb.form.removed.push(r.source + ':' + r.name.toLowerCase());
        tb.form.headers.splice(idx, 1);
        renderHeaders();
        counts();
        save();
      });
      d.appendChild(del);
      tr.append(c, n, v, d);
      table.appendChild(tr);
    });
    $('restoreHeaders').hidden = !tb.form.removed.length && !tb.form.headers.some((r) => r.source && r.edited);
  }

  // the body: a textarea over its own highlighted copy
  function paint(target, tokens) {
    target.textContent = '';
    const frag = document.createDocumentFragment();
    for (const [cls, text] of tokens) {
      if (!cls) frag.appendChild(document.createTextNode(text));
      else frag.appendChild(el('span', 'tk-' + cls, text));
    }
    target.appendChild(frag);
  }
  function bodyChanged(fromUser) {
    const tb = tab();
    const text = $('body').value;
    const mode = $('bodyMode').value;
    if (tb) {
      tb.form.body = text;
      tb.form.bodyMode = mode;
    }
    const hl = $('bodyHl');
    const big = text.length > BIG;
    $('bodyEdit').classList.toggle('plain', big);
    if (big) hl.textContent = '';
    else paint(hl, mode === 'json' ? H.tokenizeJson(text + '\n') : [['', text + '\n']]);
    syncScroll();
    const p = mode === 'json' ? H.jsonProblem(text) : undefined;
    const box = $('bodyProblem');
    box.textContent = '';
    box.hidden = !p;
    $('bodyEdit').classList.toggle('bad', !!p);
    if (p) {
      const a = button('link', '', t('jsonAt', p.line, p.col), t('jsonGo'));
      a.addEventListener('click', () => goTo(p.line, p.col));
      box.append(el('span', 'bad-dot'), a, el('span', '', ' ' + p.message));
    }
    $('format').disabled = mode !== 'json' || !text.trim() || !!p;
    if (fromUser !== false) {
      refreshHeaders();
      save();
    }
  }
  function goTo(line, col) {
    const lines = $('body').value.split('\n');
    let at = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) at += lines[i].length + 1;
    at += col - 1;
    $('body').focus();
    $('body').setSelectionRange(at, at + 1);
  }
  function syncScroll() {
    $('bodyHl').scrollTop = $('body').scrollTop;
    $('bodyHl').scrollLeft = $('body').scrollLeft;
  }
  function formatBody() {
    const out = H.formatJson($('body').value);
    if (out === undefined) return;
    $('body').value = out;
    bodyChanged();
  }

  // auth
  const AUTH = ['inherit', 'none', 'bearer', 'basic', 'apikey', 'oauth2'];
  function field(label, value, set, opts) {
    const o = opts || {};
    const row = el('label', 'field');
    row.appendChild(el('span', 'flabel', label));
    const wrap = el('div', 'cellwrap');
    const i = el('input', o.cls || 's');
    i.value = value ?? '';
    i.placeholder = o.placeholder || '';
    i.spellcheck = false;
    if (o.secret) i.type = 'password';
    i.addEventListener('input', () => {
      set(i.value);
      counts();
      save();
    });
    wrap.appendChild(i);
    if (o.secret) {
      const eye = button('icon', 'eye', '', t('showValue'));
      eye.addEventListener('click', () => {
        i.type = i.type === 'password' ? 'text' : 'password';
        eye.querySelector('.ico').innerHTML = ICON[i.type === 'password' ? 'eye' : 'eyeOff'];
      });
      wrap.appendChild(eye);
    }
    row.appendChild(wrap);
    return row;
  }
  function choice(label, value, options, set) {
    const row = el('label', 'field');
    row.appendChild(el('span', 'flabel', label));
    const s = el('select');
    for (const [v, text] of options) {
      const o = el('option', '', text);
      o.value = v;
      s.appendChild(o);
    }
    s.value = value;
    s.addEventListener('change', () => {
      set(s.value);
      save();
    });
    row.appendChild(s);
    return row;
  }
  function renderAuth() {
    const a = tab().form.auth;
    $('authType').value = a.type;
    const box = $('authFields');
    box.textContent = '';
    const hint = (text) => box.appendChild(el('p', 'hint', text));
    if (a.type === 'inherit') {
      hint(t('auth.inherit.hint'));
      const rows = tab().form.headers.filter((r) => r.on && /authorization|token|key/i.test(r.name));
      for (const r of rows) {
        const line = el('div', 'inherit-row');
        line.append(el('span', 'k', r.name), el('span', 'p', ': '), el('span', 's', r.value));
        if (r.source) line.appendChild(el('span', 'src src-' + r.source, t('from.' + r.source)));
        box.appendChild(line);
      }
      if (!rows.length) hint(t('auth.inherit.none'));
    }
    if (a.type === 'none') hint(t('auth.none.hint'));
    if (a.type === 'bearer') {
      box.appendChild(field(t('auth.token'), a.token, (v) => (a.token = v), { placeholder: '{{token}}', secret: true }));
      hint(t('auth.bearer.hint'));
    }
    if (a.type === 'basic') {
      box.appendChild(field(t('auth.username'), a.username, (v) => (a.username = v)));
      box.appendChild(field(t('auth.password'), a.password, (v) => (a.password = v), { secret: true }));
      hint(t('auth.basic.hint'));
    }
    if (a.type === 'apikey') {
      box.appendChild(field(t('auth.key'), a.key, (v) => (a.key = v), { cls: 'k', placeholder: 'X-API-Key' }));
      box.appendChild(field(t('value'), a.value, (v) => (a.value = v), { placeholder: '{{apiKey}}', secret: true }));
      box.appendChild(choice(t('auth.in'), a.in || 'header', [['header', t('auth.in.header')], ['query', t('auth.in.query')]], (v) => (a.in = v)));
    }
    if (a.type === 'oauth2') {
      box.appendChild(choice(t('auth.grant'), a.grant || 'client_credentials', [['client_credentials', t('auth.grant.client')], ['password', t('auth.grant.password')]], (v) => ((a.grant = v), renderAuth())));
      box.appendChild(field(t('auth.tokenUrl'), a.tokenUrl, (v) => (a.tokenUrl = v), { placeholder: 'https://auth.example.com/oauth/token' }));
      box.appendChild(field(t('auth.clientId'), a.clientId, (v) => (a.clientId = v)));
      box.appendChild(field(t('auth.clientSecret'), a.clientSecret, (v) => (a.clientSecret = v), { secret: true, placeholder: '{{clientSecret}}' }));
      box.appendChild(field(t('auth.scope'), a.scope, (v) => (a.scope = v), { placeholder: 'read write' }));
      if (a.grant === 'password') {
        box.appendChild(field(t('auth.username'), a.username, (v) => (a.username = v)));
        box.appendChild(field(t('auth.password'), a.password, (v) => (a.password = v), { secret: true }));
      }
      box.appendChild(choice(t('auth.credentials'), a.credentials || 'basic', [['basic', t('auth.credentials.basic')], ['body', t('auth.credentials.body')]], (v) => (a.credentials = v)));
      box.appendChild(field(t('auth.tokenVar'), a.tokenVar, (v) => (a.tokenVar = v), { cls: 'v', placeholder: 'accessToken' }));
      const row = el('div', 'oauth-row');
      const get = button('primary', 'key', t('auth.getToken'));
      get.id = 'getToken';
      get.addEventListener('click', () => {
        get.disabled = true;
        $('oauthState').textContent = t('auth.getting');
        vscode.postMessage({ type: 'oauthToken', tab: keyOf(tab().endpoint), auth: a });
      });
      const st = el('span', 'oauth-state');
      st.id = 'oauthState';
      row.append(get, st);
      box.appendChild(row);
      oauthState();
      hint(t('auth.oauth.hint'));
    }
  }
  function oauthState() {
    const st = $('oauthState');
    const a = tab()?.form.auth;
    if (!st || !a) return;
    st.textContent = '';
    st.className = 'oauth-state';
    const name = '{{' + ((a.tokenVar || '').trim() || 'accessToken') + '}}';
    if (a.error) {
      st.classList.add('fail');
      st.textContent = a.error;
      return;
    }
    if (!a.obtainedAt) return;
    if (a.expiresAt) {
      const left = Math.round((a.expiresAt - Date.now()) / 60000);
      st.classList.add(left > 0 ? 'ok' : 'fail');
      st.textContent = left > 0 ? t('auth.expiresIn', name, left) : t('auth.expired', name);
    } else {
      st.classList.add('ok');
      st.textContent = t('auth.saved', name);
    }
  }

  // post-response rules
  function renderRules() {
    const tb = tab();
    const table = $('rules');
    table.textContent = '';
    const head = el('tr', 'th');
    head.append(el('th', 'chk', ''), el('th', '', t('rules.variable')), el('th', '', t('rules.from')), el('th', '', t('rules.path')), el('th', '', t('rules.scope')), el('th', '', ''));
    table.appendChild(head);
    tb.form.rules.forEach((r, idx) => {
      const tr = el('tr', r.on ? '' : 'off');
      const c = el('td', 'chk');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = r.on;
      box.setAttribute('aria-label', t('enabled'));
      box.addEventListener('change', () => ((r.on = box.checked), tr.classList.toggle('off', !r.on), counts(), save()));
      c.appendChild(box);
      const inp = (cls, value, set, label, ph) => {
        const td = el('td');
        const i = el('input', cls);
        i.value = value;
        i.placeholder = ph || '';
        i.spellcheck = false;
        i.setAttribute('aria-label', label);
        i.addEventListener('input', () => (set(i.value), counts(), save()));
        td.appendChild(i);
        return td;
      };
      const sel = (value, options, set, label) => {
        const td = el('td');
        const s = el('select');
        s.setAttribute('aria-label', label);
        for (const [v, text] of options) {
          const o = el('option', '', text);
          o.value = v;
          s.appendChild(o);
        }
        s.value = value;
        s.addEventListener('change', () => (set(s.value), save()));
        td.appendChild(s);
        return td;
      };
      const d = el('td', 'act');
      const del = button('icon', 'trash', '', t('delete'));
      del.addEventListener('click', () => (tb.form.rules.splice(idx, 1), renderRules(), counts(), save()));
      d.appendChild(del);
      tr.append(
        c,
        inp('v', r.name, (v) => (r.name = v), t('rules.variable'), 'token'),
        sel(r.from, [['body', t('rules.from.body')], ['header', t('rules.from.header')]], (v) => (r.from = v), t('rules.from')),
        inp('k', r.path, (v) => (r.path = v), t('rules.path'), r.from === 'header' ? 'X-Request-Id' : 'data.access_token'),
        sel(r.scope, SCOPES.map((s) => [s, t('scope.' + s)]), (v) => (r.scope = v), t('rules.scope')),
        d,
      );
      table.appendChild(tr);
    });
    if (!tb.form.rules.length) {
      const tr = el('tr');
      const td = el('td', 'none', t('rules.none'));
      td.colSpan = 6;
      tr.appendChild(td);
      table.appendChild(tr);
    }
  }

  // ---------- send ----------

  function sending(on) {
    const b = $('send');
    b.classList.toggle('busy', on);
    b.querySelector('.label').textContent = on ? t('cancel') : t('send');
    b.setAttribute('aria-label', on ? t('cancel') : t('send'));
  }
  function send() {
    const tb = tab();
    if (!tb) return;
    if (tb.sending) {
      vscode.postMessage({ type: 'cancel', tab: keyOf(tb.endpoint) });
      return;
    }
    const f = tb.form;
    tb.sending = true;
    sending(true);
    renderTabs();
    $('resBody').classList.add('dim');
    vscode.postMessage({
      type: 'send',
      tab: keyOf(tb.endpoint),
      method: f.method,
      url: f.url,
      headers: f.headers.filter((r) => r.on && r.name.trim()).map((r) => [r.name.trim(), r.value]),
      body: f.method === 'GET' || f.method === 'HEAD' ? '' : f.body,
      auth: f.auth,
      rules: f.rules,
    });
  }
  function curl() {
    const f = tab().form;
    const q = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
    let url = resolve(f.url);
    const parts = ['curl', '-X', f.method];
    let rows = f.headers.filter((r) => r.on && r.name.trim()).map((r) => [r.name.trim(), resolve(r.value)]);
    const a = f.auth;
    const setH = (n, v) => (rows = rows.filter(([k]) => k.toLowerCase() !== n.toLowerCase()).concat([[n, v]]));
    if (a.type === 'none') rows = rows.filter(([k]) => k.toLowerCase() !== 'authorization');
    if (a.type === 'bearer') setH('Authorization', 'Bearer ' + resolve(a.token));
    if (a.type === 'oauth2') setH('Authorization', 'Bearer ' + resolve('{{' + ((a.tokenVar || '').trim() || 'accessToken') + '}}'));
    if (a.type === 'apikey' && (a.key || '').trim()) {
      if (a.in === 'query') url += (url.includes('?') ? '&' : '?') + encodeURIComponent(resolve(a.key)) + '=' + encodeURIComponent(resolve(a.value));
      else setH(a.key.trim(), resolve(a.value));
    }
    if (a.type === 'basic') parts.push('-u', q(resolve(a.username) + ':' + resolve(a.password)));
    for (const [k, v] of rows) parts.push('-H', q(k + ': ' + v));
    if (f.body.trim() && f.method !== 'GET' && f.method !== 'HEAD') parts.push('--data-raw', q(resolve(f.body)));
    parts.push(q(url));
    copy(parts.join(' '), t('copied.curl'));
  }
  function copy(text, notice) {
    navigator.clipboard.writeText(text).then(() => toast(notice || t('copied'), null, 'info'), () => toast(t('copyFailed'), null, 'fail'));
  }

  // ---------- response ----------

  function kindOf(r) {
    const ct = (Object.entries(r.headers || {}).find(([k]) => k.toLowerCase() === 'content-type') || [, ''])[1].toLowerCase();
    if (/json/.test(ct)) return 'json';
    if (/html/.test(ct)) return 'html';
    if (/xml/.test(ct)) return 'xml';
    const b = (r.body || '').trim();
    if ((b[0] === '{' || b[0] === '[') && !H.jsonProblem(b)) return 'json';
    if (/^<!doctype html|^<html/i.test(b)) return 'html';
    if (/^<\?xml/.test(b)) return 'xml';
    return 'text';
  }
  const VIEWS = { json: ['pretty', 'raw', 'headers'], html: ['pretty', 'raw', 'preview', 'headers'], xml: ['pretty', 'raw', 'headers'], text: ['raw', 'headers'] };
  function bytes(n) {
    return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
  }
  function renderResponse() {
    const tb = tab();
    const r = tb.response;
    const status = $('status');
    status.className = 'status';
    $('resBody').classList.toggle('dim', !!tb.sending);
    $('resTime').hidden = $('resSize').hidden = true;
    const views = $('resViews');
    views.textContent = '';
    $('treeTools').hidden = true;
    $('copyBody').hidden = !r || !!r.error;
    const body = $('resBody');
    body.textContent = '';
    if (!r) {
      status.textContent = '';
      status.hidden = true;
      const none = el('div', 'res-empty');
      none.appendChild(icon('send', 'big'));
      none.appendChild(el('div', '', t('noResponse')));
      none.appendChild(el('kbd', '', navigator.platform.includes('Mac') ? '⌘ Enter' : 'Ctrl Enter'));
      body.appendChild(none);
      return;
    }
    status.hidden = false;
    $('resTime').hidden = false;
    $('resTime').querySelector('span:last-child').textContent = r.ms + ' ms';
    if (r.error) {
      status.textContent = t(r.cancelled ? 'cancelled' : 'failed');
      status.classList.add('s5');
      const box = el('div', 'res-error');
      box.append(el('strong', '', r.cancelled ? t('cancelled') : r.timeout ? t('timeout', r.timeout) : t('failedTo', r.url)), el('pre', '', r.cancelled ? r.url : r.error));
      body.appendChild(box);
      return;
    }
    status.textContent = r.status + (r.statusText ? ' ' + r.statusText : '');
    status.classList.add('s' + String(r.status)[0]);
    $('resSize').hidden = false;
    $('resSize').querySelector('span:last-child').textContent = bytes(r.size ?? r.body.length);
    const kind = kindOf(r);
    const list = VIEWS[kind];
    let view = tb.form.view && list.includes(tb.form.view) ? tb.form.view : list[0];
    for (const v of list) {
      const b = button('seg-b' + (v === view ? ' on' : ''), v === 'headers' ? 'list' : v, t('view.' + v) + (v === 'headers' ? ' ' + Object.keys(r.headers).length : ''));
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(v === view));
      b.addEventListener('click', () => {
        tb.form.view = v;
        renderResponse();
        save();
      });
      views.appendChild(b);
    }
    views.appendChild(el('span', 'kind', kind.toUpperCase()));
    if (view === 'headers') return headersView(r, body);
    if (view === 'preview') {
      const f = document.createElement('iframe');
      f.setAttribute('sandbox', '');
      f.setAttribute('title', t('view.preview'));
      f.className = 'preview-frame';
      f.srcdoc = r.body;
      body.appendChild(f);
      return;
    }
    if (kind === 'json' && view === 'pretty') {
      let parsed;
      try {
        parsed = JSON.parse(r.body);
      } catch {
        parsed = undefined;
      }
      if (parsed !== undefined) {
        $('treeTools').hidden = false;
        return tree(parsed, body, tb);
      }
    }
    const pre = el('pre', 'code');
    const text = view === 'pretty' && kind === 'json' ? H.formatJson(r.body) || r.body : r.body;
    if (text.length > BIG) pre.textContent = text;
    else paint(pre, kind === 'json' ? H.tokenizeJson(text) : kind === 'html' || kind === 'xml' ? H.tokenizeMarkup(text) : [['', text]]);
    if (view === 'raw') pre.classList.add('wrap');
    body.appendChild(pre);
  }
  function headersView(r, body) {
    const table = el('table', 'kv');
    for (const [k, v] of Object.entries(r.headers)) {
      const tr = el('tr');
      const a = el('td', 'k', k);
      const b = el('td', 's', v);
      const c = el('td', 'act');
      const cp = button('icon', 'copy', '', t('copyValue'));
      cp.addEventListener('click', () => copy(v));
      const sv = button('icon', 'save', '', t('saveAsVar'));
      sv.addEventListener('click', (ev) => saveDialog(ev.currentTarget, k.replace(/[^A-Za-z0-9_]/g, '_'), v, { from: 'header', path: k }));
      c.append(cp, sv);
      tr.append(a, b, c);
      table.appendChild(tr);
    }
    body.appendChild(table);
  }

  // the JSON tree: each node opens and closes; a value can be copied, its path copied, or kept as a variable
  function count(v) {
    return Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0;
  }
  function tree(value, box, tb) {
    const id = keyOf(tb.endpoint);
    if (!expanded.has(id)) expanded.set(id, { all: null, open: new Set(), closed: new Set() });
    const st = expanded.get(id);
    const total = (function size(v, n) {
      if (n > 2000) return n;
      if (v && typeof v === 'object') for (const x of Object.values(v)) n = size(x, n + 1);
      return n;
    })(value, 0);
    const isOpen = (path, depth) => (st.all !== null ? st.all : st.open.has(path) ? true : st.closed.has(path) ? false : total <= 400 || depth < 2);
    const root = el('div', 'jtree');
    root.setAttribute('role', 'tree');
    root.setAttribute('aria-label', t('view.pretty'));
    const row = (parts, key, v, depth, last) => {
      const path = H.pathOf(parts);
      const node = el('div', 'jn');
      node.setAttribute('role', 'treeitem');
      const line = el('div', 'jr');
      line.tabIndex = -1;
      line.style.paddingLeft = 8 + depth * 16 + 'px';
      const container = v !== null && typeof v === 'object';
      const open = container && isOpen(path, depth);
      const tw = el('span', 'tw' + (container ? '' : ' leaf'));
      if (container) {
        tw.appendChild(icon('chevron'));
        node.setAttribute('aria-expanded', String(open));
      }
      line.appendChild(tw);
      if (key !== undefined) {
        line.appendChild(el('span', typeof key === 'number' ? 'tk-idx' : 'tk-k', typeof key === 'number' ? String(key) : JSON.stringify(key)));
        line.appendChild(el('span', 'tk-p', ': '));
      }
      if (container) {
        const arr = Array.isArray(v);
        line.appendChild(el('span', 'tk-p', arr ? '[' : '{'));
        if (!open) {
          line.appendChild(el('span', 'tk-p ell', '…'));
          line.appendChild(el('span', 'tk-p', (arr ? ']' : '}') + (last ? '' : ',')));
        }
        const n = count(v);
        line.appendChild(el('span', 'cnt', arr ? t('items', n) : t('keys', n)));
      } else {
        const cls = typeof v === 'string' ? 's' : typeof v === 'number' ? 'n' : typeof v === 'boolean' ? 'b' : 'z';
        const shown = el('span', 'tk-' + cls + ' val', JSON.stringify(v));
        line.appendChild(shown);
        if (!last) line.appendChild(el('span', 'tk-p', ','));
      }
      const acts = el('span', 'acts');
      const cv = button('icon', 'copy', '', t('copyValue'));
      cv.addEventListener('click', (ev) => (ev.stopPropagation(), copy(typeof v === 'string' ? v : JSON.stringify(v, null, 2))));
      const cp = button('icon', 'link', '', t('copyPath'));
      cp.addEventListener('click', (ev) => (ev.stopPropagation(), copy(path || '$', t('copied.path', path || '$'))));
      acts.append(cv, cp);
      if (!container) {
        const sv = button('icon', 'save', '', t('saveAsVar'));
        sv.addEventListener('click', (ev) => (ev.stopPropagation(), saveDialog(ev.currentTarget, typeof key === 'string' ? key : 'value', typeof v === 'string' ? v : JSON.stringify(v), { from: 'body', path })));
        acts.appendChild(sv);
      }
      line.appendChild(acts);
      line.title = path || '$';
      node.appendChild(line);
      if (container) {
        const toggle = () => {
          st.all = null;
          if (open) {
            st.closed.add(path);
            st.open.delete(path);
          } else {
            st.open.add(path);
            st.closed.delete(path);
          }
          rerender(path);
        };
        line.addEventListener('click', (ev) => {
          if (getSelection().toString()) return;
          toggle();
        });
        line.addEventListener('keydown', (ev) => {
          if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === line) (ev.preventDefault(), toggle());
          if (ev.key === 'ArrowRight' && !open) toggle();
          if (ev.key === 'ArrowLeft' && open) toggle();
        });
      }
      if (open) {
        const kids = el('div', 'jc');
        kids.setAttribute('role', 'group');
        const entries = Array.isArray(v) ? v.map((x, i) => [i, x]) : Object.entries(v);
        entries.forEach(([k, x], i) => kids.appendChild(row([...parts, k], k, x, depth + 1, i === entries.length - 1)));
        node.appendChild(kids);
        const end = el('div', 'jr end');
        end.style.paddingLeft = 8 + depth * 16 + 'px';
        end.append(el('span', 'tw leaf'), el('span', 'tk-p', (Array.isArray(v) ? ']' : '}') + (last ? '' : ',')));
        node.appendChild(end);
      }
      return node;
    };
    const rerender = (focusPath) => {
      root.textContent = '';
      root.appendChild(row([], undefined, value, 0, true));
      const rows = [...root.querySelectorAll('.jr:not(.end)')];
      if (rows[0]) rows[0].tabIndex = 0;
      if (focusPath !== undefined) rows.find((r) => r.title === (focusPath || '$'))?.focus();
    };
    root.addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp' && ev.key !== 'Home' && ev.key !== 'End') return;
      const rows = [...root.querySelectorAll('.jr:not(.end)')];
      const i = rows.indexOf(document.activeElement);
      const n = ev.key === 'Home' ? 0 : ev.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)));
      ev.preventDefault();
      rows[n]?.focus();
    });
    rerender();
    box.appendChild(root);
    $('expandAll').onclick = () => ((st.all = true), st.open.clear(), st.closed.clear(), rerender());
    $('collapseAll').onclick = () => ((st.all = false), st.open.clear(), st.closed.clear(), rerender());
  }

  // ---------- save as variable ----------

  function saveDialog(anchor, name, value, rule) {
    const d = $('dialog');
    d.hidden = false;
    $('dlgName').value = /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name) ? name : 'value';
    $('dlgValue').textContent = value.length > 120 ? value.slice(0, 120) + '…' : value;
    $('dlgScope').value = 'project';
    $('dlgRule').checked = false;
    $('dlgRuleText').textContent = t('dlg.rule', rule.from === 'header' ? t('rules.from.header') + ' ' + rule.path : rule.path || '$');
    const r = anchor.getBoundingClientRect();
    d.style.top = Math.min(window.innerHeight - 220, r.bottom + 6) + 'px';
    d.style.left = Math.max(8, Math.min(window.innerWidth - 330, r.right - 320)) + 'px';
    d._save = () => {
      const n = $('dlgName').value.trim();
      if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(n)) {
        $('dlgName').classList.add('bad');
        $('dlgName').focus();
        return;
      }
      const scope = $('dlgScope').value;
      vscode.postMessage({ type: 'saveVar', name: n, value, scope });
      if ($('dlgRule').checked && rule.path) {
        tab().form.rules.push({ on: true, name: n, from: rule.from, path: rule.path, scope });
        renderRules();
        counts();
        save();
      }
      closeDialog();
    };
    d._anchor = anchor;
    $('dlgName').classList.remove('bad');
    $('dlgName').focus();
    $('dlgName').select();
  }
  function closeDialog() {
    const d = $('dialog');
    if (d.hidden) return;
    d.hidden = true;
    d._anchor?.focus?.();
  }

  // ---------- notices ----------

  function toast(text, undo, kind) {
    const box = $('toasts');
    const n = el('div', 'toast ' + (kind || 'ok'));
    n.setAttribute('role', 'status');
    n.appendChild(icon(kind === 'fail' ? 'close' : kind === 'info' ? 'copy' : 'bolt'));
    n.appendChild(el('span', 'tmsg', text));
    if (undo) {
      const u = button('link', 'undo', t('undo'));
      u.addEventListener('click', () => {
        vscode.postMessage({ type: 'undo', changes: undo });
        n.remove();
      });
      n.appendChild(u);
    }
    const x = button('icon', 'close', '', t('close'));
    x.addEventListener('click', () => n.remove());
    n.appendChild(x);
    box.appendChild(n);
    setTimeout(() => n.remove(), undo ? 12000 : 3500);
  }

  // ---------- the variables drawer ----------

  function openDrawer(on) {
    const d = $('drawer');
    d.hidden = !on;
    $('varsBtn').setAttribute('aria-expanded', String(on));
    if (on) {
      if (!envs.scopes[drawerScope]) drawerScope = 'global';
      renderDrawer();
      d.querySelector('.scope-tab.on')?.focus();
    } else $('varsBtn').focus();
  }
  function edit(scope, e) {
    vscode.postMessage({ type: 'envEdit', scope, edit: e });
  }
  function renderDrawer() {
    if ($('drawer').hidden) return;
    const focus = document.activeElement?.dataset?.fid;
    const sel = focus ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    $('drawerEnv').textContent = envs.active;
    const tabsBox = $('scopeTabs');
    tabsBox.textContent = '';
    for (const s of SCOPES) {
      const sc = envs.scopes[s];
      const b = button('scope-tab scope-' + s + (s === drawerScope ? ' on' : ''), s, '');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(s === drawerScope));
      b.tabIndex = s === drawerScope ? 0 : -1;
      b.disabled = !sc;
      const label = el('span', 'stext');
      label.append(el('span', 'sname', t('scope.' + s)), el('span', 'sof', s === 'global' ? envs.active : s === 'project' ? envs.projectLabel : envs.component));
      b.appendChild(label);
      b.appendChild(el('span', 'count', String(sc ? Object.keys(sc.vars).length : 0)));
      b.addEventListener('click', () => ((drawerScope = s), renderDrawer()));
      b.addEventListener('keydown', (ev) => {
        if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
        const n = SCOPES[(SCOPES.indexOf(s) + (ev.key === 'ArrowRight' ? 1 : 2)) % 3];
        if (envs.scopes[n]) ((drawerScope = n), renderDrawer(), tabsBox.querySelector('.on')?.focus());
      });
      tabsBox.appendChild(b);
    }
    $('scopeHint').textContent = t('scopeHint.' + drawerScope);
    const sc = envs.scopes[drawerScope];
    kvEditor($('dVars'), drawerScope, 'vars', sc);
    kvEditor($('dHeaders'), drawerScope, 'headers', sc);
    if (focus) {
      const f = document.querySelector('[data-fid="' + CSS.escape(focus) + '"]');
      if (f) {
        f.focus();
        if (sel && f.setSelectionRange) try { f.setSelectionRange(sel[0], sel[1]); } catch {}
      }
    }
  }
  function overriddenBy(scope, name) {
    const order = SCOPES.slice(SCOPES.indexOf(scope) + 1);
    return order.find((s) => envs.scopes[s] && envs.scopes[s].vars[name] !== undefined);
  }
  function kvEditor(table, scope, kind, sc) {
    table.textContent = '';
    const entries = Object.entries(sc ? sc[kind] : {});
    const draft = pending[scope + ':' + kind];
    if (draft) entries.push([null, '']);
    const head = el('tr', 'th');
    head.append(el('th', '', t('name')), el('th', '', t('value')), el('th', '', ''));
    table.appendChild(head);
    for (const [name, value] of entries) {
      const tr = el('tr');
      const secret = kind === 'vars' && name !== null && sc.secrets.includes(name);
      const fid = scope + ':' + kind + ':' + (name ?? '+');
      const n = el('td');
      const ni = el('input', kind === 'vars' ? 'v' : 'k');
      ni.value = name ?? '';
      ni.placeholder = kind === 'vars' ? 'token' : 'X-Header';
      ni.spellcheck = false;
      ni.dataset.fid = fid + ':n';
      ni.setAttribute('aria-label', t('name'));
      const v = el('td');
      const wrap = el('div', 'cellwrap');
      const vi = el('input', 's');
      vi.value = value;
      vi.spellcheck = false;
      vi.dataset.fid = fid + ':v';
      vi.setAttribute('aria-label', t('value') + ' ' + (name ?? ''));
      if (secret && !revealed.has(fid)) vi.type = 'password';
      wrap.appendChild(vi);
      const by = name !== null && kind === 'vars' && overriddenBy(scope, name);
      if (by) {
        const o = el('span', 'src src-' + by);
        o.appendChild(icon(by));
        o.appendChild(el('span', '', t('overridden', t('scope.' + by))));
        o.title = t('overriddenHint', t('scope.' + by));
        wrap.appendChild(o);
      }
      v.appendChild(wrap);
      const commitName = () => {
        const to = ni.value.trim();
        if (!to) return;
        if (name === null) {
          delete pending[scope + ':' + kind];
          edit(scope, { op: 'set', kind, name: to, value: vi.value });
        } else if (to !== name) edit(scope, { op: 'rename', kind, name, to, value: vi.value });
      };
      ni.addEventListener('change', commitName);
      vi.addEventListener('change', () => {
        if (name === null) return commitName();
        edit(scope, { op: 'set', kind, name, value: vi.value });
      });
      const d = el('td', 'act');
      if (kind === 'vars' && name !== null) {
        const eye = button('icon' + (secret ? ' on' : ''), secret ? 'eyeOff' : 'eye', '', secret ? t('secret.off') : t('secret.on'));
        eye.setAttribute('aria-pressed', String(secret));
        eye.addEventListener('click', () => edit(scope, { op: 'secret', kind, name, on: !secret }));
        if (secret) {
          const peek = button('icon', revealed.has(fid) ? 'eyeOff' : 'eye', '', t('showValue'));
          peek.classList.add('peek');
          peek.addEventListener('click', () => (revealed.has(fid) ? revealed.delete(fid) : revealed.add(fid), renderDrawer()));
          wrap.appendChild(peek);
        }
        d.appendChild(eye);
      }
      const del = button('icon', 'trash', '', t('delete'));
      del.addEventListener('click', () => {
        if (name === null) {
          delete pending[scope + ':' + kind];
          return renderDrawer();
        }
        edit(scope, { op: 'delete', kind, name });
      });
      d.appendChild(del);
      n.appendChild(ni);
      tr.append(n, v, d);
      table.appendChild(tr);
    }
    if (!entries.length) {
      const tr = el('tr');
      const td = el('td', 'none', kind === 'vars' ? t('noVars') : t('noHeaders'));
      td.colSpan = 3;
      tr.appendChild(td);
      table.appendChild(tr);
    }
  }

  // ---------- layout ----------

  function applyLayout() {
    const s = $('split');
    s.dataset.layout = layout;
    $('reqBox').style.flexBasis = split * 100 + '%';
    $('layoutBtn').querySelector('.ico').innerHTML = ICON[layout === 'rows' ? 'rows' : 'columns'];
    $('layoutBtn').title = t('layout.' + layout);
    $('layoutBtn').setAttribute('aria-label', t('layout.' + layout));
    const rows = getComputedStyle(s).flexDirection === 'column';
    $('gutter').setAttribute('aria-orientation', rows ? 'horizontal' : 'vertical');
  }
  function dragGutter(ev) {
    const s = $('split');
    const rect = s.getBoundingClientRect();
    const rows = getComputedStyle(s).flexDirection === 'column';
    const move = (e) => {
      split = Math.min(0.85, Math.max(0.15, rows ? (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width));
      $('reqBox').style.flexBasis = split * 100 + '%';
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('dragging');
      save();
    };
    ev.preventDefault();
    document.body.classList.add('dragging');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // ---------- messages ----------

  function environments(m) {
    envs = m;
    const s = $('envSelect');
    s.textContent = '';
    for (const n of m.names) {
      const o = el('option', '', n);
      o.value = n;
      s.appendChild(o);
    }
    const add = el('option', '', t('newEnv'));
    add.value = '\u0000new';
    s.appendChild(add);
    s.value = m.active;
    $('varsCount').textContent = String(Object.keys(m.vars).length);
    if (tab()) {
      refreshHeaders();
      urlPreview();
      if (!$('p-auth').hidden) renderAuth();
    }
    renderDrawer();
  }
  window.addEventListener('message', (ev) => {
    const m = ev.data;
    if (m.type === 'environments') environments(m);
    if (m.type === 'open') open(m.endpoint);
    if (m.type === 'restore' && m.state && Array.isArray(m.state.tabs)) {
      tabs = m.state.tabs.map((x) => ({ endpoint: x.endpoint, form: H.migrateForm(x.form || {}), response: x.response || null }));
      layout = m.state.layout || 'auto';
      split = typeof m.state.split === 'number' ? m.state.split : 0.5;
      applyLayout();
      active = -1;
      show(m.state.active >= 0 && m.state.active < tabs.length ? m.state.active : tabs.length ? 0 : -1);
    }
    if (m.type === 'response') {
      const tb = tabs.find((x) => keyOf(x.endpoint) === m.tab);
      if (!tb) return;
      tb.sending = false;
      tb.response = m;
      if (tb === tab()) {
        sending(false);
        renderResponse();
      }
      renderTabs();
      save();
    }
    if (m.type === 'saved') {
      const names = m.changes.map((c) => '{{' + c.name + '}} (' + t('scope.' + c.scope) + ')').join(', ');
      if (m.changes.length) toast(t(m.changes.some((c) => c.auto) ? 'saved.auto' : 'saved', names), m.changes);
      if (m.missing && m.missing.length) toast(t('rules.missing', m.missing.join(', ')), null, 'fail');
    }
    if (m.type === 'oauth') {
      const tb = tabs.find((x) => keyOf(x.endpoint) === m.tab);
      if (!tb) return;
      const a = tb.form.auth;
      a.error = m.problem ? t('oauth.missing', t('auth.' + m.problem)) : m.error ? 'OAuth 2.0: ' + m.error : undefined;
      if (m.ok) {
        a.obtainedAt = Date.now();
        a.expiresAt = m.expiresAt;
      }
      if (tb === tab() && !$('p-auth').hidden) {
        const g = $('getToken');
        if (g) g.disabled = false;
        oauthState();
      }
      save();
    }
  });

  // ---------- wiring ----------

  for (const v of VERBS) {
    const o = el('option', 'verb ' + v.toLowerCase(), v);
    o.value = v;
    $('method').appendChild(o);
  }
  $('method').addEventListener('change', () => {
    tab().form.method = $('method').value;
    methodColor();
    save();
  });
  $('url').addEventListener('input', () => {
    tab().form.url = $('url').value;
    urlPreview();
    save();
  });
  document.querySelectorAll('#reqTabs [data-pane]').forEach((s) =>
    s.addEventListener('click', () => {
      showPane(s.dataset.pane);
      if (s.dataset.pane === 'auth') renderAuth();
      save();
    }),
  );
  $('reqTabs').addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
    const all = [...document.querySelectorAll('#reqTabs [data-pane]')];
    const i = all.findIndex((x) => x.classList.contains('on'));
    const n = all[(i + (ev.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
    n.click();
    n.focus();
  });
  $('addHeader').addEventListener('click', () => {
    tab().form.headers.push({ on: true, name: '', value: '' });
    renderHeaders();
    const ins = $('headers').querySelectorAll('input.k');
    ins[ins.length - 1]?.focus();
    save();
  });
  $('restoreHeaders').addEventListener('click', () => {
    const f = tab().form;
    f.removed = [];
    f.headers = f.headers.filter((r) => !r.source);
    refreshHeaders(false);
    renderHeaders();
    counts();
    save();
  });
  $('body').addEventListener('input', () => bodyChanged());
  $('body').addEventListener('scroll', syncScroll);
  $('body').addEventListener('paste', () =>
    setTimeout(() => {
      if ($('bodyMode').value === 'json' && !H.jsonProblem($('body').value)) formatBody();
    }),
  );
  $('body').addEventListener('keydown', (ev) => {
    if (ev.altKey && ev.shiftKey && (ev.key === 'F' || ev.key === 'f')) (ev.preventDefault(), formatBody());
  });
  $('bodyMode').addEventListener('change', () => bodyChanged());
  $('format').addEventListener('click', formatBody);
  $('authType').addEventListener('change', () => {
    const a = tab().form.auth;
    a.type = $('authType').value;
    if (a.type === 'bearer' && !a.token) a.token = '{{token}}';
    renderAuth();
    counts();
    save();
  });
  $('addRule').addEventListener('click', () => {
    tab().form.rules.push({ on: true, name: '', from: 'body', path: '', scope: 'project' });
    renderRules();
    const ins = $('rules').querySelectorAll('input.v');
    ins[ins.length - 1]?.focus();
    save();
  });
  $('send').addEventListener('click', send);
  $('copyCurl').addEventListener('click', curl);
  $('copyBody').addEventListener('click', () => tab()?.response && copy(tab().response.body));
  $('envSelect').addEventListener('change', () => {
    const v = $('envSelect').value;
    if (v === '\u0000new') {
      $('envSelect').value = envs.active;
      vscode.postMessage({ type: 'selectEnvironment' });
    } else vscode.postMessage({ type: 'activateEnvironment', name: v });
  });
  $('varsBtn').addEventListener('click', () => openDrawer($('drawer').hidden));
  $('drawerClose').addEventListener('click', () => openDrawer(false));
  $('editJson').addEventListener('click', () => vscode.postMessage({ type: 'editEnvironments' }));
  $('addVar').addEventListener('click', () => ((pending[drawerScope + ':vars'] = true), renderDrawer(), document.querySelector('[data-fid="' + drawerScope + ':vars:+:n"]')?.focus()));
  $('addEnvHeader').addEventListener('click', () => ((pending[drawerScope + ':headers'] = true), renderDrawer(), document.querySelector('[data-fid="' + drawerScope + ':headers:+:n"]')?.focus()));
  $('layoutBtn').addEventListener('click', () => {
    layout = layout === 'auto' ? 'columns' : layout === 'columns' ? 'rows' : 'auto';
    applyLayout();
    save();
  });
  $('gutter').addEventListener('pointerdown', dragGutter);
  $('gutter').addEventListener('keydown', (ev) => {
    const d = ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -0.05 : ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 0.05 : 0;
    if (!d) return;
    ev.preventDefault();
    split = Math.min(0.85, Math.max(0.15, split + d));
    applyLayout();
    save();
  });
  window.addEventListener('resize', applyLayout);
  $('dlgSave').addEventListener('click', () => $('dialog')._save());
  $('dlgCancel').addEventListener('click', closeDialog);
  $('dlgName').addEventListener('keydown', (ev) => ev.key === 'Enter' && $('dialog')._save());
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      send();
    }
    if (ev.key === 'Escape') {
      if (!$('dialog').hidden) closeDialog();
      else if (!$('drawer').hidden) openDrawer(false);
    }
  });
  document.addEventListener('pointerdown', (ev) => {
    if (!$('dialog').hidden && !$('dialog').contains(ev.target)) closeDialog();
  });
  applyLayout();
}
