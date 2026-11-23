"""The database side of database-check: it waits for a database, reads its real schema, seeds rows and answers a
query, the same way for PostgreSQL, MySQL, MariaDB and SQLite. It takes the platform's URL (`postgres://`, `mysql://`,
`mariadb://`) or a SQLite file. Run: python db.py <command> <url or file> [arguments]

    wait <url>                     until the database answers a query (60 seconds at most)
    schema <url> [--points]        checks the tables the migrations of store_api must have made; prints them
    seed <url>                     one customer and one order, with only the columns that have no default
    points <url> present|absent    the column customers.points added by the second migration, and its default
    scalar <url> <sql>             the first value of a query
    compare <folder>               the schemas migrations.py and tables.py wrote there: what differs between the dialects
"""

from __future__ import annotations

import asyncio
import json
import re
import sys
import time
from typing import Any

import warnings

from sqlalchemy import Float, exc, inspect, text
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine

# a type SQLite spells in its own way (TINYINT(1)) is read without its arguments: no news here
warnings.simplefilter("ignore", exc.SAWarning)
DRIVERS = {"postgres": "postgresql+asyncpg", "mysql": "mysql+aiomysql", "mariadb": "mysql+aiomysql"}


def engine_url(url: str) -> str:
    scheme, sep, rest = url.partition("://")
    return f"{DRIVERS[scheme]}://{rest}" if sep else f"sqlite+aiosqlite:///{url}"


async def _with(url: str, work: Any) -> Any:
    engine = create_async_engine(engine_url(url))
    try:
        async with engine.begin() as connection:
            return await work(connection)
    finally:
        await engine.dispose()


def scalar(url: str, sql: str) -> Any:
    async def work(c: AsyncConnection) -> Any:
        return (await c.execute(text(sql))).scalar()

    return asyncio.run(_with(url, work))


def execute(url: str, *statements: str) -> None:
    async def work(c: AsyncConnection) -> None:
        for s in statements:
            await c.execute(text(s))

    asyncio.run(_with(url, work))


def wait(url: str, seconds: float = 60) -> None:
    end = time.monotonic() + seconds
    while True:
        try:
            scalar(url, "SELECT 1")
            return
        except Exception as e:  # the server is still starting
            if time.monotonic() > end:
                raise SystemExit(f"the database did not answer in {seconds:.0f} s: {e}")
            time.sleep(0.5)


def default_of(default: Any) -> str | None:
    """A column's default by its meaning: each database (and each way of writing it) spells the same value in its own
    way (`(false)`, `'0'`, `0`; `0.0`, `'0'`; `'pending'::character varying`; `CURRENT_TIMESTAMP`, `now()`)."""
    if default is None:
        return None
    d = str(default).strip()
    while d.startswith("(") and d.endswith(")"):
        d = d[1:-1].strip()
    d = d.split("::")[0].strip("'").lower()
    if d in ("true", "false"):
        return str(int(d == "true"))
    if d in ("current_timestamp", "current_timestamp()", "now()"):
        return "now"
    try:
        return f"{float(d):g}"
    except ValueError:
        return d


