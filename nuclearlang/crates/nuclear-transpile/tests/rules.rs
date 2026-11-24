//! One test per rule of nuclearlang/docs/07-reference/nuclear-base.md and nuclearlang/docs/07-reference/dialects.md, using the dialects in dialects/.

use nuclear_dialect::{Dialect, Loader};

fn dialect(name: &str) -> Dialect {
    let loader = Loader::of(Vec::new(), &[nuclear_dialect::Home::tree()]);
    let (d, report) = loader.load(name);
    d.unwrap_or_else(|| panic!("{name}: {:#?}", report.diags))
}

fn ts(src: &str) -> String {
    build(src, "typescript")
}

fn build(src: &str, d: &str) -> String {
    let out = nuclear_transpile::transpile(src, &dialect(d));
    let errors: Vec<_> = out.diagnostics.iter().filter(|x| x.is_error()).collect();
    assert!(errors.is_empty(), "{src}\n{errors:#?}");
    out.code
}

fn codes(src: &str, d: &str) -> Vec<&'static str> {
    nuclear_transpile::transpile(src, &dialect(d)).diagnostics.iter().map(|x| x.code.id).collect()
}

fn has(code: &str, needle: &str) {
    assert!(code.contains(needle), "expected:\n{needle}\n--- in ---\n{code}");
}

#[test]
fn const_or_let_depends_on_reassignment() {
    let code = ts("run()\n  a = 1\n  b = 2\n  b = b + a\n  b\n");
    has(&code, "const a = 1;");
    has(&code, "let b = 2;");
    has(&code, "b = b + a;");
}

#[test]
fn implicit_return_and_void() {
    let code = ts("twice(x: int) int\n  x * 2\nlog(m: string) void\n  print(m)\n");
    has(&code, "return x * 2;");
    has(&code, "console.log(m);\n}");
    assert!(!code.contains("return console.log"));
}

#[test]
fn last_assignment_is_returned() {
    has(&ts("sum(a: int, b: int)\n  total = a + b\n"), "const total = a + b;\n  return total;");
}

#[test]
fn async_is_inferred_from_tilde() {
    let code = ts("load(url: string) string\n  res = ~fetch(url)\n  ~res.text()\n");
    has(&code, "export async function load(url: string): Promise<string> {");
    has(&code, "const res = await fetch(url);");
    has(&code, "return await res.text();");
}

#[test]
fn tilde_in_declaration_forces_async() {
    has(&ts("~hello(name: string) string\n  \"hi ${name}\"\n"), "async function hello(name: string): Promise<string>");
}

#[test]
fn members_get_this_and_dollar_is_explicit() {
    let code = ts(
        "Counter\n  count: int = 0\n  add(count: int) void\n    $count = $count + count\n  inc() void\n    count += 1\n",
    );
    has(&code, "this.count = this.count + count;");
    has(&code, "this.count += 1;");
}

#[test]
fn dart_members_need_no_this() {
    let code = build("Counter\n  count: int = 0\n  inc() void\n    count += 1\n", "dart");
    has(&code, "count += 1;");
}

#[test]
fn pascal_case_call_constructs() {
    let code = ts("make() User\n  User(\"Ana\")\n");
    has(&code, "return new User('Ana');");
    // `String(x)` is the target's conversion, not a class: Nuclear writes `x.toString()` (N0114)
    assert!(codes("n(x: string) string\n  String(x)\n", "typescript").contains(&"N0114"));
}

#[test]
fn named_args_reorder_for_nuclear_functions() {
    let code = ts(
        "greet(name: string, polite: boolean = false) string\n  name\nrun()\n  greet(polite = true, name = \"Ana\")\n",
    );
    has(&code, "greet('Ana', true)");
}

#[test]
fn named_args_to_external_functions() {
    has(&ts("run(url: string)\n  fetch(url, method = \"POST\")\n"), "fetch(url, { method: 'POST' })");
    has(&build("run(s: TextStyle) void\n  Text(\"hi\", style = s)\n", "flutter"), "Text('hi', style: s)");
}

#[test]
fn interface_is_inferred_from_signatures_only() {
    let code = ts(
        "Shape\n  name: string\n  area() double\nSquare > Shape\n  name: string = \"square\"\n  (side: double)\n  area() double\n    side * side\n",
    );
    has(&code, "export interface Shape {\n  name: string;\n  area(): number;\n}");
    has(&code, "export class Square implements Shape {");
}

#[test]
fn base_that_is_an_interface_goes_to_implements() {
    has(&ts("Shape\n  area() double\nCircle: Shape\n  area() double\n    1.0\n"), "class Circle implements Shape");
}

#[test]
fn single_base_only() {
    assert!(codes("A\n  x: int = 1\nB\n  y: int = 1\nC: A, B\n  z: int = 1\n", "typescript").contains(&"N0208"));
}

#[test]
fn enums() {
    let code = ts("Role\n  user\n  admin(\"administrator\")\n");
    has(&code, "export enum Role {\n  user = 'user',\n  admin = 'administrator'\n}");
}

#[test]
fn undefined_names_are_errors() {
    // no inferred parameters: `page` is not declared anywhere
    let src = "Repo\n  get(name: string, page: int) string\n    name\nUseCase\n  list(name: string) string\n    Repo().get(name, page)\n";
    assert!(codes(src, "typescript").contains(&"N0106"));
    // a typo suggests the closest name
    let out = nuclear_transpile::transpile("f(total: int) int\n  totl + 1\n", &dialect("typescript"));
    assert!(
        out.diagnostics.iter().any(|d| d.code.id == "N0106" && d.message.contains("did you mean 'total'")),
        "{:#?}",
        out.diagnostics
    );
    // names this file cannot see: a whole-module `use`, or a base declared elsewhere
    assert!(!codes("use lib1/lib1\nf() int\n  helper()\n", "dart").contains(&"N0106"));
    assert!(!codes("Painter: ThirdPartyPainter\n  run() void\n    inheritedThing()\n", "flutter").contains(&"N0106"));
    // a base in the dialect's type definitions is known: its members exist, other names do not
    assert!(codes("Painter: CustomPainter\n  run() void\n    inheritedThing()\n", "flutter").contains(&"N0106"));
    assert!(codes("Painter: CustomPainter\n  run() void\n    addListener(() => print('x'))\n", "flutter").is_empty());
    // globals, auto-imports and base types are known
    assert!(codes("f(s: string) int\n  print(s)\n  Json.decode(s)\n  s.toInt()!\n", "flutter").is_empty());
}

#[test]
fn block_variables_end_with_the_block() {
    let src = "pick(a: boolean) string\n  if a\n    r = \"x\"\n  else\n    r = \"y\"\n  r\n";
    assert!(codes(src, "typescript").contains(&"N0105"));
    // each branch has its own `r`
    assert!(
        codes(
            "pick(a: boolean) void\n  if a\n    r = 1\n    print(r)\n  else\n    r = 2\n    print(r)\n",
            "typescript"
        )
        .is_empty()
    );
    assert!(codes("f(xs: int[]) void\n  for x in xs\n    print(x)\n  print(x)\n", "typescript").contains(&"N0105"));
}

#[test]
fn if_and_match_are_values_with_blocks() {
    let code = ts("pick(a: boolean) string\n  r = if a\n    p = \"x\"\n    p + \"!\"\n  else\n    \"y\"\n  r\n");
    has(&code, "let r;\n  if (a) {\n    const p = 'x';\n    r = p + '!';\n  } else {\n    r = 'y';\n  }\n  return r;");
    // one expression per branch: a ternary
    has(&ts("pick(a: boolean) string\n  r = if a\n    \"x\"\n  else\n    \"y\"\n  r\n"), "const r = a ? 'x' : 'y';");
    let code = build(
        "size(n: int) string\n  label = match n\n    0 -> \"zero\"\n    _ ->\n      big = n > 100\n      big ? \"big\" : \"some\"\n  label\n",
        "dart",
    );
    has(
        &code,
        "var label;\n  if (n == 0) {\n    label = 'zero';\n  } else {\n    final big = n > 100;\n    label = big ? 'big' : 'some';\n  }",
    );
    // the last if of a function returns from each branch
    has(
        &ts("pick(a: boolean) string\n  if a\n    p = \"x\"\n    p\n  else\n    \"y\"\n"),
        "const p = 'x';\n    return p;",
    );
}

#[test]
fn mutability_is_decided_per_block() {
    let code = ts("f(a: boolean) void\n  if a\n    n = 1\n    print(n)\n  else\n    n = 2\n    n += 1\n    print(n)\n");
    has(&code, "const n = 1;");
    has(&code, "let n = 2;");
}

#[test]
fn lambdas_with_block_and_one_line() {
    let code = ts(
        "run()\n  xs = list.filter(x: int)\n    x > 1\n  ys = list.map(x => x + 1)\n  list.forEach(x)\n    print(x)\n    print(x)\n",
    );
    has(&code, "list.filter((x: number) => x > 1)");
    has(&code, "list.map((x) => x + 1)");
    has(&code, "list.forEach((x) => {\n    console.log(x);\n    return console.log(x);\n  });");
}

#[test]
fn match_as_statement_and_value() {
    let code = ts(
        "run(e: string) void\n  match e\n    'a' -> print(1)\n    'b' | 'c' ->\n      print(2)\n    _ -> print(3)\n",
    );
    has(&code, "if (e === 'a') {\n    console.log(1);\n  } else if (e === 'b' || e === 'c') {");
    has(&code, "} else {\n    console.log(3);");
    // as the last statement of a function that returns, every arm returns
    has(&ts("pick(e: string)\n  match e\n    'a' -> 1\n    _ -> 2\n"), "} else {\n    return 2;");
    // as a value: a chain of ternaries
    has(
        &ts("size(n: int) string\n  label = match n\n    0 -> \"zero\"\n    _ -> \"many\"\n  label\n"),
        "const label = n === 0 ? 'zero' : 'many';",
    );
}

#[test]
fn ranges_and_for() {
    let code = ts("run(m: <string, int>)\n  for i in 0..3\n    print(i)\n  for k, v in m\n    print(k)\n");
    has(&code, "for (let i = 0; i < 3; i++) {");
    has(&code, "for (const [k, v] of Object.entries(m)) {");
}

#[test]
fn strings_escape_per_target() {
    has(&ts("x = \"it's\"\n"), "const x = 'it\\'s';");
    has(&ts("b = 1\nx = \"a ${b} $c\"\n"), "const x = `a ${b} $c`;");
    has(&build("x = \"cost $5\"\n", "dart"), "final x = 'cost \\$5';");
}

#[test]
fn reserved_words_of_the_target_are_renamed() {
    has(&ts("run()\n  delete = 1\n  delete + 1\n"), "const delete_ = 1;\n  return delete_ + 1;");
}

#[test]
fn function_shortcuts() {
    has(&ts("run()\n  t = now()\n  print(t)\n"), "const t = new Date();");
}

#[test]
fn auto_imports_only_when_used_and_not_declared() {
    let code = build("load(p: string) string\n  ~readFile(p, 'utf8')\n", "nodejs");
    has(&code, "import { readFile } from 'node:fs/promises';");
    let code = build("readFile(p: string) string\n  p\nrun()\n  readFile('x')\n", "nodejs");
    assert!(!code.contains("import"), "{code}");
}

