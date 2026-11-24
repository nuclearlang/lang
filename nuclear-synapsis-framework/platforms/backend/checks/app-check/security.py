"""The security probes of app-check: the same hostile requests to the app built with each dialect, the answers
compared. A probe is a finding when the dialects answer differently (the status; for an error, its whole body, which
is Nuclear's and the same everywhere: ADR-synapsis-0013), when an answer is not the one the probe wants, or when an
error shows what it must not (a stack, SQL, a path, the name of what runs underneath).

The apps (check.sh starts them, production mode):
  store on SQLite      store_api with the probe routes, no `origins`: SQL injection, what CORS allows by default
  store on PostgreSQL  the same with `origins = ["http://localhost:5173"]`: SQL injection, errors, bodies, CORS
  store in development the PostgreSQL one with NUCLEAR_ENV=development and NUCLEAR_DEV_ORIGINS: CORS of development
  tasks on SQLite      tasks_api: the guards `NoOrigin` and `Token`, a controller's guard, the WebSocket

Run: python security.py <work folder> <tasks token> <owner token>     (appends its findings to <work>/findings)
"""

from __future__ import annotations

import http.client
import http.server
import json
import re
import socket
import sys
import threading
from collections.abc import Callable
from typing import Any
from urllib.parse import quote, urlsplit

from websockets.exceptions import ConnectionClosed, InvalidStatus
from websockets.sync.client import connect

work, TASKS, OWNER = sys.argv[1], sys.argv[2], sys.argv[3]
DIALECTS = ("fastapi", "nestjs")
Answer = tuple[int, dict[str, str], bytes]
findings: dict[str, str] = {}
ran = 0

# what an answer never shows: the stack, the SQL, a path of the machine, what runs underneath
LEAKS = re.compile(
    rb"Traceback|File \"|\bat .*\(.*:\d+:\d+\)|node_modules|site-packages|/home/|/tmp/|sqlalchemy|sequelize|asyncpg|sqlite3?\b|"
    rb"\bSELECT\b|\bINSERT\b|pydantic|class-validator|NestJS|FastAPI|Starlette|Express|uvicorn|SQLSTATE|syntax error",
    re.IGNORECASE,
)


def apps(name: str) -> dict[str, str]:
    with open(f"{work}/urls-{name}", encoding="utf-8") as f:
        return {line.split()[0]: line.split()[1] for line in f if line.strip()}


def raw(base: str, method: str, path: str, body: bytes | None = None, headers: list[tuple[str, str]] | None = None) -> Answer:
    """One request, written as given: no header added but Host and, with a body, Content-Length."""
    u = urlsplit(base)
    c = http.client.HTTPConnection(u.hostname or "", u.port, timeout=60)
    try:
        c.putrequest(method, path, skip_accept_encoding=True)
        for k, v in headers or []:
            c.putheader(k, v)
        if body is not None:
            c.putheader("Content-Length", str(len(body)))
        c.endheaders()
        if body is not None:
            c.send(body)
        r = c.getresponse()
        return r.status, {k.lower(): v for k, v in r.getheaders()}, r.read()
    except (OSError, http.client.HTTPException) as e:
        return 0, {}, f"no answer: {type(e).__name__}".encode()
    finally:
        c.close()


JSON = [("Content-Type", "application/json")]


def short(a: Answer) -> str:
    return f"{a[0]} {a[2][:150].decode(errors='replace')}".strip()


def error_of(a: Answer) -> Any:
    try:
        return json.loads(a[2])
    except ValueError:
        return a[2][:80]


def finding(name: str, said: str) -> None:
    findings[name] = " ".join(said.split())


def probe(
    name: str, bases: dict[str, str], method: str, path: str, body: Any = None, headers: list[tuple[str, str]] | None = None,
    want: int | tuple[int, ...] | Callable[[Answer], bool] | None = None, same: bool = True,
) -> dict[str, Answer]:
    """The request to every dialect. `want`: the status (or statuses, or a test of the answer) every dialect must
    give; `same`: the dialects must answer the same status and, for an error, the same body."""
    global ran
    ran += 1
    if body is not None and not isinstance(body, bytes):
        body, headers = json.dumps(body).encode(), [*JSON, *(headers or [])]
    got = {d: raw(bases[d], method, path, body, headers) for d in DIALECTS}
    problems: list[str] = []
    for d, a in got.items():
        ok = want is None or (want(a) if callable(want) else a[0] in ((want,) if isinstance(want, int) else want))
        if not ok:
            problems.append(f"{d} is not what the probe wants")
        if a[0] >= 400 and LEAKS.search(a[2]):
            problems.append(f"{d} shows {LEAKS.search(a[2]).group(0).decode()!r}")  # type: ignore[union-attr]
    f, n = got["fastapi"], got["nestjs"]
    if same and (f[0] != n[0] or (f[0] >= 400 and error_of(f) != error_of(n))):
        problems.append("the dialects differ")
    if problems:
        sent = f"{method} {path[:120]}" + (f" body {body[:100]!r}" if body else "") + (f" headers {headers}" if headers and headers != JSON else "")
        finding(name, f"{'; '.join(problems)}. {sent} → fastapi {short(f)} | nestjs {short(n)}")
    return got


