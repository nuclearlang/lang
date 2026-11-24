"""The migrations of database-check: one project (store_api) taken through every kind of schema change with the real
command, `nuclear migrate`, on one database, and the real schema and rows read back after each step (db.py). The same
steps for every dialect and database: only the migration edited by hand (a failure made on purpose) is written in the
dialect's migration language. Run:

    python migrations.py <dialect> <database> <url or file> <project> <out>

`nuclear` is the one on PATH (check.sh puts the tree's build first); the project's `build/` already has what its
dialect's `[toolchain]` needs. <out> gets `migrations-<dialect>-<database>.log` (one line per scenario) and
`schema-<dialect>-<database>-<step>.json` (the schema after each step, compared between the dialects by check.sh).
It ends with the entities of the second step again (the first ones and `points`), so the app of the next stage runs
on a schema seven migrations made and one brought back; a last step makes a text column longer than a VARCHAR holds
and brings it back.
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
entities = project / "components/store/data/entities"
log = (out / f"migrations-{dialect}-{database}.log").open("w")
transactional = database in ("sqlite", "postgres")  # MySQL and MariaDB commit each schema change as it runs
HISTORY = "migrations"  # one row per migration applied, the same table in every dialect (ADR-backend-0002)
OLD_HISTORY = "alembic_version" if dialect == "fastapi" else "SequelizeMeta"  # before 0.93


def fail(message: str) -> Any:
    raise SystemExit(message)


def done(scenario: str) -> None:
    log.write(scenario + "\n")
    log.flush()


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


def schema(step: str = "") -> dict[str, Any]:
    s = db.read_schema(url)
    if step:
        (out / f"schema-{dialect}-{database}-{step}.json").write_text(json.dumps(s, indent=1, sort_keys=True))
    return s


same = db.same


def rows() -> tuple[int, ...]:
    return tuple(int(db.scalar(url, f"SELECT COUNT(*) FROM {t}")) for t in ("customers", "orders", "tags", "orders_tags"))


def kept(what: str) -> None:
    if rows() != (1, 1, 1, 1):
        fail(f"{what}: the rows of customers, orders, tags, orders_tags are {rows()}, expected (1, 1, 1, 1)")


def edit(file: str, old: str, new: str) -> None:
    path = entities / file
    text = path.read_text()
    if old not in text:
        fail(f"{file} has no {old!r}")
    path.write_text(text.replace(old, new, 1))


def quoted(name: str) -> str:
    return f"`{name}`" if database in ("mysql", "mariadb") else f'"{name}"'


def names() -> list[tuple[str, str]]:
    """(state, name) of every migration, from `nuclear migrate status`."""
    return re.findall(r"^(applied|pending)  (\S+)$", migrate("status"), re.M)


original = {f.name: f.read_text() for f in entities.glob("*.nuc")}

# --- 1. the first migration; the edges of an empty history; a database that already has the tables
expect(migrate("status"), "no migrations in")
expect(migrate("up"), "the database is up to date")
expect(migrate("down"), "no migration is applied")
first = made(migrate("make", "First: the store!")).stem
if not re.fullmatch(r"\d{14}_first_the_store", first):
    fail(f"the first migration is named {first}")
expect(migrate("status"), f"pending  {first}")
expect(migrate("up"), f"applied {first}")
expect(migrate("up"), "the database is up to date")
expect(migrate("status"), f"applied  {first}")
expect(migrate("make", "again"), "no changes: the entities match the last migration")
db.check_schema(url)
if wrong := db.exact_types(schema(), database):
    fail("the first migration made an exact column of another type: " + "; ".join(wrong))
expect(migrate("down"), f"reverted {first}")
if schema():
    fail(f"reverting the first migration left the tables {sorted(schema())}")
expect(migrate("down"), "no migration is applied")
migrate("up")
done("make, up, nothing left to make, status, down to an empty database, down with nothing applied, up")

# the tables are there and the history says nothing is applied (a database made before its migrations): applying is
# refused whole; --fake brings it under the migrations without running them, and takes it out again
db.execute(url, f"DELETE FROM {quoted(HISTORY)}")
text = migrate("up", code=1)
expect(text, f"error: the migration {first} failed:", "nothing of this run was kept" if transactional else "does not undo schema changes")
db.check_schema(url)
expect(migrate("status"), f"pending  {first}")
expect(migrate("up", "--fake"), f"applied {first} (fake)")
expect(migrate("status"), f"applied  {first}")
expect(migrate("down", "--fake"), f"reverted {first} (fake)")
expect(migrate("status"), f"pending  {first}")
expect(migrate("--fake"), f"applied {first} (fake)")
db.check_schema(url)
expect(migrate("make", "again"), "no changes: the entities match the last migration")
done("a database that already has the tables: up refused (exit 1, nothing changed); up --fake and down --fake change the history only")

db.seed(url)
db.execute(url, "INSERT INTO tags (label) VALUES ('seeded')", "INSERT INTO orders_tags (order_id, tag_id) SELECT o.id, t.id FROM orders o, tags t")
s1 = schema("1-first")

# --- 2. a column with a default added to a table with rows
edit("customer.nuc", "  credit: double = 0.0\n", "  credit: double = 0.0\n  points: int = 7\n")
points = made(migrate("make", "points of a customer")).stem
migrate("up")
db.points(url, "present")
migrate("down")
db.points(url, "absent")
same(schema(), s1, "the column reverted")
kept("the column reverted")
migrate("up")
db.points(url, "present")
s2 = schema("2-add-column")
done("add a column with a default to a table with rows: the rows get it; down: the schema and the rows of before")

# --- 3. a column changed: type, null, default, length, a unique added
edit("customer.nuc", "  points: int = 7\n", "  points?: double\n  @column(length = 30)\n  phone?: string\n")
edit("customer.nuc", "  @column(length = 200)\n  name: string", "  @column(length = 300, unique = true)\n  name: string")
edit("customer.nuc", "  vip: boolean = false", "  vip: boolean = true")
made(migrate("make", "customer columns"))
migrate("up")
s3 = schema("3-change-columns")
c = s3["customers"]["columns"]
if (c["points"]["type"], c["points"]["nullable"], c["points"]["default"]) != ("float", True, None):
    fail(f"customers.points should be a nullable decimal without a default: {c['points']}")
if c["name"]["length"] != 300 or s3["customers"]["unique"] != ["email", "name"]:
    fail(f"customers.name should hold 300 characters and be unique: {c['name']}, unique {s3['customers']['unique']}")
if c["vip"]["default"] == s2["customers"]["columns"]["vip"]["default"]:
    fail(f"the default of customers.vip did not change: {c['vip']}")
if float(db.scalar(url, "SELECT points FROM customers")) != 7.0:
    fail("the value of customers.points was lost when its type changed")
kept("columns changed")
migrate("down")
same(schema(), s2, "the column changes reverted")
if db.scalar(url, "SELECT points FROM customers") != 7:
    fail("the value of customers.points was lost when its type came back")
kept("the column changes reverted")
migrate("up")
same(schema(), s3, "the column changes applied again")
done("change a column's type, null, default and length, add a unique: the values stay; down: the schema and the rows of before")

# --- 4. tables with relations: one to many (a foreign key on a table with rows) and many to many (a join table)
(entities / "shop.nuc").write_text(
    '// Where an order is picked up.\n@entity("shops")\nShop()\n  @primary(generated = true)\n  id: int\n'
    '  @column(length = 80)\n  name: string\n  @oneToMany(inverse = "shop")\n  orders?: Order[]\n'
)
edit("order.nuc", "  quantity: int = 1\n", '  @manyToOne(inverse = "orders", onDelete = "set null")\n  shop?: Shop\n  shopId?: int\n  quantity: int = 1\n')
edit("customer.nuc", '  @oneToMany(inverse = "customer")', '  @manyToMany(inverse = "fans")\n  @joinTable()\n  favorites?: Tag[]\n  @oneToMany(inverse = "customer")')
edit("tag.nuc", '  @manyToMany(inverse = "tags")', '  @manyToMany(inverse = "favorites")\n  fans?: Customer[]\n  @manyToMany(inverse = "tags")')
made(migrate("make", "shops and favorites"))
migrate("up")
s4 = schema("4-relations")
if "shop_id -> shops.id on delete set null" not in s4["orders"]["foreign"]:
    fail(f"orders has no foreign key to shops: {s4['orders']['foreign']}")
if s4.get("customers_favorites", {}).get("foreign") != ["customer_id -> customers.id on delete cascade", "tag_id -> tags.id on delete cascade"]:
    fail(f"the join table customers_favorites is not right: {s4.get('customers_favorites')}")
if sorted(s4["customers_favorites"]["key"]) != ["customer_id", "tag_id"] or s4["shops"]["key"] != ["id"]:
    fail("the keys of shops and customers_favorites are not right")
kept("relations added")
migrate("down")
same(schema(), s3, "the relations reverted")
kept("the relations reverted")
migrate("up")
same(schema(), s4, "the relations applied again")
db.execute(
    url, "INSERT INTO shops (name) VALUES ('corner')", "UPDATE orders SET shop_id = (SELECT id FROM shops)",
    "INSERT INTO customers_favorites (customer_id, tag_id) SELECT c.id, t.id FROM customers c, tags t",
)
done("add a table, a foreign key on a table with rows and a join table; down: the schema and the rows of before")

# --- 5. a table and two columns renamed: without --rename a drop and an add (with its warnings, which say how to
# rename); with --rename a rename, the same command in every dialect; what --rename refuses
edit("shop.nuc", '@entity("shops")', '@entity("stores")')
edit("shop.nuc", 'inverse = "shop"', 'inverse = "store"')
edit("shop.nuc", "  name: string\n", "  title: string\n")
edit("order.nuc", "  shop?: Shop\n  shopId?: int\n", "  store?: Shop\n  storeId?: int\n")
text = migrate("make", "shops are stores")
expect(
    text,
    "warning: the migration drops table shops, with its rows; if it was renamed, delete this migration and make it with --rename shops=<new table>",
    "warning: the migration drops column orders.shop_id, with its values; if it was renamed, delete this migration and make it with --rename orders.shop_id=<new column>",
)
made(text).unlink()
RENAMES = ("--rename", "shops=stores", "--rename", "shops.name=title", "--rename", "orders.shop_id=store_id")
for wrong, message in (
    (("--rename", "nothing=stores"), "error: cannot rename nothing: the migrations have no table nothing"),
    (("--rename", "tags=stores"), "error: cannot rename tags: the entities still have the table tags"),
    (("--rename", "shops=markets"), "error: cannot rename shops to markets: the entities have no table markets"),
    (("--rename", "shops=orders"), "error: cannot rename shops to orders: the migrations already have the table orders"),
    (("--rename", "orders.nothing=store_id"), "error: cannot rename orders.nothing: the migrations have no column orders.nothing"),
    (("--rename", "orders.total=store_id"), "error: cannot rename orders.total: the entities still have the column orders.total"),
    (("--rename", "orders.shop_id=shop"), "error: cannot rename orders.shop_id to shop: the entities have no column orders.shop"),
    (("--rename", "orders.shop_id=total"), "error: cannot rename orders.shop_id to total: the migrations already have the column orders.total"),
    (("--rename", "shops=stores", "--rename", "shops.name=label"), "error: cannot rename shops.name to label: the entities have no column stores.label"),
):
    said = [line for line in migrate("make", "shops are stores", *wrong, code=1).splitlines() if line.startswith("error:")]
    if said != [message]:
        fail(f"make {' '.join(wrong)} said {said}, expected {message!r}")
expect(migrate("make", "shops are stores", "--rename", "shops", code=1), "usage: nuclear migrate make")
text = migrate("make", "shops are stores", *RENAMES)
if "warning: the migration" in text or re.search(r"drop_?(table|column)|remove_?column|create_?table|add_?column", made(text).read_text().split("export const known")[0], re.I):
    fail(f"make --rename wrote more than the renames:\n{text}\n{made(text).read_text()[:1500]}")
expect(migrate("make", "again"), "no changes: the entities match the last migration")
migrate("up")
s5 = schema("5-rename")
if "shops" in s5 or "store_id -> stores.id on delete set null" not in s5["orders"]["foreign"] or "shop_id" in s5["orders"]["columns"]:
    fail(f"the rename left: tables {sorted(s5)}, orders {sorted(s5['orders']['columns'])}, foreign keys {s5['orders']['foreign']}")
if sorted(s5["stores"]["columns"]) != ["id", "title"] or s5["stores"]["columns"]["title"] != s4["shops"]["columns"]["name"]:
    fail(f"the renamed column is not the column it was: {s5['stores']['columns']}")
if db.scalar(url, "SELECT s.title FROM orders o JOIN stores s ON s.id = o.store_id") != "corner":
    fail("the renamed table or column lost its rows")
migrate("down")
same(schema(), s4, "the rename reverted")
if db.scalar(url, "SELECT s.name FROM orders o JOIN shops s ON s.id = o.shop_id") != "corner":
    fail("reverting the rename lost the rows")
migrate("up")
same(schema(), s5, "the rename applied again")
kept("renamed")
done("rename a table and two columns with make --rename (without it: a drop and an add, and a warning that says how): the rows and the foreign key follow; down: back; nine renames that are not there refused with the same words")

# --- 6. what goes: a column, a unique, a foreign key (its column stays)
edit("customer.nuc", "  @column(length = 30)\n  phone?: string\n", "")
edit("customer.nuc", "@column(length = 300, unique = true)", "@column(length = 300)")
edit("order.nuc", '  @manyToOne(inverse = "orders", onDelete = "set null")\n  store?: Shop\n', "")
edit("shop.nuc", '  @oneToMany(inverse = "store")\n  orders?: Order[]\n', "")
text = migrate("make", "less")
expect(text, "warning: the migration drops column customers.phone, with its values; if it was renamed")
# the unique under the name the database gives one made without a name (a migration of before 0.91): found by its column
if database == "postgres":
    db.execute(url, "ALTER TABLE customers RENAME CONSTRAINT uq_customers_name TO customers_name_key")
elif database in ("mysql", "mariadb"):
    db.execute(url, "ALTER TABLE customers RENAME INDEX uq_customers_name TO name")
migrate("up")
s6 = schema("6-drops")
if "phone" in s6["customers"]["columns"] or s6["customers"]["unique"] != ["email"]:
    fail(f"customers still has phone or the unique of name: {sorted(s6['customers']['columns'])}, unique {s6['customers']['unique']}")
if "store_id" not in s6["orders"]["columns"] or any(f.startswith("store_id") for f in s6["orders"]["foreign"]):
    fail(f"orders.store_id should stay without its foreign key: {s6['orders']['foreign']}")
if db.scalar(url, "SELECT COUNT(*) FROM orders WHERE store_id IS NOT NULL") != 1:
    fail("dropping the foreign key lost the value of orders.store_id")
kept("dropped")
migrate("down")
same(schema(), s5, "the drops reverted")
kept("the drops reverted")
migrate("up")
same(schema(), s6, "the drops applied again")
done("drop a column, a unique (under the database's own name) and a foreign key; make warns of the column; down: the schema of before")

# --- 7. a migration that fails half way, after one that works: what each transaction mode keeps
edit("tag.nuc", "  label: string\n", "  label: string\n  @column(length = 20)\n  color?: string\n")
color = made(migrate("make", "color of a tag")).stem
edit("tag.nuc", "  label: string\n", "  label: string\n  rank: int = 1\n")
failing = made(migrate("make", "rank of a tag"))
good = failing.read_text()
if dialect == "fastapi":
    bad = good.replace("\n\n\ndef downgrade", '\n    op.execute("SELECT * FROM no_such_table")\n\n\ndef downgrade', 1)
else:
    bad = good.replace("\n}\n", '\n  await queryInterface.sequelize.query("SELECT * FROM no_such_table");\n}\n', 1)
if bad == good:
    fail("the failing statement was not written into the migration")
failing.write_text(bad)
RANK = "`rank`" if database in ("mysql", "mariadb") else '"rank"'


def by_hand() -> None:
    """As the message says: what the failed migration did is undone by hand before it runs again."""
    if "rank" not in schema()["tags"]["columns"]:
        fail("the column made before the failure was expected to stay")
    db.execute(url, f"ALTER TABLE tags DROP COLUMN {RANK}")


# all (the default): one transaction for the two
text = migrate("up", code=1)
expect(text, f"error: the migration {failing.stem} failed:", "nothing of this run was kept" if transactional else "does not undo schema changes")
if transactional:
    same(schema(), s6, "a failed run in one transaction")
    if [state for state, _ in names()][-2:] != ["pending", "pending"] or f"applied {color}" in text:
        fail(f"one transaction for the run: the migration before the failed one must not stay: {names()}")
else:
    expect(text, f"applied {color}")
    by_hand()
# each: the migration before the failed one stays
text = migrate("up", "--transaction", "each", code=1)
expect(text, f"error: the migration {failing.stem} failed:", "nothing of it was kept" if transactional else "does not undo schema changes")
if transactional:
    expect(text, f"applied {color}")
else:
    by_hand()
if names()[-2:] != [("applied", color), ("pending", failing.stem)]:
    fail(f"a transaction per migration: {names()}")
s6c = schema()
if sorted(set(s6c["tags"]["columns"]) - set(s6["tags"]["columns"])) != ["color"]:
    fail(f"tags should have color and not rank: {sorted(s6c['tags']['columns'])}")
# none: what the failed one did stays, on every database
text = migrate("up", "--transaction", "none", code=1)
expect(text, f"error: the migration {failing.stem} failed:", "it ran without a transaction" if transactional else "does not undo schema changes", "what it did before failing is still there")
by_hand()
same(schema(), s6c, "the failed migration, undone by hand")
if names()[-1] != ("pending", failing.stem):
    fail(f"a failed migration is not pending: {names()}")
kept("a failed migration")
failing.write_text(good)
expect(migrate("up", "--transaction", "none"), f"applied {failing.stem}")
s7 = schema("7-after-failure")
if "rank" not in s7["tags"]["columns"] or db.scalar(url, f"SELECT {RANK} FROM tags") != 1:
    fail("the migration applied after its failure did not add tags.rank with its default")
done(
    "a failing migration after a good one: exit 1, still pending; --transaction all: "
    + ("neither stays" if transactional else "the good one stays (no transactional schema changes) and the message says what is left")
    + "; each: the good one stays; none: what it did stays; fixed, it applies"
)

# --- 8. the history is what was applied: a pending migration older than the applied ones, one missing from the folder
(entities / "note.nuc").write_text('// A note of the shop.\n@entity("notes")\nNote()\n  @primary(generated = true)\n  id: int\n  @column(length = 80)\n  text: string\n')
note = made(migrate("make", "notes"))
note = note.rename(note.with_name("20000101000000" + note.name[14:]))
if names()[0] != ("pending", note.stem) or any(state != "applied" for state, _ in names()[1:]):
    fail(f"an older pending migration should be listed first, pending: {names()}")
expect(migrate("up"), f"applied {note.stem}")
if "notes" not in schema():
    fail("the older pending migration was not applied")
expect(migrate("make", "again"), "no changes: the entities match the last migration")
# down reverts the last one applied, not the one with the last timestamp
expect(migrate("down"), f"reverted {note.stem}")
expect(migrate("up"), f"applied {note.stem}")
s8 = schema("8-out-of-order")
# a migration the database has and the folder does not: only its revert needs the file
gone = note.rename(note.with_suffix(".gone"))
if note.stem in migrate("status"):
    fail("status lists a migration that is not in the folder")
expect(migrate("up"), "the database is up to date")
expect(migrate("down", code=1), f"error: the migration {note.stem} is applied and is not in")
note = gone.rename(note)
same(schema(), s8, "the refused revert")
last = names()[-1][1]
done("a pending migration older than the applied ones: applied, and reverted first by down; a migration missing from the folder: only its revert is refused")

# --- 8b. a database migrated by 0.91 or 0.92: its history is converted in place, once
applied_before = [name for state, name in names() if state == "applied"]
db.execute(url, f"DROP TABLE {quoted(HISTORY)}")
if dialect == "fastapi":
    db.execute(url, "CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)", f"INSERT INTO alembic_version VALUES ('{last[:14]}')")
else:
    db.execute(url, f"CREATE TABLE {quoted(OLD_HISTORY)} (name VARCHAR(255) NOT NULL PRIMARY KEY)")
    db.execute(url, *(f"INSERT INTO {quoted(OLD_HISTORY)} VALUES ('{name}.js')" for name in applied_before))
if [name for state, name in names() if state == "applied"] != applied_before:
    fail(f"the history of before was not converted: {names()}")
if db.scalar(url, f"SELECT COUNT(*) FROM {quoted(HISTORY)}") != len(applied_before):
    fail("the table migrations does not hold one row per migration applied")
expect(migrate("up"), "the database is up to date")
same(schema(), s8, "the converted history")
done("the history of 0.91 / 0.92 (the tool's own table) converted in place: the same migrations applied, nothing run again")

# --- 9. down to a migration, up to a migration
text = migrate("down", "--to", first)
reverted = re.findall(r"^reverted (\S+)$", text, re.M)
# every migration applied after the first one: the converted history has them by their timestamp, so not the notes
if len(reverted) != 7 or sorted(reverted) != sorted(n for _, n in names() if n not in (first, note.stem)):
    fail(f"down --to the first migration reverted {reverted}")
same({t: v for t, v in schema().items() if t != "notes"}, s1, "every migration applied after the first reverted")
kept("every migration after the first reverted")
expect(migrate("down", "--to", first), "nothing to revert")
expect(migrate("up", "--to", points[:14]), f"applied {points}")
if {t: v for t, v in schema().items() if t != "notes"} != s2:
    fail("up --to the second migration: not its schema")
if [state for state, _ in names()] != ["applied", "applied", "applied"] + ["pending"] * 6:
    fail(f"after up --to the second migration: {names()}")
expect(migrate("up", "--to", "nothing", code=1), "error: no migration nothing in")
expect(migrate("down", "--to", last, code=1), f"error: the migration {last} is not applied")
if len(re.findall(r"^applied ", migrate("up"), re.M)) != 6:
    fail("up did not apply the six pending migrations")
same(schema(), s8, "every migration applied again")
kept("every migration applied again")
done("down --to the first migration (seven reverted: the first schema, the rows kept), up --to the second, up: the last schema again")

# --- 10. the entities of step 2 again: one migration takes everything added away, and the app of the next stage runs on it
for f in entities.glob("*.nuc"):
    if f.name not in original:
        f.unlink()
for name, text in original.items():
    (entities / name).write_text(text)
# with the column of step 2: the scenario of the next stage reads it through the app
edit("customer.nuc", "  credit: double = 0.0\n", "  credit: double = 0.0\n  points: int = 7\n")
text = migrate("make", "back to the first entities")
expect(text, "warning: the migration drops table stores", "warning: the migration drops table customers_favorites", "warning: the migration drops column tags.rank", "warning: the migration drops table notes")
migrate("up")
db.check_schema(url, True)
same(schema("10-back"), s2, "the first entities again")
db.points(url, "present")
kept("the first entities again")
expect(migrate("make", "again"), "no changes: the entities match the last migration")
db.execute(url, "DELETE FROM orders_tags", "DELETE FROM tags")
done("the first entities again: one migration drops what was added (make warns of each), the schema is the one of the second migration")

# --- 11. a text longer than a VARCHAR holds: the database's text type; a changed length is a migration, both ways
def note_is(length: int, step: str = "") -> None:
    column = schema(step)["orders"]["columns"]["note"]
    if column["sql"] != db.LONG_TEXT[length][database] or column["type"] != "str" or not column["nullable"]:
        fail(f"orders.note of {length} characters should be a nullable {db.LONG_TEXT[length][database]}: {column}")


counted = "LENGTH" if database == "sqlite" else "CHAR_LENGTH"
edit("order.nuc", "  @column(length = 2000)\n  note?: string\n", "  @column(length = 100000)\n  note?: string\n")
made(migrate("make", "a long note"))
migrate("up")
note_is(100000, "11-long-text")
db.execute(url, f"UPDATE orders SET note = '{'ñ' * 100000}'")
edit("order.nuc", "  @column(length = 100000)\n", "  @column(length = 5000000)\n")
made(migrate("make", "a longer note"))
migrate("up")
note_is(5000000, "12-longer-text")
if db.scalar(url, f"SELECT {counted}(note) FROM orders") != 100000:
    fail("the note lost characters when its column got longer")
migrate("down")
note_is(100000)
if db.scalar(url, f"SELECT {counted}(note) FROM orders") != 100000:
    fail("the note lost characters when its column got shorter again")
migrate("up")
db.execute(url, "UPDATE orders SET note = NULL")
edit("order.nuc", "  @column(length = 5000000)\n", "  @column(length = 2000)\n")
made(migrate("make", "the note as it was"))
migrate("up")
same(schema("13-text-back"), s2, "the note of 2000 characters again")
if db.scalar(url, "SELECT COUNT(*) FROM orders") != 1:
    fail("changing the length of a text lost the rows")
expect(migrate("make", "again"), "no changes: the entities match the last migration")
done(f"a text of 100000 characters is a {db.LONG_TEXT[100000][database]} and one of 5000000 a {db.LONG_TEXT[5000000][database]}: a changed length is a migration, up and down, the text kept")

# --- 12. an exact column whose scale changes: every database keeps the value, rounded half away from zero
db.execute(url, "DELETE FROM balances", "INSERT INTO balances (serial, amount, rate) VALUES (9223372036854775807, 0.3, 1.123456789)")
edit("balance.nuc", "  @column(precision = 40, scale = 20)\n", "  @column(precision = 40, scale = 4)\n")
made(migrate("make", "fewer decimals of a rate"))
migrate("up")
rate = schema("14-exact-scale")["balances"]["columns"]["rate"]["sql"]
if rate != db.EXACT["rate"][database].replace("40, 20", "40, 4").replace("40,20", "40,4"):
    fail(f"balances.rate of scale 4 is a {rate}")
if (str(db.scalar(url, "SELECT rate FROM balances")), str(db.scalar(url, "SELECT serial FROM balances"))) != ("1.1235", "9223372036854775807"):
    fail(f"the exact values changed with the scale: {db.scalar(url, 'SELECT rate FROM balances')}, {db.scalar(url, 'SELECT serial FROM balances')}")
migrate("down")
if wrong := db.exact_types(schema(), database):
    fail("down did not bring the exact column back: " + "; ".join(wrong))
migrate("up")
edit("balance.nuc", "  @column(precision = 40, scale = 4)\n", "  @column(precision = 40, scale = 20)\n")
made(migrate("make", "the decimals of a rate again"))
migrate("up")
if wrong := db.exact_types(schema(), database):
    fail("the exact column did not come back: " + "; ".join(wrong))
expect(migrate("make", "again"), "no changes: the entities match the last migration")
db.execute(url, "DELETE FROM balances")
done(f"an exact column of another scale is a migration, up and down: {db.EXACT['rate'][database]}, the values rounded, a bigint of 64 bits kept")

print(f"{len(names())} migrations, {sum(1 for _ in open(log.name))} scenarios: every change applied and reverted with `nuclear migrate`, the real schema and the rows read back after each")
