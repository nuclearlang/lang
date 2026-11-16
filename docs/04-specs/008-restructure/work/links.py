#!/usr/bin/env python3
"""Checks every relative markdown link of the tree's documents and, with --fix, repairs the ones that broke when
their file or their target moved (spec 008).

    links.py [--fix] [<folder>...]        from the tree root
"""
import os, re, sys, importlib.util

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('sweep', os.path.join(here, 'sweep.py'))
fix = '--fix' in sys.argv
folders = [a for a in sys.argv[1:] if a != '--fix'] or ['.']

# the rules that turn an old path of the tree into the new one (sweep.py), applied to one path
src = open(os.path.join(here, 'sweep.py')).read()
ns = {}
exec(src.split('changed = 0')[0].replace('import re, sys, os, difflib', 'import re, sys, os, difflib').replace("DRY = os.environ.get('DRY')", ''), ns)
RULES = ns['RULES']
def new_path(old):
    out = old
    for rx, rep in RULES:
        out = rx.sub(rep, out)
    extra = [(r'^dragonfly-(mobile|backend|web)/', r'nuclear-synapsis-framework/platforms/\1/'), (r'^dragonfly/', 'nuclear-synapsis-framework/'),
             (r'^nuclear-developer/', 'nuclear-agents/nuclear_developer/'), (r'^nuclear-graph/', 'nuclear-graph-storage/'),
             (r'^examples/', 'nuclearlang/examples/'), (r'^languages/', 'nuclearlang/base/'), (r'^dialects/?$', 'nuclearlang/dialects/'),
             (r'^defs/(\w+)', r'nuclearlang/dialects/\1/defs'), (r'^crates/', 'nuclearlang/crates/'), (r'^install\.sh$', 'installer/install.sh'),
             (r'^docs/architecture\.md$', 'nuclearlang/docs/08-guides/architecture.md'), (r'^docs/ai/setup\.md$', 'installer/docs/08-guides/ai-setup.md'),
             (r'^docs/dialects/create-with-agent\.md$', 'nuclearlang/docs/08-guides/create-a-dialect-with-an-agent.md'),
             (r'^specs/', 'docs/04-specs/')]
    for rx, rep in extra:
        out = re.sub(rx, rep, out)
    return out

# where a moved document was, by its new folder (the file's own name decides between two origins)
FW = {'fastapi': 'dragonfly-backend', 'nestjs': 'dragonfly-backend', 'react': 'dragonfly-web', 'flutter': 'dragonfly-mobile'}
def old_dir(path):
    p = path[2:] if path.startswith('./') else path
    name = os.path.splitext(os.path.basename(p))[0]
    m = re.match(r'nuclearlang/dialects/(\w+)/docs/(07-reference|08-guides)/(brief/)?', p)
    if m:
        repo = FW.get(name, '')
        if m.group(2) == '08-guides':
            return f"{repo}/docs/dragonfly"
        return (repo + '/' if repo else '') + 'spec' + ('/brief' if m.group(3) else '')
    m = re.match(r'nuclear-synapsis-framework/platforms/(\w+)/docs/(07-reference|08-guides)/(brief/)?', p)
    if m:
        return f"dragonfly-{m.group(1)}/" + ('docs/dragonfly' if m.group(2) == '08-guides' else 'spec' + ('/brief' if m.group(3) else ''))
    if p.startswith('nuclear-synapsis-framework/docs/08-guides/'): return 'dragonfly/docs/dragonfly'
    if p.startswith('nuclearlang/docs/07-reference/brief/'): return 'spec/brief'
    if p.startswith('nuclearlang/docs/07-reference/'): return 'spec'
    if p == 'nuclearlang/docs/08-guides/create-a-dialect-with-an-agent.md': return 'docs/dialects'
    if p == 'nuclearlang/docs/08-guides/architecture.md': return 'docs'
    if p.startswith('nuclearlang/docs/08-guides/'): return 'docs/language'
    if p == 'installer/docs/08-guides/ai-setup.md': return 'docs/ai'
    return None

GITHUB = re.compile(r'https://github\.com/nuclearlang/([\w.-]+)/(?:blob|tree)/main/([^)#\s]+)')
LINK = re.compile(r'(\]\()([^)\s]+)(\))')
skip = ('node_modules', 'target', '.venv', 'build', '.git', 'github-profile', '.dart_tool', 'vendor', 'icon-themes', 'aprende', 'old-sources')
broken, fixed = [], 0
for folder in folders:
    for d, dirs, files in os.walk(folder):
        dirs[:] = [x for x in dirs if x not in skip and not (x == 'data' and d.endswith('nuclear-graph-storage'))]
        for f in files:
            if not f.endswith('.md'): continue
            path = os.path.join(d, f)
            text = open(path, encoding='utf-8', errors='replace').read()
            was = old_dir(os.path.normpath(path))
            def repl(m):
                global fixed
                target = m.group(2)
                g = GITHUB.fullmatch(target.split('#')[0])
                anchor = ('#' + target.split('#', 1)[1]) if '#' in target else ''
                if g and g.group(1) != 'website':
                    old = (g.group(1) + '/' if g.group(1) != 'nuclear' else '') + g.group(2)
                    new = new_path(old)
                    if os.path.exists(new):
                        fixed += 1
                        return m.group(1) + os.path.relpath(new, d) + anchor + m.group(3)
                    return m.group(0)
                if re.match(r'[a-z]+:|#|<', target): return m.group(0)
                plain = target.split('#')[0]
                if plain == '' or os.path.exists(os.path.normpath(os.path.join(d, plain))): return m.group(0)
                candidates = []
                if was is not None:
                    candidates.append(new_path(os.path.normpath(os.path.join(was, plain))))
                candidates.append(new_path(os.path.normpath(plain)))
                for new in candidates:
                    if not new.startswith('..') and os.path.exists(new):
                        fixed += 1
                        rel = os.path.relpath(new, d) + ('/' if plain.endswith('/') else '')
                        return m.group(1) + rel + anchor + m.group(3)
                broken.append((path, target))
                return m.group(0)
            new_text = LINK.sub(repl, text)
            if fix and new_text != text:
                open(path, 'w', encoding='utf-8').write(new_text)
print(f"{fixed} links {'repaired' if fix else 'can be repaired'}; {len(broken)} broken")
for p, t in broken[:400]:
    print(f"  {p}: {t}")
