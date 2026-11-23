"""The performance stage of app-check: the same load on the app built with each dialect, one at a time, in
production mode on one PostgreSQL, and the SQL statements one request costs.

  performance.py run <dialect> <base url> <app pid> <start-up ms> <postgres container> <database> <work folder>
  performance.py compare <work folder>

`run` seeds the database over HTTP (120 customers; customer 1 with 5 orders of 3 tags, customer 2 with 20), then for
each route of ROUTES: counts the statements of one request in the server's statement log (`log_statement = all`,
turned on only while it counts, 5 requests one after another), then runs load.mjs three times (CONNECTIONS
connections, REQUESTS requests each, after a warm-up) with the statement log off, and reads the machine's load
before each run and the app's memory after. It writes <work>/performance-<dialect>.json.

`compare` prints the table and fails on: an error under load; a route that costs more statements than its bound
(ROUTES); a list with a relation whose statements grow with its rows (N + 1); a dialect more than RATIO times slower
than the other on a route. It never fails on a speed by itself: machines differ.

With APPCHECK_POOL=1, `run` also exhausts the connection pool: it locks the table for LOCK seconds and sends 40
requests at once, then says how many connections the app opened and what each request answered, and when.
"""

from __future__ import annotations

import json
import os
import statistics
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

CONNECTIONS, REQUESTS, WARM_UP, RUNS = 32, 3000, 300, 3
# generous on purpose: two languages and two libraries, one process each, on a machine that does other work. A
# dialect ten times slower than the other on the same route is a defect, not a difference of runtimes.
RATIO = 10
LOCK = 75
# route: (method, path, body, the most SQL statements one request may cost, transaction control included)
ROUTES: dict[str, tuple[str, str, str, int]] = {
    "read one row": ("GET", "/customers/1", "-", 3),
    "a page of 20": ("GET", "/customers/page?page=2&size=20", "-", 6),
    "a row with a relation (5 orders, 3 tags each)": ("GET", "/customers/1/orders", "-", 6),
    "a row with a relation (20 orders, 3 tags each)": ("GET", "/customers/2/orders", "-", 6),
    "a write": ("POST", "/customers", '{"email":"load{n}@example.com","name":"load {n}"}', 6),
    "a write in a transaction (@transactional)": ("POST", "/orders/checkout", '{"customerId":{c},"total":1,"note":"load"}', 8),
}
here = Path(__file__).parent


def call(base: str, method: str, path: str, body: Any = None) -> tuple[int, Any]:
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(base + path, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=180) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:200]
    except OSError as e:
        return 0, str(e)


def psql(container: str, database: str, sql: str) -> str:
    return subprocess.run(["docker", "exec", container, "psql", "-q", "-At", "-U", "postgres", "-d", database, "-c", sql], capture_output=True, text=True, check=True).stdout.strip()


def statements(container: str, database: str) -> list[str]:
    """Every statement the server logged for this database (`log_line_prefix = '%d '`)."""
    log = subprocess.run(["docker", "logs", container], capture_output=True, text=True).stderr
    out: list[str] = []
    for line in log.splitlines():
        if line.startswith(f"{database} LOG:  statement: ") or line.startswith(f"{database} LOG:  execute "):
            out.append(line.split(": ", 2)[2] if " execute " in line else line.split("statement: ", 1)[1])
    return out


def log_statements(container: str, on: bool) -> None:
    psql(container, "postgres", f"ALTER SYSTEM SET log_statement = '{'all' if on else 'none'}'")
    psql(container, "postgres", "SELECT pg_reload_conf()")
    time.sleep(0.5)


def memory_mb(pid: int) -> float:
    """The resident memory of the app: every process of its group (the server is the group's leader)."""
    total = 0
    for stat in Path("/proc").glob("[0-9]*/stat"):
        try:
            fields = stat.read_text().rsplit(") ", 1)[1].split()
            if int(fields[2]) == pid:  # pgrp
                total += int(fields[21]) * os.sysconf("SC_PAGE_SIZE")  # rss, in pages
        except (OSError, IndexError, ValueError):
            continue
    return round(total / 1e6, 1)


