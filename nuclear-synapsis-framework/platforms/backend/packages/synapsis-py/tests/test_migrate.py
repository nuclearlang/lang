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
    assert "warning: the migration drops column tasks.done; if it was renamed, edit it" in text
    assert "warning: the migration adds the required column projects.code without a default: a table with rows refuses it" in text
    # the key of a table: no migration changes it, and make says so
    p.app(V4.replace("id: Mapped[int] = primary(generated=True)\n    name", "id: Mapped[int] = column()\n    key: Mapped[int] = primary(generated=True)\n    name"))
    text = p.migrate("make", "another key", code=1)
    assert "error: the key of projects changed (id to key): a migration does not change a key" in text
    assert len(list(p.versions.glob("*.py"))) == 2


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
