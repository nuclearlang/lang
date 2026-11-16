import os,re,glob,json,sys
here=os.path.dirname(os.path.abspath(__file__))
src=open(os.path.join(here,'links.py')).read()
ns={'__file__':os.path.join(here,'links.py')}
exec(src.split('# where a moved document was')[0].replace("fix = '--fix' in sys.argv",'fix=False').replace("folders = [a for a in sys.argv[1:] if a != '--fix'] or ['.']",''),ns)
new_path=ns['new_path']
# every heading of every document of the tree
skip=('node_modules','target','.venv','build','.git','github-profile','work','data','aprende')
heads={}
for d,dirs,files in os.walk('.'):
    dirs[:]=[x for x in dirs if x not in skip]
    for f in files:
        if not f.endswith('.md'): continue
        p=os.path.normpath(os.path.join(d,f))
        for l in open(p,errors='replace'):
            m=re.match(r'#{1,6} (.+)',l)
            if m: heads.setdefault(re.sub(r'[`*]','',m.group(1)).strip().lower(),[]).append(p)
SPECIAL={'STATUS.md':None,'docs/ai/setup.md':'installer/docs/08-guides/ai-setup.md','docs/ai/mcp.md':'tools/mcp/docs/08-guides/mcp.md',
 'docs/context/product/prd.md':'docs/01-product/prd.md','docs/context/architecture.md':'docs/02-architecture/overview.md',
 'docs/context/workflow.md':'docs/05-standards/coding.md','docs/context/tech.md':'docs/06-runbooks/machine.md',
 'nuclear-graph/prompts':'nuclear-graph-storage/prompts'}
def fix(source):
    path,_,anchor=source.partition('#')
    np_=SPECIAL.get(path, new_path(path))
    if np_ is None or not os.path.exists(np_ or ''):
        np_=None
    if anchor:
        key=re.sub(r'[`*]','',anchor).strip().lower()
        cands=heads.get(key,[])
        if np_ and np_ in cands: return f'{np_}#{anchor}'
        if cands:
            # prefer a file in the project of the new path, else the shortest path
            proj=(np_ or path).split('/')[0]
            best=sorted(cands,key=lambda c:(not c.startswith(proj),len(c)))[0]
            return f'{best}#{anchor}'
    return np_ or source
changed=unresolved=0
for f in glob.glob('nuclear-graph-storage/data/assets/*/*.json'):
    data=json.load(open(f))
    rows=data if isinstance(data,list) else data.get('rows',[])
    touched=False
    for r in rows:
        if not isinstance(r,dict) or 'sources' not in r: continue
        out=[]
        for s in r['sources']:
            n=fix(s)
            if n!=s: changed+=1; touched=True
            p=n.partition('#')[0]
            if not os.path.exists(p): unresolved+=1; print('UNRESOLVED',r.get('id'),s,file=sys.stderr)
            out.append(n)
        r['sources']=out
    if touched:
        txt=json.dumps(data,indent=1,ensure_ascii=False)+'\n'
        open(f,'w').write(txt)
print('sources rewritten',changed,'unresolved',unresolved)