#[test]
fn use_shortcuts_and_module_paths() {
    has(
        &build("use fs/promises{ readFile, writeFile }\n", "nodejs"),
        "import { readFile, writeFile } from 'node:fs/promises';",
    );
    has(&build("use material\n", "flutter"), "import 'package:flutter/material.dart';");
    has(
        &build("use lib2/lib2 as lib2\nuse greetings/hello deferred as hello\nuse lib1/lib1 show foo\n", "dart"),
        "import 'package:greetings/hello.dart' deferred as hello;",
    );
    has(&build("use lib1/lib1 show foo\n", "dart"), "import 'package:lib1/lib1.dart' show foo;");
}

#[test]
fn unknown_use_clause() {
    assert_eq!(codes("use lib show foo\n", "typescript"), ["N0211"]);
}

#[test]
fn unknown_kind_suggests_the_closest() {
    let out = nuclear_transpile::transpile(
        "stateles MyApp\n  build(context: BuildContext) Widget\n    Text('x')\n",
        &dialect("flutter"),
    );
    let d = out.diagnostics.iter().find(|d| d.code.id == "N0201").expect("N0201");
    assert!(d.message.contains("did you mean 'stateless'"), "{}", d.message);
    // the same kind does not exist in typescript
    assert!(codes("stateless MyApp\n  build() Widget\n    x\n", "typescript").contains(&"N0201"));
}

#[test]
fn kind_requires_its_methods() {
    assert!(codes("stateless MyApp\n  title: string = ''\n", "flutter").contains(&"N0209"));
}

#[test]
fn stateful_params_are_read_through_widget() {
    let code = build(
        "stateful Counter(start: int)\n  count: int = 0\n  build(context: BuildContext) Widget\n    Text(\"${start}\")\n",
        "flutter",
    );
    has(&code, "const Counter({super.key, required this.start});");
    has(&code, "final int start;");
    has(&code, "Text('${widget.start}')");
}

#[test]
fn nest_kinds_inject_and_route() {
    // Synapsis for NestJS: names stay as written, dependencies are injected, @get is Nest's @Get, the route of the
    // controller is its name without the suffix, and a route parameter is read and parsed by itself
    let code = build(
        "service UsersService\n  all() string[]\n    []\ncontroller UsersController(users: UsersService)\n  @get(\":id\")\n  one(id: int) string[]\n    users.all()\n",
        "nestjs",
    );
    has(&code, "import { Controller, Get, Injectable, Param } from '@nestjs/common';");
    has(&code, "@Injectable()\nexport class UsersService {");
    has(
        &code,
        "@Controller('users')\nexport class UsersController {\n  constructor(private readonly users: UsersService) {}",
    );
    has(&code, "@Get(':id')\n  one(@Param('id', RequiredPipe, IntPipe) id: number): string[] {");
}

#[test]
fn toplevel_statements_go_to_main_in_dart() {
    has(&build("print('hi')\n", "dart"), "void main() {\n  print('hi');\n}");
}

#[test]
fn comments_are_kept_in_place() {
    let code =
        ts("// top\nA\n  // field doc\n  x: int = 1\n  // method doc\n  run() void\n    // inside\n    print(x)\n");
    has(
        &code,
        "/** top */\nexport class A {\n  /** field doc */\n  x: number = 1;\n\n  /** method doc */\n  run(): void {\n    // inside\n    console.log(this.x);",
    );
}

#[test]
fn doc_comments_become_doc_comments_of_the_target() {
    let src = "// loose\n\n// Price with tax.\n * @param amount before tax\n * @return the price\n * @deprecated use total()\n * @example\n *   withTax(1.0)\nwithTax(amount: double) double\n  amount * 1.16\n";
    has(
        &ts(src),
        "// loose\n\n/**\n * Price with tax.\n *\n * @deprecated use total()\n * @param amount before tax\n * @returns the price\n * @example\n * withTax(1.0)\n */\nexport function withTax(",
    );
    has(
        &dart(src),
        "// loose\n\n/// Price with tax.\n///\n/// * [amount]: before tax\n/// * Returns the price\n///\n/// ```nuclear\n/// withTax(1.0)\n/// ```\n@Deprecated('use total()')\ndouble withTax(",
    );
    // a blank line between the comment and the declaration: an ordinary comment
    has(&ts("// note\n\nf() int\n  1\n"), "// note\n\nexport function f()");
}

fn dart(src: &str) -> String {
    build(src, "flutter")
}

#[test]
fn block_lambda_as_named_argument() {
    // `name = (params)` + an indented block, inside the parentheses; the `,` after the block is optional
    let src = "stateful Counter\n  count: int = 0\n\n  build(context: BuildContext) Widget\n    FloatingActionButton(\n      onPressed = ()\n        setState()\n          count += 1\n      child = Icon(Icons.add),\n    )\n";
    let code = dart(src);
    has(&code, "onPressed: () => setState(() {\n        count += 1;\n      }),\n      child: Icon(Icons.add),");
    // the `=>` form still works
    let arrow = src.replace("onPressed = ()\n", "onPressed = () =>\n");
    assert_eq!(dart(&arrow), code);
}

#[test]
fn block_lambda_with_params_and_return() {
    let code = dart(
        "stateless Home\n  build(context: BuildContext) Widget\n    StreamBuilder<int>(\n      stream = Stream.value(1),\n      builder = (context, snapshot)\n        if not snapshot.hasData\n          return Text('-')\n        Text('${snapshot.data}')\n    )\n",
    );
    has(
        &code,
        "builder: (context, snapshot) {\n        if (!snapshot.hasData) {\n          return Text('-');\n        }\n        return Text('${snapshot.data}');\n      },",
    );
}

#[test]
fn one_line_lambda_cannot_assign() {
    assert!(codes("f()\n  g(onSaved = (v) => email = v)\n", "flutter").contains(&"N0013"));
}

#[test]
fn generic_calls() {
    let code = dart(
        "stateless Home\n  build(context: BuildContext) Widget\n    FutureBuilder<string>(future = load(), builder = (context, snapshot) => Text(snapshot.data ?? ''))\n\n  load() Future<string>\n    Future.value('x')\n",
    );
    has(&code, "FutureBuilder<String>(");
    has(&ts("run(a: int, b: int)\n  a < b\n"), "a < b");
    has(&ts("run()\n  key = GlobalKey<FormState>()\n"), "new GlobalKey<FormState>()");
}

#[test]
fn a_typed_value_of_a_file_is_not_a_header() {
    // `Admin: User` is a module with a parent; with a `=` on its line it is a typed value of the file
    let src = "PORTS: <string, int> = { 'graph': 7878 }\nUser(name: string)\nAdmin: User\n  level: int = 1\n";
    let py = build(src, "python");
    has(&py, "PORTS: dict[str, int] = {\"graph\": 7878}");
    has(&py, "class Admin(User):");
    has(&ts(src), "export const PORTS: Record<string, number> = { 'graph': 7878 };");
    // a local constant is not exported
    has(&ts("f() int\n  n = 1\n  n\n"), "  const n = 1;");
}

#[test]
fn a_parameter_that_would_hide_a_function_of_the_target_is_renamed() {
    // `list` and `len` are functions the python dialect writes: a parameter with that name would hide them
    let py = build("words(style: <string, any>, list: string) string[]\n  ((style[list] ?? []) as any[]).map((w) => \"${w}\")\n\ncount(xs: int[], len: int) int\n  xs.length + len\n", "python");
    has(&py, "def words(style: dict[str, Any], list_: str) -> list[str]:");
    has(&py, "cast(list[Any], _coalesce(style.get(list_)");
    has(&py, "return len(xs) + len_");
    // outside, the function still shows and takes its own names (`[syntax] renamed_params`)
    has(&py, "@_public_names(len_=\"len\")\ndef count(xs: list[int], len_: int) -> int:");
    has(&py, "@_public_names(list_=\"list\")\ndef words(");
    assert_eq!(py.matches("def _public_names").count(), 1, "the helper is written once: {py}");
    // every name the helper defines starts with `_`, so a project's import of its own names never matches one
    let helper = &py[py.find("def _public_names").unwrap()..py.find("return _wrap").unwrap()];
    for word in helper.split(|c: char| !c.is_alphanumeric() && c != '_') {
        let defined = helper.contains(&format!("def {word}(")) || helper.contains(&format!(" {word} = "));
        assert!(!defined || word.starts_with('_'), "the helper defines `{word}`");
    }
    assert!(!build("f(a: int) int\n  a\n", "python").contains("_public_names"), "no helper without a renamed parameter");
    // a lambda's parameter is written as its body reads it
    has(&build("f(xs: int[]) int\n  xs.reduce((sum, b) => sum + b, 0)\n", "python"), "lambda sum_, b: sum_ + b");
    // a named argument to it is renamed the same way; a constructor's parameter is a field and keeps its name
    let named = build("pick(xs: int[], { max: int = 3 }) int\n  xs.length + max\n\nuseIt() int\n  pick([1], max = 2)\n\nBox(max: int)\n", "python");
    has(&named, "*, max_: int = 3");
    has(&named, "pick([1], max_=2)");
    has(&named, "self.max = max");
    // the target without that function keeps the name
    has(&ts("count(xs: int[], len: int) int\n  xs.length + len\n"), "len: number");
}

#[test]
fn a_list_with_spreads_has_the_type_of_their_elements() {
    let py = build("f(a: string, more: string[]) string[]\n  [...a.split(':'), ...more].filter((d) => d.length > 0)\n", "python");
    has(&py, "if len(d) > 0]");
}

#[test]
fn a_conditional_body_keeps_its_parentheses_where_a_condition_goes() {
    let py = build("f(xs: string[], fixing: boolean, paths: string[]) string[]\n  xs.filter((x) => fixing ? not x.startsWith('t') : x in paths)\n", "python");
    has(&py, "if (not x.startswith(\"t\") if fixing else x in paths)]");
    let plain = build("f(xs: int[]) int\n  xs.count((x) => x > 1)\n", "python");
    has(&plain, "if x > 1)");
}

#[test]
fn an_optional_member_before_coalesce_is_evaluated_once() {
    // `?.` is a conditional in Python: `??` must not write it twice (pyright cannot narrow the repetition)
    let py = build("Item(id: string)\npick(item: Item?) string\n  item?.id ?? 'none'\n", "python");
    has(&py, "_coalesce((item.id if item is not None else None), lambda: \"none\")");
}

#[test]
fn a_map_of_a_coalesce_is_iterated_whole() {
    let src = "run(env: <string, string>?) void\n  for k, v in env ?? {}\n    print(k)\n";
    has(&build(src, "python"), "in (env if env is not None else {}).items():");
    has(&build(src, "dart"), "in (env ?? {}).entries)");
}

#[test]
fn print_passes_its_named_arguments_to_python() {
    let py = build("use sys\nrun() void\n  print('a', flush = true)\n  print('b', file = sys.stderr)\n", "python");
    has(&py, "_print(\"a\", flush=True)");
    has(&py, "_print(\"b\", file=sys.stderr)");
    has(&py, "def _print(*args: object, **options: Any) -> None:");
}

