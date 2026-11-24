"""ADR-backend-0001, ADR-backend-0002: migrations from the entities, compared with the migrations before, applied to and
reverted from SQLite with TypeORM's rules (the same cases as packages/synapsis-nest/test/migrate.test.ts). Every step runs in its own process, as
`nuclear migrate` does: the entities of one version are a new app."""

from __future__ import annotations

import re
import sqlite3
import subprocess
import sys
from pathlib import Path

APP = '''
from synapsis import AppConfig, Entity, Mapped, SQLite, column, create_app, many_to_one, primary


class ProjectConfig(AppConfig):
    connections = [SQLite(file="app.sqlite")]


class Project(Entity):
    __tablename__ = "projects"
    id: Mapped[int] = primary(generated=True)
    name: Mapped[str] = column({name}){code}


class Task(Entity):
    __tablename__ = "tasks"
    id: Mapped[int] = primary(generated=True)
    title: Mapped[str] = column(length={title})
    project: Mapped[Project | None] = many_to_one("Task", "project_id", "projects.id", "", "cascade")
    project_id: Mapped[int | None] = column(){done}


app = create_app(ProjectConfig(), entities=[Project, Task])
'''

# the first version of the app: projects and their tasks
V1 = APP.format(name="length=100", code="", title=200, done="")
# the second: a task gets `done`, its title gets longer
V2 = APP.format(name="length=100", code="", title=300, done="\n    done: Mapped[bool] = column(default=False)")
# the third: the name of a project (a table other rows point to) gets longer and unique
V3 = APP.format(name="length=150, unique=True", code="", title=300, done="\n    done: Mapped[bool] = column(default=False)")
# the name of a project unique, made by someone who does not have `done` yet
V5 = APP.format(name="length=150, unique=True", code="", title=200, done="")
# a required column without a default
V4 = APP.format(name="length=100", code="\n    code: Mapped[str] = column(length=8)", title=200, done="")


class Project:
    """A project folder with its app, as `nuclear build` leaves it."""

    def __init__(self, root: Path) -> None:
        self.root, self.db, self.versions = root, root / "app.sqlite", root / "migrations" / "versions"
        (root / "app").mkdir()
        (root / "app" / "__init__.py").write_text("")

    def app(self, source: str) -> None:
        (self.root / "app" / "main.py").write_text(source)

    def migrate(self, *args: str, code: int = 0) -> str:
        out = subprocess.run(
            [sys.executable, "-m", "synapsis.migrate", *args, "--dir", "migrations"], cwd=self.root, capture_output=True, text=True
        )
        assert out.returncode == code, out.stdout + out.stderr
        return out.stdout + out.stderr

    def made(self, message: str) -> Path:
        return Path(re.search(r"^wrote (.+)$", self.migrate("make", message), re.M).group(1))  # type: ignore[union-attr]

    def sql(self, statement: str) -> list[tuple[object, ...]]:
        with sqlite3.connect(self.db) as c:
            return c.execute(statement).fetchall()

    def columns(self, table: str) -> list[str]:
        return [str(r[1]) for r in self.sql(f"PRAGMA table_info({table})")]


