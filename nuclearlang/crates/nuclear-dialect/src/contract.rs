//! The dialect contract: every template the transpiler renders, the variables it passes, and every
//! option and section a dialect file can use. `nuclear spec` prints this table for agents, and the
//! loader uses it to validate dialect files.

pub struct TemplateSpec {
    pub key: &'static str,
    pub vars: &'static [&'static str],
    pub doc: &'static str,
}

const fn t(key: &'static str, vars: &'static [&'static str], doc: &'static str) -> TemplateSpec {
    TemplateSpec { key, vars, doc }
}

/// `[syntax]`: how each construct of the base language is written in the target language.
/// A target dialect (one that does not extend another) must define all of them.
pub const SYNTAX: &[TemplateSpec] = &[
    // imports
    t(
        "import_names",
        &["module", "names", "clauses"],
        "`use fs/promises{ readFile }` and auto-imports of named symbols",
    ),
    t("import_alias", &["module", "alias", "clauses"], "`use lib/lib as x`, `use * as x from lib`"),
    t(
        "import_default",
        &["module", "default_name", "names", "clauses"],
        "`use express`; also auto-imports when import_names is not defined (whole-library imports)",
    ),
    t("import_file", &["path", "clauses"], "`use \"./setup\"` (a project file)"),
    t(
        "type_imports",
        &["imports"],
        "the imports for the type checker only of a kind with `type_imports` (two entities that refer to each other); optional",
    ),
    t(
        "project_import",
        &["project", "package", "path", "relative"],
        "optional: import of another file of the project (path without extension, relative to the project root; `package`: the folder the project's files go to, as a module)",
    ),
    t(
        "local_import",
        &["import"],
        "optional: an import written at the start of the block that uses it, for a project with `lazy_imports` (`import`: the line the top-level templates give); without it every import stays at the top (ADR-lang-0012)",
    ),
    t("module_path", &["path"], "turns a `use` path that is not a shortcut into the target's module string"),
    t("file_path", &["path"], "turns a `use \"./file\"` path into the target's path"),
    // declarations
    t("export", &[], "prefix for top-level declarations (`export ` in TypeScript); passed as {{export}}"),
    t(
        "class",
        &[
            "name",
            "generics",
            "extends",
            "implements",
            "clauses",
            "clause",
            "modifiers",
            "decorators",
            "export",
            "members",
            "abstract", "doc"],
        "module with code (fields with values, methods with bodies, constructor)",
    ),
    t(
        "interface",
        &["name", "generics", "extends", "members", "decorators", "export", "doc"],
        "module with only attributes and signatures",
    ),
    t("interface_field", &["name", "type", "optional"], "attribute of an interface"),
    t("interface_method", &["name", "generics", "params", "ret", "async"], "signature inside an interface"),
    t(
        "enum",
        &["name", "items", "export", "values", "value_type", "items_list"],
        "enum; items are already rendered with enum_item and joined with \",\\n\" (items_list: the same, one per item)",
    ),
    t("enum_item", &["name", "value"], "`user` or `admin(\"administrator\")`"),
    t(
        "function",
        &[
            "name",
            "generics",
            "params",
            "params_list",
            "ret",
            "ret_info",
            "async",
            "generator",
            "body",
            "export",
            "decorators",
            "decor",
            "deco_args", "doc", "public_names"],
        "top-level function; public_names = `renamed_params` rendered when a parameter was renamed (empty otherwise); generator = the body uses yield. Structured data for code generation: decor (decorator name → {arg, args, items, <named>}), deco_args (named arguments of every decorator), params_list (each with name, local, type, tinfo, decor, decorated; local = the variable the body reads, renamed where name would hide a function of the target), ret_info (type, list, item, model, primitive, result, err, void, is.<name>)",
    ),
    t(
        "method",
        &[
            "name",
            "generics",
            "params",
            "ret",
            "async",
            "generator",
            "body",
            "decorators",
            "modifiers",
            "mods",
            "override",
            "override_interface",
            "owner",
            "params_list",
            "ret_info",
            "decor",
            "deco_args", "doc", "public_names"],
        "method with a body; owner = name of the class; params_list, ret_info, decor, deco_args, public_names as in function; `mods.<word>` is true for each header word (`{{#mods.get}}`); override = replaces a member of an extended class, override_interface = implements a member of an interface",
    ),
    t(
        "method_signature",
        &[
            "name",
            "generics",
            "params",
            "ret",
            "async",
            "modifiers",
            "mods",
            "abstract",
            "decorators",
            "override",
            "override_interface",
            "owner",
            "params_list",
            "ret_info",
            "decor",
            "deco_args", "doc"],
        "method without a body inside a class; `mods`, owner, params_list, ret_info, decor, deco_args as in method",
    ),
    t(
        "field",
        &["name", "type", "default", "optional", "modifiers", "decorators", "uninitialized", "override", "decor", "in_init", "tinfo", "decorated", "static"],
        "attribute of a class; uninitialized = no value, not optional and not set by the constructor; override = it replaces a member of a base",
    ),
    t(
        "constructor",
        &["class_name", "params", "body", "initializer"],
        "constructor; initializer = the leading super(...) call when options.super_in_initializer",
    ),
    t(
        "super_param",
        &["name", "type", "default", "optional", "named", "required", "decorators"],
        "optional: a constructor parameter passed as is to super(...) (Dart: `super.name`)",
    ),
    t("file_prelude", &[], "optional: the first lines of every generated file, before the imports (Python: `from __future__ import annotations`)"),
    t(
        "field_init",
        &["name", "value"],
        "optional (options.init_fields): one line of the constructor that sets a field (Python: `self.name = value`)",
    ),
    t("super_ctor", &["args"], "optional: `super(args)` in a constructor, when the target writes it otherwise (Python: `super().__init__(args)`)"),
    t(
        "local_function",
        &["name", "params", "body", "async"],
        "optional (options.hoist_block_lambdas): the local function a lambda with a block becomes",
    ),
    t(
        "super_call",
        &[],
        "optional: first line of the constructor of a class that extends another, when the body does not call super(...) (TS: `super();`)",
    ),
    t(
        "ctor_param",
        &["name", "type", "default", "optional", "named", "required", "decorators"],
        "constructor parameter (it is also a field)",
    ),
    t(
        "param",
        &["name", "type", "default", "optional", "named", "required", "decorators"],
        "parameter of a function, method or lambda",
    ),
    t("params_optional_group", &["params"], "optional: wraps trailing optional positional parameters (Dart `[...]`)"),
    t("params_named_group", &["params"], "optional: wraps parameters written inside `{ }` (Dart `{...}`)"),
    t(
        "decorator",
        &["name", "args", "has_args", "pascal"],
        "`@Get(\":id\")`, `@override`; has_args is true when the decorator has parentheses, pascal when its name starts with an uppercase letter (a class)",
    ),
    t("generics", &["names"], "`<T, U>`; names are already rendered with generic_param"),
    t("generic_param", &["name", "bound"], "one generic: `T` or `T: Comparable` (bound)"),
    t("main", &["body"], "entry point that receives top-level statements when options.toplevel_statements = \"main\""),
    t("comment", &["text"], "one line of a comment"),
    t(
        "doc_comment",
        &[
            "summary",
            "params",
            "returns",
            "throws",
            "examples",
            "see",
            "deprecated",
            "deprecated_text",
            "deprecated_literal",
            "since",
            "other",
            "has_tags",
            "one_line",
        ],
        "optional: the doc comment of a declaration (base §2.3). summary, throws and see are lists of lines; params = [{name, text}]; examples = [{caption, lines}]; other = [{tag, text}]; deprecated_literal: the reason as a string literal of the target; has_tags: there is a summary and at least one tag; one_line: only one summary line. Without it a doc comment is written with `comment`",
    ),
    // statements
    t("const_decl", &["name", "type", "value"], "variable that is never reassigned"),
    t("toplevel_const_decl", &["name", "type", "value"], "optional: a constant at the top of a file, which the other files of a project import (`const_decl` when absent; TypeScript: `export const`)"),
    t("let_decl", &["name", "type", "value"], "variable that is reassigned later"),
    t(
        "declare",
        &["name", "type"],
        "variable declared before a block because it is assigned inside the block and used after it",
    ),
    t("assign", &["target", "op", "value"], "assignment; op is =, +=, -=, *=, /= or ??="),
    t(
        "pattern_assign",
        &["target", "value"],
        "destructuring into existing variables: `[a, b] = [b, a]`; a declaration uses const_decl/let_decl with the pattern as name",
    ),
    t("pattern_ignore", &[], "`_` inside a list pattern"),
    t("expr_stmt", &["expr"], "expression used as a statement"),
    t("return", &["value"], "return (value may be empty)"),
    t("if", &["cond", "body"], "if"),
    t("else_if", &["cond", "body"], "appended after if"),
    t("else", &["body"], "appended after if / else_if"),
    t("for_in", &["var", "iter", "body"], "`for x in xs`"),
    t("for_range", &["var", "start", "end", "body"], "`for i in 0..10` (end excluded)"),
    t("for_entries", &["key", "value", "iter", "iter_member", "body", "map"], "`for key, value in map` (`map`: the value is a Map object, not a map literal; `iter_member`: the map with parentheses when a member follows it)"),
    t("while", &["cond", "body"], "while"),
    t("try", &["body", "catch", "catch_var", "catch_used", "catch_body", "finally", "finally_body"], "try / catch / finally"),
    t("throw", &["value"], "throw"),
    t("break", &[], "break"),
    t("yield", &["value"], "`yield value` in a generator"),
    t("yield_all", &["value"], "`yield ...values`: every value of another generator"),
    t("continue", &[], "continue"),
    // expressions
    t("self_member", &["name"], "access to a module member: `this.name`"),
    t("this", &[], "`this`"),
    t("super", &[], "`super`"),
    t("null", &[], "`null`"),
    t("true", &[], "`true`"),
    t("false", &[], "`false`"),
    t("list", &["items"], "`[1, 2, 3]`"),
    t("list_if", &["cond", "value"], "`if cond value` inside a list"),
    t(
        "list_if_slot",
        &["cond", "value"],
        "optional: `if cond value` in a list given to a named argument of `[options] slot_lists`: the item keeps its place (a UI library's children)",
    ),
    t(
        "cascade",
        &["target", "sections"],
        "an object followed by `..member = value` lines; sections is a list, each rendered from cascade_self",
    ),
    t("cascade_self", &[], "the object inside a cascade section (empty in Dart: `..color`)"),
    t("object", &["entries"], "`{ a: 1 }` / `{\"k\": v}`; entries is empty for `{}`"),
    t("object_entry", &["key", "value"], "one entry; key is already rendered"),
    t("object_key_ident", &["key"], "key written as a name: `role`"),
    t("object_key_string", &["key"], "key written as a string: `\"julian\"` (key holds the raw text)"),
    t("object_shorthand", &["key"], "`{ text }`"),
    t("object_spread", &["expr"], "`{ ...base }`"),
    t("call", &["callee", "args"], "function call"),
    t("construct", &["callee", "args"], "call of a PascalCase name: builds an object"),
    t("named_arg", &["name", "value"], "`name = value` in a call when options.named_args = \"native\""),
    t("spread_arg", &["expr"], "`...list` in a call"),
    t("member", &["object", "name"], "`a.b`"),
    t("optional_member", &["object", "name"], "`a?.b`"),
    t("default_init", &["name", "value"], "optional: the first line of a function whose parameter defaults to a list or a map; the parameter is then nullable (Python: a default is made once; Dart: it must be const)"),
    t("map_compound", &["object", "key", "op", "value"], "optional: `m[k] += v` on a map whose read is nullable (Dart: `m.update(k, (v) => v + 1)`)"),
    t("global_decl", &["names"], "optional: the first line of a function that assigns variables of its file (Python: `global counter`)"),
    t("nonlocal_decl", &["names"], "optional: the first line of a block lambda that assigns variables of the function around it (Python: `nonlocal count`)"),
    t("optional_member_once", &["object", "name"], "optional: `a?.b` where `a` is not a name (a call), for a target whose optional_member writes the object twice"),
    t("method_ref", &["object", "name"], "optional: a method of an object of the program given as a value (`dice.roll`), for a target whose methods forget their object (TypeScript: `dice.roll.bind(dice)`)"),
    t("object_any", &["entries"], "optional: a map literal inside a value declared `any`, for a target that would type it by what it holds (Dart: `<String, dynamic>{...}`)"),
    t("list_any", &["items"], "optional: the same for a list literal (Dart: `<dynamic>[...]`)"),
    t("show_any", &["expr"], "optional: a value declared `any` in print or an interpolated text, where the target writes a boolean or a missing value another way (Python)"),
    t("map_sure", &["object", "index"], "optional: `m[k]!` of a map whose values are never null, as the target's read that fails when the key is absent (Python: `m[k]`)"),
    t("map_get_or", &["object", "index", "default"], "optional: `m[k] ?? d` of such a map with a literal or a name as the default (Python: `m.get(k, d)`)"),
    t("show_double", &["expr"], "optional: a decimal in print or an interpolated text, where the target writes `2.0` as `2` (TypeScript)"),
    t("show_double_nullable", &["expr"], "optional: the same for a decimal that may be missing (`double?`): its text, or null"),
    t("bigint_literal", &["value", "small"], "a whole literal where a `bigint` goes (`x: bigint = 5`, `big + 1`): `value` is its exact decimal text (`-5`, `12345678901234567890`), `small` whether it is within ±(2^53 − 1); with a `helper`, it is written also wherever the type `bigint` is"),
    t("bigdouble_literal", &["value"], "a literal where a `bigdouble` goes (`x: bigdouble = 0.1`): `value` is its exact text (`0.1`, `-2`, `1.5e-3`), never a binary number; with a `helper` (a runtime of the exact decimal), it is written also wherever the type `bigdouble` is"),
    t("show_bigint", &["expr"], "optional: a `bigint` in print or an interpolated text, where the target's text of it is not its digits (TypeScript writes `5n`)"),
    t("show_bigint_nullable", &["expr"], "optional: the same for a `bigint?`: its digits, or null"),
    t("show_bigdouble", &["expr"], "optional: a `bigdouble` in print or an interpolated text: the shortest exact text with at least one decimal (`0.3`, `2.0`)"),
    t("show_bigdouble_nullable", &["expr"], "optional: the same for a `bigdouble?`: its text, or null"),
    t("show_nullable", &["expr"], "optional: a value that may be missing in print or an interpolated text, where the target writes it as other than null (TypeScript's `undefined`)"),
    t("show_bool", &["expr"], "optional: a boolean in an interpolated text, where the target writes it as other than `true` / `false` (Python's `True`)"),
    t("renamed_params", &["renamed"], "optional: written into `public_names` of a function or method whose parameters were renamed because they would hide a function of the target; `renamed` is a list of `{ name, local }` (Python: a decorator that shows `list_` as `list` to whoever reads the signature); usually a `{ template, helper }`"),
    t("bound_param", &["name", "type"], "optional: a name of the loop around a lambda, bound when the lambda is made, for a target that binds a closure late (Python: `i=i`, `i: int = i`)"),
    t("optional_chain", &["value", "conds"], "optional: a chain after a `?.` where `?.` is not native: `value` is the chain without `?.`, `conds` its receivers' `optional_cond` joined with `and` (Python)"),
    t("optional_cond", &["object"], "optional: one receiver of `optional_chain` is not null"),
    t("index", &["object", "index", "map"], "`a[i]`; `map`: the object is a map (`m[k]`, null when absent)"),
    t("await", &["expr"], "`~call()`"),
    t("ternary", &["cond", "then", "else"], "`c ? a : b`"),
    t("is", &["expr", "type", "t"], "`x is User` (`t`: the type's info, as `tinfo`)"),
    t("cast", &["expr", "type"], "`value as Type`"),
    t("non_null", &["expr"], "`value!`: the value is not null"),
    t("lambda", &["params", "names", "body", "async"], "lambda with a block (names: the parameters without types)"),
    t("lambda_expr", &["params", "names", "expr", "async"], "lambda whose body is one expression (names: the parameters without types)"),
    // the monitor (`--monitor`, spec 015): both optional; a dialect without them builds without measuring
    t(
        "monitor_body",
        &["body", "label", "path", "line", "async"],
        "optional: the body of a function or method measured by the monitor (label: `Owner.name` or `name`; path: the `.nuc` file; line: its line)",
    ),
    t(
        "monitor_runtime",
        &["app", "url"],
        "optional: the monitor's runtime `NuclearMonitor`, written once to `nuclear/monitor` of a project built with `--monitor` (url: the collector a browser's or a phone's app posts its report to; empty: none)",
    ),
    t(
        "monitor_runtime_web",
        &["app", "url"],
        "optional: the part of the monitor's runtime a browser runs, written beside it to `nuclear/monitor_web`",
    ),
    // Result<T, E> (all optional: a dialect without them cannot transpile code that uses Result)
    t(
        "result_runtime",
        &[],
        "optional: the Result type with Ok and Err, written once after the imports of a file that uses it",
    ),
    t("result_ok", &["value"], "optional: `Ok(value)`; value is empty for `Ok()`"),
    t("result_err", &["value"], "optional: `Err(error)`"),
    t("result_is_ok", &["result", "ok", "err"], "optional: test of a match on a Result: `result.isOk`"),
    t("result_is_err", &["result", "ok", "err"], "optional: test of a match whose first arm is Err: `result.isErr`"),
    t("result_value", &["result", "ok", "err"], "optional: the value of a Result that is Ok: `result.value`"),
    t("result_error", &["result", "ok", "err"], "optional: the error of a Result that is Err: `result.error`"),
    t(
        "result_propagate",
        &["result", "ok", "err"],
        "optional: returns the error of `result` from the current function when it is Err (automatic propagation)",
    ),
    t("result_then", &["target", "callback"], "optional: `.ok(cb)` where cb returns Ok/Err: transforms the Ok branch"),
    t("result_tap", &["target", "callback"], "optional: `.ok(cb)` where cb only observes the value"),
    t(
        "result_recover",
        &["target", "callback"],
        "optional: `.error(cb)` where cb returns Ok/Err: recovers or changes the error",
    ),
    t("result_tap_error", &["target", "callback"], "optional: `.error(cb)` where cb only observes the error"),
    t("result_map", &["target", "callback"], "optional: `.ok(cb)` where cb returns a value: the Ok value becomes it"),
    t(
        "result_get_or_else",
        &["target", "callback"],
        "optional: `.error(cb)` where cb returns a value: the error is recovered and the expression is a plain value",
    ),
];

/// `[types]`: base type names and type constructors. A missing simple name is written as is.
pub const TYPES: &[TemplateSpec] = &[
    t("string", &[], "string"),
    t("int", &[], "int"),
    t("double", &[], "double"),
    t("number", &[], "number"),
    t("boolean", &[], "boolean"),
    t("bool", &[], "bool"),
    t("void", &[], "void"),
    t("any", &[], "any"),
    t("dynamic", &[], "dynamic"),
    t("unknown", &[], "type used when a parameter has no type and none can be inferred"),
    t("list", &["item", "item_group"], "`User[]` (`item_group`: the element in parentheses when it is several types: `(number | null)[]`)"),
    t("map", &["key", "value"], "`<string, User>`"),
    t("nullable", &["type"], "`string?`"),
    t("union", &["types"], "`'a' | 'b'`; types is a list (use join). Identical members are merged first"),
    t("string_literal", &["value"], "`'user'` as a type"),
    t("number_literal", &["value"], "`42` as a type"),
    t("function", &["params", "types", "ret"], "`(a: int) => int`"),
    t("generic", &["name", "args"], "`Promise<string>`"),
    t("async", &["type"], "return type of an async function: `Promise<T>`, `Future<T>`"),
    t("generator", &["type"], "return type of a generator; type is the type of each value: `Iterable<T>`"),
    t("async_generator", &["type"], "return type of an async generator: `Stream<T>`"),
];

/// `[operators]`: a symbol (`"&&"`) or a template with `{{left}}`/`{{right}}` (unary: `{{expr}}`).
pub const OPERATORS: &[TemplateSpec] = &[
    t("and", &["left", "right"], "and"),
    t("or", &["left", "right"], "or"),
    t("not", &["expr"], "not (unary)"),
    t("neg", &["expr"], "- (unary)"),
    t("eq", &["left", "right", "left_infix", "right_infix", "null"], "=="),
    t("not_eq", &["left", "right", "left_infix", "right_infix", "null"], "!="),
    t("lt", &["left", "right"], "<"),
    t("gt", &["left", "right"], ">"),
    t("lt_eq", &["left", "right"], "<="),
    t("gt_eq", &["left", "right"], ">="),
    t("add", &["left", "right"], "+"),
    t("sub", &["left", "right"], "-"),
    t("mul", &["left", "right"], "*"),
    t("div", &["left", "right"], "/"),
    t("rem", &["left", "right"], "%"),
    t("int_div", &["left", "right", "left_arg", "right_arg", "int", "double"], "`~/` (integer division)"),
    t("pow", &["left", "right", "left_arg", "right_arg", "int", "double"], "`**` (power; `int`: both operands are integers, `double`: one is a decimal)"),
    t("bit_and", &["left", "right"], "&"),
    t("bit_or", &["left", "right"], "|"),
    t("bit_xor", &["left", "right"], "^"),
    t("bit_not", &["expr"], "`^x` (bitwise complement, unary)"),
    t("shl", &["left", "right"], "<<"),
    t("shr", &["left", "right"], ">>"),
    t("ushr", &["left", "right"], ">>> (unsigned shift)"),
    t("coalesce", &["left", "right"], "??"),
    t(
        "coalesce_once",
        &["left", "right", "left_arg", "right_arg"],
        "`??` whose left side is not a plain name or member chain (a call, a map read): optional, for a target whose `coalesce` writes the left side twice (Python); usually a `{ template, helper }`",
    ),
    t(
        "eq_deep",
        &["left", "right", "left_arg", "right_arg"],
        "`==` of two lists, maps or sets: optional, for a target whose `==` compares the objects (TypeScript, Dart); usually a `{ template, helper }`",
    ),
    t("not_eq_deep", &["left", "right", "left_arg", "right_arg"], "`!=` of two lists, maps or sets: optional, as `eq_deep`"),
    t("bigint_int_div", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `~/` of two `bigint`, where the plain operator is not it"),
    t("bigint_rem", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `%` of two `bigint`: the remainder of `~/` (the dividend's sign), where the plain operator is not it"),
    t("bigint_pow", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `bigint ** int` (a negative exponent is an error), where the plain operator is not it"),
    t("bigdouble_add", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `+` of two `bigdouble`, where the plain operator is not it"),
    t("bigdouble_sub", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `-` of two `bigdouble`, where the plain operator is not it"),
    t("bigdouble_mul", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `*` of two `bigdouble`, where the plain operator is not it"),
    t("bigdouble_div", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `/` of two `bigdouble`: rounded half away from zero to max(20, the decimals of each) decimals, where the plain operator is not it"),
    t("bigdouble_rem", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `%` of two `bigdouble`: the remainder of `~/` (the dividend's sign), where the plain operator is not it"),
    t("bigdouble_int_div", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `~/` of two `bigdouble`: a `bigint`, toward zero, where the plain operator is not it"),
    t("bigdouble_pow", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `bigdouble ** int` (a negative exponent is an error), where the plain operator is not it"),
    t("bigdouble_eq", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `==` of two `bigdouble`, where the plain operator is not it"),
    t("bigdouble_not_eq", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `!=` of two `bigdouble`, where the plain operator is not it"),
    t("bigdouble_lt", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `<` of two `bigdouble`, where the plain operator is not it"),
    t("bigdouble_gt", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `>` of two `bigdouble`, where the plain operator is not it"),
    t("bigdouble_lt_eq", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `<=` of two `bigdouble`, where the plain operator is not it"),
    t("bigdouble_gt_eq", &["left", "right", "left_arg", "right_arg", "left_infix", "right_infix"], "optional: `>=` of two `bigdouble`, where the plain operator is not it"),
    t("bigdouble_eq_deep", &["left", "right", "left_arg", "right_arg"], "optional: `==` of two lists or maps that hold `bigdouble`, where `eq_deep` compares the decimals as objects"),
    t("bigdouble_not_eq_deep", &["left", "right", "left_arg", "right_arg"], "optional: `!=` of the same, as `bigdouble_eq_deep`"),
    t("bigdouble_in", &["left", "right", "left_arg", "right_arg"], "optional: `x in xs` of a list of `bigdouble`, where the plain `in` compares the decimals as objects"),
    t("bigint_neg", &["expr"], "optional: `-x` of a `bigint`, where the plain `neg` is not it"),
    t("bigdouble_neg", &["expr"], "optional: `-x` of a `bigdouble`, where the plain `neg` is not it"),
    t("in", &["left", "right", "map", "set", "object"], "`x in list`; `map`: the right side is a Map object, `set`: a Set, `object`: a map literal or `<K, V>` (`key in map`)"),
    t("range", &["left", "right"], "`a..b` used as a value (end excluded)"),
];

/// Variables of a `[kinds.<word>]` template.
pub const KIND_VARS: &[&str] = &[
    "name",
    "source_name",
    "class_name",
    "members",
    "body",
    "methods_code",
    "fields_required",
    "fields",
    "methods",
    "params",
    "params_list",
    "ctor",
    "extends",
    "implements",
    "clauses",
    "clause",
    "decorators",
    "export",
    "modifiers",
    "generics",
    "generic_list",
    "decor",
    "deco_args",
    "file",
    "project",
    "kind",
    "component", "doc", "field_decor",
    // the `[plugin] values` of the package whose source the declaration is (ADR-platform-0017)
    "package",
];

pub struct OptionSpec {
    pub key: &'static str,
    pub kind: &'static str,
    pub default: &'static str,
    pub doc: &'static str,
}

const fn o(key: &'static str, kind: &'static str, default: &'static str, doc: &'static str) -> OptionSpec {
    OptionSpec { key, kind, default, doc }
}

pub const OPTIONS: &[OptionSpec] = &[
    o("implicit_self", "bool", "false", "members can be used without `this.` in the target (Dart)"),
    o(
        "named_args",
        "\"object\" | \"native\"",
        "\"object\"",
        "named arguments to external calls: grouped in one object (TS) or kept as named arguments (Dart)",
    ),
    o("declare_ctor_fields", "bool", "false", "constructor parameters need their own field declaration (Dart)"),
    o("const_collection_defaults", "bool", "false", "list/map defaults of parameters are written as const (Dart)"),
    o("optional_params_nullable", "bool", "false", "`name?: T` parameters get a nullable type (Dart)"),
    o("number_separators", "bool", "true", "the target accepts 1_000"),
    o("binary_literals", "bool", "true", "the target accepts 0b1010 (false: written in hexadecimal)"),
    o("map_patterns", "bool", "true", "the target destructures a map in one statement (false: one line per name, each reading its key)"),
    o("int_member_parens", "bool", "false", "a member of an integer literal needs parentheses: (5).toString()"),
    o("decimal_literals", "bool", "false", "integers and decimals are different values: an integer literal given for a `double` is written as a decimal (3 → 3.0)"),
    o("doc_in_text", "bool", "false", "a doc comment is written inside a text of the target (a docstring): its backslashes and triple quotes are escaped"),
    o("string_quote", "string", "\"'\"", "quote for strings without interpolation"),
    o("interp_quote", "string", "\"`\"", "quote for strings with interpolation"),
    o("interp_open", "string", "\"${\"", "opens an interpolation"),
    o("interp_close", "string", "\"}\"", "closes an interpolation"),
    o(
        "dollar_escape",
        "\"always\" | \"before_brace\" | \"never\"",
        "\"before_brace\"",
        "how a literal $ is escaped inside strings",
    ),
    o(
        "reserved_escape",
        "\"suffix\" | \"prefix\"",
        "\"suffix\"",
        "renames names that are reserved in the target: name_ or _name",
    ),
    o("interp_prefix", "string", "\"\"", "written before the quote of a string with interpolation (Python: f)"),
    o("interp_brace_escape", "bool", "false", "`{` and `}` of the text of an interpolated string are doubled (Python f-strings)"),
    o("module_separator", "string", "\"/\"", "separator of the parts of a module or project path (Python: .)"),
    o("toplevel_gap", "integer", "1", "blank lines between top-level declarations (Python, PEP 8: 2)"),
    o(
        "hoist_block_lambdas",
        "bool",
        "false",
        "a lambda with a block becomes a local function declared before the statement (`local_function`): the target's lambdas are one expression (Python)",
    ),
    o(
        "init_fields",
        "bool",
        "false",
        "fields with a default and constructor parameters are assigned in the constructor (`field_init`); the `field` template gets in_init (Python)",
    ),
    o("type_args_as_args", "bool | string[]", "false", "the type arguments of a call are its first arguments: inject<Repo>() → inject(Repo); true for every call (Python) or the names of the functions (TypeScript: [\"inject\"])"),
    o(
        "builtin_result",
        "bool",
        "true",
        "false: the parent's result_runtime is not written; Result, Ok and Err come from the dialect's auto_imports (a framework runtime)",
    ),
    o(
        "doc_inside",
        "bool",
        "false",
        "the doc comment of a function, method or class goes inside it: its template gets `doc` (Python docstrings)",
    ),
    o(
        "snake_case_names",
        "bool",
        "false",
        "the camelCase names of the .nuc are written in snake_case (getOne → get_one); names that exist as they are in the type definitions are kept (Python)",
    ),
    o(
        "route_param",
        "string",
        "\"{name}\"",
        "how a path parameter is written in `decor.<decorator>.path`, the first text argument of a decorator with its `{x}` segments rewritten (`name` stands for the parameter): \":name\" for NestJS or Express",
    ),
    o(
        "slot_lists",
        "array",
        "[]",
        "named arguments whose list keeps each item's place (`children` of a UI library): `if c x` in it is `list_if_slot`, never a spread",
    ),
    o("max_bases", "integer", "1", "how many bases (`: A, B`) a class can extend; 0 = unlimited"),
    o("catch_var", "string", "\"error\"", "variable name for `catch` without a name"),
    o(
        "toplevel_statements",
        "\"allow\" | \"main\"",
        "\"allow\"",
        "where top-level statements go: in place, or inside the `main` template",
    ),
    o("line_width", "integer", "80", "calls, lists and objects longer than this are split one item per line"),
    o("trailing_comma", "bool", "true", "add a comma after the last item of a split call, list or object"),
    o(
        "omit_null_default",
        "bool",
        "false",
        "`= null` defaults of fields and parameters are left out (Dart: null is already the default)",
    ),
    o(
        "interp_bare_names",
        "bool",
        "false",
        "an interpolated plain name is written `$name` instead of `${name}` (Dart)",
    ),
    o(
        "implicit_base",
        "string",
        "\"\"",
        "class every class extends in the target (Dart: Object); with [dialect] defs, overriding its members (toString) is marked",
    ),
    o(
        "super_call_last",
        "array",
        "[]",
        "methods whose override calls the overridden one last (teardown: dispose, close); every other method the type definitions mark must_call_super calls it first",
    ),
    o(
        "super_in_initializer",
        "bool",
        "false",
        "a `super(...)` at the start of a constructor body goes to the initializer list (Dart: `User(this.a) : super(a)`)",
    ),
    o(
        "cascade_statements",
        "bool",
        "false",
        "`x = T()` + `..` lines is written as the declaration and one statement per line (targets without cascades)",
    ),
];

pub fn syntax_spec(key: &str) -> Option<&'static TemplateSpec> {
    SYNTAX.iter().find(|s| s.key == key)
}

/// The full contract as Markdown (for `nuclear spec` and agents).
pub fn markdown() -> String {
    let mut out = String::new();
    let table = |out: &mut String, title: &str, specs: &[TemplateSpec]| {
        out.push_str(&format!("### {title}\n\n| key | variables | what it renders |\n|---|---|---|\n"));
        for s in specs {
            let vars = if s.vars.is_empty() {
                "—".to_string()
            } else {
                s.vars.iter().map(|v| format!("`{v}`")).collect::<Vec<_>>().join(" ")
            };
            out.push_str(&format!("| `{}` | {} | {} |\n", s.key, vars, s.doc.replace('|', "\\|")));
        }
        out.push('\n');
    };
    table(&mut out, "[syntax]", SYNTAX);
    table(&mut out, "[types]", TYPES);
    table(&mut out, "[operators]", OPERATORS);
    out.push_str("### [kinds.<word>] template variables\n\n");
    out.push_str(&KIND_VARS.iter().map(|v| format!("`{v}`")).collect::<Vec<_>>().join(" "));
    out.push_str("\n\n### [library.<base>] (`nuclear help library`)\n\nOne template per member, as the target writes it; variables: ");
    out.push_str(&crate::library::VARS.iter().map(|v| format!("`{v}`")).collect::<Vec<_>>().join(" "));
    out.push_str(". A member with `helper = \"...\"` gets that function written once per file.\n\n| base | members |\n|---|---|\n");
    for base in crate::library::BASES.iter().chain(crate::library::OBJECTS) {
        let members: Vec<String> = crate::library::MEMBERS
            .iter()
            .filter(|m| m.base == *base)
            .map(|m| if m.property { format!("`{}`", m.name) } else { format!("`{}()`", m.name) })
            .collect();
        out.push_str(&format!("| `{base}` | {} |\n", members.join(" ")));
    }
    out.push_str("\n\n### [options]\n\n| key | type | default | meaning |\n|---|---|---|---|\n");
    for o in OPTIONS {
        out.push_str(&format!("| `{}` | {} | `{}` | {} |\n", o.key, o.kind.replace('|', "\\|"), o.default, o.doc));
    }
    out
}