def rows(a: Answer) -> int:
    try:
        v = json.loads(a[2])
    except ValueError:
        return -1
    return len(v["items"] if isinstance(v, dict) and "items" in v else v) if isinstance(v, (list, dict)) else -1


def count(n: int) -> Callable[[Answer], bool]:
    return lambda a: a[0] == 200 and rows(a) == n


# ---------------------------------------------------------------------------------------------------------------
def injection(bases: dict[str, str], db: str) -> None:
    """SQL injection through everything a request reaches: the path, the query, a body and every repository word
    whose value, field, direction or limit comes from the request (probes/probe_repository.nuc)."""
    t = f"@{db}"
    for i in (1, 2, 3):
        probe(f"seed{t}", bases, "POST", "/customers", {"email": f"c{i}@example.com", "name": f"cust{i}", "credit": i}, want=201)
    hostile = ["' OR '1'='1", "'; DROP TABLE customers; --", "\" OR 1=1 --", "1); DELETE FROM customers; --", "\\'; SELECT pg_sleep(5); --", "%' UNION SELECT 1,2,3,4,5,6,7,8 --"]
    for i, h in enumerate(hostile):
        q = quote(h)
        # a value is a value: a text with SQL in it matches no row and changes nothing
        probe(f"inject.like.{i}{t}", bases, "GET", f"/probe/named?pattern={q}", want=count(0))
        probe(f"inject.ilike.{i}{t}", bases, "GET", f"/probe/alike?pattern={q}", want=count(0))
        probe(f"inject.contains.{i}{t}", bases, "GET", f"/probe/holding?text={q}", want=count(0))
        probe(f"inject.icontains.{i}{t}", bases, "GET", f"/customers/search?text={q}&page=1&size=5", want=count(0))
        probe(f"inject.oneOf.{i}{t}", bases, "GET", f"/probe/among?emails=c1@example.com,{q}", want=count(1))
        probe(f"inject.between.{i}{t}", bases, "GET", f"/probe/ranged?low=cust1&high={q}", want=lambda a: a[0] == 200)
        probe(f"inject.path.{i}{t}", bases, "GET", f"/customers/{q}", want=(400, 404))
        probe(f"inject.int.{i}{t}", bases, "GET", f"/customers/page?page=1&size={q}", want=400)
        probe(f"inject.double.{i}{t}", bases, "GET", f"/customers/vips?credit={q}", want=400)
        # a field or a direction that comes from a request is refused, never written into the query
        probe(f"inject.orderBy.field.{i}{t}", bases, "GET", f"/probe/sorted?field={q}&desc=false&max=2&skip=0", want=(400, 500))
        # (which texts are true or false is compared by `param.boolean.*`)
        probe(f"inject.orderBy.desc.{i}{t}", bases, "GET", f"/probe/sorted?field=name&desc={q}&max=2&skip=0", want=(200, 400), same=False)
        probe(f"inject.limit.{i}{t}", bases, "GET", f"/probe/sorted?field=name&desc=false&max={q}&skip=0", want=400)
        probe(f"inject.offset.{i}{t}", bases, "GET", f"/probe/sorted?field=name&desc=false&max=2&skip={q}", want=400)
        made = probe(f"inject.body.{i}{t}", bases, "POST", "/customers", {"email": f"h{i}@example.com", "name": h}, want=201)
        for d in DIALECTS:
            if made[d][0] == 201 and json.loads(made[d][2])["name"] != h:
                finding(f"inject.body.kept.{i}{t}", f"{d} did not keep the text as it was sent")
    # a field that is not a column of the entity: its relation, an attribute of the library underneath
    for field in ("nope", "orders", "metadata", "__table__", "constructor", "sequelize", "customers.name", "name, id", "name DESC", "1"):
        probe(f"orderBy.field.{field}{t}", bases, "GET", f"/probe/sorted?field={quote(field)}&desc=false&max=2&skip=0", want=(400, 500))
    probe(f"orderBy.field.snake{t}", bases, "GET", "/probe/sorted?field=created_at&desc=false&max=2&skip=0")
    probe(f"orderBy.field.camel{t}", bases, "GET", "/probe/sorted?field=createdAt&desc=false&max=2&skip=0", want=200)
    probe(f"limit.negative{t}", bases, "GET", "/probe/sorted?field=name&desc=false&max=-1&skip=0")
    probe(f"offset.negative{t}", bases, "GET", "/probe/sorted?field=name&desc=false&max=2&skip=-1")
    probe(f"limit.huge{t}", bases, "GET", "/probe/sorted?field=name&desc=false&max=99999999999999999999&skip=0", want=400)
    probe(f"page.huge{t}", bases, "GET", "/customers/page?page=99999999999&size=99999999999", want=(200, 400))
    # a pattern's wildcards are the caller's (`like`, `ilike`); a client's text is a text (`contains`, `icontains`):
    # of the names above only one holds a %, one a _ and one a backslash, none a /
    probe(f"like.wildcard{t}", bases, "GET", "/probe/named?pattern=%25", want=lambda a: a[0] == 200 and rows(a) > 3)
    for name, text in (("percent", "%25"), ("underscore", "_"), ("backslash", "%5C")):
        probe(f"contains.{name}{t}", bases, "GET", f"/probe/holding?text={text}", want=count(1))
        probe(f"icontains.{name}{t}", bases, "GET", f"/customers/search?text={text}&page=1&size=50", want=count(1))
    probe(f"contains.escape{t}", bases, "GET", "/probe/holding?text=%2F", want=count(0))
    probe(f"text.nul{t}", bases, "POST", "/customers", {"email": "nul@example.com", "name": "a\u0000b"}, want=(201, 400))
    probe(f"int.beyond32{t}", bases, "POST", "/orders", {"customerId": 1, "total": 1, "quantity": 2147483648}, want=(201, 400))
    probe(f"int.beyond64{t}", bases, "POST", "/orders", {"customerId": 1, "total": 1, "quantity": 99999999999999999999}, want=400)
    # after all of it the table is there, with the rows that were made and no other
    left = probe(f"inject.survived{t}", bases, "GET", "/customers/page?page=1&size=1", want=200)
    totals = {d: json.loads(a[2]).get("total") for d, a in left.items() if a[0] == 200}
    if len(set(totals.values())) != 1:
        finding(f"inject.rows{t}", f"the dialects kept different rows: {totals}")