#[test]
fn spread_in_lists() {
    has(
        &dart("f(items: string[]) Widget[]\n  [Text('a'), ...items.map(i => Text(i))]\n"),
        "[Text('a'), ...items.map((i) => Text(i)).toList()]",
    );
    // a conditional spread keeps its parentheses: Python's `*` binds tighter than its `if ... else`
    let src = "f(on: boolean) string[]\n  ['a', ...(on ? ['b'] : [])]\n";
    has(&build(src, "python"), "*([\"b\"] if on else [])");
    has(&ts(src), "...(on ? ['b'] : [])");
}

#[test]
fn cast_and_not_null() {
    let code = dart("parse(body: string) int\n  json = Json.decode(body) as <string, dynamic>\n  json['id'] as int\n");
    has(&code, "final json = jsonDecode(body) as Map<String, dynamic>;");
    has(&code, "return json['id'] as int;");
    has(&code, "import 'dart:convert';");
    has(&dart("f(key: GlobalKey<FormState>) bool\n  key.currentState!.validate()\n"), "key.currentState!.validate()");
    // `!` before a value is still `not`
    assert!(codes("f(a: bool) bool\n  !a\n", "flutter").contains(&"N0009"));
}

#[test]
fn dart_getters() {
    let code = dart("Badge(status: int)\n  get label() string\n    'n ${status}'\n");
    has(&code, "String get label {");
    has(&ts("Badge(status: int)\n  get label() string\n    'n ${status}'\n"), "get label(): string {");
}

#[test]
fn stateful_mixins_go_to_the_state() {
    let code = dart(
        "stateful Spinner with SingleTickerProviderStateMixin\n  build(context: BuildContext) Widget\n    Text('x')\n",
    );
    has(&code, "class _SpinnerState extends State<Spinner> with SingleTickerProviderStateMixin {");
}

#[test]
fn dart_style_details() {
    let code = dart(
        "stateful Loader\n  data: string? = null\n\n  build(context: BuildContext) Widget\n    Text('${data} of ${data}s ${widget}')\n",
    );
    has(&code, "String? data;");
    // `$name` unless the next character continues the name
    has(&code, "'$data of ${data}s $widget'");
}

#[test]
fn auto_imports_use_the_smallest_set_of_libraries() {
    // widgets.dart is not imported when material.dart (which re-exports it) is needed
    let code = dart("stateless Home\n  build(context: BuildContext) Widget\n    Scaffold(body = Text('x'))\n");
    has(&code, "import 'package:flutter/material.dart';");
    assert!(!code.contains("widgets.dart"), "{code}");
    let code = dart(
        "stateless Home\n  build(context: BuildContext) Widget\n    CupertinoButton(onPressed = () => HapticFeedback.lightImpact(), child = Text('x'))\n",
    );
    has(&code, "import 'package:flutter/cupertino.dart';\nimport 'package:flutter/services.dart';");
    assert!(!code.contains("material.dart") && !code.contains("widgets.dart"), "{code}");
}

#[test]
fn chain_continues_after_a_lambda_block() {
    let code = dart("names(xs: int[]) string[]\n  xs.map(x: int)\n    y = x * 2\n    '${y}'\n");
    has(&code, "return xs.map((int x) {\n    final y = x * 2;\n    return '$y';\n  }).toList();");
}

#[test]
fn type_is_an_ordinary_name() {
    let code = build("Character\n  id: int\n  type: string\n\n  describe() string\n    '${id} ${type}'\n", "dart");
    has(&code, "late String type;");
    has(&code, "return '$id $type';");
}

#[test]
fn setters_never_return() {
    let src = "Box(c: int)\n  set count(value: int)\n    print(value)\n";
    has(&build(src, "dart"), "set count(int value) {\n    print(value);\n  }");
    has(&ts(src), "set count(value: number) {\n    console.log(value);\n  }");
}

#[test]
fn constructor_body_assigns_the_field() {
    let src = "User\n  (name: string, localAttr: string = \"\")\n    localAttr = \"other value\"\n";
    has(&ts(src), "this.localAttr = 'other value';");
    has(&build(src, "dart"), "{\n    localAttr = 'other value';\n  }");
}

#[test]
fn enum_item_without_value_takes_its_name() {
    has(&ts("Level\n  low(\"bajo\")\n  medium\n"), "low = 'bajo',\n  medium = 'medium'");
    has(&build("Level\n  low(\"bajo\")\n  medium\n", "dart"), "low('bajo'),\n  medium('medium');");
}

#[test]
fn list_destructuring() {
    let src = "f(xs: int[]) void\n  [first, _, ...rest] = xs\n  print(first)\n  print(rest)\n";
    has(&ts(src), "const [first, , ...rest] = xs;");
    has(&build(src, "dart"), "final [first, _, ...rest] = xs;");
}

#[test]
fn map_destructuring() {
    let src = "f(m: <string, int>) void\n  { min, \"max-value\": max } = m\n  print(min + max)\n";
    has(&ts(src), "const { min, 'max-value': max } = m;");
    has(&build(src, "dart"), "final {'min': min, 'max-value': max} = m;");
}

#[test]
fn destructuring_into_existing_names_and_mixing() {
    let src = "f() void\n  p = 1\n  q = 2\n  [p, q] = [q, p]\n";
    has(&ts(src), "([p, q] = [q, p]);");
    has(&build(src, "dart"), "[p, q] = [q, p];");
    assert!(codes("f(xs: int[]) void\n  a = 1\n  [a, b] = xs\n", "typescript").contains(&"N0107"));
    // a pattern variable reassigned later is mutable
    has(&ts("f(xs: int[]) void\n  [a, b] = xs\n  a += b\n"), "let [a, b] = xs;");
}

#[test]
fn generators_from_yield() {
    let src = "contar(n: int) int\n  for i in 0..n\n    yield i\n\ntodos(n: int) int\n  yield ...contar(n)\n";
    let code = ts(src);
    has(&code, "export function* contar(n: number): Generator<number> {");
    has(&code, "yield* contar(n);");
    let code = build(src, "dart");
    has(&code, "Iterable<int> contar(int n) sync* {");
    // a generator never returns its last line
    assert!(!code.contains("return"), "{code}");
    let code = build("ticks() int\n  ~Future.delayed(Duration(seconds = 1))\n  yield 1\n", "dart");
    has(&code, "Stream<int> ticks() async* {");
}

#[test]
fn generic_bounds() {
    let src = "Box<T: Comparable, U>\n  value: T\n  other: U\n";
    has(&ts(src), "interface Box<T extends Comparable, U> {");
    has(&build(src, "dart"), "class Box<T extends Comparable, U> {");
    has(&ts("first<T: Comparable>(xs: T[]) T\n  xs[0]\n"), "function first<T extends Comparable>(xs: T[]): T {");
    // the `<` of a call is written right after the name; with a space it is a comparison
    has(&ts("f(a: int, b: int) boolean\n  a < b\n"), "a < b");
}

#[test]
fn if_inside_lists() {
    let src = "f(loading: boolean, xs: string[]) string[]\n  ['a', if loading 'b', ...xs]\n";
    has(&ts(src), "['a', ...(loading ? ['b'] : []), ...xs]");
    has(&build(src, "dart"), "['a', if (loading) 'b', ...xs]");
}

#[test]
fn cascades() {
    let src = "f() void\n  sb = StringBuffer()\n    ..write('a')\n    ..length = 0\n  print(sb)\n";
    has(&build(src, "dart"), "final sb = StringBuffer()\n    ..write('a')\n    ..length = 0;");
    has(&ts(src), "const sb = new StringBuffer();\n  sb.write('a');\n  sb.length = 0;");
    // as a value inside an expression, TypeScript uses a function that returns the object
    has(&ts("f() void\n  print(StringBuffer()\n    ..write('a'))\n"), "(($) => {\n");
    // a range still works
    has(&ts("f() int[]\n  (1..3).map(i => i)\n"), "Array.from");
}

#[test]
fn overrides_of_bases_declared_in_the_file() {
    let src = "Shape\n  area() double\n\nSerializable\n  toJson() string\n\nabstract Base\n  name() string\n    'base'\n\nCircle: Base > Shape, Serializable\n  (radius: double)\n  name() string\n    'circle'\n  area() double\n    3.14 * radius * radius\n  toJson() string\n    'c'\n  extra() int\n    1\n";
    let dart = build(src, "dart");
    has(&dart, "@override\n  String name() {");
    has(&dart, "@override\n  double area() {");
    has(&dart, "@override\n  String toJson() {");
    assert!(!dart.contains("@override\n  int extra()"), "{dart}");
    // TypeScript marks only members of an extended class (override on an interface member is an error)
    let code = ts(src);
    has(&code, "override name(): string {");
    has(&code, "  area(): number {");
    assert!(!code.contains("override area") && !code.contains("override toJson"), "{code}");
}

#[test]
fn constructors_of_derived_classes_call_super() {
    let src = "abstract Base\n  (n: int)\n  name() string\n    'b'\nC: Base\n  (r: int)\n    super(r)\n    print(r)\n";
    // TypeScript: the call stays first; its arguments are the parameters (this is not ready yet)
    has(&ts(src), "constructor(public r: number) {\n    super(r);\n    console.log(this.r);\n  }");
    // Dart: the call goes to the initializer list
    has(&build(src, "dart"), "C(this.r) : super(r) {\n    print(r);\n  }");
    // without super(...), TypeScript calls the base constructor without arguments
    has(
        &ts("abstract Base\n  name() string\n    'b'\nC: Base\n  (r: int)\n"),
        "constructor(public r: number) {\n    super();\n  }",
    );
}

#[test]
fn inherited_constructor_parameters_are_not_new_fields() {
    let src = "Animal\n  (name: string)\n\nDog: Animal\n  (name: string, breed: string)\n    super(name)\n\nBird: Animal\n  (wings: int)\n    super('bird')\n";
    let code = ts(src);
    has(&code, "constructor(name: string, public breed: string) {\n    super(name);\n  }");
    let dart = build(src, "dart");
    // passed as is, in order: Dart super parameters
    has(&dart, "class Dog extends Animal {\n  String breed;\n\n  Dog(super.name, this.breed);");
    has(&dart, "Bird(this.wings) : super('bird');");
}

#[test]
fn type_definitions_mark_overrides_of_external_classes() {
    // CustomPainter comes from nuclearlang/dialects/dart/frameworks/flutter/defs: paint and shouldRepaint override it
    let code = dart(
        "Ring: CustomPainter\n  paint(canvas: Canvas, size: Size) void\n    print(size)\n  shouldRepaint(old: CustomPainter) bool\n    true\n  extra() int\n    1\n",
    );
    has(&code, "@override\n  void paint(Canvas canvas, Size size) {");
    has(&code, "@override\n  bool shouldRepaint(CustomPainter old) {");
    assert!(!code.contains("@override\n  int extra()"), "{code}");
    // every Dart class extends Object (options.implicit_base): toString overrides it
    has(&build("Point\n  x: int = 0\n  toString() string\n    'p'\n", "dart"), "@override\n  String toString() {");
    // kinds take their members and overrides from the classes they inherit (State)
    let code = dart(
        "stateful Counter\n  count: int = 0\n  initState() void\n    super.initState()\n  build(context: BuildContext) Widget\n    Text('${count} ${mounted}')\n",
    );
    has(&code, "@override\n  void initState() {");
    has(&code, "@override\n  Widget build(BuildContext context) {");
}

