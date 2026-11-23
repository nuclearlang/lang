"""The tables of database-check: `createTables` makes the schema the migrations make, and a project migrated before 0.94
gets the fraction of a `DateTime` from its next `nuclear migrate make`. One project (store_api with
`createTables = true`, and a note of 100000 characters: a text longer than a VARCHAR holds on MySQL and MariaDB) on
one database, whose tables the app made when check.sh started it. Run:

    python tables.py <dialect> <database> <url or file> <project> <out>

It reads the schema `createTables` left, with the names of its constraints, and writes it to
`schema-<dialect>-<database>-0-create-tables.json` (compared between the dialects by check.sh); then, with the real
command (`nuclear migrate`): the first migration is made and applied with `--fake`, nothing is left to make, it is
reverted and applied for real, and the schema must be the one `createTables` made. Then the first migration is written
as 0.93 wrote it (a `DateTime` without its fraction: the only lines in the dialect's migration language), applied, and
the next `make` must write the change that brings the schema `createTables` made.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

import db

dialect, database, url, project, out = sys.argv[1], sys.argv[2], sys.argv[3], Path(sys.argv[4]), Path(sys.argv[5])
same = db.same


def fail(message: str) -> Any:
    raise SystemExit(message)


def migrate(*args: str, code: int = 0) -> str:
    """`nuclear migrate <args>` in the project; its output. The exit code must be `code`."""
    run = subprocess.run(["nuclear", "migrate", *args], cwd=project, capture_output=True, text=True)
    text = run.stdout + run.stderr
    if run.returncode != code:
        fail(f"`nuclear migrate {' '.join(args)}` ended with {run.returncode}, expected {code}:\n{text[-3000:]}")
    return text


def expect(text: str, *wanted: str) -> None:
    for w in wanted:
        if w not in text:
            fail(f"expected {w!r} in:\n{text[-2000:]}")


def made(text: str) -> Path:
    found = re.search(r"^wrote (.+)$", text, re.M)
    return Path(found.group(1)) if found else fail(f"no migration was written:\n{text[-2000:]}")


def schema() -> dict[str, Any]:
    return db.read_schema(url, names=True)


# --- createTables made the tables: the ones the first migration makes
created = schema()
db.check_schema(url)
if created["orders"]["columns"]["note"]["sql"] != db.LONG_TEXT[100000][database]:
    fail(f"createTables should make the note of 100000 characters a {db.LONG_TEXT[100000][database]}: {created['orders']['columns']['note']}")
(out / f"schema-{dialect}-{database}-0-create-tables.json").write_text(json.dumps(created, indent=1, sort_keys=True))
stamps = [c for t in created.values() for c in t["columns"].values() if c["type"] == "datetime"]
if database != "postgres" and any(c["sql"] != "DATETIME(6)" for c in stamps):
    fail(f"createTables made a DateTime column without its fraction: {sorted({c['sql'] for c in stamps})}")
first = made(migrate("make", "first"))
expect(migrate("up", code=1), f"error: the migration {first.stem} failed:")
expect(migrate("up", "--fake"), f"applied {first.stem} (fake)")
expect(migrate("make", "again"), "no changes: the entities match the last migration")
same(schema(), created, "the history faked over the tables createTables made")
expect(migrate("down"), f"reverted {first.stem}")
if schema():
    fail(f"reverting the first migration left tables createTables made: {sorted(schema())}")
expect(migrate("up"), f"applied {first.stem}")
same(schema(), created, "the first migration, against what createTables made")

# --- a project migrated before 0.94: its DateTime columns have no fraction; the next make gives it
migrate("down")
new = first.read_text()
if dialect == "fastapi":
    old = new.replace("UtcDateTime()", "sa.DateTime(timezone=True)")
else:
    old = new.replace("Sequelize.DataTypes.DATE({length: 6})", "Sequelize.DataTypes.DATE").replace("(CURRENT_TIMESTAMP)", "CURRENT_TIMESTAMP")
    old, schema_columns = re.subn(r',\s*"options": \{\s*"length": 6\s*\}', "", old)
    if schema_columns != new.count("Sequelize.DataTypes.DATE({length: 6})"):
        fail("the schema of the first migration was not written as 0.93 wrote it")
if old == new or "DATE({length" in old or "UtcDateTime()" in old:
    fail("the first migration was not written as 0.93 wrote it")
first.write_text(old)
migrate("up")
before = schema()
kinds = sorted({c["sql"] for t in before.values() for c in t["columns"].values() if c["type"] == "datetime"})
if database != "postgres" and kinds != ["DATETIME"]:
    fail(f"a migration of before 0.94 should make DateTime columns without a fraction: {kinds}")
# with rows: a customer and an order, as a database that kept its data has them
db.seed(url)
db.execute(url, "UPDATE orders SET placed_at = '2026-03-04 05:06:07'")
PRECISE = "SELECT COUNT(*) FROM orders WHERE placed_at > '2026-03-04 05:06:07.05' AND placed_at < '2026-03-04 05:06:07.1'"
fraction = made(migrate("make", "the fraction of a DateTime"))
expect(migrate("up"), f"applied {fraction.stem}")
same(schema(), created, "the DateTime columns of before 0.94, after the migration that gives them their fraction")
if db.scalar(url, "SELECT COUNT(*) FROM orders WHERE placed_at = '2026-03-04 05:06:07'") != 1 or db.scalar(url, "SELECT COUNT(*) FROM customers") != 1:
    fail("the migration that gives a DateTime its fraction lost the rows or their dates")
db.execute(url, "UPDATE orders SET placed_at = '2026-03-04 05:06:07.089'")
if db.scalar(url, PRECISE) != 1:
    fail("the column does not keep the fraction of a second after the migration")
expect(migrate("make", "again"), "no changes: the entities match the last migration")
expect(migrate("down"), f"reverted {fraction.stem}")
same(schema(), before, "the fraction reverted")
if db.scalar(url, "SELECT COUNT(*) FROM orders WHERE placed_at IS NOT NULL") != 1:
    fail("reverting the fraction lost the rows")
migrate("up")
same(schema(), created, "the fraction applied again")

print(
    "createTables made the schema of the first migration (types, defaults, keys, foreign keys, the names of the constraints); "
    "--fake over it leaves nothing to make; a first migration of before 0.94 gets the fraction of a DateTime from the next make, its rows kept"
)
