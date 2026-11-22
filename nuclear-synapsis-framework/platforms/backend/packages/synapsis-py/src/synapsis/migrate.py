"""Migrations of the database schema (ADR-backend-0001, ADR-backend-0002), run by `nuclear migrate` in the generated
project:

    python -m synapsis.migrate make "add done to tasks" --dir ../migrations    one migration: the entities minus the last one
    python -m synapsis.migrate up [--to <name>] --dir ../migrations            applies the pending ones (up to <name>)
    python -m synapsis.migrate down [--to <name>] --dir ../migrations          reverts the last one applied (or every one applied after <name>)
    python -m synapsis.migrate status --dir ../migrations                      every migration: applied or pending

    up and down take --fake (the history changes, nothing runs) and --transaction all|each|none (default: all)

A migration is `versions/<timestamp>_<slug>.py` with `upgrade()` and `downgrade()` over Alembic's operations (`op`), in
batch mode, so SQLite (which cannot alter a column) and the other databases run the same file. `make` compares the
entities with the migrations, never with the database: it runs every migration on an empty SQLite in memory and lets
Alembic's autogenerate write the difference (the same rule as the nestjs dialect).

The behaviour is TypeORM's (ADR-backend-0002), the same as the nestjs dialect's tool, with the same words: the table
`migrations` holds one row per migration applied (`id`, `timestamp`, `name`); the migrations are ordered by their
timestamp; a pending one runs whatever its place; `down` reverts the last one applied. Alembic writes and runs the
operations; its revisions and its `alembic_version` are not used (a database migrated with them is converted once).
"""

from __future__ import annotations

import argparse
import asyncio
import importlib
import importlib.util
import re
import sys
import warnings
from collections.abc import Callable, Iterator
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Literal

from sqlalchemy import DateTime

from .orm import FRACTION, Entity, UtcDateTime

__all__ = ["make", "up", "down", "status", "MigrateError", "run_env"]

HISTORY = "migrations"
Transaction = Literal["all", "each", "none"]


class MigrateError(Exception):
    """What the user must know or do: printed as it is, without a traceback."""


FILE = '''"""{message}

Written by `nuclear migrate make` from the entities; it is the project's from now on (a renamed table or column shows
as a drop and an add: change it to a rename to keep the data).
"""
from alembic import op
import sqlalchemy as sa
from synapsis.orm import UtcDateTime


def upgrade() -> None:
{upgrade}


def downgrade() -> None:
{downgrade}
'''


def run_env() -> None:
    """What the `env.py` of a folder made before 0.93 calls: nothing runs through Alembic's own commands any more."""
    raise RuntimeError("synapsis migrations run through `nuclear migrate` (python -m synapsis.migrate)")


def _database(app: str) -> Any:
    """The default database of the app's configuration (the one the repositories use); importing the app imports every
    entity (main.py lists them)."""
    from .config import Database

    module = importlib.import_module(app)
    state = module.app.state
    config, components = state.synapsis_config, state.synapsis_components
    found = [c for c in [*config.connections, *(c for comp in components for c in comp.connections)] if isinstance(c, Database)]
    if not found:
        raise LookupError("the configuration has no database (Postgres, MySQL, MariaDB or SQLite)")
    return next((c for c in found if c.name == "default"), found[0])


def _files(folder: str | Path) -> list[Path]:
    """The migrations of the folder, by their timestamp."""
    return sorted(p for p in (Path(folder).resolve() / "versions").glob("*.py") if re.match(r"\d{14}_", p.name))


def _load(file: Path) -> Any:
    spec = importlib.util.spec_from_file_location(f"synapsis_migration_{file.stem}", file)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _find(files: list[Path], to: str, folder: str | Path) -> int:
    """The migration `to` names: its name, or the timestamp it starts with."""
    name = Path(to).name.removesuffix(".py")
    for i, f in enumerate(files):
        if f.stem == name or f.stem.startswith(f"{name}_"):
            return i
    raise MigrateError(f"no migration {to} in {Path(folder).resolve()}")


# --- Alembic's operations over one connection

NAMES = {"uq": "uq_%(table_name)s_%(column_0_N_name)s", "fk": "fk_%(table_name)s_%(column_0_N_name)s"}


def _precise(bind: Any, table: str, column: str) -> bool:
    """SQLite: whether the column is a `DateTime` with its fraction (`DATETIME(6)`), by the words it was made with."""
    declared = bind.exec_driver_sql("SELECT type FROM pragma_table_info(?) WHERE name = ?", (table, column)).scalar()
    return str(declared).upper() == f"DATETIME({FRACTION})"