#[test]
fn external_interface_classes_are_implemented() {
    // Comparable is an `interface class` in the Dart definitions: it cannot be extended
    let code = dart("Score(value: int): Comparable<Score>\n  compareTo(other: Score) int\n    value - other.value\n");
    has(&code, "class Score implements Comparable<Score> {");
    has(&code, "@override\n  int compareTo(Score other) {");
}

// ---------- Result<E, T> (nuclearlang/docs/07-reference/nuclear-base.md §3.2) ----------

const FIND: &str = "User(name: string)\nfindUser(id: string) Result<string, User>\n  if id == ''\n    return Err('empty')\n  Ok(User(id))\n";

#[test]
fn result_runtime_is_written_once_when_used() {
    let code = ts(FIND);
    assert_eq!(code.matches("export class Result<E, T>").count(), 1, "{code}");
    has(&code, "return Err('empty');");
    has(&code, "return Ok(new User(id));");
    assert!(code.find("class Result").unwrap() < code.find("class User").unwrap(), "{code}");
    let dart = build(FIND, "dart");
    // Dart uses fpdart: Result<E, T> is Either<E, T>, Ok is Right and Err is Left; no runtime is written
    has(&dart, "import 'package:fpdart/fpdart.dart';");
    has(&dart, "Either<String, User> findUser(String id) {");
    has(&dart, "return Left('empty');");
    assert!(!dart.contains("class Result"), "{dart}");
    // without Result there is no runtime
    assert!(!ts("f() int\n  1\n").contains("class Result"));
}

#[test]
fn result_errors_propagate_automatically() {
    let src = format!(
        "{FIND}buy(id: string) Result<string, string>\n  user = findUser(id)\n  findUser('x')\n  Ok(user.name)\n"
    );
    let code = ts(&src);
    has(
        &code,
        "const userResult = findUser(id);\n  if (userResult.isErr) return Err(userResult.error);\n  const user = userResult.value;",
    );
    // a call whose value is not used: only its error propagates
    has(
        &code,
        "const findUserResult = findUser('x');\n  if (findUserResult.isErr) return Err(findUserResult.error);\n  return Ok(user.name);",
    );
    let dart = build(&src, "dart");
    has(
        &dart,
        "final userResult = findUser(id);\n  if (userResult case Left(:final value)) return Left(value);\n  final user = (userResult as Right<String, User>).value;",
    );
}

#[test]
fn result_inside_expressions_is_unwrapped_before_the_statement() {
    let src = format!(
        "{FIND}Pair(a: User, b: User)\nboth(x: string, y: string) Result<string, Pair>\n  Ok(Pair(findUser(x), findUser(y)))\n"
    );
    has(
        &ts(&src),
        "const findUserResult = findUser(x);\n  if (findUserResult.isErr) return Err(findUserResult.error);\n  const findUserResult2 = findUser(y);\n  if (findUserResult2.isErr) return Err(findUserResult2.error);\n  return Ok(new Pair(findUserResult.value, findUserResult2.value));",
    );
}

#[test]
fn result_typed_variables_and_results_returned_are_kept() {
    let src = format!(
        "{FIND}keep(id: string) Result<string, User>\n  r: Result<string, User> = findUser(id)\n  findUser(id)\n"
    );
    let code = ts(&src);
    has(&code, "const r: Result<string, User> = findUser(id);\n  return findUser(id);");
    // a parameter typed Result receives it as it is
    let src =
        format!("{FIND}show(r: Result<string, User>) string\n  'x'\nrun(id: string) string\n  show(findUser(id))\n");
    has(&ts(&src), "return show(findUser(id));");
}

#[test]
fn result_ok_and_error_callbacks_observe_or_transform() {
    let src = format!(
        "{FIND}log(m: string) void\n  print(m)\nbuy(id: string) Result<string, string>\n  a = findUser(id).error(e => log(e))\n  b = findUser(id).error(e => Ok(User('guest')))\n  c = findUser(id).ok(u => Ok(u.name))\n  d = findUser(id).ok(u => log(u.name))\n  Ok(c)\n"
    );
    let code = ts(&src);
    has(&code, "findUser(id).inspectErr((e) => log(e))");
    has(&code, "findUser(id).orElse((e) => Ok(new User('guest')))");
    has(&code, "findUser(id).andThen((u) => Ok(u.name))");
    has(&code, "findUser(id).inspect((u) => log(u.name))");
    // a callback that returns Ok/Err in some branches only
    let bad = format!(
        "{FIND}f(id: string) Result<string, User>\n  findUser(id).error(e)\n    if e == ''\n      Ok(User('a'))\n    else\n      print(e)\n"
    );
    assert!(codes(&bad, "typescript").contains(&"N0111"));
}

#[test]
fn result_callbacks_that_return_a_result_propagate_inside() {
    let src = format!(
        "{FIND}rename(id: string, to: string) Result<string, User>\n  findUser(id).ok(u: User)\n    other = findUser(to)\n    Ok(User(other.name))\n"
    );
    has(
        &ts(&src),
        "return findUser(id).andThen((u: User) => {\n    const otherResult = findUser(to);\n    if (otherResult.isErr) return Err(otherResult.error);",
    );
}

#[test]
fn result_match_binds_ok_and_err() {
    let src = format!(
        "{FIND}show(id: string) string\n  match findUser(id)\n    Ok(user) -> 'hi ${{user.name}}'\n    Err(e) -> 'error: ${{e}}'\n"
    );
    has(
        &ts(&src),
        "const findUserResult = findUser(id);\n  if (findUserResult.isOk) {\n    return `hi ${findUserResult.value.name}`;\n  } else {\n    return `error: ${findUserResult.error}`;\n  }",
    );
    let src = format!(
        "{FIND}short(id: string) string\n  label = match findUser(id)\n    Ok(user) -> user.name\n    Err(e) -> e\n  label\n"
    );
    let dart = build(&src, "dart");
    has(
        &dart,
        "final findUserResult = findUser(id);\n  final label = findUserResult.isRight() ? (findUserResult as Right<String, User>).value.name : (findUserResult as Left<String, User>).value;",
    );
    // a variable is matched as it is; Err first
    let src = format!("{FIND}f(r: Result<string, User>) string\n  match r\n    Err(e) -> e\n    _ -> 'ok'\n");
    has(&ts(&src), "if (r.isErr) {\n    return r.error;\n  } else {\n    return 'ok';\n  }");
    // invalid patterns and missing arms
    assert!(
        codes(
            &format!("{FIND}f(id: string) string\n  match findUser(id)\n    Ok(1) -> 'a'\n    _ -> 'b'\n"),
            "typescript"
        )
        .contains(&"N0111")
    );
    assert!(
        codes(
            &format!("{FIND}f(id: string) string\n  x = match findUser(id)\n    Ok(u) -> u.name\n  x\n"),
            "typescript"
        )
        .contains(&"N0103")
    );
}

#[test]
fn result_async_calls_propagate_with_tilde() {
    let src = "User(name: string)\nload(id: string) Result<string, User>\n  ~fetch(id)\n  Ok(User(id))\nbuy(id: string) Result<string, string>\n  user = ~load(id)\n  Ok(user.name)\n";
    let code = ts(src);
    has(&code, "export async function buy(id: string): Promise<Result<string, string>> {");
    has(&code, "const userResult = await load(id);\n  if (userResult.isErr) return Err(userResult.error);");
    // without ~ the value of an async function is not its Result
    let bad = "User(name: string)\nload(id: string) Result<string, User>\n  ~fetch(id)\n  Ok(User(id))\nshow(id: string) string\n  match load(id)\n    Ok(u) -> u.name\n    Err(e) -> e\n";
    assert!(codes(bad, "typescript").contains(&"N0111"));
}

#[test]
fn result_methods_of_modules_propagate() {
    let src = "User(name: string)\nRepo\n  find(id: string) Result<string, User>\n    Ok(User(id))\nShop(repo: Repo)\n  check(id: string) Result<string, int>\n    Ok(1)\n  buy(id: string) Result<string, string>\n    user = repo.find(id)\n    n = check(id)\n    Ok('${user.name} ${n}')\n";
    let code = ts(src);
    has(&code, "const userResult = this.repo.find(id);");
    has(&code, "const nResult = this.check(id);");
    let dart = build(src, "dart");
    has(&dart, "final userResult = repo.find(id);");
}

#[test]
fn result_must_be_handled_outside_result_functions() {
    let ids = |s: &str| codes(&format!("{FIND}{s}"), "typescript");
    assert!(ids("f(id: string) string\n  user = findUser(id)\n  user.name\n").contains(&"N0108"));
    assert!(ids("f(id: string) void\n  findUser(id)\n").contains(&"N0108"));
    assert!(ids("f(id: string) User\n  findUser(id)\n").contains(&"N0108"));
    // handled: the error branch of a chain, a typed variable, a function without a written type
    assert!(!ids("f(id: string) void\n  findUser(id).error(e => print(e))\n").contains(&"N0108"));
    let msg = nuclear_transpile::transpile(&format!("{FIND}f(id: string) void\n  findUser(id)\n"), &dialect("typescript")).diagnostics.into_iter().find(|d| d.code.id == "N0108").unwrap().message;
    assert!(msg.contains("always handled") && msg.contains("findUser(...).error((e) => ...)") && !msg.contains("keep it"), "{msg}");
    assert!(!ids("f(id: string) void\n  r: Result<string, User> = findUser(id)\n  print(r)\n").contains(&"N0108"));
    assert!(!ids("f(id: string)\n  findUser(id)\n").contains(&"N0108"));
    // a name typed Result keeps the Result it is given again, also inside a function that returns one
    let code = ts(&format!("{FIND}f(id: string) Result<string, boolean>\n  r: Result<string, User> = findUser(\"a\")\n  r = findUser(id)\n  Ok(r.isOk)\n"));
    has(&code, "r = findUser(id);");
}

#[test]
fn result_error_types_must_match() {
    let src = format!(
        "{FIND}AppError(message: string)\nbuy(id: string) Result<AppError, User>\n  user = findUser(id)\n  Ok(user)\n"
    );
    let out = nuclear_transpile::transpile(&src, &dialect("typescript"));
    let d = out.diagnostics.iter().find(|d| d.code.id == "N0109").expect("N0109");
    assert!(d.message.contains("Err(AppError(e))"), "{}", d.message);
    // converted with .error(e => Err(...)): its error type is the new one
    let ok = format!(
        "{FIND}AppError(message: string)\nbuy(id: string) Result<AppError, User>\n  user = findUser(id).error(e => Err(AppError(e)))\n  Ok(user)\n"
    );
    assert!(!codes(&ok, "typescript").contains(&"N0109"));
}

#[test]
fn result_cannot_propagate_from_lazy_branches() {
    let ids = |s: &str| codes(&format!("{FIND}{s}"), "typescript");
    assert!(
        ids("f(a: boolean, id: string) Result<string, boolean>\n  x = a and findUser(id).name == ''\n  Ok(x)\n")
            .contains(&"N0110")
    );
    assert!(
        ids("f(a: boolean, id: string) Result<string, string>\n  x = a ? findUser(id).name : ''\n  Ok(x)\n")
            .contains(&"N0110")
    );
    assert!(
        ids("f(id: string) Result<string, boolean>\n  while findUser(id).name == ''\n    print(1)\n  Ok(true)\n")
            .contains(&"N0110")
    );
    // the first condition of an if runs before the if: allowed
    assert!(
        ids("f(id: string) Result<string, boolean>\n  if findUser(id).name == ''\n    print(1)\n  Ok(true)\n")
            .is_empty()
    );
}

