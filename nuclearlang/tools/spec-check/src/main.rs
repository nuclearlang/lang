// Reads the ```nuclear blocks of a markdown file and prints, for each, its output in a dialect
// (even when it uses names declared elsewhere: N0106 is ignored). Used by check.py. A block whose first line is
// `// config.nuc: plugins(telemetry = true)` (then an empty line) is built with those plugins on; one whose first line
// is `// nuclear.toml: lazy_imports = true`, as a file of a project with lazy imports.

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let (md, dialect) = (&args[1], &args[2]);
    let loader = nuclear_dialect::Loader::of(Vec::new(), &[nuclear_dialect::Home::tree()]);
    let d = loader.load(dialect).0.expect("dialect");
    let text = std::fs::read_to_string(md).unwrap();
    let mut blocks = Vec::new();
    let mut cur: Option<String> = None;
    for line in text.lines() {
        match (&mut cur, line.trim_end()) {
            (None, "```nuclear") => cur = Some(String::new()),
            (Some(_), "```") => blocks.push(cur.take().unwrap()),
            (Some(b), l) => {
                b.push_str(l);
                b.push('\n');
            }
            _ => {}
        }
    }
    for b in blocks {
        let plugins: Vec<String> = b
            .lines()
            .next()
            .and_then(|l| l.trim().strip_prefix("// config.nuc: plugins("))
            .and_then(|l| l.strip_suffix(')'))
            .map(|args| args.split(',').filter_map(|a| a.trim().strip_suffix("= true").map(|n| n.trim().to_string())).collect())
            .unwrap_or_default();
        let lazy = b.lines().next().is_some_and(|l| l.trim() == "// nuclear.toml: lazy_imports = true");
        let out = nuclear_transpile::transpile_alone(&b, &d, &plugins, lazy);
        let real: Vec<_> = out.diagnostics.iter().filter(|x| x.is_error() && x.code.id != "N0106").map(|x| x.message.clone()).collect();
        println!("<<<NUCLEAR\n{b}>>>OUT\n{}", out.code);
        if !real.is_empty() {
            println!("!!! {real:?}");
        }
        println!("<<<END");
    }
}