def _reflected(inspector: Any, table: Any, column: dict[str, Any]) -> None:
    """SQLite: Alembic makes a table again from what it reads in the database. Three things are not read there and are
    said here: AUTOINCREMENT (a key is never given twice, as on the other databases), the name of a unique or a
    foreign key that was made without one (so it can be dropped, and has its name from then on), and the fraction of a
    `DateTime` column (SQLAlchemy reads `DATETIME(6)` as `DATETIME`)."""
    bind = inspector.bind
    if bind.dialect.name != "sqlite":
        return
    if _precise(bind, table.name, column["name"]):
        column["type"] = UtcDateTime()
    elif isinstance(column["type"], DateTime):
        # made without its fraction (before 0.94): the type that migration wrote, which every database has (a
        # migration that names SQLite's own DATETIME would not run on PostgreSQL)
        column["type"] = DateTime(timezone=True)
    if not table.metadata.naming_convention.get("uq"):
        table.metadata.naming_convention = {**table.metadata.naming_convention, **NAMES}
    if not table.dialect_options["sqlite"]["autoincrement"]:
        made = bind.exec_driver_sql("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", (table.name,)).scalar()
        if made and re.search(r"\bAUTOINCREMENT\b", made, re.I):
            table.dialect_options["sqlite"]["autoincrement"] = True


def _drop_constraint(operations: Any, operation: Any) -> None:
    """A unique or a foreign key goes by the name it has in the database: the one the migration says, or the one the
    database gave it when it was made without a name (found by its columns)."""
    name, table, kind = operation.constraint_name, operation.table_name, operation.constraint_type
    bind = operations.get_bind()
    if bind.dialect.name != "sqlite" and name and kind in ("unique", "foreignkey"):
        from sqlalchemy import inspect

        i = inspect(bind)
        if kind == "unique":
            found = [(u["name"], u["column_names"]) for u in i.get_unique_constraints(table)]
            found += [(x["name"], x["column_names"]) for x in i.get_indexes(table) if x.get("unique")]
            prefix = "uq"
        else:
            found = [(f["name"], f["constrained_columns"]) for f in i.get_foreign_keys(table)]
            prefix = "fk"
        if not any(n == name for n, _ in found):
            name = next((n for n, columns in found if f"{prefix}_{table}_{'_'.join(c or '' for c in columns)}" == name), name)
    options = {} if operation.if_exists is None else {"if_exists": operation.if_exists}
    operations.impl.drop_constraint(operations.schema_obj.generic_constraint(name, table, kind, schema=operation.schema), **options)


def _render(kind: str, item: Any, autogen: Any) -> str | Literal[False]:
    # a `DateTime` column is the runtime's type (FILE imports it): each database names it with its fraction
    del autogen
    return "UtcDateTime()" if kind == "type" and isinstance(item, UtcDateTime) else False


def _compare_type(context: Any, inspected: Any, column: Any, inspected_type: Any, type_: Any) -> bool | None:
    """Whether a column's type changed, where Alembic cannot tell: a `DateTime` made without its fraction (a migration
    of before 0.94). `make` compares on SQLite, which keeps the words of the type."""
    del inspected_type
    if isinstance(type_, UtcDateTime) and context.dialect.name == "sqlite":
        return not _precise(context.bind, column.table.name, inspected.name)
    return None


def _context(connection: Any) -> Any:
    from alembic.migration import MigrationContext
    from alembic.operations import Operations, ops
    from sqlalchemy import Table, event

    if not event.contains(Table, "column_reflect", _reflected):
        event.listen(Table, "column_reflect", _reflected)
        Operations.implementation_for(ops.DropConstraintOp, replace=True)(_drop_constraint)
    options = {
        "target_metadata": Entity.metadata, "render_as_batch": True, "render_item": _render,
        "compare_type": _compare_type, "compare_server_default": True,
    }
    return MigrationContext.configure(connection, opts=options)


def _apply(connection: Any, module: Any, direction: Literal["up", "down"]) -> None:
    from alembic.operations import Operations

    with Operations.context(_context(connection)):
        (module.upgrade if direction == "up" else module.downgrade)()


# --- make

