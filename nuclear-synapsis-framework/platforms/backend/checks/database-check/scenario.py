"""The one scenario of database-check: it drives a running store_api over HTTP, the same requests whatever the
dialect it was built with and whatever its database, and writes every answer, normalized, to a file. check.sh compares
the files: the same Nuclear must answer the same bytes in every dialect on every database.

Run: python scenario.py <base url> <database url or SQLite file> <answers file>

Normalized: an id becomes the order its row was made in (`customer#1`), `createdAt` / `updatedAt` their shape
(`0000-00-00T00:00:00.000Z`), rows in a list of related rows are sorted by id. What the scenario asserts by itself
(not by comparison): the statuses, the rollbacks (with SQL on the database), the cascade, the concurrent requests.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from typing import Any

import db

base, database, out_file = sys.argv[1], sys.argv[2], sys.argv[3]
answers: list[dict[str, Any]] = []
# what differs by database or by run and is not compared: said in the stage's line
notes: list[str] = []
# real id → the order its row was made in, per table
ids: dict[str, dict[int, int]] = {"customer": {}, "order": {}, "tag": {}}
STAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$")


def call(method: str, path: str, body: Any = None) -> tuple[int, Any]:
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(base + path, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=30) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b"null")
        except ValueError:
            return e.code, raw.decode(errors="replace")


def kind_of(row: dict[str, Any]) -> str:
    return "customer" if "email" in row else "tag" if "label" in row else "order"


def alias(kind: str, real: Any) -> Any:
    if not isinstance(real, int):
        return real
    known = ids[kind]
    if real not in known:
        known[real] = len(known) + 1
    return f"{kind}#{known[real]}"


def normal(value: Any) -> Any:
    if isinstance(value, list):
        rows = [normal(v) for v in value]
        return rows
    if isinstance(value, float) and value.is_integer():
        return int(value)  # 401.0 and 401 are one number: each language writes it its way
    if not isinstance(value, dict):
        return value
    out: dict[str, Any] = {}
    for key, v in sorted(value.items()):
        if key == "id":
            out[key] = alias(kind_of(value), v)
        elif key == "customerId":
            out[key] = alias("customer", v)
        elif key in ("createdAt", "updatedAt"):
            if not (isinstance(v, str) and STAMP.match(v)):
                raise AssertionError(f"{key} is not a timestamp: {v!r}")
            written = datetime.fromisoformat(v.replace("Z", "+00:00"))
            if written.tzinfo is None:
                raise AssertionError(f"{key} has no time zone: {v!r}")
            if abs(datetime.now(UTC) - written) > timedelta(minutes=10):
                raise AssertionError(f"{key} is not now: {v!r}")
            out[key] = re.sub(r"\d", "0", v)
        elif key in ("orders", "tags") and isinstance(v, list):
            # related rows come in the order the database gives them: by id here
            out[key] = sorted((normal(x) for x in v), key=lambda r: int(str(r["id"]).split("#")[1]))
        else:
            out[key] = normal(v)
    return out


def error_of(status: int, body: Any) -> Any:
    """The body of an error is Nuclear's, the same in every dialect (ADR-synapsis-0013): its status, its message and
    the reasons of an invalid request. Only the ids a message names are made the scenario's own."""
    if not isinstance(body, dict):
        return body

    def row(m: re.Match[str]) -> str:
        known = ids[m.group(1).lower()].get(int(m.group(2)))
        return f"{m.group(1)} #{known}" if known else m.group(0)

    return {**body, "message": re.sub(r"\b(customer|order|tag) (\d+)\b", row, str(body.get("message")), flags=re.IGNORECASE)}


def step(name: str, method: str, path: str, body: Any = None, expect: int = 200) -> Any:
    status, answer = call(method, path, body)
    if status != expect:
        raise AssertionError(f"{name}: {method} {path} answered {status}, expected {expect}: {json.dumps(answer)[:600]}")
    answers.append({"step": name, "status": status, "body": normal(answer) if status < 400 else error_of(status, answer)})
    return answer


def sql(query: str) -> Any:
    return db.scalar(database, query)


def same(name: str, got: Any, expected: Any) -> None:
    if got != expected:
        raise AssertionError(f"{name}: {got!r}, expected {expected!r}")


