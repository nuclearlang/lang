//! The helpers every Nuclear file has without a `use`: the functions of lodash that serve Nuclear, written in
//! Nuclear (`nuclear-synapsis-framework/lodash/src/*.nuc`). A file that calls one gets only that function and the
//! ones it calls: written into the file itself when it is built alone, and into one generated file of the project
//! that every file imports from by name (`project::build`).

use nuclear_dialect::Dialect;
use nuclear_syntax::ast::{Body, File, Item, Member};
use nuclear_syntax::token::{Punct, StrPart, Token, TokenKind};
use std::collections::{BTreeSet, HashMap, HashSet};
use std::sync::OnceLock;

/// The file of a project that holds the helpers it uses (no extension: the dialect's).
pub const PATH: &str = "nuclear_helpers";

const SOURCES: [&str; 6] = [
    include_str!("../../../../nuclear-synapsis-framework/lodash/src/array.nuc"),
    include_str!("../../../../nuclear-synapsis-framework/lodash/src/collection.nuc"),
    include_str!("../../../../nuclear-synapsis-framework/lodash/src/math.nuc"),
    include_str!("../../../../nuclear-synapsis-framework/lodash/src/string.nuc"),
    include_str!("../../../../nuclear-synapsis-framework/lodash/src/object.nuc"),
    include_str!("../../../../nuclear-synapsis-framework/lodash/src/function.nuc"),
];

/// What the helpers use among themselves: a program cannot call them (the name stays free for it).
const INTERNAL: [&str; 4] = ["child", "mapAt", "fillText", "pathKeys"];

struct Helper {
    /// Its place among all the helpers: they are written in this order.
    order: usize,
    /// The declaration with its doc comment.
    text: String,
    /// The helpers it calls.
    uses: Vec<String>,
}

fn registry() -> &'static HashMap<String, Helper> {
    static REGISTRY: OnceLock<HashMap<String, Helper>> = OnceLock::new();
    REGISTRY.get_or_init(|| {
        let mut out: HashMap<String, Helper> = HashMap::new();
        for src in SOURCES {
            let parsed = nuclear_syntax::parse(src);
            for item in &parsed.file.items {
                let Item::Decl(d) = item else { continue };
                // the doc comment: the comment lines right above the declaration
                let mut start = src[..d.span.start].rfind('\n').map_or(0, |i| i + 1);
                while start > 0 {
                    let above = src[..start - 1].rfind('\n').map_or(0, |i| i + 1);
                    if !src[above..start].starts_with("//") {
                        break;
                    }
                    start = above;
                }
                let text = src[start..d.span.end].trim_end().to_string();
                out.insert(d.name.name.clone(), Helper { order: out.len(), text, uses: Vec::new() });
            }
        }
        let names: HashSet<String> = out.keys().cloned().collect();
        for (name, h) in &mut out {
            let mut found = BTreeSet::new();
            words(&nuclear_syntax::lex(&h.text).tokens, &mut |w, _, _| {
                if w != name && names.contains(w) {
                    found.insert(w.to_string());
                }
            });
            h.uses = found.into_iter().collect();
        }
        out
    })
}

/// Every identifier of the tokens (also inside the interpolations of a text), with the token before and after it.
fn words(tokens: &[Token], f: &mut impl FnMut(&str, Option<&TokenKind>, Option<&TokenKind>)) {
    for (i, t) in tokens.iter().enumerate() {
        match &t.kind {
            TokenKind::Ident(n) => {
                f(n, i.checked_sub(1).map(|p| &tokens[p].kind), tokens.get(i + 1).map(|t| &t.kind));
            }
            TokenKind::Str(s) => {
                for p in &s.parts {
                    if let StrPart::Interp { tokens, .. } = p {
                        words(tokens, f);
                    }
                }
            }
            _ => {}
        }
    }
}

/// The names a file declares: its declarations, their members and what it imports. A helper of that name is the
/// file's own.
pub fn declared(file: &File) -> HashSet<String> {
    let mut out = HashSet::new();
    for item in &file.items {
        match item {
            Item::Use(u) => {
                out.extend(u.names.iter().map(|n| n.name.clone()));
                out.extend(u.alias.iter().map(|a| a.name.clone()));
            }
            Item::Decl(d) => {
                out.insert(d.name.name.clone());
                if let Body::Members(members) = &d.body {
                    for m in members {
                        match m {
                            Member::Method(md) => out.insert(md.name.name.clone()),
                            Member::Field(f) => out.insert(f.name.name.clone()),
                            _ => false,
                        };
                    }
                }
            }
            Item::Stmt(_) => {}
        }
    }
    out
}