def _prepare(ops: list[Any], table: str = "") -> Iterator[str]:
    """Names every unique and foreign key a migration makes or drops (`uq_<table>_<column>`, `fk_<table>_<column>`) and
    gives what the user must know before applying it: data that is lost, a change a table with rows refuses."""
    from alembic.operations import ops as o
    from sqlalchemy import ForeignKeyConstraint, UniqueConstraint

    def named(table_name: str, c: Any) -> str | None:
        if isinstance(c, UniqueConstraint):
            return f"uq_{table_name}_{'_'.join(col.name for col in c.columns)}"
        if isinstance(c, ForeignKeyConstraint):
            return f"fk_{table_name}_{'_'.join(c.column_keys)}"
        return None

    for op in ops:
        if isinstance(op, o.CreateTableOp):
            columns: list[Any] = list(op.columns)
            for c in columns:
                if getattr(c, "name", None) is None and named(op.table_name, c):
                    c.name = named(op.table_name, c)
        elif isinstance(op, o.CreateUniqueConstraintOp):
            op.constraint_name = op.constraint_name or f"uq_{op.table_name}_{'_'.join(op.columns)}"
        elif isinstance(op, o.CreateForeignKeyOp):
            op.constraint_name = op.constraint_name or f"fk_{op.source_table}_{'_'.join(op.local_cols)}"
        elif isinstance(op, o.DropConstraintOp):
            # made without a name by a migration of before 0.91: the name it would have; the database's own is found
            # by its columns when the migration runs (_drop_constraint, _reflected)
            op.constraint_name = op.constraint_name or named(op.table_name, op.to_constraint())
        elif isinstance(op, o.DropTableOp):
            yield f"the migration drops table {op.table_name}; if it was renamed, edit it"
        elif isinstance(op, o.DropColumnOp):
            yield f"the migration drops column {op.table_name or table}.{op.column_name}; if it was renamed, edit it"
        elif isinstance(op, o.AddColumnOp):
            c = op.column
            if not c.nullable and c.server_default is None and not c.primary_key:
                yield f"the migration adds the required column {op.table_name or table}.{c.name} without a default: a table with rows refuses it"
        elif isinstance(op, o.AlterColumnOp):
            if op.modify_nullable is False:
                yield f"the migration makes {op.table_name or table}.{op.column_name} required: it fails while a row has it empty"
        elif isinstance(op, o.OpContainer):  # a batch groups the operations of one table
            yield from _prepare(op.ops, getattr(op, "table_name", table))


def create_tables(connection: Any) -> None:
    """`createTables`: the tables of the entities the database does not have, made by the operations a migration runs
    (the same types, defaults, foreign keys and names of constraints): a database made this way is the one the
    migrations make, and comes under them with `nuclear migrate --fake`."""
    from alembic.operations import Operations
    from alembic.operations import ops as o
    from sqlalchemy import inspect

    reader = inspect(connection)
    new = [t for t in Entity.metadata.sorted_tables if not reader.has_table(t.name)]
    made: list[Any] = []
    for table in new:
        made.append(o.CreateTableOp.from_table(table))
        made += [o.CreateIndexOp.from_index(i) for i in sorted(table.indexes, key=lambda i: str(i.name))]
    list(_prepare(made))
    operations = Operations(_context(connection))
    for op in made:
        operations.invoke(op)


