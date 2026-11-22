"""ADR-backend-0001: migrations from the entities, compared with the last migration, applied to and reverted from SQLite
(the same cases as packages/synapsis-nest/test/migrate.test.ts). Every step runs in its own process, as
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
    assert "done" in p.columns("tasks")
    assert p.sql("SELECT title, done FROM tasks") == [("paint", 0)], "the data stays"

    assert p.migrate("down").strip() == f"reverted {second}"
    assert "done" not in p.columns("tasks")
    assert p.migrate("down").strip() == f"reverted {first}"
    assert "no migration is applied" in p.migrate("down")
    tables = {r[0] for r in p.sql("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert tables <= {"alembic_version", "sqlite_sequence"}  # SQLite's own table of generated keys
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


def test_make_warns_of_what_loses_data_or_is_refused(tmp_path: Path) -> None:
    p = Project(tmp_path)
    p.app(V2)
    p.made("first")
    p.app(V4)
    text = p.migrate("make", "less and more")
    assert "warning: the migration drops column tasks.done; if it was renamed, edit it" in text
    assert "warning: the migration adds the required column projects.code without a default: a table with rows refuses it" in text


def test_a_failed_migration_is_not_applied(tmp_path: Path) -> None:
    p = Project(tmp_path)
    p.app(V1)
    first = p.made("first").stem
    p.migrate("up")
    p.app(V2)
    file = p.made("done")
    good = file.read_text()
    file.write_text(good.replace("\n\n\ndef downgrade", '\n    op.execute("SELECT * FROM nothing")\n\n\ndef downgrade', 1))
    text = p.migrate("up", code=1)
    assert f"error: the migration {file.stem} failed:" in text and "nothing of it was kept" in text
    assert "Traceback" not in text
    assert "done" not in p.columns("tasks"), "what the migration did before failing is undone"
    assert p.migrate("status").split() == ["applied", first, "pending", file.stem]
    file.write_text(good)
    assert p.migrate("up").strip() == f"applied {file.stem}"
    assert "done" in p.columns("tasks")


def test_the_history_is_one_line(tmp_path: Path) -> None:
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

    # a migration the database has and the folder does not
    p.migrate("up", "--to", second)
    hidden = [f.rename(f.with_suffix(".gone")) for f in sorted(p.versions.glob("*.py"))[1:]]
    for command in ("status", "up", "down"):
        assert "error: the database has the migration" in p.migrate(command, code=1)
    for f in hidden:
        f.rename(f.with_suffix(".py"))

    # two migrations made after the same one (two people at once)
    twin = file.with_name("29990101000000_twin.py")
    twin.write_text(re.sub(r"^(revision: str = )'\d+'", r"\1'29990101000000'", file.read_text(), flags=re.M))
    for command in (("status",), ("up",), ("down",), ("make", "more")):
        text = p.migrate(*command, code=1)
        assert f"error: the migrations {second} and 29990101000000_twin both follow {first}" in text
    twin.unlink()
    assert p.migrate("status").split() == ["applied", first, "applied", second, "pending", third]


def test_migrations_made_by_an_older_version_still_run(tmp_path: Path) -> None:
    """Before 0.91 a revision was a random id and constraints had no name: the files are ordered by their parents."""
    p = Project(tmp_path)
    p.app(V1)
    first = p.made("first")
    p.app(V2)
    second = p.made("done")
    first.write_text(first.read_text().replace(first.stem[:14], "f1e2d3c4b5a6").replace(", name='fk_tasks_project_id'", ""))
    second.write_text(second.read_text().replace(second.stem[:14], "0a1b2c3d4e5f").replace(first.stem[:14], "f1e2d3c4b5a6"))
    assert "fk_tasks_project_id" not in first.read_text() and "down_revision: Union[str, Sequence[str], None] = 'f1e2d3c4b5a6'" in second.read_text()
    assert p.migrate("up").split() == ["applied", first.stem, "applied", second.stem]
    assert p.sql("SELECT version_num FROM alembic_version") == [("0a1b2c3d4e5f",)]
    assert "no changes" in p.migrate("make", "nothing"), "a constraint without a name is the same constraint"
    p.app(V3)
    third = p.made("unique names").stem
    assert p.migrate("up").strip() == f"applied {third}"
    assert p.migrate("down", "--to", first.stem).split() == ["reverted", third, "reverted", second.stem]
