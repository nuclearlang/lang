"""The logs of app-check: every line every step printed (the build, the checker, `nuclear migrate`, the app in
development and in production mode, the project's tests, the apps of the security and performance stages) is read.

  1. Each line must be on ALLOW (what a healthy run prints), on CAUSES (the error that ends the stack of a 500 the
     scenario or a probe provokes on purpose) or on KNOWN (a warning or an error that is a defect, written in the
     roadmap and not fixed yet): a pattern, whose line it is (the tool, the runtime, the generated code, a
     dependency) and why it is there. A stack is read as one line: the error that ends it. A line that is on no
     pattern fails the check: a new warning, a deprecation notice, an error nobody decided to accept. A pattern of
     KNOWN that no line matches any more fails it too: the defect is fixed, the pattern is deleted.
  2. No log holds a secret of the run: the database's password, a guard's token, a request's body.
  3. What one request leaves in each dialect's log is compared (a line per request? the cause of a 500?): what
     differs is a finding (`logs <id>`), known or not as known.txt says.

Run: python logs.py <logs folder> <database password> <tasks token> <owner token> <findings file>
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

folder, findings_file = Path(sys.argv[1]), sys.argv[5]
SECRETS = {"the database's password": sys.argv[2], "the token of a guard": sys.argv[3], "the token of a controller's guard": sys.argv[4], "a request's body": "appcheck-body-canary"}

# (pattern, whose line it is, why it is allowed)
ALLOW: list[tuple[str, str, str]] = [
    # --- the tool
    (r"^\w+: \d+ files → \./build$", "nuclear build", "the summary of a build"),
    (r"^(no migrations in |wrote |applied |reverted |pending  |applied  |no changes|nothing to revert|nothing to apply)", "nuclear migrate", "what each migrate command answers"),
    (r"^\$ (nuclear build \.|sh -c )", "nuclear migrate", "the commands it runs, said before each: the build, then the dialect's migrate command"),
    (r"^npm notice run ", "npm (a tool)", "what `npx` runs, said by npm: three lines for each migrate command of a nestjs project (the compiler, then the runtime's migrate)"),
    (r"^0 errors, 0 warnings, 0 informations ?$|^tsc --strict: 0 errors$", "the checker", "pyright and tsc found nothing"),
    (r"^\d+ answers, the rollbacks and the cascade checked in the database; ", "the scenario", "the database check's scenario passed"),
    # --- the project's tests
    (r"^\.+ +\[\d+%\]$|^\d+ passed(, \d+ warnings?)? in [\d.]+s$", "pytest", "the tests passed"),
    (r"^=+ warnings summary =+$|^\.venv/lib/python[\d.]+/site-packages/langsmith/\S+: \d+ warnings?$|/site-packages/langsmith/_internal/_beta_decorator\.py:\d+: DeprecationWarning: 'asyncio\.iscoroutinefunction' is deprecated|^    if asyncio\.iscoroutinefunction\(func\):$|^-- Docs: https://docs\.pytest\.org/en/stable/how-to/capture-warnings\.html$",
     "langsmith (a dependency of LangChain)", "pytest's summary of a deprecation notice of langsmith on Python 3.14: no line of the platform's"),
    (r"^ *[✔▶] .*\(\d+(\.\d+)?ms\)$|^▶ |^ℹ (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) [\d.]+$", "node:test", "the tests passed"),
    # --- the app's own line of a request, the same in every dialect
    (r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z [A-Z]+ /\S* \d{3} \d+ms$", "the runtime", "the line of a request: time, method, path without its query, status, duration"),
    # --- the server, fastapi
    (r"^INFO: +(Started server process \[\d+\]|Waiting for application startup\.|Application startup complete\.|Uvicorn running on http://127\.0\.0\.1:\d+ \(Press CTRL\+C to quit\)|"
     r"Shutting down|Waiting for application shutdown\.|Application shutdown complete\.|Finished server process \[\d+\])$", "uvicorn (a dependency)", "the server starting and stopping"),
    (r"^INFO: +(Will watch for changes in these directories: |Started reloader process \[\d+\] using WatchFiles|Stopping reloader process \[\d+\])", "uvicorn (a dependency)", "development mode: the reloader"),
    (r"^WARNING: +Invalid HTTP request received\.$", "uvicorn (a dependency)", "a request the server could not read (the probes send a path of 20000 characters and a header of 100000)"),
    # --- the server, nestjs
    (r"^\[Nest\] \d+  - \S+ \S+( [AP]M)? +LOG \[(NestFactory|InstanceLoader|RoutesResolver|RouterExplorer|NestApplication)\] ", "NestJS (a dependency)", "the server starting: its modules and every route it mapped"),
    (r"^(Restarting|Completed running|Failed running) 'dist/src/main\.js'|^Waiting for file changes before restarting\.\.\.$", "node --watch", "development mode: the watcher"),
]

# the causes of the 500s the scenario and the probes provoke on purpose: the last line of each stack
CAUSES: list[tuple[str, str, str]] = [
    (r"^pydantic_core\._pydantic_core\.ValidationError: 1 validation error\(s\) for NewCustomer: email: ", "the generated code (fastapi)", "the scenario: a model built in code that breaks its rule (GET /customers/draft?email=nope)"),
    (r"^Error: NewCustomer is not valid: email must be an e-mail address$", "the generated code (nestjs)", "the scenario: a model built in code that breaks its rule (GET /customers/draft?email=nope)"),
    (r"^(synapsis\.repository\.)?InvalidField: Customer has no column of that name$", "the runtime", "the probes: orderBy with a field that is no column (never named: it is the client's text)"),
    (r"^SequelizeDatabaseError: \w+( \(code \w+\))?$", "the runtime (nestjs)", "the probes: a value beyond its column's range on PostgreSQL (the database's code, never its SQL)"),
    (r"^sqlalchemy\.exc\.(DataError|DBAPIError|ProgrammingError|OperationalError): \w+( \(code \w+\))?$", "the runtime (fastapi)",
     "the probes: a value beyond its column's range on PostgreSQL (the database's code, never its parameters)"),
    (r"^sqlalchemy\.exc\.TimeoutError: QueuePool limit of size \d+ overflow \d+ reached", "the runtime (fastapi)", "APPCHECK_POOL=1: the connection pool exhausted on purpose; a request that waited 30 seconds for a connection answers 500"),
    (r"^SequelizeConnectionAcquireTimeoutError: ", "the runtime (nestjs)", "APPCHECK_POOL=1: the connection pool exhausted on purpose"),
]

# defects that print a line today (the backend roadmap, "Found by the app check"): (pattern, whose, why, the log it is in)
KNOWN: list[tuple[str, str, str, str]] = []

ANSI = re.compile(r"\x1b\[[0-9;]*m")
allowed = [(re.compile(p), who, why) for p, who, why in ALLOW] + [(re.compile(p), who, f"KNOWN: {why}") for p, who, why, _ in KNOWN]
causes = [(re.compile(p), who, why) for p, who, why in CAUSES]


def events(text: str) -> list[str]:
    """The lines of a log, a stack as one line: `STACK <the error that ends it>`."""
    out: list[str] = []
    lines = [ANSI.sub("", line).rstrip() for line in text.splitlines()]
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("Traceback (most recent call last):") or line.lstrip("| +").startswith(("Traceback (most recent call last):", "Exception Group Traceback")):
            # Python: indented lines, then the error; a chained stack ("During handling", "The above exception") goes on
            last = ""
            i += 1
            while i < len(lines):
                cur = lines[i]
                bare = cur.lstrip("| +-")
                if cur.startswith((" ", "\t", "|", "+")) or not cur or bare.startswith(("Traceback", "During handling", "The above exception", "Exception Group")):
                    if cur.startswith(("  |", "    |")) and re.match(r"^[\w.]+(Error|Exception|Disconnect)\b", bare):
                        last = bare
                    i += 1
                    continue
                if re.match(r"^[\w.]+(Error|Exception|Exit|Interrupt|Disconnect|Warning)\b|^\w+(\.\w+)+: ", cur):
                    last = cur
                    i += 1
                    # pydantic says each field and its value after the error
                    if "ValidationError" in cur:
                        while i < len(lines) and (re.match(r"^[\w.]+$", lines[i]) or lines[i].startswith("  ")):
                            i += 1
                    # SQLAlchemy says the statement and its parameters after the error, to the line of its link
                    if cur.startswith("sqlalchemy.") and any(l.startswith("(Background on this error at:") for l in lines[i:i + 40]):
                        while not lines[i].startswith("(Background on this error at:"):
                            i += 1
                        i += 1
                    continue
                break
            out.append(f"STACK {last}")
            continue
        if re.match(r"^\d{4}-\d\d-\d\dT\S+Z ERROR [A-Z]+ /\S* ", line):
            # the cause of a 500, the same head in every dialect, then its stack (indented)
            out.append(f"STACK {line.split(' ', 4)[4]}")
            i += 1
            while i < len(lines) and lines[i].startswith(" "):
                i += 1
            continue
        if re.match(r"^(file://|/)\S+:\d+$", line) and i + 3 < len(lines):
            # Node: the place, the source line, the caret, then the error and its `at` lines
            j = i + 1
            while j < len(lines) and not re.match(r"^\w*(Error|Exception)\b", lines[j]):
                j += 1
            if j < len(lines):
                out.append(f"STACK {lines[j]}")
                i = j + 1
                while i < len(lines) and (lines[i].startswith("    at ") or not lines[i] or lines[i].startswith("Node.js v")):
                    i += 1
                continue
        if re.match(r"^\w*(Error|Exception): ", line) and i + 1 < len(lines) and lines[i + 1].startswith("    at "):
            out.append(f"STACK {line}")
            i += 1
            while i < len(lines) and (lines[i].startswith("    at ") or lines[i].startswith(("  [cause]", "}", "  ")) and "at " in lines[i]):
                i += 1
            continue
        if line.strip():
            out.append(line)
        i += 1
    return out


def main() -> int:
    failed = False
    findings: dict[str, str] = {}
    used: Counter[str] = Counter()
    seen: dict[str, dict[str, list[str]]] = {}
    for path in sorted(folder.glob("*/*.log")):
        dialect = path.parent.name
        text = path.read_text(errors="replace")
        for what, secret in SECRETS.items():
            # (the probes guard.query and ws.upgrade.query write the token in a URL themselves, to see it refused)
            told = [l for l in text.splitlines() if secret in l and not re.search(r"[?&](X-Tasks-Token|token)=", l)]
            if told:
                line = told[0]
                print(f"FAIL logs {dialect}/{path.name}: {what} is in the log: {ANSI.sub('', line)[:200].replace(secret, '<the secret>')}")
                failed = True
        lines = events(text)
        seen.setdefault(dialect, {})[path.name] = lines
        unknown: Counter[str] = Counter()
        for line in lines:
            table = causes if line.startswith("STACK ") else allowed
            hit = next(((who, why) for rx, who, why in table if rx.search(line.removeprefix("STACK "))), None)
            if hit:
                used[f"{dialect:8} {hit[0]:28} {hit[1]}"] += 1
            else:
                unknown[re.sub(r"\d+", "N", line)[:260]] += 1
        for line, n in unknown.most_common(15):
            print(f"FAIL logs {dialect}/{path.name}: a line that is not allowed ({n} times): {line}")
            failed = True
    for said, n in sorted(used.items()):
        print(f"     {n:6} × {said}")
    for pattern, _, why, where in KNOWN:
        log = folder / where
        if log.is_file() and not any(re.search(pattern, line) for line in events(log.read_text(errors="replace"))):
            print(f"FAIL logs {where}: a known line is no longer printed (delete its pattern of KNOWN in logs.py): {why}")
            failed = True

    # --- what a request leaves in the log, in each dialect (the production run of the scenario)
    for dialect, files in sorted(seen.items()):
        prod = files.get("prod.log")
        if prod is None:
            continue
        requests = sum(1 for l in prod if re.search(r"\b[A-Z]+ /\S* \d{3} \d+ms$", l))
        stacks = [l for l in prod if l.startswith("STACK ")]
        print(f"     {dialect}: the production run of the scenario left {len(prod)} lines: {requests} of a request, {len(stacks)} causes of a 500")
        if requests == 0:
            findings[f"logs {dialect}.requests.silent"] = "the app logs no line for a request (no method, path, status or time): the dialects' logs cannot be compared"
        if not stacks:
            findings[f"logs {dialect}.500.silent"] = "a 500 leaves nothing in the log: the client is told `error` and the cause is nowhere"
        text = "\n".join(prod)
        if ANSI.search((folder / dialect / "prod.log").read_text(errors="replace")):
            findings[f"logs {dialect}.colours"] = "the log written to a file holds the terminal's colour codes"
        if re.search(r"\[parameters: |input_value=", (folder / dialect / "prod.log").read_text(errors="replace")):
            findings[f"logs {dialect}.500.values"] = "the stack of a 500 holds values a client sent (a database error: `[parameters: (...)]`; a model: `input_value='...'`)"
        if "?" in "".join(re.findall(r"\b[A-Z]+ (/\S*) \d{3} \d+ms$", text, re.MULTILINE)):
            findings[f"logs {dialect}.requests.query"] = "the line of a request holds its whole query: a value a client sends there is in the log (a guard's token never is: guards read headers)"
    with open(findings_file, "a", encoding="utf-8") as f:
        for name, said in findings.items():
            f.write(f"{name} | {said}\n")
    return 1 if failed else 0


sys.exit(main())