def parameters(bases: dict[str, str]) -> None:
    """A parameter of the path or the query: what is a whole number, a number, true or false; one that is missing."""
    for name, value in (("hex", "0x1"), ("exponent", "1e0"), ("plus", "+1"), ("space", "%201"), ("fraction", "1.0"), ("empty", "%20")):
        probe(f"param.int.{name}", bases, "GET", f"/customers/{value}")
    for name, value in (("NaN", "NaN"), ("Infinity", "Infinity"), ("overflow", "1e400"), ("hex", "0x10"), ("empty", "")):
        probe(f"param.double.{name}", bases, "GET", f"/customers/vips?credit={value}")
    for name, value in (("one", "1"), ("yes", "yes"), ("True", "True"), ("maybe", "maybe"), ("empty", "")):
        probe(f"param.boolean.{name}", bases, "GET", f"/probe/sorted?field=name&desc={value}&max=1&skip=0")
    probe("param.default", bases, "GET", "/customers", want=200)  # `list(page: int = 1)`
    probe("param.missing.text", bases, "GET", "/probe/named", want=400)
    probe("param.missing.int", bases, "GET", "/customers/page", want=400)
    probe("param.repeated", bases, "GET", "/probe/sorted?field=name&field=email&desc=false&max=1&skip=0", want=(200, 400))
    # a size beyond the app's largest page (100 by default) is answered with that many rows, and says so
    probe("page.size.unbounded", bases, "GET", "/customers/page?page=1&size=1000000000", want=lambda a: a[0] == 200 and json.loads(a[2]).get("size") == 100)


def errors(bases: dict[str, str]) -> None:
    """What an error and the server's own headers reveal; the documents an app serves in production."""
    seen = {
        "404": probe("error.404", bases, "GET", "/nope", want=404),
        "400": probe("error.400", bases, "POST", "/customers", {"email": "nope", "name": ""}, want=400),
        "500": probe("error.500", bases, "GET", "/customers/draft?email=nope", want=500),
        "500.database": probe("error.500.database", bases, "GET", "/probe/sorted?field=nope&desc=false&max=1&skip=0", want=(400, 500)),
        "200": probe("answer.200", bases, "GET", "/customers/page?page=1&size=1", want=200),
    }
    for header in ("server", "x-powered-by"):
        told = {d: a[1][header] for d, a in seen["200"].items() if header in a[1]}
        if told:
            finding(f"header.{header}", f"every answer names what runs underneath: {header}: {told}")
    extra = {d: sorted(set(a[1]) - {"content-type", "content-length", "date", "server", "x-powered-by", "connection", "keep-alive"}) for d, a in seen["200"].items()}
    if extra["fastapi"] != extra["nestjs"]:
        finding("header.others", f"the headers of a 200 differ: {extra}")
    for path in ("/docs", "/redoc", "/openapi.json", "/.nuclear/contract.json", "/.nuclear/openapi.json", "/.nuclear/lines.json", "/.env", "/.nuclear/..%2f.env", "/.git/config"):
        probe(f"served.{path}", bases, "GET", path)
    for method in ("OPTIONS", "HEAD", "TRACE", "PATCH", "DELETE"):
        probe(f"method.{method}", bases, method, "/customers")
    probe("method.HEAD.one", bases, "HEAD", "/customers/1")
    probe("path.traversal", bases, "GET", "/customers/..%2f..%2fetc%2fpasswd", want=(400, 404))
    probe("path.long", bases, "GET", "/customers/" + "9" * 20000, want=lambda a: a[0] >= 400, same=False)
    probe("header.long", bases, "GET", "/customers/1", headers=[("X-Long", "a" * 100000)], want=lambda a: a[0] in (0, 200, 400, 431), same=False)