def machine_load() -> float:
    """The 1 minute load average per core; waits up to a minute for a quiet machine (another check may be running)."""
    cores = os.cpu_count() or 1
    for _ in range(12):
        load = os.getloadavg()[0] / cores
        if load < 0.5:
            break
        time.sleep(5)
    return round(os.getloadavg()[0] / cores, 2)


def load(base: str, method: str, path: str, body: str, requests: int, first: int) -> dict[str, Any]:
    r = subprocess.run(["node", str(here / "load.mjs"), base + path, method, body, str(CONNECTIONS), str(requests), str(first)], capture_output=True, text=True, timeout=900)
    return json.loads(r.stdout)


def seed(base: str) -> None:
    for i in range(1, 121):
        status, _ = call(base, "POST", "/customers", {"email": f"seed{i}@example.com", "name": f"seed {i:03}", "credit": 1e12, "vip": i % 2 == 0})
        assert status == 201, f"seed customer {i}: {status}"
    for customer, orders in ((1, 5), (2, 20)):
        for i in range(orders):
            status, order = call(base, "POST", "/orders", {"customerId": customer, "total": i + 1, "note": "seed"})
            assert status == 201, f"seed order: {status} {order}"
            status, _ = call(base, "PUT", f"/orders/{order['id']}/tags", {"labels": ["a", "b", f"c{i % 3}"]})
            assert status == 200, f"seed tags: {status}"


def exhaust(base: str, container: str, database: str) -> dict[str, Any]:
    """The pool with every connection busy: the table locked, 40 requests at once."""
    locker = subprocess.Popen(["docker", "exec", container, "psql", "-q", "-U", "postgres", "-d", database, "-c",
                               f"BEGIN; LOCK TABLE customers IN ACCESS EXCLUSIVE MODE; SELECT pg_sleep({LOCK}); COMMIT"], stdout=subprocess.DEVNULL)
    time.sleep(1)
    answers: list[tuple[int, float]] = []
    started = time.monotonic()

    def one() -> None:
        status, _ = call(base, "GET", "/customers/1")
        answers.append((status, round(time.monotonic() - started)))

    threads = [threading.Thread(target=one) for _ in range(40)]
    for t in threads:
        t.start()
    peak = 0
    while any(t.is_alive() for t in threads):
        peak = max(peak, int(psql(container, "postgres", f"SELECT count(*) FROM pg_stat_activity WHERE datname = '{database}' AND application_name <> 'psql'") or 0))
        time.sleep(2)
    locker.wait()
    by: dict[str, int] = {}
    for status, after in sorted(answers, key=lambda a: a[1]):
        key = f"{status} after about {after // 5 * 5} s"
        by[key] = by.get(key, 0) + 1
    return {"locked for seconds": LOCK, "requests at once": 40, "connections the app opened": peak, "answers": by, "alive after": call(base, "GET", "/customers/1")[0]}


