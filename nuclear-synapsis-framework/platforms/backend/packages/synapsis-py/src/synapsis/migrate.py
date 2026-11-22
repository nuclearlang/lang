"""Migrations of the database schema (ADR-backend-0001) with Alembic, run by `nuclear migrate` in the generated project:

    python -m synapsis.migrate make "add done to tasks" --dir ../migrations    one migration: the entities minus the last one
    python -m synapsis.migrate up [--to <name>] --dir ../migrations            applies the pending ones (up to <name>)
    python -m synapsis.migrate down [--to <name>] --dir ../migrations          reverts the last one (or every one after <name>)
    python -m synapsis.migrate status --dir ../migrations                      every migration: applied or pending

`make` compares the entities with the last migration, never with the database: it brings an empty SQLite in memory to
the last migration and lets Alembic's autogenerate write the difference (the same rule as the nestjs dialect). The
folder is an Alembic script folder (`env.py`, `script.py.mako`, `versions/`), written the first time; `up` and `down`
use the default database of the app's configuration (`alembic_version` holds the last one applied). Migrations are
written in batch mode, so SQLite (which cannot alter a column) and the other databases run the same file.

The same rules as the nestjs dialect's tool, with the same words: a migration's name is its file without `.py`; the
history is one line (two migrations made after the same one are refused); each migration runs in a transaction of its
own; every unique and foreign key has a name (`uq_<table>_<column>`, `fk_<table>_<column>`), so it can be dropped.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import importlib
import io
import re
import shutil
import sys
import warnings
from collections.abc import Callable, Iterator
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Literal

__all__ = ["make", "up", "down", "status", "run_env", "MigrateError"]


class MigrateError(Exception):
    """What the user must know or do: printed as it is, without a traceback."""


ENV = '''"""Alembic's environment of a Synapsis project, written once by `nuclear migrate make` (synapsis.migrate)."""

from synapsis.migrate import run_env