#[test]
fn a_file_with_its_own_result_does_not_get_the_builtin() {
    let src = "Result\n  ok: boolean\nOk(value: int)\nf() Ok\n  Ok(1)\n";
    let code = ts(src);
    has(&code, "return new Ok(1);");
    assert!(!code.contains("andThen"));
}

const USE_CASES: &str = "Character(name: string)\nGetOne\n  exec(id: int) Character\n    Character('${id}')\n  ~load(id: int) Character\n    Character('${id}')\n  static count(n: int) int = n\n  ids(limit: int) int\n    for i in 0..limit\n      yield i\n";

#[test]
fn alias_is_the_same_function_as_a_module_method() {
    let src = format!(
        "{USE_CASES}Component()\n  getOne() = GetOne.exec\n  load() = GetOne.load\n  count() = GetOne.count\n  ids() = GetOne.ids\n  first() Character\n    getOne(1)\ntop() = GetOne.exec\n"
    );
    let code = ts(&src);
    has(&code, "getOne(id: number): Character {\n    return new GetOne().exec(id);\n  }");
    has(&code, "async load(id: number): Promise<Character> {\n    return await new GetOne().load(id);\n  }");
    // a static method is called on the module
    has(&code, "count(n: number): number {\n    return GetOne.count(n);\n  }");
    has(&code, "*ids(limit: number): Generator<number> {\n    yield* new GetOne().ids(limit);\n  }");
    has(&code, "return this.getOne(1);");
    has(&code, "export function top(id: number): Character {\n  return new GetOne().exec(id);\n}");
    let dart = build(&src, "dart");
    has(&dart, "Character getOne(int id) {\n    return GetOne().exec(id);\n  }");
    has(&dart, "Iterable<int> ids(int limit) sync* {\n    yield* GetOne().ids(limit);\n  }");
}

#[test]
fn alias_keeps_named_parameters_and_results() {
    let src = "Finder\n  find(id: int) Result<string, string>\n    id > 0 ? Ok('x') : Err('bad')\n  greet(name: string, {loud: boolean = false}) string\n    name\nComp()\n  find() = Finder.find\n  greet() = Finder.greet\n  size(id: int) Result<string, int>\n    name = find(id)\n    Ok(name.length)\n";
    let dart = build(src, "dart");
    has(&dart, "String greet(String name, {bool loud = false}) {\n    return Finder().greet(name, loud: loud);\n  }");
    has(&dart, "Either<String, String> find(int id) {\n    return Finder().find(id);\n  }");
    // calls to the alias propagate its errors like calls to the target
    has(&dart, "final nameResult = find(id);\n    if (nameResult case Left(:final value)) return Left(value);");
}

#[test]
fn alias_rules_do_not_change_other_short_functions() {
    // an enum item, a field or a function that is not a method keep their meaning: the function returns it
    let src = "Role\n  user\n  admin\nBox(size: int = 1)\nf() = Role.admin\ng() = Box.size\n";
    let code = ts(src);
    has(&code, "export function f() {\n  return Role.admin;\n}");
    has(&code, "export function g() {\n  return Box.size;\n}");
    // the target module must be buildable with no arguments
    assert_eq!(codes("Repo(url: string)\n  find(id: int) int = id\nf() = Repo.find\n", "typescript"), vec!["N0112"]);
}

#[test]
fn result_callbacks_recover_transform_or_observe_by_what_they_return() {
    let src = format!(
        "{FIND}log(m: string) void\n  print(m)\nfallbackUser() User\n  User('guest')\nbuy(id: string) Result<string, string>\n  a = findUser(id).error(e => log(e))\n  b = findUser(id).error(e => fallbackUser())\n  c = findUser(id).ok(u => u.name)\n  Ok('${{a.name}} ${{b.name}} ${{c}}')\n"
    );
    let dart = build(&src, "dart");
    // nothing returned: it only observes, and the error still propagates
    has(&dart, "final aResult = findUser(id).mapLeft((error) {");
    has(&dart, "if (aResult case Left(:final value)) return Left(value);");
    // a value from .error(): the error is recovered and the expression is that value
    has(&dart, "final b = findUser(id).getOrElse((e) => fallbackUser());");
    // a value from .ok(): it transforms the Ok value
    has(&dart, "final cResult = findUser(id).map((u) => u.name);");
    let code = ts(&src);
    has(&code, "const b = findUser(id).getOrElse((e) => fallbackUser());");
}

#[test]
fn a_kind_that_does_not_write_generics_or_interfaces_says_so() {
    assert!(codes("event Box<T>\n  value: T\n", "flutter").contains(&"N0218"));
    assert!(codes("event Ping > Comparable\n  at: int\n", "flutter").contains(&"N0218"));
    // the plain class and the model kind write both
    assert!(codes("Box<T>\n  value: T\n", "flutter").is_empty());
}

/// A variable named like a method of its module would be written as an assignment to the method (`self.pieces = ...`
/// in Python): it is N0019, in every language.
#[test]
fn a_variable_cannot_take_the_name_of_a_method() {
    let src = "Planner()\n  run() int\n    pieces = pieces()\n    pieces\n\n  pieces() int\n    1\n\n  ok() int\n    total = pieces()\n    total\n";
    for d in ["typescript", "dart", "python"] {
        assert_eq!(codes(src, d), ["N0019"], "{d}");
    }
}

/// Python's `??` is a conditional expression (`a if a is not None else b`): inside another conditional it keeps its
/// parentheses, and so does a conditional in a first branch, or Python groups them the wrong way.
#[test]
fn a_coalesce_inside_a_conditional_keeps_its_group_in_python() {
    let src = "pick(a: string[], m: string?, d: string) string\n  a.length > 0 ? a[0] : m != null ? m ?? d : d\n\nnest(x: int, y: int) int\n  x > 0 ? (y > 0 ? 1 : 2) : 3\n";
    let py = build(src, "python");
    has(&py, "a[0] if len(a) > 0 else (m if m is not None else d) if m is not None else d");
    has(&py, "(1 if y > 0 else 2) if x > 0 else 3");
    has(&build(src, "typescript"), "a.length > 0 ? a[0] : m != null ? m ?? d : d");
}

/// An appcomponent method without a body would be generated empty (`...` in Python): N0221, in every platform.
#[test]
fn an_appcomponent_method_needs_an_alias_or_a_body() {
    let empty = "appcomponent BooksAppComponent\n  booksOf(author: string) Result<Error, string[]>\n";
    let alias = "usecase BooksOfAuthor\n  exec(author: string) Result<Error, string[]>\n    Ok([author])\n\nappcomponent BooksAppComponent\n  booksOf() = BooksOfAuthor.exec\n";
    for d in ["fastapi", "nestjs", "flutter", "react"] {
        assert!(codes(empty, d).contains(&"N0221"), "{d}: {:?}", codes(empty, d));
        assert!(!codes(alias, d).contains(&"N0221"), "{d}: {:?}", codes(alias, d));
    }
}

/// What an asynchronous call returns is there only once awaited: a member or an index of it without `~` is N0222.
#[test]
fn an_async_call_used_without_await_is_an_error() {
    let src = "Books()\n  all() string[]\n    ~fetchAll()\n\n  fetchAll() string[]\n    []\n\n  count() int\n    books = Books()\n    books.all().length\n\n  right() int\n    books = Books()\n    (~books.all()).length\n";
    // kept in a variable first: the variable holds the call, not its value
    let kept = "Books()\n  all() string[]\n    ~fetchAll()\n\n  fetchAll() string[]\n    []\n\n  count() int\n    books = Books()\n    found = books.all()\n    found.length\n\n  right() int\n    books = Books()\n    found = ~books.all()\n    found.length\n";
    for d in ["typescript", "dart", "python"] {
        let got = codes(src, d);
        assert_eq!(got.iter().filter(|c| **c == "N0222").count(), 1, "{d}: {got:?}");
        let got = codes(kept, d);
        assert_eq!(got.iter().filter(|c| **c == "N0222").count(), 1, "{d} (kept): {got:?}");
    }
}

/// A test keeps its Results: a member or an index of one that is not `value`, `error`, `isOk` or `isErr` is N0114, with
/// the fix; inside a function that returns a Result the call unwraps by itself and nothing is reported.
#[test]
fn a_kept_result_is_read_through_its_value() {
    let src = "usecase Find\n  exec(a: string) Result<Error, string[]>\n    Ok([a])\n\ntests FindTest\n  @test(\"finds\")\n  finds() void\n    find = inject<Find>()\n    found = ~find.exec(\"a\")\n    expect(found.length == 1)\n    expect(found[0] == \"a\")\n    expect(found.value.length == 1)\n";
    let got = codes(src, "fastapi");
    assert_eq!(got.iter().filter(|c| **c == "N0114").count(), 2, "{got:?}");
}

/// A member declared twice in one module is N0102 (the second would silently replace the first); a `get`/`set` pair
/// shares its name.
#[test]
fn a_member_is_declared_once() {
    let twice = "Books()\n  load() int\n    1\n\n  load() int\n    2\n";
    let pair = "Box()\n  n: int = 0\n  get size() int\n    n\n  set size(v: int)\n    n = v\n";
    for d in ["typescript", "dart", "python"] {
        assert_eq!(codes(twice, d).len(), 1, "{d}: {:?}", codes(twice, d));
    }
    assert!(codes(pair, "typescript").is_empty(), "{:?}", codes(pair, "typescript"));
}


/// A call to a method hidden by a local of the same name (`prompt(...)` inside `write(prompt: string)`) would call the
/// local: N0102. A parameter named like its own method (`page(page: int)`) that calls nothing by that name is fine.
#[test]
fn a_local_does_not_hide_a_called_method() {
    let src = "Bench()\n  prompt(name: string) string\n    name\n\n  write(prompt: string) string\n    prompt(\"x\")\n\n  page(page: int) int\n    page + 1\n\n  fine(text: string) string\n    prompt(text)\n";
    for d in ["typescript", "dart", "python"] {
        let got = codes(src, d);
        assert_eq!(got.iter().filter(|c| **c == "N0102").count(), 1, "{d}: {got:?}");
    }
}

/// A parameter with a default, in a kind whose parameters are read from an object (the views of react): the template
/// that reads a parameter gets its default, and a declaration with no required parameter can be built without any.
#[test]
fn a_view_reads_the_default_of_its_parameter() {
    let code = build(
        "stateless Tag(label: string, tone: string = \"plain\")\n  build() Element\n    span(className = tone, children = label)\n\nstateless Bare(tone: string = \"plain\")\n  build() Element\n    span(className = tone)\n",
        "react",
    );
    has(&code, "(this.props.tone ?? 'plain')");
    has(&code, "this.props.label");
    has(&code, "export function Tag(props: TagProps): Element");
    has(&code, "export function Bare(props: BareProps = {}): Element");
    assert!(!code.contains("constructor"), "{code}");
}