def run(dialect: str, base: str, pid: int, startup_ms: int, container: str, database: str, work: str) -> int:
    seed(base)
    out: dict[str, Any] = {"dialect": dialect, "start-up ms": startup_ms, "memory MB after start": memory_mb(pid), "routes": {}}
    first = 1
    for name, (method, path, body, _) in ROUTES.items():
        # warm: the pool has its connections, the libraries their caches (the first use of a type costs statements)
        load(base, method, path, body, WARM_UP, first)
        first += WARM_UP
        log_statements(container, True)
        before = len(statements(container, database))
        for i in range(5):
            filled = body.replace("{n}", str(first + i)).replace("{c}", str(i + 1))
            status, answer = call(base, method, path.replace("{n}", str(first + i)), None if body == "-" else json.loads(filled))
            assert 200 <= status < 300, f"{name}: {status} {answer}"
        first += 5
        time.sleep(0.5)
        logged = statements(container, database)[before:]
        log_statements(container, False)
        runs: list[dict[str, Any]] = []
        for _ in range(RUNS):
            quiet = machine_load()
            runs.append({**load(base, method, path, body, REQUESTS, first), "machine load per core": quiet})
            first += REQUESTS
        out["routes"][name] = {
            "statements per request": len(logged) / 5,
            "the statements of one request": [s[:160] for s in logged[: len(logged) // 5]],
            "runs": runs,
            "memory MB": memory_mb(pid),
        }
        print(f"     + {dialect} {name}: {len(logged) / 5:g} statements, {[r['rps'] for r in runs]} requests/s, errors {[r['errors'] for r in runs]}")
    out["connections open after the load"] = int(psql(container, "postgres", f"SELECT count(*) FROM pg_stat_activity WHERE datname = '{database}' AND application_name <> 'psql'"))
    if os.environ.get("APPCHECK_POOL"):
        out["pool exhausted"] = exhaust(base, container, database)
        print(f"     + {dialect} pool exhausted: {out['pool exhausted']}")
    Path(work, f"performance-{dialect}.json").write_text(json.dumps(out, indent=1))
    return 0


def compare(work: str) -> int:
    results = {p.stem.split("-", 1)[1]: json.loads(p.read_text()) for p in sorted(Path(work).glob("performance-*.json"))}
    problems: list[str] = []
    median: dict[str, dict[str, float]] = {}
    print(f"     {'route':48} {'dialect':8} {'req/s (3 runs)':22} {'p50':>7} {'p95':>7} {'p99':>7} {'errors':>6} {'SQL':>5} {'MB':>6}")
    for name, (_, _, _, bound) in ROUTES.items():
        for dialect, result in results.items():
            route = result["routes"][name]
            runs = sorted(route["runs"], key=lambda r: r["rps"])
            mid = runs[len(runs) // 2]
            median.setdefault(name, {})[dialect] = mid["rps"]
            errors = sum(r["errors"] for r in runs)
            print(f"     {name:48} {dialect:8} {'/'.join(str(r['rps']) for r in route['runs']):22} {mid['p50']:7} {mid['p95']:7} {mid['p99']:7} {errors:6} {route['statements per request']:5g} {route['memory MB']:6}")
            if errors:
                problems.append(f"{dialect}, {name}: {errors} errors under load ({[r['statuses'] for r in runs]})")
            if route["statements per request"] > bound:
                problems.append(f"{dialect}, {name}: {route['statements per request']:g} SQL statements per request, more than {bound}")
        speeds = median[name]
        if len(speeds) == 2 and min(speeds.values()) * RATIO < max(speeds.values()):
            problems.append(f"{name}: one dialect is more than {RATIO} times slower than the other ({speeds})")
    for dialect, result in results.items():
        few = result["routes"]["a row with a relation (5 orders, 3 tags each)"]["statements per request"]
        many = result["routes"]["a row with a relation (20 orders, 3 tags each)"]["statements per request"]
        if many > few:
            problems.append(f"{dialect}: a relation costs more statements with more rows (N + 1): {few:g} for 5 orders, {many:g} for 20")
        loads = [r["machine load per core"] for route in result["routes"].values() for r in route["runs"]]
        print(f"     {dialect}: start-up {result['start-up ms']} ms, {result['memory MB after start']} MB after start, {result['connections open after the load']} connections open after the load, "
              f"machine load per core during the runs {min(loads)} to {max(loads)} (median {statistics.median(loads):.2f})")
        if "pool exhausted" in result:
            print(f"     {dialect}: pool exhausted: {result['pool exhausted']}")
    for p in problems:
        print(f"FAIL performance: {p}")
    return 1 if problems or len(results) < 2 else 0


if __name__ == "__main__":
    if sys.argv[1] == "run":
        sys.exit(run(sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]), sys.argv[6], sys.argv[7], sys.argv[8]))
    sys.exit(compare(sys.argv[2]))