def _slug(message: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", message.lower()).strip("_")[:60] or "migration"


def make(folder: str | Path, message: str, app: str = "app.main", now: datetime | None = None) -> Path | None:
    """Writes the migration from the migrations of the folder to the entities; None when nothing changed."""
    from alembic.autogenerate import produce_migrations, render_python_code
    from sqlalchemy import create_engine, inspect
    from sqlalchemy.orm import configure_mappers

    importlib.import_module(app)
    configure_mappers()
    engine = create_engine("sqlite://")
    try:
        with engine.begin() as connection, warnings.catch_warnings():
            warnings.simplefilter("ignore")  # Alembic's notes on a constraint without a name: _prepare names it
            for file in _files(folder):
                _apply(connection, _load(file), "up")
            context = _context(connection)
            # Alembic does not see a changed key, and no migration of the platform changes one: said, never skipped
            reader = inspect(connection)
            for table in Entity.metadata.sorted_tables:
                if reader.has_table(table.name):
                    old, new = reader.get_pk_constraint(table.name)["constrained_columns"], [c.name for c in table.primary_key.columns]
                    if sorted(old) != sorted(new):
                        raise MigrateError(_key_changed(table.name, old, new))
            script = produce_migrations(context, Entity.metadata)
            ops = script.upgrade_ops
            assert ops is not None and script.downgrade_ops is not None
            if ops.is_empty():
                return None
            warned = list(_prepare(ops.ops))
            ops.reverse_into(script.downgrade_ops)  # the way back, from the operations with their names
            # Alembic renders a body for its own template: the first line bare, the others indented, between two notes
            body = {
                side: "\n".join(
                    line
                    for line in ("    " + render_python_code(o, render_as_batch=True, render_item=_render, migration_context=context)).splitlines()
                    if "###" not in line
                ).rstrip()
                for side, o in (("upgrade", ops), ("downgrade", script.downgrade_ops))
            }
    finally:
        engine.dispose()
    versions = Path(folder).resolve() / "versions"
    versions.mkdir(parents=True, exist_ok=True)
    # local time, as the nestjs dialect names its migrations
    at = now or datetime.now()
    while any(versions.glob(f"{at:%Y%m%d%H%M%S}_*.py")):  # two in one second: the next one
        at += timedelta(seconds=1)
    file = versions / f"{at:%Y%m%d%H%M%S}_{_slug(message)}.py"
    file.write_text(FILE.format(message=" ".join(message.split()).replace('"""', "'''"), **body))
    for warning in warned:
        print(f"warning: {warning}", file=sys.stderr)
    return file


def _key_changed(table: str, old: list[str], new: list[str]) -> str:
    return (
        f"the key of {table} changed ({', '.join(sorted(old))} to {', '.join(sorted(new))}): a migration does not change a key; "
        "make the table under another name and move its rows"
    )


# --- the history: the table `migrations`, one row per migration applied

def _history_table() -> Any:
    from sqlalchemy import BigInteger, Column, Integer, MetaData, String, Table

    return Table(
        HISTORY, MetaData(),
        Column("id", Integer, primary_key=True, autoincrement=True),
        Column("timestamp", BigInteger, nullable=False),
        Column("name", String(255), nullable=False),
    )


def _history(connection: Any, folder: str | Path) -> list[str]:
    """The names of the applied migrations in the order they were applied; the table is made when it is missing, from
    Alembic's `alembic_version` when the database was migrated before 0.93 (it held the last revision only: every
    migration up to it was applied)."""
    from sqlalchemy import inspect, select, text

    table = _history_table()
    reader = inspect(connection)
    if not reader.has_table(HISTORY):
        applied: list[str] = []
        if reader.has_table("alembic_version"):
            last = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
            if last is not None:
                files = _files(folder)
                at = next((i for i, f in enumerate(files) if getattr(_load(f), "revision", f.stem[:14]) == last), None)
                if at is None:
                    raise MigrateError(f"the database has the migration {last} applied (by an older version), which is not in {Path(folder).resolve()}")
                applied = [f.stem for f in files[: at + 1]]
        connection.rollback()
        table.create(connection)
        if applied:
            connection.execute(table.insert(), [{"timestamp": int(name[:14]), "name": name} for name in applied])
        connection.commit()
    names = [str(n) for n in connection.execute(select(table.c.name).order_by(table.c.id)).scalars()]
    connection.rollback()  # the read opened a transaction: the migrations have their own
    return names


def _on_database[T](app: str, work: Callable[[Any], T], transaction: Transaction = "all") -> T:
    """`work` over one connection to the app's default database."""
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.orm import configure_mappers

    db = _database(app)
    configure_mappers()

    async def run() -> T:
        options: dict[str, Any] = {}
        if transaction == "none":
            options["isolation_level"] = "AUTOCOMMIT"
        elif db.url.startswith("sqlite"):
            # SQLite: Python's driver opens no transaction for a schema change unless it is told to
            options["connect_args"] = {"autocommit": False}
        engine = create_async_engine(db.url, **options)
        try:
            async with engine.connect() as connection:
                return await connection.run_sync(work)
        finally:
            await engine.dispose()

    return asyncio.run(run())


def _execute(
    connection: Any, steps: list[tuple[str, Path]], direction: Literal["up", "down"], fake: bool, transaction: Transaction,
    each: Callable[[str], None],
) -> list[str]:
    """Applies or reverts `steps` and writes the history with each one. `all`: one transaction for the whole run;
    `each`: one per migration; `none`: no transaction. PostgreSQL and SQLite undo what a failed transaction did; MySQL
    and MariaDB commit every schema change as it runs."""
    table = _history_table()
    dialect = connection.dialect.name
    undoes = dialect not in ("mysql", "mariadb") and transaction != "none"
    done: list[str] = []
    name = ""
    try:
        if transaction == "all":
            connection.begin()
        for name, file in steps:
            if transaction == "each":
                connection.begin()
            if not fake:
                _apply(connection, _load(file), direction)
                if dialect == "sqlite":
                    # the tables are rebuilt with the foreign keys off: what they left is checked before it is kept
                    broken = connection.exec_driver_sql("PRAGMA foreign_key_check").first()
                    if broken is not None:
                        raise MigrateError(f"rows of {broken[0]} point to rows of {broken[2]} that do not exist")
            if direction == "up":
                connection.execute(table.insert().values(timestamp=int(name[:14]), name=name))
            else:
                connection.execute(table.delete().where(table.c.name == name))
            if transaction != "all":
                connection.commit()
            done.append(name)
        connection.commit()
    except Exception as e:
        connection.rollback()
        # what stays applied of this run: nothing where one transaction held it all
        for kept in [] if transaction == "all" and undoes else done:
            each(kept)
        reason = str(getattr(e, "orig", None) or e).split("\n")[0]
        if dialect in ("mysql", "mariadb"):
            left = "this database does not undo schema changes: what it did before failing is still there, undo it by hand before running it again"
        elif transaction == "none":
            left = "it ran without a transaction: what it did before failing is still there, undo it by hand before running it again"
        else:
            left = "nothing of this run was kept" if transaction == "all" else "nothing of it was kept"
        raise MigrateError(f"the migration {name} failed{' to revert' if direction == 'down' else ''}: {reason}\n{left}") from e
    for name in done:
        each(name)
    return done


def _silent(name: str) -> None:
    del name


def up(
    folder: str | Path, app: str = "app.main", to: str | None = None, each: Callable[[str], None] = _silent, fake: bool = False,
    transaction: Transaction = "all",
) -> list[str]:
    """Applies the pending migrations to the app's database, by their timestamp (up to `to`, when given); returns their
    names. `each` hears every one that stays applied. `fake`: the history says they are applied and nothing runs."""

    def work(connection: Any) -> list[str]:
        applied = set(_history(connection, folder))
        files = _files(folder)
        last = len(files) - 1 if to is None else _find(files, to, folder)
        steps = [(f.stem, f) for f in files[: last + 1] if f.stem not in applied]
        return _execute(connection, steps, "up", fake, transaction, each)

    return _on_database(app, work, transaction)


def down(
    folder: str | Path, app: str = "app.main", to: str | None = None, each: Callable[[str], None] = _silent, fake: bool = False,
    transaction: Transaction = "all",
) -> list[str]:
    """Reverts the last migration applied, or every one applied after `to`; returns their names, the last one first.
    `fake`: the history forgets them and nothing runs."""

    def work(connection: Any) -> list[str]:
        applied = _history(connection, folder)
        files = {f.stem: f for f in _files(folder)}
        back = applied[-1:]
        if to is not None:
            name = _files(folder)[_find(_files(folder), to, folder)].stem
            if name not in applied:
                raise MigrateError(f"the migration {name} is not applied")
            back = applied[applied.index(name) + 1 :]
        for name in back:
            if name not in files:
                raise MigrateError(f"the migration {name} is applied and is not in {Path(folder).resolve()}: it cannot be reverted without its file")
        return _execute(connection, [(name, files[name]) for name in reversed(back)], "down", fake, transaction, each)

    return _on_database(app, work, transaction)


def status(folder: str | Path, app: str = "app.main") -> list[tuple[str, bool]]:
    """Every migration of the folder, by its timestamp, and whether the database has it."""

    def work(connection: Any) -> list[tuple[str, bool]]:
        applied = set(_history(connection, folder))
        return [(f.stem, f.stem in applied) for f in _files(folder)]

    return _on_database(app, work)


def main(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(prog="python -m synapsis.migrate")
    parser.add_argument("command", choices=["make", "up", "down", "status"])
    parser.add_argument("message", nargs="?")
    parser.add_argument("--dir", default="../migrations")
    parser.add_argument("--app", default="app.main")
    parser.add_argument("--to")
    parser.add_argument("--fake", action="store_true")
    parser.add_argument("--transaction", choices=["all", "each", "none"], default="all")
    a = parser.parse_args(argv)
    sys.path.insert(0, str(Path.cwd()))
    sys.dont_write_bytecode = True  # no __pycache__ in the project's migrations folder
    fake = " (fake)" if a.fake else ""
    try:
        if a.command == "make":
            if not a.message:
                parser.error('make needs a message: make "<what changes>"')
            file = make(a.dir, a.message, a.app)
            print(f"wrote {file}" if file else "no changes: the entities match the last migration")
        elif a.command == "status":
            all_ = status(a.dir, a.app)
            print("\n".join(f"{'applied' if applied else 'pending'}  {name}" for name, applied in all_) if all_ else f"no migrations in {Path(a.dir).resolve()}")
        elif a.command == "up":
            if not up(a.dir, a.app, a.to, lambda name: print(f"applied {name}{fake}", flush=True), a.fake, a.transaction):
                print("the database is up to date")
        elif not down(a.dir, a.app, a.to, lambda name: print(f"reverted {name}{fake}", flush=True), a.fake, a.transaction):
            print("nothing to revert" if a.to else "no migration is applied")
    except (MigrateError, LookupError) as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