/// A map read is a lookup (`None` when the key is absent) also when the map comes from a call: a function, a static
/// method of a class, or a local holding what one returns.
#[test]
fn a_map_from_a_call_is_read_with_a_lookup_in_python() {
    let src = "Conf\n  static all() <string, string>\n    found: <string, string> = {}\n    found\n\nmapOf() <string, string>\n  found: <string, string> = {}\n  found\n\nread() string\n  m = Conf.all()\n  a: string = m[\"x\"] ?? \"a\"\n  b: string = Conf.all()[\"x\"] ?? \"b\"\n  c: string = mapOf()[\"x\"] ?? \"c\"\n  \"${a}${b}${c}\"\n";
    let py = build(src, "python");
    for read in ["m.get(\"x\")", "Conf.all().get(\"x\")", "map_of().get(\"x\")"] {
        assert!(py.contains(read), "{read} missing in:\n{py}");
    }
}

#[test]
fn a_conditional_value_of_a_match_arm_keeps_its_parentheses() {
    // Python's `t if c else o`: an arm's own conditional would otherwise join the next arm (the first arm won always)
    let src = "rate(kind: string, often: boolean) double\n  r = match kind\n    \"some\" -> often ? 0.8 : 0.5\n    \"many\" -> often ? 1.0 : 0.9\n    _ -> 0.0\n  r\n";
    let code = build(src, "python");
    has(&code, "(0.8 if often else 0.5) if kind == \"some\" else (1.0 if often else 0.9) if kind == \"many\" else 0.0");
    let chosen = build("pick(a: boolean, b: boolean) int\n  n = if a\n    b ? 1 : 2\n  else\n    3\n  n\n", "python");
    has(&chosen, "(1 if b else 2) if a else 3");
}

#[test]
fn an_argument_a_template_puts_next_to_an_operator_keeps_its_parentheses() {
    // `"x".repeat(a + b)` is `"x" * a + b` in Python and Dart without them; a call's argument stays bare
    let src = "f(a: int, b: int, on: boolean) string\n  \"x\".repeat(a + b) + \"y\".repeat(on ? a : b)\n";
    has(&build(src, "python"), "(\"x\" * (a + b)) + (\"y\" * (a if on else b))");
    has(&dart(src), "('x' * (a + b)) + ('y' * (on ? a : b))");
    has(&ts(src), "'x'.repeat(a + b) + 'y'.repeat(on ? a : b)");
    // a function of the dialect: `asyncio.sleep({{arg0}} / 1000)`
    has(&build("f(a: int, b: int) void\n  ~delay(a + b)\n", "python"), "asyncio.sleep((a + b) / 1000)");
    has(&dart("f(a: int, b: int) void\n  ~delay(a + b)\n"), "Duration(milliseconds: a + b)");
}

#[test]
fn a_spread_of_a_conditional_keeps_its_parentheses_in_maps_and_calls() {
    let src = "f(a: <string, int>, b: <string, int>, on: boolean) <string, int>\n  { ...a, ...(on ? a : b) }\n";
    has(&build(src, "python"), "{**a, **(a if on else b)}");
    has(&ts(src), "{ ...a, ...(on ? a : b) }");
    has(&dart(src), "{...a, ...(on ? a : b)}");
    let call = "g(n: int) int\n  n\nf(on: boolean) int\n  g(...(on ? [1] : [2]))\n";
    has(&build(call, "python"), "g(*([1] if on else [2]))");
}

#[test]
fn a_value_of_another_basic_type_is_reported() {
    // N0117: each target would keep or reject it differently; an int is a double
    for src in ["f() void\n  x: int = \"s\"\n  print(x)\n", "f() void\n  s: string? = 4\n  print(s)\n", "Box\n  on: boolean = 1.5\n"] {
        assert!(codes(src, "python").contains(&"N0117"), "{src}");
    }
    build("f(n: int) void\n  h: double = 3\n  m: double = n\n  s: string? = null\n  print(h, m, s)\n", "python");
}

#[test]
fn tilde_on_a_call_that_awaits_nothing_is_reported() {
    // N0224, the mirror of N0222: Python cannot await what a function that is not async returns
    let sync = "twice(n: int) int\n  n * 2\nTools\n  add(n: int) int\n    n + 1\n";
    for call in ["~twice(2)", "~Tools().add(1)"] {
        let src = format!("{sync}run() int\n  t = Tools()\n  {}\n", call.replace("Tools()", "t"));
        assert!(codes(&src, "python").contains(&"N0224"), "{src}");
    }
    // through an appcomponent's alias of a use case that returns what a sync method gives
    let alias = "Registry\n  register(name: string) Result<Error, string>\n    Ok(name)\n\nusecase Register(registry: Registry)\n  exec(name: string) Result<Error, string>\n    registry.register(name)\n\nappcomponent Workspaces\n  register() = Register.exec\n\nCaller\n  (workspaces: Workspaces)\n  go(name: string) Result<Error, string>\n    ~workspaces.register(name)\n";
    assert!(codes(alias, "fastapi").contains(&"N0224"));
    // async, declared async, giving a Future, or returning the call of an async one: awaited
    build("Box\n  ~load() int\n    1\n  open() int\n    load()\nrun() int\n  b = Box()\n  ~b.open()\n", "python");
    build("~later(n: int) int\n  n\nfetch(n: int) int\n  ~later(n)\nrun() int\n  a = ~later(1)\n  ~fetch(a)\n", "python");
}

#[test]
fn an_appcomponent_alias_propagates_its_result() {
    // `ws = workspaces.find(name)` unwraps like the use case it names; a Result is always handled
    let base = "Registry\n  ~find(name: string) Result<Error, string>\n    ~publish(\"found\", name)\n    Ok(name)\n\nusecase Find(registry: Registry)\n  exec(name: string) Result<Error, string>\n    ~registry.find(name)\n\nappcomponent Workspaces\n  find() = Find.exec\n\n";
    let used = format!("{base}usecase Open(workspaces: Workspaces)\n  exec(name: string) Result<Error, int>\n    ws = ~workspaces.find(name)\n    Ok(ws.length)\n");
    let py = build(&used, "fastapi");
    has(&py, "ws_result = await self.workspaces.find(name)");
    has(&py, "len(ws)");
    // a statement of a void method: N0108, whose message names the ways to handle it
    let dropped = format!("{base}Caller\n  (workspaces: Workspaces)\n  ~go(name: string) void\n    ~workspaces.find(name)\n");
    let out = nuclear_transpile::transpile(&dropped, &dialect("fastapi"));
    let d = out.diagnostics.iter().find(|d| d.code.id == "N0108").expect("N0108");
    assert!(d.message.contains("(~find(...)).error((e) => ...)") && d.message.contains("propagate"), "{}", d.message);
    // handled: its error logged (the call awaited first), or matched
    build(&format!("{base}Caller\n  (workspaces: Workspaces)\n  ~go(name: string) void\n    (~workspaces.find(name)).error((e) => print(e.message))\n"), "fastapi");
    build(&format!("{base}Caller\n  (workspaces: Workspaces)\n  ~go(name: string) void\n    match ~workspaces.find(name)\n      Ok(n) -> print(n)\n      Err(e) -> print(e.message)\n"), "fastapi");
    // `~` awaits the whole chain: `~f().error(...)` says to await the call first
    let chained = format!("{base}Caller\n  (workspaces: Workspaces)\n  ~go(name: string) void\n    ~workspaces.find(name).error((e) => print(e.message))\n");
    let out = nuclear_transpile::transpile(&chained, &dialect("fastapi"));
    assert!(out.diagnostics.iter().any(|d| d.code.id == "N0111" && d.message.contains("(~find(...)).error(...)")), "{:#?}", out.diagnostics);
}

#[test]
fn a_plain_name_that_writes_an_inherited_attribute_warns() {
    // N0118: the rule stays (it writes the attribute), with a warning and the fix `$given`
    let src = "Chat\n  given: string = \"\"\n\nMember: Chat\n  hear(text: string) void\n    given = text\n";
    let out = nuclear_transpile::transpile(src, &dialect("python"));
    let w = out.diagnostics.iter().find(|d| d.code.id == "N0118").expect("N0118");
    assert!(!w.is_error() && w.fix.as_ref().is_some_and(|f| f.replacement == "$given"), "{w:#?}");
    has(&out.code, "self.given = text");
    // `$given` says the attribute is meant; an own field and a new local are no warning
    for quiet in [
        "Chat\n  given: string = \"\"\n\nMember: Chat\n  hear(text: string) void\n    $given = text\n",
        "Member\n  given: string = \"\"\n  hear(text: string) void\n    given = text\n",
        "Chat\n  given: string = \"\"\n\nMember: Chat\n  hear(text: string) void\n    heard = text\n    print(heard)\n",
    ] {
        assert!(!codes(quiet, "python").contains(&"N0118"), "{quiet}");
    }
}

#[test]
fn an_inherited_attribute_keeps_its_type() {
    // `history` of `Member: Chat` is Chat's `<string, any>[]`: its library members are rewritten
    let src = "Chat\n  history: <string, any>[] = []\n\nMember: Chat\n  count() int\n    history.isEmpty ? 0 : history.length\n";
    has(&build(src, "python"), "0 if len(self.history) == 0 else len(self.history)");
}

#[test]
fn a_use_stands_only_at_the_top_of_a_file() {
    // ADR-lang-0012: no `use` inside a function; a project's `lazy_imports` moves an import into a body instead
    assert!(!codes("heavy(x: string) string\n  use textwrap{ dedent }\n  dedent(x)\n", "python").is_empty());
}

// ---------- found by the conformance programs (examples/conformance, 2026-11-21) ----------

#[test]
fn a_negated_negative_keeps_its_parentheses() {
    // `--5` is a decrement in TypeScript and Dart
    for d in ["typescript", "dart", "python"] {
        has(&build("f(n: int) int\n  -(-n)\n", d), "-(-n)");
    }
}

#[test]
fn an_assignment_as_the_last_line_of_a_typed_function_returns_what_it_assigned() {
    let src = "Counter\n  count: int = 0\n\n  bump(by: int) int\n    count += by\n";
    has(&ts(src), "this.count += by;\n    return this.count;");
    has(&build(src, "python"), "self.count += by\n        return self.count");
    // a function without a return type keeps the rule of the new variable only
    assert!(!ts("Counter\n  count: int = 0\n\n  bump(by: int) void\n    count += by\n").contains("return"));
}

#[test]
fn a_map_pattern_reads_each_key_where_the_target_has_no_map_patterns() {
    let src = "f(m: <string, int>) int\n  { low, \"high-value\": high } = m\n  low + high\n";
    has(&build(src, "python"), "low = m[\"low\"]\n    high = m[\"high-value\"]");
    has(&ts(src), "const { low, 'high-value': high } = m;");
    // a value that is not a name is read once
    let lit = build("f() int\n  { low } = { \"low\": 1 }\n  low\n", "python");
    has(&lit, "= {\"low\": 1}");
    assert!(!lit.contains("{\"low\": low} ="), "{lit}");
}

#[test]
fn a_local_named_like_a_library_function_imports_nothing() {
    let code = build("main() void\n  log: string[] = []\n  log.add(\"a\")\n  print(log.length)\n", "dart");
    assert!(!code.contains("dart:math"), "{code}");
    // the function of the library used elsewhere in the file still imports its module
    has(&build("main() void\n  log: string[] = []\n  print(log.length)\n\ng(x: double) double = Math.log(x)\n", "dart"), "dart:math");
}

#[test]
fn a_function_may_return_a_function_type() {
    has(&ts("adder(n: int) (x: int) => int\n  (x: int) => x + n\n"), "export function adder(n: number): (x: number) => number {");
}

