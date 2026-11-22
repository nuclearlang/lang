"""The migrations of database-check: one project (store_api) taken through every kind of schema change with the real
command, `nuclear migrate`, on one database, and the real schema and rows read back after each step (db.py). The same
steps for every dialect and database: only the two migrations edited by hand (a rename, a failure made on purpose) are
written in the dialect's migration language. Run:

    python migrations.py <dialect> <database> <url or file> <project> <out>

`nuclear` is the one on PATH (check.sh puts the tree's build first); the project's `build/` already has what its
dialect's `[toolchain]` needs. <out> gets `migrations-<dialect>-<database>.log` (one line per scenario) and
`schema-<dialect>-<database>-<step>.json` (the schema after each step, compared between the dialects by check.sh).
It ends with the entities of the second step again (the first ones and `points`), so the app of the next stage runs
on a schema seven migrations made and one brought back.
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
HISTORY = "alembic_version" if dialect == "fastapi" else "SequelizeMeta"


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


def same(now: dict[str, Any], before: dict[str, Any], what: str) -> None:
    """The schema is exactly the one read before: every table, column, type, length, null, default, key, unique, foreign key."""
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
        for part in ("key", "unique", "foreign"):
            if a[part] != b[part]:
                lines.append(f"{table} {part}: {b[part]}, was {a[part]}")
    fail(f"{what}: the schema is not the one before:\n  " + "\n  ".join(lines))


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
expect(migrate("down"), f"reverted {first}")
if schema():
    fail(f"reverting the first migration left the tables {sorted(schema())}")
expect(migrate("down"), "no migration is applied")
migrate("up")
done("make, up, nothing left to make, status, down to an empty database, down with nothing applied, up")

# the tables are there and the history says nothing is applied (a database made before its migrations): refused whole
db.execute(url, f"DELETE FROM {quoted(HISTORY)}")
text = migrate("up", code=1)
expect(text, f"error: the migration {first} failed:", "nothing of it was kept" if transactional else "does not undo schema changes")
db.check_schema(url)
expect(migrate("status"), f"pending  {first}")
db.execute(url, *(f"DROP TABLE {t}" for t in ("orders_tags", "orders", "tags", "customers")))
migrate("up")
db.check_schema(url)
done("a database that already has the tables: refused, exit 1, nothing changed, the history still empty")

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

# --- 5. a table and a column renamed: made as a drop and an add (with its warnings), edited into a rename
edit("shop.nuc", '@entity("shops")', '@entity("stores")')
edit("shop.nuc", 'inverse = "shop"', 'inverse = "store"')
edit("order.nuc", "  shop?: Shop\n  shopId?: int\n", "  store?: Shop\n  storeId?: int\n")
text = migrate("make", "shops are stores")
expect(text, "warning: the migration drops table shops; if it was renamed, edit it", "warning: the migration drops column orders.shop_id; if it was renamed, edit it")
renamed = made(text)
body = renamed.read_text()
if dialect == "fastapi":
    body = body[: body.index("def upgrade")] + (
        "def upgrade() -> None:\n"
        "    op.rename_table('shops', 'stores')\n"
        "    with op.batch_alter_table('orders', schema=None) as batch_op:\n"
        "        batch_op.alter_column('shop_id', new_column_name='store_id', existing_type=sa.Integer(), existing_nullable=True)\n"
        "\n\n"
        "def downgrade() -> None:\n"
        "    with op.batch_alter_table('orders', schema=None) as batch_op:\n"
        "        batch_op.alter_column('store_id', new_column_name='shop_id', existing_type=sa.Integer(), existing_nullable=True)\n"
        "    op.rename_table('stores', 'shops')\n"
    )
else:
    body = body[: body.index("export async function up")] + (
        "export async function up(queryInterface, Sequelize) {\n"
        '  await queryInterface.renameTable("shops", "stores");\n'
        '  await queryInterface.renameColumn("orders", "shop_id", "store_id");\n'
        "}\n\n"
        "export async function down(queryInterface, Sequelize) {\n"
        '  await queryInterface.renameColumn("orders", "store_id", "shop_id");\n'
        '  await queryInterface.renameTable("stores", "shops");\n'
        "}\n\n"
    ) + body[body.index("// the migration this one was made after") :]
renamed.write_text(body)
expect(migrate("make", "again"), "no changes: the entities match the last migration")
migrate("up")
s5 = schema("5-rename")
if "shops" in s5 or "store_id -> stores.id on delete set null" not in s5["orders"]["foreign"] or "shop_id" in s5["orders"]["columns"]:
    fail(f"the rename left: tables {sorted(s5)}, orders {sorted(s5['orders']['columns'])}, foreign keys {s5['orders']['foreign']}")
if db.scalar(url, "SELECT s.name FROM orders o JOIN stores s ON s.id = o.store_id") != "corner":
    fail("the renamed table or column lost its rows")
migrate("down")
same(schema(), s4, "the rename reverted")
if db.scalar(url, "SELECT s.name FROM orders o JOIN shops s ON s.id = o.shop_id") != "corner":
    fail("reverting the rename lost the rows")
migrate("up")
same(schema(), s5, "the rename applied again")
kept("renamed")
done("rename a table and a column (the migration edited by hand): the rows and the foreign key follow; down: back")

# --- 6. what goes: a column, a unique, a foreign key (its column stays)
edit("customer.nuc", "  @column(length = 30)\n  phone?: string\n", "")
edit("customer.nuc", "@column(length = 300, unique = true)", "@column(length = 300)")
edit("order.nuc", '  @manyToOne(inverse = "orders", onDelete = "set null")\n  store?: Shop\n', "")
edit("shop.nuc", '  @oneToMany(inverse = "store")\n  orders?: Order[]\n', "")
text = migrate("make", "less")
expect(text, "warning: the migration drops column customers.phone; if it was renamed, edit it")
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
done("drop a column, a unique and a foreign key (make warns of the column): the other values stay; down: the schema of before")

# --- 7. a migration that fails half way: the history never says it is applied
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
text = migrate("up", code=1)
expect(text, f"error: the migration {failing.stem} failed:", "nothing of it was kept" if transactional else "does not undo schema changes")
if names()[-1] != ("pending", failing.stem):
    fail(f"a failed migration is not pending: {names()}")
half = schema()
if transactional:
    same(half, s6, "the failed migration")
else:
    if "rank" not in half["tags"]["columns"]:
        fail("MySQL and MariaDB were expected to keep the column made before the failure")
    # as the message says: what it did is undone by hand before it runs again
    db.execute(url, "ALTER TABLE tags DROP COLUMN `rank`")
    same(schema(), s6, "the failed migration, undone by hand")
kept("a failed migration")
failing.write_text(good)
expect(migrate("up"), f"applied {failing.stem}")
s7 = schema("7-after-failure")
if "rank" not in s7["tags"]["columns"] or db.scalar(url, "SELECT `rank` FROM tags" if not transactional else 'SELECT "rank" FROM tags') != 1:
    fail("the migration applied after its failure did not add tags.rank with its default")
done(
    "a migration that fails half way: exit 1, still pending, "
    + ("nothing of it kept" if transactional else "what it did stays and the message says so (no transactional schema changes)")
    + "; fixed, it applies"
)

# --- 8. the history: a migration applied and gone from the folder, two made after the same one
last = names()[-1][1]
gone = failing.with_suffix(".gone")
failing.rename(gone)
for command in ("status", "up", "down"):
    expect(migrate(command, code=1), "error: the database has the migration", "applied, which is not in")
gone.rename(failing)
twin = failing.with_name(failing.name.replace(failing.stem[:14], "29990101000000"))
twin.write_text(re.sub(r"^(revision: str = )'\d+'", r"\1'29990101000000'", good, flags=re.M))
for command in (("status",), ("up",), ("down",), ("make", "third")):
    expect(migrate(*command, code=1), f"error: the migrations {failing.stem} and {twin.stem} both follow", "delete one, apply the other and make it again")
twin.unlink()
same(schema(), s7, "the refused commands")
expect(migrate("status"), f"applied  {last}")
done("a migration applied and missing from the folder, two migrations made after the same one: refused, exit 1, nothing changed")

# --- 9. down to a migration, up to a migration
text = migrate("down", "--to", first)
reverted = re.findall(r"^reverted (\S+)$", text, re.M)
if reverted != [n for _, n in reversed(names())][: len(reverted)] or len(reverted) != 6:
    fail(f"down --to the first migration reverted {reverted}")
same(schema(), s1, "every migration after the first reverted")
kept("every migration after the first reverted")
expect(migrate("down", "--to", first), "nothing to revert")
expect(migrate("up", "--to", points[:14]), f"applied {points}")
same(schema(), s2, "up to the second migration")
if [state for state, _ in names()] != ["applied", "applied", "pending", "pending", "pending", "pending", "pending"]:
    fail(f"after up --to the second migration: {names()}")
expect(migrate("up", "--to", "nothing", code=1), "error: no migration nothing in")
expect(migrate("down", "--to", last, code=1), f"error: the migration {last} is not applied")
if len(re.findall(r"^applied ", migrate("up"), re.M)) != 5:
    fail("up did not apply the five pending migrations")
same(schema(), s7, "every migration applied again")
kept("every migration applied again")
done("down --to the first migration (six reverted in order: the first schema, the rows kept), up --to the second, up: the last schema again")

# --- 10. the entities of step 2 again: one migration takes everything added away, and the app of the next stage runs on it
for f in entities.glob("*.nuc"):
    if f.name not in original:
        f.unlink()
for name, text in original.items():
    (entities / name).write_text(text)
# with the column of step 2: the scenario of the next stage reads it through the app
edit("customer.nuc", "  credit: double = 0.0\n", "  credit: double = 0.0\n  points: int = 7\n")
text = migrate("make", "back to the first entities")
expect(text, "warning: the migration drops table stores", "warning: the migration drops table customers_favorites", "warning: the migration drops column tags.rank")
migrate("up")
db.check_schema(url, True)
same(schema("10-back"), s2, "the first entities again")
db.points(url, "present")
kept("the first entities again")
expect(migrate("make", "again"), "no changes: the entities match the last migration")
db.execute(url, "DELETE FROM orders_tags", "DELETE FROM tags")
done("the first entities again: one migration drops what was added (make warns of each), the schema is the one of the second migration")

print(f"{len(names())} migrations, {sum(1 for _ in open(log.name))} scenarios: every change applied and reverted with `nuclear migrate`, the real schema and the rows read back after each")