def bodies(bases: dict[str, str]) -> None:
    """A body that is too large, too deep, not what its content type says, or that carries more than the model lists."""
    mass = {"email": "mass@example.com", "name": "mass", "id": 777, "createdAt": "2000-01-01T00:00:00Z", "updatedAt": "2000-01-01T00:00:00Z",
            "points": 1000000, "orders": [{"total": 1}], "__proto__": {"vip": True}, "constructor": {"prototype": {"vip": True}}, "extra": "x"}
    for d, a in probe("mass.customer", bases, "POST", "/customers", mass, want=201).items():
        if a[0] == 201:
            row = json.loads(a[2])
            if row["id"] == 777 or row["createdAt"].startswith("2000") or row["vip"] or row.get("points") != 7 or "extra" in row or "orders" in row:
                finding(f"mass.customer.{d}", f"a client set what the model does not list: {short(a)}")
    order = {"customerId": 1, "total": 1, "id": 555, "createdAt": "2000-01-01T00:00:00Z", "customer": {"id": 2, "email": "z@example.com", "name": "z"}, "tags": [{"label": "hack"}]}
    for d, a in probe("mass.order", bases, "POST", "/orders", order, want=201).items():
        if a[0] == 201 and (json.loads(a[2])["id"] == 555 or json.loads(a[2])["createdAt"].startswith("2000") or "tags" in json.loads(a[2])):
            finding(f"mass.order.{d}", f"a client set what the model does not list: {short(a)}")
    probe("body.200KB", bases, "POST", "/customers", {"email": "big@example.com", "name": "n", "nickname": "x" * 200_000}, want=(400, 413))
    probe("body.2MB", bases, "POST", "/customers", {"email": "big@example.com", "name": "n", "nickname": "x" * 2_000_000}, want=(400, 413))
    probe("body.30MB", bases, "POST", "/customers", {"email": "big@example.com", "name": "n", "nickname": "x" * 30_000_000}, want=413)
    # under the limit (1 MB), a text longer than its column: what the database refuses for integrity (409)
    probe("body.note.1MB", bases, "POST", "/orders", {"customerId": 1, "total": 1, "note": "x" * 1_000_000}, want=409)
    probe("body.deep", bases, "POST", "/customers", b"[" * 50_000 + b"]" * 50_000, JSON, want=400)
    probe("body.deep.field", bases, "POST", "/customers", b'{"email":"d@example.com","name":' + b"[" * 50_000 + b"]" * 50_000 + b"}", JSON, want=400)
    probe("body.number.huge", bases, "POST", "/customers", b'{"email":"n1@example.com","name":"n","credit":1e999}', JSON, want=400)
    probe("body.number.digits", bases, "POST", "/orders", b'{"customerId":1,"total":1,"quantity":' + b"9" * 5000 + b"}", JSON, want=400)
    probe("body.number.precision", bases, "POST", "/orders", b'{"customerId":9007199254740993,"total":1}', JSON, want=(400, 404))
    probe("body.list", bases, "POST", "/customers", [{"email": "p@example.com", "name": "p"}], want=400)
    probe("body.text", bases, "POST", "/customers", b'"text"', JSON, want=400)
    probe("body.null", bases, "POST", "/customers", b"null", JSON, want=400)
    probe("body.empty", bases, "POST", "/customers", b"", JSON, want=400)
    probe("body.repeated.key", bases, "POST", "/customers", b'{"email":"k1@example.com","email":"k2@example.com","name":"k"}', JSON, want=(201, 400))
    probe("body.invalid.utf8", bases, "POST", "/customers", b'{"email":"u8@example.com","name":"\xff\xfe\xc3"}', JSON, want=400)
    probe("body.on.get", bases, "GET", "/customers/1", {"email": "g@example.com", "name": "g"}, want=200)
    valid = b'{"email":"ct%d@example.com","name":"content type"}'
    # only JSON is a body: a form or a text is what a web page can send to another origin without asking (CSRF)
    for i, (name, kind) in enumerate((("form", "application/x-www-form-urlencoded"), ("text", "text/plain"), ("multipart", "multipart/form-data; boundary=x"), ("xml", "application/xml"),
                                      ("upper", "APPLICATION/JSON"), ("utf16", "application/json; charset=utf-16"), ("suffix", "application/vnd.api+json"))):
        probe(f"content.{name}", bases, "POST", "/customers", valid % i, [("Content-Type", kind)])
    probe("content.none", bases, "POST", "/customers", valid % 8)
    probe("content.form.body", bases, "POST", "/customers", b"email=form@example.com&name=form", [("Content-Type", "application/x-www-form-urlencoded")], want=(400, 415))