#[test]
fn a_block_lambda_that_assigns_an_outer_variable_declares_it_nonlocal() {
    let code = build("counter()\n  count = 0\n  ()\n    count += 1\n    count\n", "python");
    has(&code, "nonlocal count\n        count += 1");
    // a variable of its own stays its own
    assert!(!build("f()\n  ()\n    own = 1\n    own += 1\n    own\n", "python").contains("nonlocal"));
}

#[test]
fn an_inverted_range_is_empty_in_dart() {
    has(&build("f(a: int, b: int) int[] = a..b\n", "dart"), "[for (var i = a; i < b; i++) i]");
}

#[test]
fn an_optional_attribute_starts_as_null_in_python() {
    has(&build("User(name: string)\n  nick?: string\n", "python"), "self.nick = None");
}

#[test]
fn the_type_arguments_of_a_generic_of_the_program_are_types_in_python() {
    let src = "Stack<T>\n  items: T[] = []\n\nlastOr<T>(xs: T[], fallback: T) T\n  xs.isEmpty ? fallback : xs.last\n\nmain() void\n  st = Stack<int>()\n  print(lastOr<int>(st.items, 9))\n";
    let code = build(src, "python");
    has(&code, "st = Stack[int]()");
    has(&code, "last_or(st.items, 9)");
}

#[test]
fn an_optional_attribute_and_a_getter_have_their_types() {
    // TypeScript prints a missing optional attribute as `null` and a getter's decimal with its `.0`
    let src = "T(celsius: double)\n  nick?: string\n\n  get fahrenheit() double\n    celsius * 9 / 5 + 32\n\nmain() void\n  t = T(1.0)\n  print(t.nick, t.fahrenheit)\n";
    has(&ts(src), "console.log((t.nick ?? null), _double(t.fahrenheit));");
}

#[test]
fn an_integer_literal_given_for_a_decimal_is_a_decimal_in_python() {
    let src = "Account(balance: double = 0)\n  deposit(amount: double) void\n    balance += amount\n\nmain() void\n  a = Account()\n  a.deposit(50)\n  price: double = 3\n  price = -4\n  print(price, 0xff)\n";
    let code = build(src, "python");
    has(&code, "balance: float = 0.0");
    has(&code, "a.deposit(50.0)");
    has(&code, "price: float = 3.0\n    price = -4.0");
    has(&ts(src), "a.deposit(50);");
}

#[test]
fn the_sum_of_a_list_has_the_type_of_its_elements() {
    // unknown elements are not decimals: TypeScript printed `12.0`
    let code = ts("f(xs: any) void\n  print(xs.sum())\n\ng(xs: double[]) void\n  print(xs.sum())\n");
    has(&code, "console.log(xs.reduce((a, b) => a + b, 0));");
    has(&code, "console.log(_double(xs.reduce((a, b) => a + b, 0)));");
    has(&build("g(xs: double[]) double = xs.sum()\n", "dart"), "xs.fold(0.0, (a, b) => a + b)");
}

#[test]
fn a_variable_is_narrowed_inside_an_is_branch() {
    let src = "Animal(name: string)\n\nDog: Animal\n  (name: string, breed: string)\n    super(name)\n\nf(a: Animal) string\n  if a is Dog\n    return a.breed\n  a.name\n";
    assert!(codes(src, "typescript").is_empty(), "{:?}", codes(src, "typescript"));
    // outside the branch it is an Animal again
    let outside = "Animal(name: string)\n\nDog: Animal\n  (name: string, breed: string)\n    super(name)\n\nf(a: Animal) string\n  if a is Dog\n    print(a.breed)\n  a.breed\n";
    assert!(codes(outside, "typescript").contains(&"N0116"));
}

#[test]
fn type_parameters_reach_the_members_of_the_library() {
    let src = "Box<T>(value: T)\n  get() T\n    value\n\nfirst<T>(xs: T[]) T\n  xs[0]\n\nmain() void\n  s = Box(\"hi\")\n  print(s.get().upper(), s.value.length, first([\"a\"]).upper(), Box<string[]>([]).value.length)\n";
    has(&ts(src), "s.get().toUpperCase(), s.value.length, first(['a']).toUpperCase()");
    has(&build(src, "python"), "s.get().upper(), len(s.value), first([\"a\"]).upper(), len(Box[list[str]]([]).value)");
}

#[test]
fn the_members_of_a_kept_result_are_the_dialects() {
    let src = "half(n: int) Result<string, int>\n  n % 2 == 0 ? Ok(n ~/ 2) : Err(\"odd\")\n\nmain() void\n  r: Result<string, int> = half(4)\n  print(r.isOk, r.isErr)\n";
    has(&build(src, "dart"), "r.isRight(), r.isLeft()");
    has(&ts(src), "r.isOk, r.isErr");
}

#[test]
fn a_literal_in_a_text_is_never_a_bare_name_in_dart() {
    has(&build("main() void\n  print(\"${true} ${null}\")\n", "dart"), "'${true} ${null}'");
}

#[test]
fn a_helper_is_written_only_for_the_form_that_calls_it() {
    assert!(!ts("f(s: string) string = s.replaceAll(\"a\", \"b\")\n").contains("_replaceWith"));
    has(&ts("f(s: string) string = s.replaceAll(Regex(r\"a\"), (m) => m.text)\n"), "function _replaceWith(");
}

#[test]
fn a_list_of_decimals_keeps_its_decimals_when_joined_in_typescript() {
    let code = ts("f(xs: double[], ys: int[]) string = xs.map((x) => x * 2).join(\",\") + ys.join(\",\")\n");
    has(&code, "xs.map((x) => x * 2).map(_double).join(',') + ys.join(',')");
}

#[test]
fn a_comparison_with_null_is_never_deep() {
    let code = ts("f(m: <string, <string, int>>) boolean = m[\"c\"] == null\n");
    assert!(!code.contains("_equals"), "{code}");
}

#[test]
fn a_replacement_text_is_never_a_pattern() {
    // JavaScript reads `$&` in a replacement and Python's `re.sub` reads `\\1`: only a plain literal is given as it is
    let src = "f(s: string, to: string) string = s.replaceAll(\".\", to) + s.replace(\"a\", \"b\") + s.replace(\"a\", to)\n";
    has(&ts(src), "s.replaceAll('.', () => to) + s.replace('a', 'b') + s.replace('a', () => to)");
    let re = "f(s: string, to: string) string\n  digit = Regex(r\"\\d\")\n  s.replaceAll(digit, to) + s.replace(digit, to) + s.replaceAll(digit, \"x\")\n";
    has(&build(re, "python"), "digit.sub(lambda _: to, s) + digit.sub(lambda _: to, s, 1) + digit.sub(\"x\", s)");
    // a Regex is global in TypeScript: its first match is replaced by hand
    has(&ts(re), "_replaceFirst(s, digit, to)");
}

#[test]
fn sorting_by_a_key_reads_each_key_once_and_is_stable() {
    let src = "f(xs: int[]) int[] = xs.sortedBy((x) => x % 5)\n";
    has(&ts(src), "const keyed = xs.map((x) => ({ k: key(x), x }));");
    // Dart's List.sort does not keep the order of equal keys
    has(&build(src, "dart"), "return c != 0 ? c : a - b;");
}

#[test]
fn a_doc_comment_with_a_backslash_is_a_valid_docstring() {
    has(&build("// Splits on `\\` and on \"\"\".\nf() int = 1\n", "python"), "Splits on `\\\\` and on \\\"\\\"\\\".");
}

#[test]
fn a_map_of_plain_values_is_read_as_an_expert_reads_it_in_python() {
    let src = "f(m: <string, int>, k: string) int\n  m[k] = (m[k] ?? 0) + 1\n  m[k]!\n";
    let code = build(src, "python");
    has(&code, "m[k] = m.get(k, 0) + 1");
    has(&code, "return m[k]");
    // a map whose values may be null keeps the checks: a stored null is not a missing key
    let nullable = build("f(m: <string, int?>, k: string) int = (m[k] ?? 0) + m[k]!\n", "python");
    assert!(!nullable.contains(".get(k, 0)"), "{nullable}");
    has(&nullable, "_sure(m.get(k))");
}

#[test]
fn what_an_undeclared_method_of_a_class_gives_is_not_a_list() {
    // `orders.where(...)` is a query of the runtime: its `count()` was written as a list's
    let src = "Orders: Repository\n  size() int\n    0\n\nf(orders: Orders) int = orders.where(1).count()\n";
    has(&build(src, "python"), "orders.where(1).count()");
    has(&ts(src), "orders.where(1).count()");
    // a list of the program keeps the library's
    has(&build("f(xs: int[]) int = xs.filter((x) => x > 1).count((x) => x > 2)\n", "python"), "sum(1 for");
    // a class of the type definitions too: what its method gives is known by the member's name
    has(&build("f(file: Path) string = file.readText().trim()\n", "python"), ".strip()");
}

// ---------- found by the library of helpers (nuclear-synapsis-framework/lodash, 2026-11-21) ----------

#[test]
fn a_lambda_takes_its_parameters_types_from_the_function_it_is_given_to() {
    // `(i) => i.name.upper()`: `i` is the T that `items` fixes
    let src = "Item(name: string)\n\nuniqBy<T>(xs: T[], key: (x: T) => string) T[]\n  xs\n\nmain() void\n  items = [Item(\"a\")]\n  print(uniqBy(items, (i) => i.name.upper()).length)\n";
    has(&ts(src), "uniqBy(items, (i) => i.name.toUpperCase())");
    // in a list of functions the lambda writes its types: Dart cannot infer them there
    let list = "Item(age: int)\n\norderBy<T>(xs: T[], keys: ((x: T) => double)[]) T[]\n  xs\n\nmain() void\n  items = [Item(1)]\n  print(orderBy(items, [(i) => i.age.toDouble()]).length)\n";
    has(&build(list, "dart"), "[(Item i) => i.age.toDouble()]");
}

#[test]
fn slices_and_substrings_are_clamped_the_same_in_every_target() {
    let src = "f(xs: int[], s: string) string = xs.slice(1, 99).join(\",\") + s.substring(3, 1)\n";
    has(&build(src, "dart"), "_slice(xs, 1, 99)");
    has(&build(src, "dart"), "_substring(s, 3, 1)");
    // `substring` of JavaScript swaps an end before the start: `slice` does not
    has(&ts(src), "s.slice(3, 1)");
}

#[test]
fn a_method_given_as_a_value_keeps_its_object_in_typescript() {
    let src = "Dice\n  roll() int\n    4\n\ncall(f: () => int) int = f()\n\nmain() void\n  d = Dice()\n  print(call(d.roll), d.roll())\n";
    has(&ts(src), "call(d.roll.bind(d)), d.roll()");
}

#[test]
fn a_parameter_list_split_over_lines_has_no_comma_after_its_optional_group_in_dart() {
    let src = "orderBy<T>(valuesToSortInThisCall: T[], keysToSortThemBy: ((x: T) => double)[], descending: boolean[] = []) T[]\n  valuesToSortInThisCall\n";
    let code = build(src, "dart");
    has(&code, "[List<bool>? descending]\n)");
}

#[test]
fn an_optional_member_of_a_call_makes_the_call_once_in_python() {
    let src = "User(name: string)\n\nfind(id: int) User?\n  id == 1 ? User(\"a\") : null\n\nmain() void\n  print(find(1)?.name)\n";
    has(&build(src, "python"), "_opt(find(1), lambda v: v.name)");
}