run_env()
'''


def _config(folder: str | Path, app: str, create: bool = False) -> Any:
    from alembic.config import Config

    import alembic

    d = Path(folder).resolve()
    if create:
        (d / "versions").mkdir(parents=True, exist_ok=True)
        if not (d / "env.py").exists():
            (d / "env.py").write_text(ENV)
        if not (d / "script.py.mako").exists():
            shutil.copy(Path(alembic.__file__).parent / "templates" / "generic" / "script.py.mako", d / "script.py.mako")
    cfg = Config()
    cfg.set_main_option("script_location", str(d))
    # the file is named again by `make` (the same slug as the nestjs dialect's)
    cfg.set_main_option("file_template", "%%(rev)s_%%(slug)s")
    cfg.attributes["app"] = app
    return cfg


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


def _name(revision: Any) -> str:
    return Path(revision.path).stem


def _chain(folder: str | Path, cfg: Any) -> list[Any]:
    """The migrations of the folder from the first to the last. The history is one line: two migrations made after the
    same one (two people at once) are refused, and so is one whose parent is not in the folder."""
    from alembic.script import ScriptDirectory

    d = Path(folder).resolve()
    if not (d / "env.py").exists():
        return []
    script = ScriptDirectory.from_config(cfg)
    # every file of versions/, read one by one: Alembic's own map refuses to load a history that is not one line
    all_: list[Any] = sorted(script._load_revisions(), key=_name)  # pyright: ignore[reportPrivateUsage]
    by_id = {r.revision: r for r in all_}
    out: list[Any] = []
    at: Any = None
    while True:
        following = [r for r in all_ if r.down_revision == at]
        if len(following) > 1:
            first, second = _name(following[0]), _name(following[1])
            after = _name(by_id[at]) if at else "no migration"
            raise MigrateError(
                f"the migrations {first} and {second} both follow {after}: they were made at the same time; "
                "delete one, apply the other and make it again"
            )
        if not following:
            break
        out.append(following[0])
        at = following[0].revision
    lost = next((r for r in all_ if r.down_revision is not None and r.down_revision not in by_id), None)
    if lost is not None:
        raise MigrateError(f"the migration {_name(lost)} follows {lost.down_revision}, which is not in {d}")
    return out


def _prepare(ops: list[Any], table: str = "") -> Iterator[str]:
    """Names every unique and foreign key a migration makes (a constraint without a name cannot be dropped later) and
    gives what the user must know before applying it: data that is lost, a change a table with rows refuses."""
    from alembic.operations import ops as o
    from sqlalchemy import ForeignKeyConstraint, UniqueConstraint

    for op in ops:
        if isinstance(op, o.CreateTableOp):
            for c in op.columns:
                if isinstance(c, UniqueConstraint) and c.name is None:
                    c.name = f"uq_{op.table_name}_{'_'.join(col.name for col in c.columns)}"
                elif isinstance(c, ForeignKeyConstraint) and c.name is None:
                    c.name = f"fk_{op.table_name}_{'_'.join(c.column_keys)}"
        elif isinstance(op, o.CreateUniqueConstraintOp):
            op.constraint_name = op.constraint_name or f"uq_{op.table_name}_{'_'.join(op.columns)}"
        elif isinstance(op, o.CreateForeignKeyOp):
            op.constraint_name = op.constraint_name or f"fk_{op.source_table}_{'_'.join(op.local_cols)}"
        elif isinstance(op, o.DropConstraintOp) and op.constraint_name is None:
            yield (
                f"the migration drops a constraint of {op.table_name} that an older migration made without a name: "
                "write the name it has in the database into the migration's drop_constraint"
            )
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


def _directives(context: Any, revision: Any, directives: list[Any]) -> None:
    del revision
    script = directives[0]
    if script.upgrade_ops.is_empty():
        directives[:] = []
        return
    context.config.attributes["warnings"] = list(_prepare(script.upgrade_ops.ops))
    # the way back, from the operations with their names
    script.upgrade_ops.reverse_into(script.downgrade_ops)


def _keep_generated_keys(inspector: Any, table: Any, column: dict[str, Any]) -> None:
    """SQLite: Alembic makes a table again from what it reads in the database, where AUTOINCREMENT (a key is never
    given twice, as on the other databases) is not read: the table read is told it has it."""
    del column
    bind = inspector.bind
    if bind.dialect.name != "sqlite" or table.dialect_options["sqlite"]["autoincrement"]:
        return
    made = bind.exec_driver_sql("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", (table.name,)).scalar()
    if made and re.search(r"\bAUTOINCREMENT\b", made, re.I):
        table.dialect_options["sqlite"]["autoincrement"] = True


def run_env() -> None:
    """The body of the folder's env.py: Alembic over the connection the command opened (the scratch database of `make`,
    or the app's)."""
    from alembic import context
    from sqlalchemy import Table, event
    from sqlalchemy.orm import configure_mappers

    from .orm import Entity, UtcDateTime

    def render(kind: str, item: Any, autogen: Any) -> str | Literal[False]:
        # the runtime's own column type is written as SQLAlchemy's: a migration imports nothing of the app
        del autogen
        return "sa.DateTime(timezone=True)" if kind == "type" and isinstance(item, UtcDateTime) else False

    cfg = context.config
    connection = cfg.attributes.get("connection")
    if connection is None or context.is_offline_mode():
        raise RuntimeError("synapsis migrations run through `nuclear migrate` (python -m synapsis.migrate)")
    importlib.import_module(cfg.attributes["app"])
    configure_mappers()
    context.configure(
        connection=connection,
        target_metadata=Entity.metadata,
        render_as_batch=True,
        render_item=render,
        compare_type=True,
        compare_server_default=True,
        process_revision_directives=_directives,
    )
    if not event.contains(Table, "column_reflect", _keep_generated_keys):
        event.listen(Table, "column_reflect", _keep_generated_keys)
    with context.begin_transaction():
        context.run_migrations()


def _slug(message: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", message.lower()).strip("_")[:60] or "migration"


def make(folder: str | Path, message: str, app: str = "app.main", now: datetime | None = None) -> Path | None:
    """Writes the migration from the last one to the entities; None when nothing changed."""
    from alembic import command
    from sqlalchemy import create_engine

    cfg = _config(folder, app, create=True)
    _chain(folder, cfg)
    versions = Path(folder).resolve() / "versions"
    # local time, as the nestjs dialect names its migrations; it is also Alembic's revision
    at = now or datetime.now()
    while any(versions.glob(f"{at:%Y%m%d%H%M%S}_*.py")):  # two in one second: the next one
        at += timedelta(seconds=1)
    stamp = f"{at:%Y%m%d%H%M%S}"
    engine = create_engine("sqlite://")
    try:
        with engine.begin() as connection, contextlib.redirect_stdout(io.StringIO()), warnings.catch_warnings():
            warnings.simplefilter("ignore")  # Alembic's notes on a constraint without a name: said by _prepare
            cfg.attributes["connection"] = connection
            command.upgrade(cfg, "head")
            command.revision(cfg, message=" ".join(message.split()), autogenerate=True, rev_id=stamp)
    finally:
        engine.dispose()
    made = sorted(versions.glob(f"{stamp}_*.py"))
    if not made:
        return None
    file = made[0].rename(versions / f"{stamp}_{_slug(message)}.py")
    for warning in cfg.attributes.get("warnings", []):
        print(f"warning: {warning}", file=sys.stderr)
    return file


def _on_database[T](app: str, work: Callable[[Any], T]) -> T:
    """`work` over one connection to the app's default database."""
    from sqlalchemy.ext.asyncio import create_async_engine

    db = _database(app)

    async def run() -> T:
        # SQLite: Python's driver opens no transaction for a schema change unless it is told to
        options: dict[str, Any] = {"connect_args": {"autocommit": False}} if db.url.startswith("sqlite") else {}
        engine = create_async_engine(db.url, **options)
        try:
            async with engine.connect() as connection:
                return await connection.run_sync(work)
        finally:
            await engine.dispose()

    return asyncio.run(run())


def _state(folder: str | Path, cfg: Any, connection: Any) -> list[tuple[Any, bool]]:
    """Every migration of the folder and whether the database has it: the applied ones are the first of the line."""
    from alembic.migration import MigrationContext

    all_ = _chain(folder, cfg)
    heads = MigrationContext.configure(connection).get_current_heads()
    connection.rollback()  # the read opened a transaction: each migration has its own
    ids = [r.revision for r in all_]
    if heads and heads[0] not in ids:
        raise MigrateError(f"the database has the migration {heads[0]} applied, which is not in {Path(folder).resolve()}")
    done = ids.index(heads[0]) + 1 if heads else 0
    return [(r, i < done) for i, r in enumerate(all_)]


def _find(all_: list[tuple[Any, bool]], to: str, folder: str | Path) -> int:
    """The migration `to` names: its name, or the timestamp it starts with."""
    name = Path(to).name.removesuffix(".py")
    for i, (r, _) in enumerate(all_):
        if _name(r) == name or _name(r).startswith(f"{name}_"):
            return i
    raise MigrateError(f"no migration {to} in {Path(folder).resolve()}")


def _run(cfg: Any, connection: Any, revision: Any, direction: Literal["up", "down"]) -> None:
    """One migration, up or down, in a transaction of its own with Alembic's version: all of it or nothing where the
    database undoes schema changes (PostgreSQL, SQLite; MySQL and MariaDB commit each one as it runs)."""
    from alembic import command

    cfg.attributes["connection"] = connection
    dialect = connection.dialect.name
    connection.begin()
    try:
        if direction == "up":
            command.upgrade(cfg, revision.revision)
        else:
            command.downgrade(cfg, revision.down_revision or "base")
        if dialect == "sqlite":
            # the tables are rebuilt with the foreign keys off: what they left is checked before it is kept
            broken = connection.exec_driver_sql("PRAGMA foreign_key_check").first()
            if broken is not None:
                raise MigrateError(f"rows of {broken[0]} point to rows of {broken[2]} that do not exist")
        connection.commit()
    except Exception as e:
        connection.rollback()
        reason = str(getattr(e, "orig", None) or e).split("\n")[0]
        left = (
            "this database does not undo schema changes: what it did before failing is still there, undo it by hand before running it again"
            if dialect in ("mysql", "mariadb")
            else "nothing of it was kept"
        )
        raise MigrateError(f"the migration {_name(revision)} failed{' to revert' if direction == 'down' else ''}: {reason}\n{left}") from e


def _silent(name: str) -> None:
    del name


def up(folder: str | Path, app: str = "app.main", to: str | None = None, each: Callable[[str], None] = _silent) -> list[str]:
    """Applies the pending migrations to the app's database (up to `to`, when given); returns their names. `each` hears
    every one as it is done."""
    cfg = _config(folder, app)

    def work(connection: Any) -> list[str]:
        all_ = _state(folder, cfg, connection)
        last = len(all_) - 1 if to is None else _find(all_, to, folder)
        done: list[str] = []
        for revision, applied in all_[: last + 1]:
            if not applied:
                _run(cfg, connection, revision, "up")
                done.append(_name(revision))
                each(done[-1])
        return done

    return _on_database(app, work)


def down(folder: str | Path, app: str = "app.main", to: str | None = None, each: Callable[[str], None] = _silent) -> list[str]:
    """Reverts the last applied migration, or every one made after `to`; returns their names, the last one first."""
    cfg = _config(folder, app)

    def work(connection: Any) -> list[str]:
        all_ = _state(folder, cfg, connection)
        on = [r for r, applied in all_ if applied]
        keep = len(on) - 1
        if to is not None:
            i = _find(all_, to, folder)
            if not all_[i][1]:
                raise MigrateError(f"the migration {_name(all_[i][0])} is not applied")
            keep = i + 1
        done: list[str] = []
        for revision in reversed(on[max(keep, 0) :]):
            _run(cfg, connection, revision, "down")
            done.append(_name(revision))
            each(done[-1])
        return done

    return _on_database(app, work)


def status(folder: str | Path, app: str = "app.main") -> list[tuple[str, bool]]:
    """Every migration of the folder, from the first to the last, and whether the database has it."""
    cfg = _config(folder, app)
    return _on_database(app, lambda connection: [(_name(r), applied) for r, applied in _state(folder, cfg, connection)])


def main(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(prog="python -m synapsis.migrate")
    parser.add_argument("command", choices=["make", "up", "down", "status"])
    parser.add_argument("message", nargs="?")
    parser.add_argument("--dir", default="../migrations")
    parser.add_argument("--app", default="app.main")
    parser.add_argument("--to")
    a = parser.parse_args(argv)
    sys.path.insert(0, str(Path.cwd()))
    sys.dont_write_bytecode = True  # no __pycache__ in the project's migrations folder
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
            if not up(a.dir, a.app, a.to, lambda name: print(f"applied {name}", flush=True)):
                print("the database is up to date")
        elif not down(a.dir, a.app, a.to, lambda name: print(f"reverted {name}", flush=True)):
            print("nothing to revert" if a.to else "no migration is applied")
    except (MigrateError, LookupError) as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
