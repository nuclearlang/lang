//! NuclearLang transpiler: `.nuc` source + a dialect → target code and diagnostics.
//!
//! This is the API the CLI, the future LSP and the MCP server call. Dialects are loaded at run time
//! from files (see `nuclear_dialect::Loader`), so editing a dialect needs no recompilation.

mod alias;
mod analysis;
mod emit;
pub mod helpers;
mod naming;
pub mod contract;
pub mod map;
pub mod project;

use nuclear_diag::Diagnostic;
use nuclear_dialect::Dialect;

pub struct Output {
    /// Target code; empty when the source has syntax errors.
    pub code: String,
    pub diagnostics: Vec<Diagnostic>,
    /// Line map for debuggers: (output line, source line), both from 1, in output order. A line of the output
    /// that is not listed belongs to the closest listed line above it.
    pub lines: Vec<(u32, u32)>,
}

/// Parses and emits `src` with `dialect`.
pub fn transpile(src: &str, dialect: &Dialect) -> Output {
    transpile_with_plugins(src, dialect, &[])
}

/// `transpile` of a file built alone as if `config.nuc` enabled `plugins` (a dialect's reference shows a plugin's
/// output this way; a project's plugins come from its own `config.nuc`).
pub fn transpile_with_plugins(src: &str, dialect: &Dialect, plugins: &[String]) -> Output {
    transpile_alone(src, dialect, plugins, false)
}

/// `transpile_with_plugins` of a file built alone as if its project set `lazy_imports` (ADR-lang-0012): a dialect's
/// reference shows its output this way.
pub fn transpile_alone(src: &str, dialect: &Dialect, plugins: &[String], lazy_imports: bool) -> Output {
    let parsed = nuclear_syntax::parse(src);
    let mut diagnostics = parsed.diagnostics;
    if diagnostics.iter().any(Diagnostic::is_error) {
        return Output { code: String::new(), diagnostics, lines: Vec::new() };
    }
    // the file as it is; then, when it uses helpers of the language (`chunk`, `uniqBy`...: names nothing defines),
    // once more with them written into it
    let own = helpers::declared(&parsed.file);
    let first = emit_alone(src, parsed.file, None, dialect, plugins, lazy_imports);
    let used = helpers::used(src, &first.1, &own, dialect);
    if used.is_empty() {
        diagnostics.extend(first.0.diagnostics);
        diagnostics.sort_by_key(|d| d.span.start);
        return Output { diagnostics, ..first.0 };
    }
    // their source goes after the file's, so every position of the file stays what it is; their code goes first
    let whole = format!("{src}\n\n{}\n", helpers::source(&used, &own));
    let file = nuclear_syntax::parse(&whole).file;
    let (out, _) = emit_alone(&whole, file, Some(src.len()), dialect, plugins, lazy_imports);
    diagnostics.extend(out.diagnostics);
    diagnostics.sort_by_key(|d| d.span.start);
    Output { diagnostics, ..out }
}

/// One emission of a file built alone: its output and the names nothing defines. `helpers_from` is where the
/// helpers written into it start in `src`.
fn emit_alone(
    src: &str,
    mut file: nuclear_syntax::ast::File,
    helpers_from: Option<usize>,
    dialect: &Dialect,
    plugins: &[String],
    lazy_imports: bool,
) -> (Output, std::collections::BTreeSet<String>) {
    let mut diagnostics = Vec::new();
    let names = naming::apply(&mut file, dialect);
    diagnostics.extend(alias::expand(&mut file, &Default::default(), &|d| alias_via(dialect, d)));
    let mut emitter = emit::Emitter::new(dialect, file.comments.clone()).with_source(src).with_plugins(plugins);
    emitter.lazy_alone = lazy_imports;
    emitter.helpers_from = helpers_from;
    let code = emitter.file(&file);
    diagnostics.append(&mut emitter.diags);
    naming::restore(&mut diagnostics, &names);
    // by the names the source wrote (a dialect may have renamed them: `uniq_by`)
    let undefined =
        std::mem::take(&mut emitter.undefined).into_iter().map(|n| names.get(&n).cloned().unwrap_or(n)).collect();
    (Output { code, diagnostics, lines: line_map(src, &emitter.marks) }, undefined)
}

/// (output line, source offset) → (output line, source line).
pub(crate) fn line_map(src: &str, marks: &[(u32, usize)]) -> Vec<(u32, u32)> {
    let starts: Vec<usize> = std::iter::once(0).chain(src.match_indices('\n').map(|(i, _)| i + 1)).collect();
    marks.iter().map(|&(out, pos)| (out, starts.partition_point(|&s| s <= pos) as u32)).collect()
}

/// `alias_via` of the kind of a declaration.
pub(crate) fn alias_via(dialect: &Dialect, d: &nuclear_syntax::ast::Decl) -> Option<String> {
    d.words.iter().find_map(|w| dialect.kinds.get(&w.name).and_then(|k| k.value.alias_via.clone()))
}

/// Diagnostics only (what the LSP and `nuclear check` need).
pub fn check(src: &str, dialect: Option<&Dialect>) -> Vec<Diagnostic> {
    match dialect {
        Some(d) => transpile(src, d).diagnostics,
        None => nuclear_syntax::parse(src).diagnostics,
    }
}