def read_schema(url: str, names: bool = False) -> dict[str, Any]:
    """Every table of the app as the database has it: columns (type family, nullable, default), key, unique columns,
    foreign keys; with `names`, the names of its uniques and foreign keys too."""

    def family(t: Any) -> str:
        if isinstance(t, Float):  # MySQL's DOUBLE says it is read as a Decimal
            return "float"
        try:
            return t.python_type.__name__
        except NotImplementedError:
            return str(t)

    def unique_of(i: Any, sync: Any, table: str) -> list[str]:
        if sync.dialect.name == "sqlite":
            # SQLAlchemy reads SQLite's constraints from the text of CREATE TABLE and misses some spellings: ask SQLite
            found: list[str] = []
            for index in sync.exec_driver_sql(f'PRAGMA index_list("{table}")').all():
                columns = [r[2] for r in sync.exec_driver_sql(f'PRAGMA index_info("{index[1]}")').all()]
                if index[2] and len(columns) == 1 and index[3] != "pk":
                    found.append(columns[0])
            return sorted(found)
        unique = {tuple(u["column_names"]) for u in i.get_unique_constraints(table)}
        unique |= {tuple(x["column_names"]) for x in i.get_indexes(table) if x.get("unique")}
        return sorted(u[0] for u in unique if len(u) == 1)

    def foreign_of(i: Any, sync: Any, table: str) -> list[str]:
        if sync.dialect.name == "sqlite":
            rows = sync.exec_driver_sql(f'PRAGMA foreign_key_list("{table}")').all()
            keys = [(r[3], r[2], r[4], str(r[6]).lower(), str(r[5]).lower()) for r in rows]
        else:
            keys = [
                (
                    f["constrained_columns"][0], f["referred_table"], f["referred_columns"][0],
                    str(f.get("options", {}).get("ondelete") or "").lower(), str(f.get("options", {}).get("onupdate") or "").lower(),
                )
                for f in i.get_foreign_keys(table)
            ]
        # no rule and NO ACTION are the same rule
        rule = lambda word, r: f" on {word} {r}" if r not in ("", "no action", "none") else ""  # noqa: E731
        return sorted(f"{c} -> {t}.{k}{rule('delete', d)}{rule('update', u)}" for c, t, k, d, u in keys)

    def names_of(i: Any, sync: Any, table: str) -> list[str]:
        if sync.dialect.name == "sqlite":
            # the names are in the words the table was made with (SQLAlchemy does not read every way of quoting them)
            made = sync.exec_driver_sql("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)).scalar()
            return sorted(re.findall(r"CONSTRAINT\s+[`\"\[]?(\w+)", str(made)))
        found = {u["name"] for u in i.get_unique_constraints(table)} | {x["name"] for x in i.get_indexes(table) if x.get("unique")}
        return sorted(str(n) for n in found | {f["name"] for f in i.get_foreign_keys(table)})

    def read(sync: Any) -> dict[str, Any]:
        i = inspect(sync)
        out: dict[str, Any] = {}
        for table in sorted(i.get_table_names()):
            if table in ("migrations", "alembic_version", "SequelizeMeta", "sqlite_sequence"):
                continue
            key = i.get_pk_constraint(table)["constrained_columns"]
            # SQLite keeps the words a type was written with; SQLAlchemy reads them without their arguments
            declared: dict[str, str] = {}
            if sync.dialect.name == "sqlite":
                declared = {r[1]: r[2] for r in sync.exec_driver_sql(f'PRAGMA table_info("{table}")').all()}
            out[table] = {
                "columns": {
                    c["name"]: {
                        "type": family(c["type"]),
                        # the type as the database names it (SQLite keeps the words it was written with)
                        # (and MySQL's fraction of a second is not in the name SQLAlchemy prints)
                        "sql": declared.get(c["name"], str(c["type"])).upper() + (f"({c['type'].fsp})" if getattr(c["type"], "fsp", None) else ""),
                        "length": getattr(c["type"], "length", None),
                        # SQLite says a key may be null (it never is)
                        "nullable": bool(c["nullable"]) and c["name"] not in key,
                        "default": default_of(c.get("default")),
                    }
                    for c in i.get_columns(table)
                },
                "key": key,
                "unique": unique_of(i, sync, table),
                "foreign": foreign_of(i, sync, table),
                **({"names": names_of(i, sync, table)} if names else {}),
            }
        return out

    async def work(c: AsyncConnection) -> dict[str, Any]:
        return await c.run_sync(read)

    return asyncio.run(_with(url, work))


# what the entities of store_api say: table → column → nullable
EXPECTED: dict[str, dict[str, bool | None]] = {
    "customers": {"id": False, "email": False, "name": False, "nickname": True, "vip": False, "credit": False, "created_at": False, "updated_at": False},
    "orders": {
        "id": False, "customer_id": False, "quantity": False, "total": False, "note": True, "status": False, "paid": False,
        "placed_at": True, "created_at": False,
    },
    "tags": {"id": False, "label": False},
    "orders_tags": {"order_id": False, "tag_id": False},
    "coupons": {"id": False, "code": False, "customer_id": False},
}
TYPES = {
    ("customers", "id"): "int", ("customers", "email"): "str", ("customers", "vip"): "bool", ("customers", "credit"): "float",
    ("customers", "created_at"): "datetime", ("orders", "quantity"): "int", ("orders", "total"): "float",
    ("orders", "note"): "str", ("orders", "placed_at"): "datetime", ("orders", "paid"): "bool",
}
UNIQUE = {"customers": ["email"], "tags": ["label"], "coupons": ["code"]}
FOREIGN = {
    "orders": ["customer_id -> customers.id on delete cascade"],
    # no rule: a customer with coupons is not removed
    "coupons": ["customer_id -> customers.id"],
    "orders_tags": ["order_id -> orders.id on delete cascade", "tag_id -> tags.id on delete cascade"],
}


def check_schema(url: str, points: bool = False) -> dict[str, Any]:
    schema = read_schema(url)
    problems: list[str] = []
    expected = {t: dict(c) for t, c in EXPECTED.items()}
    if points:
        expected["customers"]["points"] = False
    if sorted(schema) != sorted(expected):
        problems.append(f"tables {sorted(schema)}, expected {sorted(expected)}")
    for table, columns in expected.items():
        have = schema.get(table, {"columns": {}, "key": [], "unique": [], "foreign": []})
        if sorted(have["columns"]) != sorted(columns):
            problems.append(f"{table}: columns {sorted(have['columns'])}, expected {sorted(columns)}")
        for name, nullable in columns.items():
            c = have["columns"].get(name)
            if c is not None and nullable is not None and c["nullable"] != nullable:
                problems.append(f"{table}.{name}: nullable {c['nullable']}, expected {nullable}")
            kind = TYPES.get((table, name))
            # MySQL and MariaDB keep a boolean as tinyint(1), SQLite as an integer affinity the driver reads back
            if c is not None and kind and c["type"] != kind and not (kind == "bool" and c["type"] == "int"):
                problems.append(f"{table}.{name}: a {c['type']} column, expected {kind}")
        key = ["order_id", "tag_id"] if table == "orders_tags" else ["id"]
        if sorted(have["key"]) != key:
            problems.append(f"{table}: primary key {have['key']}, expected {key}")
        for u in UNIQUE.get(table, []):
            if u not in have["unique"]:
                problems.append(f"{table}.{u}: not unique")
        if have["foreign"] != FOREIGN.get(table, []):
            problems.append(f"{table}: foreign keys {have['foreign']}, expected {FOREIGN.get(table, [])}")
    if problems:
        raise SystemExit("the schema in the database is not the entities':\n  " + "\n  ".join(problems))
    return schema


def same(now: dict[str, Any], before: dict[str, Any], what: str) -> None:
    """The schema is exactly the one read before: every table, column, type, length, null, default, key, unique, foreign
    key (and the names of the constraints, when both were read with them)."""
    if now == before:
        return
    lines: list[str] = []
    for table in sorted({*now, *before}):
        a, b = before.get(table), now.get(table)
        if a is None or b is None:
            lines.append(f"table {table}: {'missing' if b is None else 'not expected'}")
            continue
        for column in sorted({*a["columns"], *b["columns"]}):
            if a["columns"].get(column) != b["columns"].get(column):
                lines.append(f"{table}.{column}: {b['columns'].get(column)}, was {a['columns'].get(column)}")
        for part in ("key", "unique", "foreign", "names"):
            if a.get(part) != b.get(part):
                lines.append(f"{table} {part}: {b.get(part)}, was {a.get(part)}")
    raise SystemExit(f"{what}: the schema is not the one before:\n  " + "\n  ".join(lines))


# `@column(length = n)`: the VARCHAR of that length while the database's holds it, then its text type that does (the
# reference, §2.1): what each database must name the column of a text of 100000 and of 5000000 characters
LONG_TEXT = {
    100000: {"sqlite": "VARCHAR(100000)", "postgres": "VARCHAR(100000)", "mysql": "MEDIUMTEXT", "mariadb": "MEDIUMTEXT"},
    5000000: {"sqlite": "VARCHAR(5000000)", "postgres": "VARCHAR(5000000)", "mysql": "LONGTEXT", "mariadb": "LONGTEXT"},
}


def seed(url: str) -> None:
    """Rows written before the second migration, by SQL: the columns with a default are left to the database."""
    execute(
        url,
        "INSERT INTO customers (email, name) VALUES ('seed@example.com', 'Seed')",
        "INSERT INTO orders (customer_id, total) SELECT id, 9.5 FROM customers WHERE email = 'seed@example.com'",
    )
    if scalar(url, "SELECT COUNT(*) FROM customers WHERE created_at IS NOT NULL AND updated_at IS NOT NULL") != 1:
        raise SystemExit("a row inserted by SQL has no created_at / updated_at: the columns have no default")
    row = scalar(url, "SELECT COUNT(*) FROM orders WHERE quantity = 1 AND status = 'pending' AND NOT paid")
    vip = scalar(url, "SELECT COUNT(*) FROM customers WHERE NOT vip AND credit = 0")
    if (row, vip) != (1, 1):
        raise SystemExit(f"the defaults of the columns are not in the database (orders with defaults: {row}, customers: {vip})")


def points(url: str, state: str) -> None:
    columns = read_schema(url)["customers"]["columns"]
    if state == "absent":
        if "points" in columns:
            raise SystemExit("customers.points is still there after the migration was reverted")
        if scalar(url, "SELECT COUNT(*) FROM customers") != 1:
            raise SystemExit("reverting the migration lost the rows of customers")
        return
    if "points" not in columns:
        raise SystemExit("customers.points was not added")
    got = scalar(url, "SELECT points FROM customers WHERE email = 'seed@example.com'")
    if got != 7:
        raise SystemExit(f"the row that was there before the migration has points = {got!r}, expected the default 7")


def compare(folder: str) -> None:
    """One line per difference between the schemas two dialects left on the same database (schema-<dialect>-<database>-
    <step>.json), each difference once with the steps it shows in."""
    from pathlib import Path

    def flat(schema: dict[str, Any]) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for table, t in schema.items():
            for part in ("key", "unique", "foreign", "names"):
                if part in t:
                    out[f"{table} {part}"] = t[part]
            for column, c in t["columns"].items():
                for k, v in c.items():
                    out[f"{table}.{column} {k}"] = v
        return out

    found: dict[tuple[str, str, str, str], list[str]] = {}
    files = sorted(Path(folder).glob("schema-fastapi-*.json"), key=lambda f: (f.name.split("-")[2], int(f.name.split("-")[3])))
    for file in files:
        _, _, database, step = file.stem.split("-", 3)
        other = file.with_name(file.name.replace("schema-fastapi-", "schema-nestjs-"))
        if not other.exists():
            continue
        a, b = flat(json.loads(file.read_text())), flat(json.loads(other.read_text()))
        for key in sorted({*a, *b}):
            if a.get(key) != b.get(key):
                found.setdefault((database, key, repr(a.get(key)), repr(b.get(key))), []).append(step.split("-")[0])
    for (database, key, a, b), steps in found.items():
        print(f"{database:<8} {key}: fastapi {a}, nestjs {b} (steps {', '.join(steps)})")


def main(argv: list[str]) -> None:
    command, url, *rest = argv
    if command == "compare":
        return compare(url)
    if command == "wait":
        wait(url)
    elif command == "schema":
        print(json.dumps(check_schema(url, "--points" in rest), indent=1, sort_keys=True))
    elif command == "seed":
        seed(url)
    elif command == "points":
        points(url, rest[0])
    elif command == "scalar":
        print(scalar(url, rest[0]))
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