def test_make_up_and_down_follow_the_entities_and_keep_the_data(tmp_path: Path) -> None:
    p = Project(tmp_path)
    p.app(V1)
    assert "no migrations in" in p.migrate("status")
    assert "the database is up to date" in p.migrate("up")
    assert "no migration is applied" in p.migrate("down")
    first = p.made("projects and tasks").stem
    assert re.fullmatch(r"\d{14}_projects_and_tasks", first)
    assert "no changes" in p.migrate("make", "nothing"), "no changes, no migration"
    assert p.migrate("status").strip() == f"pending  {first}"
    assert p.migrate("up").strip() == f"applied {first}"
    p.sql("INSERT INTO projects (id, name) VALUES (1, 'home')")
    p.sql("INSERT INTO tasks (id, title, project_id) VALUES (1, 'paint', 1)")

    p.app(V2)
    second = p.made("Done tasks!").stem
    assert second.endswith("_done_tasks")
    assert "no changes" in p.migrate("make", "again")
    assert p.migrate("up").strip() == f"applied {second}"
    assert "the database is up to date" in p.migrate("up"), "nothing pending"
    assert p.migrate("status").split() == ["applied", first, "applied", second]
    # the history: one row per migration applied
    assert p.sql("SELECT id, timestamp, name FROM migrations") == [(1, int(first[:14]), first), (2, int(second[:14]), second)]
    assert "done" in p.columns("tasks")
    assert p.sql("SELECT title, done FROM tasks") == [("paint", 0)], "the data stays"

    assert p.migrate("down").strip() == f"reverted {second}"
    assert "done" not in p.columns("tasks")
    assert p.migrate("down").strip() == f"reverted {first}"
    assert "no migration is applied" in p.migrate("down")
    tables = {r[0] for r in p.sql("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert tables <= {"migrations", "sqlite_sequence"}  # SQLite's own table of generated keys
    assert len(list(p.versions.glob("*.py"))) == 2


def test_a_changed_column_keeps_the_rows_the_key_and_the_constraints(tmp_path: Path) -> None:
    p = Project(tmp_path)
    p.app(V2)
    p.made("first")
    p.migrate("up")
    p.sql("INSERT INTO projects (id, name) VALUES (1, 'home')")
    p.sql("INSERT INTO tasks (id, title, project_id) VALUES (1, 'paint', 1)")

    p.app(V3)
    p.made("unique names")
    p.migrate("up")
    # the table the tasks point to was rebuilt: its rows and theirs are there, its ids are still generated once
    assert p.sql("SELECT COUNT(*) FROM projects") == [(1,)] and p.sql("SELECT COUNT(*) FROM tasks") == [(1,)]
    table = str(p.sql("SELECT sql FROM sqlite_master WHERE name = 'projects'")[0][0])
    assert "AUTOINCREMENT" in table and "uq_projects_name" in table and "VARCHAR(150)" in table
    assert [r[2:5] for r in p.sql("PRAGMA foreign_key_list(tasks)")] == [("projects", "project_id", "id")]
    try:
        p.sql("INSERT INTO projects (name) VALUES ('home')")
        raise AssertionError("the name of a project is not unique")
    except sqlite3.IntegrityError:
        pass

    p.migrate("down")
    table = str(p.sql("SELECT sql FROM sqlite_master WHERE name = 'projects'")[0][0])
    assert "AUTOINCREMENT" in table and "uq_projects_name" not in table and "VARCHAR(100)" in table
    assert p.sql("SELECT COUNT(*) FROM tasks") == [(1,)], "the rows that point to the rebuilt table stay"
    p.sql("INSERT INTO projects (name) VALUES ('home')")  # unique no more


def test_make_warns_of_what_loses_data_and_refuses_a_changed_key(tmp_path: Path) -> None:
    p = Project(tmp_path)
    p.app(V2)
    p.made("first")
    p.app(V4)
    text = p.migrate("make", "less and more")
    assert "warning: the migration drops column tasks.done, with its values; if it was renamed, delete this migration and make it with --rename tasks.done=<new column>" in text
    assert "warning: the migration adds the required column projects.code without a default: a table with rows refuses it" in text
    # the key of a table: no migration changes it, and make says so
    p.app(V4.replace("id: Mapped[int] = primary(generated=True)\n    name", "id: Mapped[int] = column()\n    key: Mapped[int] = primary(generated=True)\n    name"))
    text = p.migrate("make", "another key", code=1)
    assert "error: the key of projects changed (id to key): a migration does not change a key" in text
    assert len(list(p.versions.glob("*.py"))) == 2


def test_make_rename_writes_a_rename_that_keeps_the_rows_and_refuses_one_that_is_not_there(tmp_path: Path) -> None:
    p = Project(tmp_path)
    p.app(V2)
    p.made("first")
    p.migrate("up")
    p.sql("INSERT INTO projects (id, name) VALUES (1, 'home')")
    p.sql("INSERT INTO tasks (id, title, project_id) VALUES (1, 'paint', 1)")
    # the projects renamed to teams, and their name to title
    v6 = V2.replace('__tablename__ = "projects"', '__tablename__ = "teams"').replace("name: Mapped[str]", "title: Mapped[str]").replace('"projects.id"', '"teams.id"')
    # refused, with the same words in every dialect; nothing is written
    for app, renames, message in (
        (v6, ["nothing=teams"], "cannot rename nothing: the migrations have no table nothing"),
        (V2, ["projects=teams"], "cannot rename projects: the entities still have the table projects"),
        (v6, ["projects=crews"], "cannot rename projects to crews: the entities have no table crews"),
        (v6, ["projects=tasks"], "cannot rename projects to tasks: the migrations already have the table tasks"),
        (v6, ["projects=teams", "projects.nope=title"], "cannot rename projects.nope: the migrations have no column projects.nope"),
        (v6, ["projects=teams", "projects.id=title"], "cannot rename projects.id: the entities still have the column projects.id"),
        (v6, ["projects=teams", "projects.name=label"], "cannot rename projects.name to label: the entities have no column teams.label"),
        (v6, ["projects=teams", "projects.name=id"], "cannot rename projects.name to id: the migrations already have the column teams.id"),
        (v6, ["projects"], "--rename takes <table>=<new table> or <table>.<column>=<new column>, not projects"),
    ):
        p.app(app)
        text = p.migrate("make", "teams", *(a for r in renames for a in ("--rename", r)), code=1)
        assert text.strip() == f"error: {message}"
    assert len(list(p.versions.glob("*.py"))) == 1

    p.app(v6)
    text = p.migrate("make", "teams", "--rename", "projects=teams", "--rename", "projects.name=title")
    file = Path(re.search(r"^wrote (.+)$", text, re.M).group(1))  # type: ignore[union-attr]
    body = file.read_text()
    assert "    op.rename_table('projects', 'teams')\n    rename_column('teams', 'name', 'title')\n" in body
    assert "    rename_column('teams', 'title', 'name')\n    op.rename_table('teams', 'projects')\n" in body
    assert not re.search(r"drop_table|create_table|drop_column|add_column|alter_column", body) and "warning" not in text
    assert "no changes" in p.migrate("make", "again"), "the rename is all that changed"
    p.migrate("up")
    assert p.sql("SELECT id, title FROM teams") == [(1, "home")], "the rows stay"
    assert [r[2:5] for r in p.sql("PRAGMA foreign_key_list(tasks)")] == [("teams", "project_id", "id")], "the rows that point to it follow"
    p.migrate("down")
    assert p.sql("SELECT id, name FROM projects") == [(1, "home")]
    assert [r[2:5] for r in p.sql("PRAGMA foreign_key_list(tasks)")] == [("projects", "project_id", "id")]
    assert p.sql("SELECT COUNT(*) FROM tasks") == [(1,)]


def test_a_text_column_is_the_varchar_of_its_length_or_the_text_type_that_holds_it(tmp_path: Path) -> None:
    from sqlalchemy import VARCHAR, String
    from sqlalchemy.dialects import mysql, postgresql, sqlite
    from synapsis.orm import text_type

    # the one rule, the same as the nestjs dialect's runtime (test/migrate.test.ts)
    def rule(n: int) -> list[str]:
        return [text_type(d, n) for d in ("sqlite", "postgres", "mysql", "mariadb")]

    assert rule(255) == ["VARCHAR(255)"] * 4
    assert rule(16383) == ["VARCHAR(16383)"] * 4
    assert rule(16384) == ["VARCHAR(16384)", "VARCHAR(16384)", "MEDIUMTEXT", "MEDIUMTEXT"]
    assert rule(4194303) == ["VARCHAR(4194303)", "VARCHAR(4194303)", "MEDIUMTEXT", "MEDIUMTEXT"]
    assert rule(4194304) == ["VARCHAR(4194304)", "VARCHAR(4194304)", "LONGTEXT", "LONGTEXT"]
    assert rule(10485760) == ["VARCHAR(10485760)", "VARCHAR(10485760)", "LONGTEXT", "LONGTEXT"]
    assert rule(10485761) == ["VARCHAR(10485761)", "TEXT", "LONGTEXT", "LONGTEXT"]
    # what a table or a migration is made with follows it
    for n in (255, 16384, 4194304, 10485761):
        # `String` in an entity and a migration; `VARCHAR` in a migration's way back, read from SQLite
        for kind in (String, VARCHAR):
            made = [str(kind(n).compile(dialect=d.dialect())) for d in (sqlite, postgresql, mysql)]
            assert made == rule(n)[:3], made

    # a changed length is a migration, in both directions
    essays = (
        "from synapsis import AppConfig, Entity, Mapped, SQLite, column, create_app, primary\n\n\n"
        "class ProjectConfig(AppConfig):\n    connections = [SQLite(file=\"app.sqlite\")]\n\n\n"
        "class Essay(Entity):\n    __tablename__ = \"essays\"\n    id: Mapped[int] = primary(generated=True)\n"
        "    body: Mapped[str] = column(length={n})\n\n\napp = create_app(ProjectConfig(), entities=[Essay])\n"
    )
    p = Project(tmp_path)

    def kind() -> str:
        return str(p.sql("SELECT type FROM pragma_table_info('essays') WHERE name = 'body'")[0][0])

    p.app(essays.format(n=100000))
    p.made("essays")
    p.migrate("up")
    assert kind() == "VARCHAR(100000)"
    p.sql("INSERT INTO essays (body) VALUES ('kept')")
    p.app(essays.format(n=100))
    p.made("shorter")
    p.migrate("up")
    assert kind() == "VARCHAR(100)"
    p.app(essays.format(n=1000000))
    p.made("longer")
    p.migrate("up")
    assert kind() == "VARCHAR(1000000)"
    p.migrate("down")
    assert kind() == "VARCHAR(100)"
    assert p.sql("SELECT body FROM essays") == [("kept",)]


def test_a_failed_migration_is_not_applied(tmp_path: Path) -> None:
    p = Project(tmp_path)
    p.app(V1)
    first = p.made("first").stem
    p.app(V2)
    file = p.made("done")
    good = file.read_text()
    file.write_text(good.replace("\n\n\ndef downgrade", '\n    op.execute("SELECT * FROM nothing")\n\n\ndef downgrade', 1))
    # one transaction for the whole run: nothing of it stays, the migration before the failed one neither
    text = p.migrate("up", code=1)
    assert f"error: the migration {file.stem} failed:" in text and "nothing of this run was kept" in text
    assert "Traceback" not in text and "applied" not in text
    assert p.migrate("status").split() == ["pending", first, "pending", file.stem]
    assert p.sql("SELECT name FROM sqlite_master WHERE name IN ('projects', 'tasks')") == []
    # one transaction per migration: the ones before the failed one stay
    text = p.migrate("up", "--transaction", "each", code=1)
    assert f"applied {first}" in text and "nothing of it was kept" in text
    assert "done" not in p.columns("tasks"), "what the migration did before failing is undone"
    assert p.migrate("status").split() == ["applied", first, "pending", file.stem]
    # no transaction: what it did before failing stays
    text = p.migrate("up", "--transaction", "none", code=1)
    assert "it ran without a transaction: what it did before failing is still there" in text
    assert "done" in p.columns("tasks") and p.migrate("status").split() == ["applied", first, "pending", file.stem]
    # brought under the history without running it
    file.write_text(good)
    assert p.migrate("up", "--fake").strip() == f"applied {file.stem} (fake)"
    assert p.migrate("down", "--fake").strip() == f"reverted {file.stem} (fake)"
    assert "done" in p.columns("tasks") and p.migrate("status").split() == ["applied", first, "pending", file.stem]
    p.migrate("up", "--fake")
    assert p.migrate("down").strip() == f"reverted {file.stem}"
    assert "done" not in p.columns("tasks")


def test_the_history_is_what_was_applied(tmp_path: Path) -> None:
    p = Project(tmp_path)
    p.app(V1)
    first = p.made("first").stem
    p.app(V2)
    file = p.made("done")
    second = file.stem
    p.app(V3)
    third = p.made("unique names").stem

    # up to a migration, down to a migration (its name, or the timestamp it starts with)
    assert p.migrate("up", "--to", second[:14]).split() == ["applied", first, "applied", second]
    assert p.migrate("status").split() == ["applied", first, "applied", second, "pending", third]
    assert f"error: the migration {third} is not applied" in p.migrate("down", "--to", third, code=1)
    assert "error: no migration nothing in" in p.migrate("up", "--to", "nothing", code=1)
    p.migrate("up")
    assert p.migrate("down", "--to", first).split() == ["reverted", third, "reverted", second]
    assert "nothing to revert" in p.migrate("down", "--to", first)

    # a pending migration older than an applied one runs, and `down` reverts the last one applied, not the newest
    hidden = file.rename(file.with_suffix(".later"))
    assert p.migrate("up").strip() == f"applied {third}"
    hidden.rename(file)
    assert p.migrate("status").split() == ["applied", first, "pending", second, "applied", third]
    assert p.migrate("up").strip() == f"applied {second}"
    assert p.migrate("down").strip() == f"reverted {second}"
    p.migrate("up")

    # a migration the database has and the folder does not: nothing but its revert needs the file
    hidden = file.rename(file.with_suffix(".gone"))
    assert p.migrate("status").split() == ["applied", first, "applied", third]
    assert "the database is up to date" in p.migrate("up")
    assert f"error: the migration {second} is applied and is not in" in p.migrate("down", code=1)
    hidden.rename(file)
    assert p.migrate("down").strip() == f"reverted {second}"


def test_two_migrations_made_at_the_same_time_both_count(tmp_path: Path) -> None:
    p = Project(tmp_path)
    p.app(V1)
    p.made("first")
    p.app(V2)
    mine = p.made("done")
    hidden = mine.rename(mine.with_suffix(".theirs"))
    p.app(V5)
    yours = p.made("unique names")
    hidden.rename(mine)
    # the entities with both changes: nothing left to make, and both apply
    p.app(V3)
    assert "no changes" in p.migrate("make", "nothing")
    assert p.migrate("up").split()[3::2] == [mine.stem, yours.stem]
    assert "done" in p.columns("tasks") and "uq_projects_name" in str(p.sql("SELECT sql FROM sqlite_master WHERE name = 'projects'"))


def test_a_database_migrated_by_an_older_version_goes_on(tmp_path: Path) -> None:
    """Before 0.93 the history was Alembic's (`alembic_version`: the last revision); before 0.91 a constraint had no
    name."""
    p = Project(tmp_path)
    p.app(V5)
    first = p.made("first")
    p.app(V3)
    second = p.made("done")
    first.write_text(first.read_text().replace(", name='uq_projects_name'", "").replace(", name='fk_tasks_project_id'", ""))
    second.write_text(second.read_text().replace("\ndef upgrade", "revision: str = 'f1e2d3c4b5a6'\n\n\ndef upgrade"))
    assert "uq_projects_name" not in first.read_text()
    p.migrate("up")
    p.sql("DROP TABLE migrations")
    p.sql("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
    p.sql("INSERT INTO alembic_version VALUES ('f1e2d3c4b5a6')")

    assert p.migrate("status").split() == ["applied", first.stem, "applied", second.stem]
    assert p.sql("SELECT name FROM migrations ORDER BY id") == [(first.stem,), (second.stem,)]
    assert "no changes" in p.migrate("make", "nothing"), "a constraint without a name is the same constraint"
    # the unique made without a name goes: it is found by its column
    p.app(V2)
    third = p.made("names again").stem
    assert p.migrate("up").strip() == f"applied {third}"
    p.sql("INSERT INTO projects (name) VALUES ('home')")
    p.sql("INSERT INTO projects (name) VALUES ('home')")
    assert p.migrate("down", "--to", first.stem, code=1).count("reverted") == 0, "two rows with one name: the unique cannot come back"
    p.sql("DELETE FROM projects")
    assert p.migrate("down", "--to", first.stem).split() == ["reverted", third, "reverted", second.stem]


# an app with every kind of thing `createTables` and a migration must write the same way: a unique, defaults, a
# `DateTime`, the timestamps, a foreign key, a join table
STAMPED = '''
from __future__ import annotations

from datetime import datetime

from synapsis import AppConfig, Entity, Mapped, SQLite, column, create_app, created, many_to_many, many_to_one, primary, updated


class ProjectConfig(AppConfig):
    connections = [SQLite(file="app.sqlite", create_tables=True)]


class Label(Entity):
    __tablename__ = "labels"
    id: Mapped[int] = primary(generated=True)
    text: Mapped[str] = column(length=30, unique=True)
    kind: Mapped[str] = column(length=8, index=True)


class Project(Entity):
    __tablename__ = "projects"
    id: Mapped[int] = primary(generated=True)
    name: Mapped[str] = column(length=100, unique=True)
    open: Mapped[bool] = column(default=True)
    cost: Mapped[float] = column(default=0.5)
    due: Mapped[datetime | None] = column(nullable=True)
    owner: Mapped[Project | None] = many_to_one("Project", "owner_id", "projects.id", "", "set null")
    owner_id: Mapped[int | None] = column()
    labels: Mapped[list[Label]] = many_to_many("Project", "labels", "Label", join=True)
    created_at: Mapped[datetime] = created()
    updated_at: Mapped[datetime] = updated()


app = create_app(ProjectConfig(), entities=[Label, Project])
'''


def shape(p: Project) -> dict[str, object]:
    """Every table as SQLite has it: its columns (the words of the type, null, the default by its value, the key), its
    foreign keys and the names of its constraints."""
    out: dict[str, object] = {}
    for name, made in p.sql("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT IN ('migrations', 'sqlite_sequence')"):
        columns = [(c[1], c[2], c[3], str(c[4]).strip("()").lower() if c[4] is not None else None, c[5]) for c in p.sql(f"PRAGMA table_info({name})")]
        foreign = sorted(r[2:7] for r in p.sql(f"PRAGMA foreign_key_list({name})"))
        indexes = sorted(str(r[0]) for r in p.sql(f"SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = '{name}' AND sql IS NOT NULL"))
        out[str(name)] = (columns, foreign, sorted(re.findall(r"CONSTRAINT (\w+)", str(made))) + indexes, "AUTOINCREMENT" in str(made))
    return out


def test_create_tables_makes_the_tables_of_the_first_migration(tmp_path: Path) -> None:
    p = Project(tmp_path)
    p.app(STAMPED)
    # the app opens its database, as it does when it starts
    opened = "import asyncio, app.main as m; asyncio.run(m.app.state.synapsis_config.connections[0].open())"
    subprocess.run([sys.executable, "-c", opened], cwd=p.root, check=True)
    created = shape(p)
    assert sorted(created) == ["labels", "projects", "projects_labels"]
    columns, foreign, names, generated = created["projects"]  # type: ignore[misc]
    assert ("due", "DATETIME(6)", 0, None, 0) in columns and ("created_at", "DATETIME(6)", 1, "current_timestamp", 0) in columns
    assert ("open", "BOOLEAN", 1, "true", 0) in columns and ("cost", "DOUBLE", 1, "0.5", 0) in columns
    assert names == ["fk_projects_owner_id", "uq_projects_name"] and generated
    assert created["labels"][2] == ["uq_labels_text", "CREATE INDEX ix_labels_kind ON labels (kind)"]  # type: ignore[index]
    assert created["projects_labels"][2] == ["fk_projects_labels_label_id", "fk_projects_labels_project_id"]  # type: ignore[index]
    subprocess.run([sys.executable, "-c", opened], cwd=p.root, check=True)  # the tables are there: nothing to make
    assert shape(p) == created

    # the tables createTables made come under the migrations with --fake, and the migration makes the same ones
    first = p.made("first")
    assert "failed" in p.migrate("up", code=1)
    assert "(fake)" in p.migrate("up", "--fake")
    assert "no changes" in p.migrate("make", "nothing")
    p.migrate("down")
    assert shape(p) == {}
    p.migrate("up")
    assert shape(p) == created

    # a migration made before 0.94 wrote a DateTime without its fraction: the next make gives it, and the rows stay
    p.migrate("down")
    first.write_text(first.read_text().replace("UtcDateTime()", "sa.DateTime(timezone=True)"))
    p.migrate("up")
    assert {c[1] for c in shape(p)["projects"][0] if c[0] in ("due", "created_at", "updated_at")} == {"DATETIME"}  # type: ignore[index]
    p.sql("INSERT INTO projects (name, due) VALUES ('home', '2026-03-04 05:06:07.089000')")
    second = p.made("the fraction")
    assert "type_=UtcDateTime()" in second.read_text()
    # the way back names a type every database has, not SQLite's own
    assert "type_=sa.DateTime(timezone=True)" in second.read_text() and "sa.DATETIME()" not in second.read_text()
    p.migrate("up")
    assert shape(p) == created
    assert p.sql("SELECT name, due FROM projects") == [("home", "2026-03-04 05:06:07.089000")]
    assert "no changes" in p.migrate("make", "nothing")


def test_an_exact_column_is_made_and_changed_by_its_precision_and_scale(tmp_path: Path) -> None:
    """A `bigint` is BIGINT, a `bigdouble` NUMERIC(p, s); SQLite keeps their text, in a type that says so (the same
    names as test/migrate.test.ts)."""
    from sqlalchemy.dialects import mysql, postgresql, sqlite
    from synapsis.orm import ExactDecimal, ExactInteger

    made = [str(ExactDecimal(20, 4).compile(dialect=d.dialect())) for d in (sqlite, postgresql, mysql)]
    assert made == ["EXACT TEXT(20,4)", "NUMERIC(20, 4)", "NUMERIC(20, 4)"]
    assert [str(ExactInteger().compile(dialect=d.dialect())) for d in (sqlite, postgresql, mysql)] == ["EXACT TEXT", "BIGINT", "BIGINT"]
    prices = (
        "from decimal import Decimal\n"
        "from synapsis import AppConfig, BigDouble, BigInt, Entity, Mapped, SQLite, column, create_app, primary\n\n\n"
        "class ProjectConfig(AppConfig):\n    connections = [SQLite(file=\"app.sqlite\")]\n\n\n"
        "class Price(Entity):\n    __tablename__ = \"prices\"\n    id: Mapped[int] = primary(generated=True)\n"
        "    code: Mapped[BigInt] = column()\n"
        "    amount: Mapped[BigDouble] = column({amount}){more}\n\n\napp = create_app(ProjectConfig(), entities=[Price])\n"
    )
    p = Project(tmp_path)

    def kinds() -> list[str]:
        return [str(r[0]) for r in p.sql("SELECT type FROM pragma_table_info('prices') ORDER BY cid")]

    p.app(prices.format(amount="", more=""))
    first = p.made("prices")
    assert "ExactInteger()" in first.read_text() and "ExactDecimal(30, 10)" in first.read_text()
    p.migrate("up")
    assert kinds() == ["INTEGER", "EXACT TEXT", "EXACT TEXT(30,10)"]
    assert "no changes" in p.migrate("make", "again")
    p.sql("INSERT INTO prices (code, amount) VALUES ('12345678901234567', '0.3000000000')")
    p.app(prices.format(amount="precision=20, scale=4", more="\n    rate: Mapped[BigDouble] = column(default=Decimal(\"1.5\"))"))
    p.made("scale")
    p.migrate("up")
    assert kinds() == ["INTEGER", "EXACT TEXT", "EXACT TEXT(20,4)", "EXACT TEXT(30,10)"]
    assert p.sql("SELECT code, amount, rate FROM prices") == [("12345678901234567", "0.3000", "1.5000000000")]
    assert "no changes" in p.migrate("make", "again")
    p.migrate("down")
    assert kinds() == ["INTEGER", "EXACT TEXT", "EXACT TEXT(30,10)"]