def cors(bases: dict[str, str], listed: bool) -> None:
    """What a browser on another origin is allowed: nothing without `origins`, only the listed origins with it."""
    t = "listed" if listed else "default"
    # production: an address of this machine on another port is one more unlisted origin
    cors_of(bases, t, ("http://localhost:5173", "http://127.0.0.1:49152", "https://evil.example", "null"), {"http://localhost:5173"} if listed else set())


def cors_development(bases: dict[str, str]) -> None:
    """In development (`NUCLEAR_ENV=development`): also the registry's addresses (`NUCLEAR_DEV_ORIGINS`) and any port
    of `localhost`, `127.0.0.1` and `[::1]`; never a look-alike, another host or credentials."""
    good = ("http://localhost:5173", "http://127.0.0.1:49152", "http://localhost:8081", "http://[::1]:3000", "http://192.168.1.20:8080")
    bad = ("https://evil.example", "http://localhost.evil.example", "http://127.0.0.1.evil.example", "http://192.168.1.21:8080", "null")
    cors_of(bases, "development", good + bad, set(good))


def cors_of(bases: dict[str, str], t: str, origins: tuple[str, ...], allowed: set[str]) -> None:
    def allows(a: Answer) -> str:
        return a[1].get("access-control-allow-origin", "")

    for origin in origins:
        for name, method, headers in (
            ("get", "GET", [("Origin", origin)]),
            ("preflight", "OPTIONS", [("Origin", origin), ("Access-Control-Request-Method", "DELETE"), ("Access-Control-Request-Headers", "authorization, content-type")]),
        ):
            got = probe(f"cors.{t}.{name}.{origin}", bases, method, "/customers/page?page=1&size=1", headers=headers, same=False)
            given = {d: allows(a) for d, a in got.items()}
            should = origin if origin in allowed else ""
            if name == "preflight" and any(a[0] != (200 if should else 403) for a in got.values()):
                finding(f"cors.{t}.preflight.{origin}.status", f"the preflight should answer {200 if should else 403}: {dict((d, a[0]) for d, a in got.items())}")
            if any(v != should for v in given.values()):
                finding(f"cors.{t}.{name}.{origin}.allowed", f"Access-Control-Allow-Origin should be {should!r}: {given}")
            if name == "preflight" and (got["fastapi"][0] != got["nestjs"][0] or any("access-control-allow-credentials" in a[1] for a in got.values())):
                finding(f"cors.{t}.preflight.{origin}.answer", f"the preflight differs: fastapi {got['fastapi'][0]} {dict((k, v) for k, v in got['fastapi'][1].items() if k.startswith('access'))} | "
                                                                f"nestjs {got['nestjs'][0]} {dict((k, v) for k, v in got['nestjs'][1].items() if k.startswith('access'))}")