/// The helpers a file needs: the names it uses that nothing defines (`undefined`: what the emitter reported as
/// N0106, so a member, a local, a name of the project or of the dialect is never taken for a helper), and the
/// modules of the helpers it writes (`Pair`) unless the file, the project (`own`) or the dialect has that name.
pub fn used(source: &str, undefined: &BTreeSet<String>, own: &HashSet<String>, dialect: &Dialect) -> BTreeSet<String> {
    let all = registry();
    let mut out: BTreeSet<String> =
        undefined.iter().filter(|n| all.contains_key(*n) && !INTERNAL.contains(&n.as_str())).cloned().collect();
    for name in all.keys().filter(|n| n.starts_with(|c: char| c.is_ascii_uppercase())) {
        if own.contains(name)
            || dialect.auto_imports.contains_key(name)
            || dialect.defs.contains_key(name.as_str())
            || !source.contains(name.as_str())
        {
            continue;
        }
        words(&nuclear_syntax::lex(source).tokens, &mut |w, before, _| {
            if w == name && !matches!(before, Some(TokenKind::Punct(Punct::Dot | Punct::QuestionDot | Punct::DotDot))) {
                out.insert(w.to_string());
            }
        });
    }
    out
}

/// The Nuclear source of those helpers and of the ones they call, in the library's order; empty for none. A helper
/// one of them calls that has a name of the file or the project (`own`: `words`) is written under another name
/// (`nuclearWords`), so both exist.
pub fn source(names: &BTreeSet<String>, own: &HashSet<String>) -> String {
    let all = registry();
    let mut wanted: BTreeSet<&str> = BTreeSet::new();
    let mut pending: Vec<&str> = names.iter().map(String::as_str).collect();
    while let Some(n) = pending.pop() {
        if let Some(h) = all.get(n)
            && wanted.insert(n)
        {
            pending.extend(h.uses.iter().map(String::as_str));
        }
    }
    let mut picked: Vec<&Helper> = wanted.iter().filter_map(|n| all.get(*n)).collect();
    picked.sort_by_key(|h| h.order);
    let text = picked.iter().map(|h| h.text.as_str()).collect::<Vec<_>>().join("\n\n");
    let hidden: HashMap<&str, String> = wanted
        .iter()
        .filter(|n| own.contains(**n))
        .map(|n| (*n, format!("nuclear{}{}", n[..1].to_uppercase(), &n[1..])))
        .collect();
    if hidden.is_empty() {
        return text;
    }
    // each use of a hidden name, from the last to the first so the positions before it stay
    let mut places = Vec::new();
    spans(&nuclear_syntax::lex(&text).tokens, &mut |w, span| {
        if let Some(to) = hidden.get(w) {
            places.push((span, to.clone()));
        }
    });
    let mut out = text.clone();
    places.sort_by_key(|(span, _)| std::cmp::Reverse(span.start));
    for (span, to) in places {
        out.replace_range(span.start..span.end, &to);
    }
    out
}

/// Every identifier of the tokens (also inside the interpolations of a text) with its place.
fn spans(tokens: &[Token], f: &mut impl FnMut(&str, nuclear_diag::Span)) {
    for t in tokens {
        match &t.kind {
            TokenKind::Ident(n) => f(n, t.span),
            TokenKind::Str(s) => {
                for p in &s.parts {
                    if let StrPart::Interp { tokens, .. } = p {
                        spans(tokens, f);
                    }
                }
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_helper_brings_the_helpers_it_calls() {
        let src = source(&BTreeSet::from(["intersectionBy".to_string()]), &HashSet::new());
        assert!(src.contains("intersectionBy<T>(") && src.contains("uniqBy<T>("), "{src}");
        assert!(!src.contains("chunk<T>("), "{src}");
        // its doc comment comes with it
        assert!(src.starts_with("// "), "{src}");
    }

    #[test]
    fn a_helper_another_calls_gives_way_to_a_name_of_the_file() {
        let src = source(&BTreeSet::from(["kebabCase".to_string()]), &HashSet::from(["words".to_string()]));
        assert!(src.contains("nuclearWords(text: string) string[]") && src.contains("nuclearWords(text).map"), "{src}");
        assert!(!src.contains("\nwords("), "{src}");
    }

    #[test]
    fn every_helper_parses_alone() {
        for name in registry().keys() {
            let src = source(&BTreeSet::from([name.clone()]), &HashSet::new());
            let parsed = nuclear_syntax::parse(&src);
            assert!(!parsed.diagnostics.iter().any(nuclear_diag::Diagnostic::is_error), "{name}: {:?}", parsed.diagnostics);
        }
    }
}