#[test]
fn a_type_parameter_is_never_imported_nor_unknown() {
    // `A` is `re.A` in Python's definitions
    let code = build("Pair<A, B>(first: A, second: B)\n", "python");
    assert!(!code.contains("import A"), "{code}");
}

#[test]
fn is_of_a_map_type_is_the_targets_own_check() {
    let src = "f(x: any) boolean = x is <string, any>\n";
    has(&ts(src), "typeof x === 'object' && x !== null && !Array.isArray(x)");
    has(&build(src, "python"), "isinstance(x, dict)");
    has(&build(src, "dart"), "x is Map<String, dynamic>");
}

#[test]
fn two_texts_are_compared_with_compare_to_in_dart() {
    let code = build("f(a: string, b: string) boolean = a < b and a >= \"m\"\n", "dart");
    has(&code, "a.compareTo(b) < 0 && a.compareTo('m') >= 0");
    has(&build("f(a: int, b: int) boolean = a < b\n", "dart"), "a < b");
}

#[test]
fn a_literal_inside_a_value_declared_any_holds_any_in_dart() {
    let code = build("main() void\n  m: <string, any> = { \"a\": { \"x\": 1 }, \"l\": [1] }\n  n: <string, int> = { \"a\": 1 }\n  print(m.length, n.length)\n", "dart");
    has(&code, "{'a': <String, dynamic>{'x': 1}, 'l': <dynamic>[1]}");
    has(&code, "{'a': 1}");
}

#[test]
fn a_value_declared_any_is_shown_as_nuclear_shows_it_in_python() {
    has(&build("f(x: any) string = \"${x}\"\n", "python"), "f\"{_text(x)}\"");
}

#[test]
fn a_nullable_decimal_keeps_its_decimals_in_typescript() {
    has(&ts("mean(xs: double[]) double?\n  xs.isEmpty ? null : xs.sum() / xs.length\n\nmain() void\n  print(mean([4, 6]))\n"), "_doubleOrNull(mean([4, 6]))");
}

// ---------- the helpers of the language (helpers.rs) ----------

#[test]
fn a_file_that_calls_a_helper_gets_it_and_what_it_calls() {
    let code = ts("main() void\n  print(intersectionBy([\"a\"], [\"A\"], (s) => s.lower()).length)\n");
    has(&code, "export function intersectionBy<T>(");
    has(&code, "export function uniqBy<T>(");
    assert!(!code.contains("function chunk"), "{code}");
    // the helpers come before the file's own code
    assert!(code.find("function uniqBy").unwrap() < code.find("function main").unwrap(), "{code}");
    // a file that calls none is what it was
    assert!(!ts("main() void\n  print(1)\n").contains("uniqBy"));
}

#[test]
fn a_name_the_file_declares_or_a_member_is_never_a_helper() {
    let own = ts("chunk(n: int) int = n\n\nmain() void\n  print(chunk(2))\n");
    assert!(!own.contains("size: number"), "{own}");
    let member = ts("Repo\n  get(id: int) int\n    id\n\n  twice(id: int) int\n    get(id) * 2\n\nmain() void\n  print(Repo().get(1))\n");
    assert!(!member.contains("pathKeys"), "{member}");
}

#[test]
fn a_helper_wins_over_a_function_of_the_target_with_its_name() {
    // `zip` and `range` are Python's own: the Nuclear of a file means the same in every dialect
    let code = build("main() void\n  print(zip([1], [\"a\"]).length, range(0, 4, 2).length)\n", "python");
    has(&code, "def zip[A, B](xs: list[A], ys: list[B]) -> list[Pair[A, B]]:");
    has(&code, "def range_(start: int, end: int, step: int = 1) -> list[int]:");
    has(&code, "len(range_(0, 4, 2))");
}

#[test]
fn a_helper_keeps_the_positions_of_the_file() {
    // an error after a helper call is reported where the file has it
    let src = "main() void\n  print(chunk([1], 1).length)\n  print(nothing)\n";
    let out = nuclear_transpile::transpile(src, &dialect("typescript"));
    let d = out.diagnostics.iter().find(|d| d.code.id == "N0106").expect("N0106");
    assert_eq!(&src[d.span.start..d.span.end], "nothing");
    assert_eq!(out.diagnostics.len(), 1, "{:#?}", out.diagnostics);
}

#[test]
fn an_override_calls_the_method_its_definition_requires() {
    // `must_call_super` of the type definitions (State.initState first, State.dispose last): the kind writes the call
    let src = "stateful Clock(start: int = 0)\n  count: int = 0\n\n  initState() void\n    count = start\n\n  \
               didUpdateWidget(oldWidget: Clock) void\n    count = 1\n\n  dispose() void\n    print(\"bye\")\n\n  \
               build(context: BuildContext) Widget\n    Text(\"${count}\")\n";
    let code = build(src, "flutter");
    has(&code, "void initState() {\n    super.initState();\n    count = widget.start;\n  }");
    has(&code, "super.didUpdateWidget(oldWidget);\n    count = 1;");
    has(&code, "print('bye');\n    super.dispose();\n  }");
    // written by the user: never twice
    let own = "stateful Clock\n  initState() void\n    super.initState()\n    print(\"x\")\n\n  \
               build(context: BuildContext) Widget\n    Text(\"x\")\n";
    assert_eq!(build(own, "flutter").matches("super.initState()").count(), 1);
    // a method no definition marks gets nothing
    assert!(!build(src, "flutter").contains("super.build("));
    // a mixin's requirement, in a method that returns its value: the call goes before it
    let keep = "stateful Tab with AutomaticKeepAliveClientMixin\n  get wantKeepAlive() boolean = true\n\n  \
                build(context: BuildContext) Widget = Text(\"x\")\n";
    has(&build(keep, "flutter"), "super.build(context);\n    return Text('x');");
    // teardown is last by the dialect's `super_call_last`, also where the definitions' documentation says nothing
    let notifier = "Store: ChangeNotifier\n  dispose() void\n    print(\"bye\")\n";
    has(&build(notifier, "flutter"), "print('bye');\n    super.dispose();\n  }");
    let cubit = "Counter: Cubit<int>\n  ()\n    super(0)\n\n  close() Future<void>\n    print(\"bye\")\n";
    has(&build(cubit, "flutter"), "print('bye');\n    return super.close();\n  }");
}

#[test]
fn an_exact_number_mixed_with_another_number_type_is_reported() {
    // N0119: nothing converts an exact number silently; a literal takes the exact type of its place
    for src in [
        "f(big: bigint, n: int) void\n  print(big + n)\n",
        "f(price: bigdouble) void\n  x: double = price\n  print(x)\n",
        "f(n: int) void\n  x: bigint = n\n  print(x)\n",
        "f(a: bigint, b: bigdouble) void\n  print(a * b)\n",
        "f() void\n  x: bigint = 1.5\n  print(x)\n",
        "f(big: bigint) void\n  print(big + 0.5)\n",
        "f() void\n  n = 12345678901234567890\n  print(n)\n",
        "g(x: bigint) bigint = x\nf(n: int) void\n  print(g(n))\n",
    ] {
        for d in ["typescript", "dart", "python"] {
            assert!(codes(src, d).contains(&"N0119"), "{d}: {src}");
        }
    }
    let ok = "f(n: int) bigint\n  big: bigint = 12345678901234567890\n  x: bigdouble = 0.1\n  print(big + 1, x * 3, x == 0.3, big ~/ 2, big ** 2, n.toBigInt() + big, -big)\n  0\n";
    for d in ["typescript", "dart", "python"] {
        build(ok, d);
    }
    // the literals are written as exact values, never through a binary number
    let out = ts(ok);
    assert!(out.contains("12345678901234567890n") && out.contains("BigDouble.of('0.1')") && out.contains("return 0n;"), "{out}");
}

#[test]
fn an_operation_the_exact_numbers_do_not_have_is_reported() {
    // N0120: no exact `/` of two bigint, no bitwise operators, no `is`, no Math, no JSON number
    for src in [
        "f(a: bigint, b: bigint) void\n  print(a / b)\n",
        "f(a: bigint) void\n  print(a & 1)\n",
        "f(x: any) void\n  print(x is bigint)\n",
        "f(a: bigdouble) void\n  print(Math.sqrt(a))\n",
        "f(id: bigint) void\n  print(Json.encode({ \"id\": id }))\n",
        "f(xs: bigint[]) void\n  print(xs.sum())\n",
        "f(xs: bigdouble[]) void\n  print(xs.sorted())\n",
    ] {
        assert!(codes(src, "typescript").contains(&"N0120"), "{src}");
    }
    build("f(id: bigint) void\n  print(Json.encode({ \"id\": id.toString() }))\n", "typescript");
}

#[test]
fn a_literal_given_for_an_exact_field_takes_its_type() {
    // the named arguments that build a class (`Price(amount = 1.5)`) and the decorators of an exact field
    let src = "Price\n  amount: bigdouble\n  code: bigint = 1\n\nf() void\n  p = Price(amount = 1.5, code = 12345678901234567890)\n  print(p.amount)\n";
    let py = build(src, "python");
    assert!(py.contains("amount=Decimal(\"1.5\"), code=12345678901234567890"), "{py}");
    let out = ts(src);
    assert!(out.contains("amount: BigDouble.of('1.5')") && out.contains("code: 12345678901234567890n"), "{out}");
    // a decimal literal for a bigint field is N0119, as anywhere a bigint goes
    assert!(codes("Price\n  code: bigint = 1\n\nf() void\n  print(Price(code = 1.5).code)\n", "typescript").contains(&"N0119"));
}

#[test]
fn exact_collections_and_arguments_compare_values() {
    // a literal argument of compareTo takes the receiver's exact type; another number is N0119
    let src = "f(big: bigint, n: int) void\n  print(big.compareTo(5))\n";
    assert!(ts(src).contains("_compare(big, 5n)"));
    for d in ["typescript", "dart", "python"] {
        assert!(codes("f(big: bigint, n: int) void\n  print(big.compareTo(n))\n", d).contains(&"N0119"), "{d}");
    }
    // lists, maps and `in` of exact decimals compare values in TypeScript (its `==` and `includes` compare objects)
    let src = "f(xs: bigdouble[], ys: bigdouble[], x: bigdouble) void\n  print(xs == ys, xs != ys, x in xs, 0.5 in xs)\n";
    let out = ts(src);
    assert!(out.contains("_equalsExact(xs, ys)") && out.contains("!_equalsExact(xs, ys)") && out.contains("_inExact(xs, BigDouble.of('0.5'))"), "{out}");
    assert!(codes("f() void\n  s = Set<bigdouble>()\n  print(s.length)\n", "typescript").contains(&"N0120"));
}

#[test]
fn a_name_of_the_definitions_written_only_as_a_member_is_not_imported() {
    // `big.pow(3)` is BigInt's method, not dart:math's `pow`; a word in a text is no name either
    let member = build("f(big: bigint) void\n  print(big ** 3, \"pow max\")\n", "dart");
    assert!(!member.contains("dart:math"), "{member}");
    let function = build("f(n: int) void\n  print(n ** 3)\n", "dart");
    assert!(function.contains("import 'dart:math'"), "{function}");
}