def main() -> None:
    q = urllib.parse.quote
    # the rows the migrations' check left
    db.execute(database, "DELETE FROM orders", "DELETE FROM customers")

    # --- CRUD, the defaults, values the databases treat differently
    unicode_name = "Ana María Ñandú 日本語 😀 'quoted' \"double\" \\ %_"
    ana = step("create ana", "POST", "/customers", {"email": "ana@example.com", "name": unicode_name, "nickname": "", "vip": True, "credit": 1234.5}, 201)
    same("unicode kept", ana["name"], unicode_name)
    same("an empty text is not null", ana["nickname"], "")
    same("the column the migration added has its default", ana.get("points"), 7)
    luis = step("create luis: the defaults", "POST", "/customers", {"email": "luis@example.com", "name": "luis"}, 201)
    same("defaults", (luis["vip"], luis["credit"], luis["nickname"]), (False, 0, None))
    step("a repeated email is a conflict", "POST", "/customers", {"email": "ana@example.com", "name": "Other"}, 409)
    step("an invalid customer", "POST", "/customers", {"email": "nope", "name": "", "credit": -1}, 400)
    step("an empty body", "POST", "/customers", {}, 400)
    step("a text where a number goes", "POST", "/customers", {"email": "x@example.com", "name": "x", "credit": "much"}, 400)
    step("read ana", "GET", f"/customers/{ana['id']}")
    step("a missing customer", "GET", "/customers/999999", expect=404)
    changed = step("change luis", "PUT", f"/customers/{luis['id']}", {"email": "luis@example.com", "name": "Luis Pérez", "credit": 0.1}, 200)
    same("the change is kept", (changed["name"], changed["credit"], changed["vip"]), ("Luis Pérez", 0.1, False))
    step("change a missing customer", "PUT", "/customers/999999", {"email": "no@example.com", "name": "no"}, 404)

    # --- pages, search, filters, order
    for i in range(1, 8):
        step(f"create customer {i}", "POST", "/customers", {"email": f"c{i}@example.com", "name": f"customer {i:02}", "vip": i % 2 == 0, "credit": i * 100.25}, 201)
    page = step("page 2 of 3 rows", "GET", "/customers/page?page=2&size=3")
    same("page", (len(page["items"]), page["page"], page["size"], page["total"], page["pages"]), (3, 2, 3, 9, 3))
    step("the last page", "GET", "/customers/page?page=3&size=3")
    empty = step("a page after the last", "GET", "/customers/page?page=4&size=3")
    same("empty page", (empty["items"], empty["total"]), ([], 9))
    step("page 0 is page 1", "GET", "/customers/page?page=0&size=2")
    found = step("search in any case", "GET", "/customers/search?text=CUSTOMER&page=1&size=5")
    same("search", (found["total"], found["pages"], [c["name"] for c in found["items"]][:2]), (7, 2, ["customer 01", "customer 02"]))
    step("search page 2", "GET", "/customers/search?text=CUSTOMER&page=2&size=5")
    step("search a text with a quote", "GET", f"/customers/search?text={q(chr(39) + 'quoted')}&page=1&size=5")
    step("search nothing", "GET", "/customers/search?text=nobody&page=1&size=5")
    vips = step("the vips by credit", "GET", "/customers/vips?credit=300")
    same("vips", [c["credit"] for c in vips], [1234.5, 601.5, 401.0])
    step("the first page of the list", "GET", "/customers?page=1")

    # --- orders: numbers, texts, null, timestamps with a time zone
    long_note = ("línea ñ 日本 😀 " * 200)[:2000]
    first = step(
        "create an order", "POST", "/orders",
        {"customerId": ana["id"], "quantity": 3, "total": 19.99, "note": long_note, "placedAt": "2026-03-04T05:06:07+02:00"}, 201,
    )
    same("a long text kept", first["note"], long_note)
    same("defaults of an order", (first["status"], first["paid"]), ("pending", False))
    same("the instant kept", datetime.fromisoformat(first["placedAt"].replace("Z", "+00:00")), datetime(2026, 3, 4, 3, 6, 7, tzinfo=UTC))
    step("an order with large numbers", "POST", "/orders", {"customerId": ana["id"], "quantity": 2147483647, "total": 123456789012.125, "note": "", "placedAt": "2026-12-31T23:59:59Z"}, 201)
    small = step("an order with negative numbers", "POST", "/orders", {"customerId": ana["id"], "quantity": -2147483648, "total": -0.000001, "paid": True, "status": "sent"}, 201)
    same("null kept", (small["note"], small["placedAt"]), (None, None))
    step("an order with a sum of decimals", "POST", "/orders", {"customerId": ana["id"], "total": 0.1 + 0.2}, 201)
    # not compared: MySQL and MariaDB keep a DateTime to the second, the others to the millisecond (the roadmap)
    precise = call("POST", "/orders", {"customerId": luis["id"], "total": 1, "placedAt": "2026-12-31T23:59:59.123Z"})[1]
    kept = call("GET", f"/orders/{precise['id']}")[1]["placedAt"]
    notes.append(f"the milliseconds of a DateTime: {'kept' if kept.endswith('.123Z') else 'lost'}")
    same("the probe is gone", call("DELETE", f"/orders/{precise['id']}")[0], 200)
    step("an order of a missing customer", "POST", "/orders", {"customerId": 999999, "total": 1}, 404)
    step("an order without a total", "POST", "/orders", {"customerId": ana["id"]}, 400)
    step("read the order", "GET", f"/orders/{first['id']}")
    step("the orders of ana by total", "GET", f"/orders/of/{ana['id']}?minTotal=0")
    step("the orders of ana of at least 1", "GET", f"/orders/of/{ana['id']}?minTotal=1")
    unnoted = step("the orders without a note", "GET", "/orders/unnoted")
    same("an empty note is not a missing one", len(unnoted), 2)
    cleared = step("change the order: null over a value", "PUT", f"/orders/{first['id']}", {"customerId": ana["id"], "quantity": 1, "total": 5, "note": None, "placedAt": None}, 200)
    same("null written", (cleared["note"], cleared["placedAt"]), (None, None))

    # --- relations
    tagged = step("tag the order", "PUT", f"/orders/{first['id']}/tags", {"labels": ["gift", "urgent", "日本"]})
    same("tags", sorted(t["label"] for t in tagged["tags"]), ["gift", "urgent", "日本"])
    step("tag it again with one", "PUT", f"/orders/{first['id']}/tags", {"labels": ["gift"]})
    full = step("the order with its customer and its tags", "GET", f"/orders/{first['id']}/full")
    same("loaded relations", (full["customer"]["email"], [t["label"] for t in full["tags"]]), ("ana@example.com", ["gift"]))
    plain = step("the order alone has no relations", "GET", f"/orders/{first['id']}")
    same("unloaded relations are absent", [k for k in ("customer", "tags") if k in plain], [])
    step("the tags", "GET", "/tags?page=1")
    loaded = step("ana with her orders and their tags", "GET", f"/customers/{ana['id']}/orders")
    same("orders loaded", len(loaded["orders"]), 4)
    step("tag a missing order", "PUT", "/orders/999999/tags", {"labels": ["gift"]}, 404)

    # --- transactions: an Err after a write takes the write back
    before = sql(f"SELECT COUNT(*) FROM orders WHERE customer_id = {ana['id']}")
    step("a checkout", "POST", "/orders/checkout", {"customerId": ana["id"], "total": 1000, "note": "paid with credit"}, 201)
    same("credit taken", sql(f"SELECT credit FROM customers WHERE id = {ana['id']}"), 234.5)
    step("a checkout without credit", "POST", "/orders/checkout", {"customerId": ana["id"], "total": 1000, "note": "never kept"}, 409)
    same("the refused order was not kept", sql(f"SELECT COUNT(*) FROM orders WHERE customer_id = {ana['id']}"), before + 1)
    same("no order with that note", sql("SELECT COUNT(*) FROM orders WHERE note = 'never kept'"), 0)
    same("the credit is as it was", sql(f"SELECT credit FROM customers WHERE id = {ana['id']}"), 234.5)
    for total in (1, 2, 3):
        step(f"an order of luis {total}", "POST", "/orders", {"customerId": luis["id"], "total": total}, 201)
    step("luis pays too many at once", "POST", f"/orders/pay/{luis['id']}", expect=409)
    same("none was paid", sql(f"SELECT COUNT(*) FROM orders WHERE customer_id = {luis['id']} AND (paid OR status = 'paid')"), 0)
    paid = step("ana pays hers", "POST", f"/orders/pay/{ana['id']}", expect=201)
    same("paid", paid["count"], 4)
    same("paid in the database", sql(f"SELECT COUNT(*) FROM orders WHERE customer_id = {ana['id']} AND paid AND status = 'paid'"), 4)
    step("a missing customer pays", "POST", "/orders/pay/999999", expect=404)

    # --- concurrent requests
    with ThreadPoolExecutor(16) as pool:
        made = list(pool.map(lambda i: call("POST", "/customers", {"email": f"p{i}@example.com", "name": f"parallel {i:02}"})[0], range(32)))
        same("32 customers at once", made, [201] * 32)
        reads = list(pool.map(lambda i: call("GET", "/customers/page?page=1&size=50")[1]["total"], range(32)))
        same("32 reads at once", reads, [41] * 32)
        race = sorted(pool.map(lambda i: call("POST", "/customers", {"email": "race@example.com", "name": f"race {i}"})[0], range(16)))
    same("one email, one row", sql("SELECT COUNT(*) FROM customers WHERE email = 'race@example.com'"), 1)
    same("one request made it", race.count(201), 1)
    # a loser the use case saw is a 409; one only the unique column stopped is the database's error
    notes.append(f"16 requests for one email: {', '.join(f'{race.count(c)} × {c}' for c in sorted(set(race)))}")
    same("the count after them", call("GET", "/customers/page?page=9&size=5")[1]["total"], 42)

    # --- delete: the row, its orders by the foreign key, then nothing
    step("delete an order", "DELETE", f"/orders/{first['id']}")
    step("the deleted order", "GET", f"/orders/{first['id']}", expect=404)
    same("its tags are no longer joined", sql("SELECT COUNT(*) FROM orders_tags"), 0)
    step("delete luis", "DELETE", f"/customers/{luis['id']}")
    same("his orders went with him", sql(f"SELECT COUNT(*) FROM orders WHERE customer_id = {luis['id']}"), 0)
    step("delete luis again", "DELETE", f"/customers/{luis['id']}", expect=404)

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(answers, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    print(f"{len(answers)} answers, the rollbacks and the cascade checked in the database; {'; '.join(notes)}")


main()
