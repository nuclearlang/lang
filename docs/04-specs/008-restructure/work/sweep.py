#!/usr/bin/env python3
"""Rewrites the old folder names of the tree to the new ones in the text of the files given (spec 008, T1.6)."""
import re, sys, os, difflib
DRY = os.environ.get('DRY')
P = 'nuclear-synapsis-framework/platforms'
D = 'nuclearlang/dialects'
LANG_OF = {'fastapi': 'python', 'nestjs': 'typescript', 'react': 'typescript', 'flutter': 'dart',
           'python': 'python', 'typescript': 'typescript', 'dart': 'dart', 'nodejs': 'nodejs'}
PLAT_OF = {'fastapi': 'backend', 'nestjs': 'backend', 'react': 'web', 'flutter': 'mobile'}
B = r'(?<![\w/.-])'   # not already part of a longer path
def spec(m):
    brief, name, ext = m.group(1) or '', m.group(2), m.group(3)
    if name in LANG_OF: return f"{D}/{LANG_OF[name]}/docs/07-reference/{brief}{name}.{ext}"
    if name in ('backend', 'mobile', 'web'): return f"{P}/{name}/docs/07-reference/{brief}{name}.{ext}"
    if name == 'dragonfly': return f"{P}/mobile/docs/07-reference/{brief}{name}.{ext}"
    return f"nuclearlang/docs/07-reference/{brief}{name}.{ext}"
GUIDE = {'python': f'{D}/python/docs/08-guides/fastapi.md', 'nestjs': f'{D}/typescript/docs/08-guides/nestjs.md',
         'react': f'{D}/typescript/docs/08-guides/react.md', 'genkit': f'{P}/mobile/docs/08-guides/genkit.md',
         'contracts': f'{P}/backend/docs/08-guides/contracts.md'}
RULES = [
    # the old repositories, most specific first
    (r'(?:dragonfly-(?:mobile|backend|web)/)?' + B.replace('?<!', '?<!') + r'', None),  # placeholder (kept empty)
    (B + r'dragonfly-(?:mobile|backend|web)/spec/', 'spec/'),
    (B + r'dragonfly-(?:mobile|backend|web)/docs/dragonfly/', 'docs/dragonfly/'),
    (B + r'dragonfly-(?:mobile|backend|web)/dialects/', 'dialects/'),
    (B + r'dragonfly-(mobile|backend|web)/defs/(python|typescript|dart)\b', lambda m: f"{D}/{m.group(2)}/defs"),
    (B + r'dragonfly-(mobile|backend|web)/tools/', lambda m: f"{P}/{m.group(1)}/checks/"),
    (B + r'dragonfly-(mobile|backend|web)/(packages|examples)\b', lambda m: f"{P}/{m.group(1)}/{m.group(2)}"),
    (B + r'dragonfly/dragonfly/src\b', 'nuclear-synapsis-framework/cli/src'),
    (B + r'dragonfly/docs/dragonfly/', 'docs/dragonfly/'),
    # references and guides
    (B + r'spec/(brief/)?([a-z-]+)\.(md|ebnf)', spec),
    (B + r'docs/dragonfly/(python|nestjs|react|genkit|contracts)\.md', lambda m: GUIDE[m.group(1)]),
    (B + r'docs/dragonfly/', 'nuclear-synapsis-framework/docs/08-guides/'),
    (B + r'docs/language/', 'nuclearlang/docs/08-guides/'),
    # dialects and platforms
    (B + r'dialects/(backend|mobile|web)/platform\.toml', lambda m: f"{P}/{m.group(1)}/platform.toml"),
    (B + r'dialects/(?:backend|mobile|web)/(fastapi|nestjs|react|flutter)\b', lambda m: f"{D}/{LANG_OF[m.group(1)]}/frameworks/{m.group(1)}"),
    (B + r'dialects/(python|typescript|dart|nodejs)\b', lambda m: f"{D}/{m.group(1)}"),
    # the language's folders
    (B + r'crates/nuclear-cli\b', 'tools/cli'),
    (B + r'crates/(nuclear-(?:diag|syntax|dialect|transpile|lsp))\b', lambda m: f"nuclearlang/crates/{m.group(1)}"),
    (B + r'languages/(nuclear|docs)\.toml', lambda m: f"nuclearlang/base/{m.group(1)}.toml"),
    (B + r'tools/(defs|spec-check|stdlib-check\.sh|node|python)\b', lambda m: f"nuclearlang/tools/{m.group(1)}"),
    (B + r'tools/release\b', 'installer/release'),
    (B + r'tools/context/check\.sh', '.claude/hooks/context-check.sh'),
    (B + r'tools/(agent-eval|thesis)\b', lambda m: f"nuclear-synapsis-framework/eval/{m.group(1)}"),
    # the extensions, the graph, the agents (never inside a URL or an installed path)
    (r'(?<![\w/.-])(?<!nuclearlang/)nuclear-(vscode|jetbrains|zed)/', lambda m: f"extensions/{m.group(1)}/"),
    (B + r'nuclear-developer/data\b', 'nuclear-graph-storage/data'),
    (B + r'nuclear-developer/(eval|components|config|defs|test|build|README|AGENTS|\.nuclear)', lambda m: f"nuclear-agents/nuclear_developer/{m.group(1)}"),
    (B + r'nuclear-graph/(src|prompts|tests|README|pyproject|\.venv|build)', lambda m: f"nuclear-graph-storage/{m.group(1)}"),
    # the installer from source
    (r'(?<![\w/.-])\./install\.sh', 'installer/install.sh'),
]
RULES = [(re.compile(p), r) for p, r in RULES if r is not None]
changed = 0
for path in sys.argv[1:]:
    try: text = open(path, encoding='utf-8').read()
    except (UnicodeDecodeError, IsADirectoryError, FileNotFoundError): continue
    # code: only its comment lines (a path inside a string is the program's, not prose); prose files: all of it
    prose = path.endswith(('.md', 'docs.toml')) or os.environ.get('FULL')
    mark = ('#',) if path.endswith(('.sh', '.py', '.toml', '.yml', '.ps1', 'Dockerfile')) else ('//', '*', '/*')
    def line(l):
        if not prose and not l.lstrip().startswith(mark): return l
        for rx, rep in RULES: l = rx.sub(rep, l)
        return l
    new = ''.join(line(l) for l in text.splitlines(keepends=True))
    if new != text:
        changed += 1
        if DRY:
            for l in difflib.unified_diff(text.splitlines(), new.splitlines(), path, path, lineterm='', n=0):
                if l[:1] in '+-' and l[:3] not in ('+++', '---'): print(l[:230])
        else:
            open(path, 'w', encoding='utf-8').write(new); print(path)
print(f"{changed} files changed", file=sys.stderr)