def guards(bases: dict[str, str]) -> None:
    """`NoOrigin`, `Token` and a controller's own guard as the reference defines them, and the ways around them."""
    ok = [("X-Tasks-Token", TASKS)]
    owner = [("Authorization", f"Bearer {OWNER}")]
    probe("guard.none", bases, "GET", "/tasks", want=401)
    probe("guard.token", bases, "GET", "/tasks", headers=ok, want=200)
    probe("guard.wrong", bases, "GET", "/tasks", headers=[("X-Tasks-Token", TASKS[:-1] + "x")], want=401)
    probe("guard.prefix", bases, "GET", "/tasks", headers=[("X-Tasks-Token", TASKS[:-1])], want=401)
    probe("guard.longer", bases, "GET", "/tasks", headers=[("X-Tasks-Token", TASKS + "x")], want=401)
    probe("guard.empty", bases, "GET", "/tasks", headers=[("X-Tasks-Token", "")], want=401)
    probe("guard.header.case", bases, "GET", "/tasks", headers=[("x-tasks-TOKEN", TASKS)], want=200)
    probe("guard.value.case", bases, "GET", "/tasks", headers=[("X-Tasks-Token", TASKS.upper())], want=401)
    probe("guard.spaces", bases, "GET", "/tasks", headers=[("X-Tasks-Token", f"  {TASKS}  ")])
    probe("guard.bearer.elsewhere", bases, "GET", "/tasks", headers=[("X-Tasks-Token", f"Bearer {TASKS}")], want=401)
    probe("guard.repeated.right.first", bases, "GET", "/tasks", headers=[("X-Tasks-Token", TASKS), ("X-Tasks-Token", "wrong")], want=401)
    probe("guard.repeated.wrong.first", bases, "GET", "/tasks", headers=[("X-Tasks-Token", "wrong"), ("X-Tasks-Token", TASKS)], want=401)
    probe("guard.query", bases, "GET", f"/tasks?X-Tasks-Token={TASKS}&token={TASKS}", want=401)
    probe("guard.origin", bases, "GET", "/tasks", headers=[*ok, ("Origin", "https://evil.example")], want=403)
    probe("guard.origin.null", bases, "GET", "/tasks", headers=[*ok, ("Origin", "null")], want=403)
    probe("guard.origin.first", bases, "GET", "/tasks", headers=[("Origin", "https://evil.example")], want=403)
    for method in ("OPTIONS", "HEAD", "POST", "DELETE"):
        probe(f"guard.none.{method}", bases, method, "/tasks", want=lambda a: a[0] in (401, 404, 405))
        probe(f"guard.none.{method}.one", bases, method, "/tasks/1", want=lambda a: a[0] in (401, 404, 405))
    probe("guard.preflight", bases, "OPTIONS", "/tasks", headers=[("Origin", "https://evil.example"), ("Access-Control-Request-Method", "GET")],
          want=lambda a: a[0] >= 400 and "access-control-allow-origin" not in a[1])
    probe("guard.missing.route", bases, "GET", "/nope", want=(401, 404))
    probe("guard.path.case", bases, "GET", "/TASKS", want=(401, 404))
    probe("guard.path.slash", bases, "GET", "/tasks/", want=(401, 404))
    probe("guard.path.double.slash", bases, "GET", "//tasks", want=(401, 404))
    probe("guard.path.encoded", bases, "GET", "/%74asks", want=(401, 404))
    for path in ("/docs", "/redoc", "/openapi.json", "/.nuclear/contract.json", "/.nuclear/openapi.json"):
        probe(f"guard.served.{path}", bases, "GET", path, want=(401, 404))
        probe(f"guard.served.token.{path}", bases, "GET", path, headers=ok)
    # the controller's own guard, after the app's
    probe("guard.controller.none", bases, "GET", "/projects/1", headers=ok, want=401)
    probe("guard.controller.both", bases, "GET", "/projects/1", headers=[*ok, *owner], want=404)
    probe("guard.controller.only", bases, "GET", "/projects/1", headers=owner, want=401)
    probe("guard.controller.swapped", bases, "GET", "/projects/1", headers=[*ok, ("Authorization", f"Bearer {TASKS}")], want=401)
    probe("guard.controller.no.bearer", bases, "GET", "/projects/1", headers=[*ok, ("Authorization", OWNER)])
    probe("guard.controller.bearer.case", bases, "GET", "/projects/1", headers=[*ok, ("Authorization", f"bearer {OWNER}")])
    probe("guard.controller.basic", bases, "GET", "/projects/1", headers=[*ok, ("Authorization", f"Basic {OWNER}")], want=401)
    probe("guard.controller.two.spaces", bases, "GET", "/projects/1", headers=[*ok, ("Authorization", f"Bearer  {OWNER}")], want=401)


# ---------------------------------------------------------------------------------------------------------------
def ws_url(base: str, path: str = "/ws") -> str:
    return "ws" + base[len("http"):] + path


def upgrade(base: str, headers: dict[str, str], path: str = "/ws") -> str:
    """How the upgrade ends: `open`, or the status that refused it."""
    try:
        with connect(ws_url(base, path), additional_headers=headers, open_timeout=5):
            return "open"
    except InvalidStatus as e:
        return str(e.response.status_code)
    except Exception as e:
        return type(e).__name__


def frames(base: str, sent: list[str | bytes], headers: dict[str, str], wait: float = 3.0) -> str:
    """Sends the frames and says what came back: each answer's status, then how the socket ended."""
    out: list[str] = []
    try:
        with connect(ws_url(base), additional_headers=headers, open_timeout=10, max_size=None) as ws:
            for s in sent:
                ws.send(s)
            # a last request whose answer says the socket is still served
            ws.send(json.dumps({"id": "alive", "method": "GET", "path": "/tasks/999999"}))
            alive = False
            while True:
                try:
                    got = json.loads(ws.recv(timeout=0.5 if alive else wait))
                except TimeoutError:
                    out.append("alive" if alive else "silent")
                    break
                if got.get("id") == "alive":  # the answers come in any order: a little longer for the others
                    alive = True
                else:
                    out.append(f"{got.get('status', got.get('event'))}")
    except ConnectionClosed as e:
        out.append(f"closed {e.rcvd.code if e.rcvd else 'abnormally'}")
    except Exception as e:
        out.append(type(e).__name__)
    return " ".join(out)


