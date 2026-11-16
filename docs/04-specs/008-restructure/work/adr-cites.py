#!/usr/bin/env python3
"""Rewrites every citation of an old ADR number (`ADR-0093`, `old ADR-0093`, `ADR-0065, 0066`, `ADR-0052–0060`)
to the per-project id (`ADR-synapsis-0002`), from the maps the documentation agents wrote (spec 008, T3.3).

    adr-cites.py <maps folder> [--dry] <file>...
"""
import glob, os, re, sys

maps = sys.argv[1]
dry = '--dry' in sys.argv
files = [a for a in sys.argv[2:] if a != '--dry']

NEW = {}   # old number -> "ADR-key-NNNN"
for path in glob.glob(os.path.join(maps, '*', 'adr-map.tsv')):
    for line in open(path):
        cols = line.rstrip('\n').split('\t')
        if len(cols) >= 3 and re.fullmatch(r'\d{4}', cols[0]):
            NEW[cols[0]] = f"ADR-{cols[1]}-{cols[2]}"

# the key of the project a file belongs to (for a link to an ADR of its own, written with the new number)
KEYS = [('nuclearlang/dialects/python/', 'python'), ('nuclearlang/dialects/typescript/', 'typescript'),
        ('nuclearlang/dialects/dart/', 'dart'), ('nuclearlang/dialects/nodejs/', 'nodejs'), ('nuclearlang/', 'lang'),
        ('nuclear-synapsis-framework/platforms/mobile/', 'mobile'),
        ('nuclear-synapsis-framework/platforms/backend/', 'backend'),
        ('nuclear-synapsis-framework/platforms/web/', 'web'), ('nuclear-synapsis-framework/', 'synapsis'),
        ('tools/cli/', 'cli'), ('tools/code_generator/', 'codegen'), ('tools/mcp/', 'mcp'), ('installer/', 'installer'),
        ('device-emulators/', 'devices'), ('extensions/', 'extensions'), ('nuclear-graph-storage/', 'graph'),
        ('nuclear-agents/', 'developer'), ('docs/', 'platform')]
def key_of(path):
    rel = os.path.relpath(os.path.abspath(path), os.getcwd()) + ('/' if os.path.isdir(path) else '')
    return next((k for prefix, k in KEYS if rel.startswith(prefix)), 'platform')

SEP = r'(?:, | and |/|–|-)'
CITE = re.compile(r'(old )?ADR-(\d{4})(?![\d-]*[a-z])((?:' + SEP + r'\d{4}(?![\d\w]))*)( ?§ ?[\w.]+(?:[–-][\w.]+)?(?:(?:, | and )§? ?[\d.]+)*)?')
OWN = re.compile(r'\[ADR-(\d{4})\]\(([^)]*03-adr/\1-[^)]*)\)')
unknown = set()

def cite(m):
    numbers = [m.group(2)]
    for sep, n in re.findall(r'(' + SEP + r')(\d{4})', m.group(3) or ''):
        if sep in ('–', '-'):
            numbers += [f"{i:04d}" for i in range(int(numbers[-1]) + 1, int(n) + 1)]
        else:
            numbers.append(n)
    out = []
    for n in numbers:
        if n not in NEW:
            unknown.add(n)
            return m.group(0)
        if NEW[n] not in out:
            out.append(NEW[n])
    return ', '.join(out)

changed = 0
for path in files:
    try:
        text = open(path, encoding='utf-8').read()
    except (UnicodeDecodeError, IsADirectoryError, FileNotFoundError):
        continue
    in_adr = '/03-adr/' in '/' + path
    key = key_of(path)
    lines = []
    for line in text.splitlines(keepends=True):
        if in_adr:
            # a decision's own title and what it replaces keep their numbers; only `old ADR-NNNN` is a citation
            if not line.startswith(('# ADR-', '- Replaces:')):
                line = re.sub(r'old ADR-\d{4}(?:' + SEP + r'\d{4}(?![\d\w]))*(?: ?§ ?[\w.]+)?', lambda m: CITE.sub(cite, m.group(0)), line)
        else:
            line = OWN.sub(lambda m: f"[ADR-{key}-{m.group(1)}]({m.group(2)})", line)
            line = CITE.sub(cite, line)
        lines.append(line)
    new = ''.join(lines)
    if new != text:
        changed += 1
        if not dry:
            open(path, 'w', encoding='utf-8').write(new)
print(f"{len(NEW)} old ADRs mapped; {changed} files {'would change' if dry else 'changed'}; unknown numbers: {sorted(unknown)}", file=sys.stderr)