def both(name: str, run: Callable[[str], str], bases: dict[str, str], want: str | tuple[str, ...] | None = None) -> dict[str, str]:
    global ran
    ran += 1
    got = {d: run(bases[d]) for d in DIALECTS}
    wanted = (want,) if isinstance(want, str) else want
    if got["fastapi"] != got["nestjs"] or (wanted and any(v not in wanted for v in got.values())):
        finding(name, f"{'want ' + ' or '.join(wanted) + ': ' if wanted else 'the dialects differ: '}fastapi {got['fastapi']} | nestjs {got['nestjs']}")
    return got


class Catcher(http.server.BaseHTTPRequestHandler):
    """A server that is not the app: a request that reaches it left the app (and carried its headers)."""

    caught: list[str] = []

    def do_GET(self) -> None:
        Catcher.caught.append(f"{self.path} token={'yes' if TASKS in str(self.headers) else 'no'}")
        self.send_response(200)
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"{}")

    def log_message(self, format: str, *args: Any) -> None:
        pass


def sockets(bases: dict[str, str]) -> None:
    """The app's WebSocket: its guards, frames that are not requests, routes it must not serve."""
    global ran
    token = {"X-Tasks-Token": TASKS}
    both("ws.upgrade.none", lambda b: upgrade(b, {}), bases, ("401", "403"))
    both("ws.upgrade.wrong", lambda b: upgrade(b, {"X-Tasks-Token": "wrong"}), bases, ("401", "403"))
    both("ws.upgrade.origin", lambda b: upgrade(b, {**token, "Origin": "https://evil.example"}), bases, "403")
    both("ws.upgrade.token", lambda b: upgrade(b, token), bases, "open")
    both("ws.upgrade.query", lambda b: upgrade(b, {}, f"/ws?X-Tasks-Token={TASKS}"), bases, ("401", "403"))
    # an upgrade on a path that is not the socket's is answered, not left open
    both("ws.upgrade.other.path", lambda b: upgrade(b, token, "/tasks"), bases)
    both("ws.upgrade.path.slash", lambda b: upgrade(b, token, "/ws/"), bases)
    both("ws.request", lambda b: frames(b, [json.dumps({"id": 1, "method": "GET", "path": "/tasks"})], token), bases, "200 alive")
    both("ws.frame.not.json", lambda b: frames(b, ["{nope"], token), bases, "closed 1003")
    both("ws.frame.binary", lambda b: frames(b, [b"\x00\x01\xff"], token), bases)
    both("ws.frame.headers.not.object", lambda b: frames(b, ['{"id": 1, "path": "/tasks", "headers": "x"}'], token), bases)
    both("ws.frame.method.unknown", lambda b: frames(b, ['{"id": 1, "method": "NOPE", "path": "/tasks"}'], token), bases)
    both("ws.frame.path.number", lambda b: frames(b, ['{"id": 1, "path": 5}'], token), bases)
    both("ws.frame.1MB", lambda b: frames(b, [json.dumps({"id": 1, "method": "POST", "path": "/tasks", "body": {"title": "x" * 1_000_000}})], token), bases)
    both("ws.frame.20MB", lambda b: frames(b, [json.dumps({"id": 1, "method": "POST", "path": "/tasks", "body": {"title": "x" * 20_000_000}})], token, 15), bases)
    both("ws.frame.deep.body", lambda b: frames(b, ['{"id": 1, "method": "POST", "path": "/tasks", "body": ' + "[" * 50_000 + "]" * 50_000 + "}"], token), bases)
    # a controller's guard answers over the socket as over HTTP; a frame's own headers add to the upgrade's
    both("ws.guard.controller", lambda b: frames(b, ['{"id": 1, "method": "GET", "path": "/projects/1"}'], token), bases, "401 alive")
    both("ws.guard.controller.header", lambda b: frames(b, [json.dumps({"id": 1, "method": "GET", "path": "/projects/1", "headers": {"Authorization": f"Bearer {OWNER}"}})], token), bases, "404 alive")
    both("ws.guard.frame.origin", lambda b: frames(b, ['{"id": 1, "method": "GET", "path": "/tasks", "headers": {"Origin": "https://evil.example"}}'], token), bases, "403 alive")
    both("ws.guard.frame.token.emptied", lambda b: frames(b, ['{"id": 1, "method": "GET", "path": "/tasks", "headers": {"X-Tasks-Token": ""}}'], token), bases)
    both("ws.guard.frame.headers.socket", lambda b: frames(b, ['{"id": 1, "path": "/tasks", "headers": {"Host": "evil.example", "Content-Length": "0", "Transfer-Encoding": "chunked"}}'], token), bases)
    both("ws.route.missing", lambda b: frames(b, ['{"id": 1, "method": "GET", "path": "/nope"}'], token), bases, "404 alive")
    both("ws.route.contract", lambda b: frames(b, ['{"id": 1, "method": "GET", "path": "/.nuclear/contract.json"}'], token), bases, "200 alive")
    # a path that is not a path of the app: the request must never leave the app. Another server listens beside it;
    # `<digit>/x` after the app's own address would name the port <app's port><digit> (check.sh gives these apps a
    # port below 6553 so that port exists)
    for name, path in (("userinfo", "@127.0.0.1:{port}/stolen"), ("absolute", "http://127.0.0.1:{port}/stolen"), ("scheme.relative", "//127.0.0.1:{port}/stolen"), ("port.suffix", "{digit}/stolen")):
        told: dict[str, str] = {}
        for d in DIALECTS:
            mine = urlsplit(bases[d]).port or 0
            server, digit = None, 0
            for digit in range(10):
                try:
                    server = http.server.ThreadingHTTPServer(("127.0.0.1", mine * 10 + digit if name == "port.suffix" else 0), Catcher)
                    break
                except (OSError, OverflowError):
                    continue
            if server is None:
                told[d] = "not run: no port beside the app's"
                continue
            threading.Thread(target=server.serve_forever, daemon=True).start()
            Catcher.caught.clear()
            said = frames(bases[d], [json.dumps({"id": 1, "method": "GET", "path": path.format(port=server.server_address[1], digit=digit)})], token)
            told[d] = f"{said}{', and another server received ' + str(Catcher.caught) if Catcher.caught else ''}"
            server.shutdown()
            server.server_close()
        ran += 1
        if told["fastapi"] != told["nestjs"] or any("received" in v or "not run" in v for v in told.values()):
            finding(f"ws.path.{name}", f"a frame with the path {path!r}: fastapi {told['fastapi']} | nestjs {told['nestjs']}")
    # last, the frames that are JSON and not an object: one that stops the app ends these probes
    for name, text in (("empty.object", "{}"), ("id.only", '{"id": 7}'), ("text", '"x"'), ("list", "[1]"), ("number", "5"), ("deep", "[" * 50_000 + "]" * 50_000), ("null", "null")):
        got = both(f"ws.frame.{name}", lambda b, text=text: frames(b, [text], token), bases)
        down = [d for d in DIALECTS if raw(bases[d], "GET", "/tasks", headers=[("X-Tasks-Token", TASKS)])[0] != 200]
        if down:
            finding(f"ws.frame.{name}", f"THE APP STOPPED ({', '.join(down)}): one frame {text[:20]!r} from a client ends the process. fastapi {got['fastapi']} | nestjs {got['nestjs']}")
            break


def binding(name: str, bases: dict[str, str]) -> None:
    """The address the server listens on by default: this machine only, or every network it is on."""
    probe_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe_socket.connect(("192.0.2.1", 9))  # no packet is sent: it only names the address of the default route
        mine = probe_socket.getsockname()[0]
    except OSError:
        return
    finally:
        probe_socket.close()
    reached: dict[str, bool] = {}
    for d in DIALECTS:
        s = socket.socket()
        s.settimeout(3)
        reached[d] = s.connect_ex((mine, urlsplit(bases[d]).port or 0)) == 0
        s.close()
    if any(reached.values()):
        finding(f"bind.{name}", f"with no host given, the server answers on the machine's network address, not only on 127.0.0.1: {reached}")


def main() -> int:
    tasks, lite, pg = apps("tasks"), apps("sqlite"), apps("postgres")
    injection(lite, "sqlite")
    cors(lite, listed=False)
    injection(pg, "postgres")
    parameters(pg)
    errors(pg)
    bodies(pg)
    cors(pg, listed=True)
    cors_development(apps("dev"))
    guards(tasks)
    sockets(tasks)
    binding("store", pg)
    for d in DIALECTS:  # every app is still answering
        for name, bases in (("store.sqlite", lite), ("store.postgres", pg)):
            if raw(bases[d], "GET", "/customers/page?page=1&size=1")[0] != 200:
                finding(f"down.{name}.{d}", "the app no longer answers after the probes")
    with open(f"{work}/findings", "a", encoding="utf-8") as f:
        for name, said in findings.items():
            f.write(f"security {name} | {said}\n")
    print(f"security: {ran} probes to each dialect, {len(findings)} findings")
    return 0


sys.exit(main())
