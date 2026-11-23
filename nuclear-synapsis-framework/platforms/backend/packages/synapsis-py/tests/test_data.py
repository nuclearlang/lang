"""ADR-backend-0001: relations, explicit loading, pagination and transactions over SQLite in memory."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from synapsis import (
    AppConfig, AppError, Conflict, Entity, Err, Mapped, Ok, Page, Repository, Result, SQLite, column, controller,
    create_app, get, ilike, inject, many_to_many, many_to_one, one_to_many, primary, transactional,
)
from synapsis.testing import client, memory_database


class Project(Entity):
    __tablename__ = "projects"
    id: Mapped[int] = primary(generated=True)
    name: Mapped[str] = column()
    tasks: Mapped[list[Task]] = one_to_many("Task", "project")


class Task(Entity):
    __tablename__ = "tasks"
    id: Mapped[int] = primary(generated=True)
    title: Mapped[str] = column()
    project: Mapped[Project | None] = many_to_one("Task", "project_id", "projects.id", "tasks", "cascade")
    project_id: Mapped[int] = column()
    note: Mapped[str | None] = column(nullable=True)
    due_at: Mapped[datetime | None] = column(nullable=True)
    tags: Mapped[list[Tag]] = many_to_many("Task", "tags", "Tag", "tasks", join=True)


class Tag(Entity):
    __tablename__ = "tags"
    id: Mapped[str] = primary(generated=True, uuid_key=True)
    label: Mapped[str] = column()
    tasks: Mapped[list[Task]] = many_to_many("Tag", "tasks", "Task", "tags")


class Member(Entity):
    """What a database refuses for integrity: a unique column, a required one, a foreign key without a rule."""

    __tablename__ = "members"
    id: Mapped[int] = primary(generated=True)
    email: Mapped[str] = column(length=20, unique=True)
    name: Mapped[str] = column()
    project: Mapped[Project | None] = many_to_one("Member", "project_id", "projects.id")
    project_id: Mapped[int | None] = column(nullable=True)


class MemberRepository(Repository[Member]):
    pass


class Enroll:
    def __init__(self, members: MemberRepository) -> None:
        self.members = members

    @transactional
    async def exec(self, email: str) -> Result[AppError, int]:
        await self.members.save(Member(email=f"new-{email}", name="written before the refusal"))
        await self.members.save(Member(email=email, name="again"))
        return Ok(1)


@controller("members")
class MemberController:
    def __init__(self, members: MemberRepository, projects: ProjectRepository) -> None:
        self.members = members
        self.projects = projects

    @get("try/{what}")
    async def attempt(self, what: str, id: int = 0, email: str = "") -> int:
        """One write the database (or the runtime, before it) refuses; a route lets the error go."""
        if what == "unique":
            await self.members.save(Member(email="ana@x.co", name="Other"))
        elif what == "foreign":
            await self.members.save(Member(email="luis@x.co", name="Luis", project_id=999))
        elif what == "parent":
            await self.projects.remove(id)
        elif what == "null":
            await self.members.save(Member(email="eva@x.co"))
        elif what == "null-update":
            await self.members.where({"id": id}).update({"name": None})
        elif what == "long":
            await self.members.save(Member(email="e" * 21, name="long"))
        elif what == "long-default":
            await self.members.save(Member(email="long@x.co", name="n" * 256))
        elif what == "long-update":
            await self.members.where({"id": id}).update({"email": "e" * 21})
        elif what == "fits":
            await self.members.save(Member(email="😀" * 20, name="ñ" * 255))
        elif what == "enroll":
            await Enroll(self.members).exec(email)
        return await self.members.count()


class ProjectRepository(Repository[Project]):
    pass


class TaskRepository(Repository[Task]):
    pass


class TagRepository(Repository[Tag]):
    pass


class MoveTasks:
    def __init__(self, tasks: TaskRepository, projects: ProjectRepository) -> None:
        self.tasks = tasks
        self.projects = projects

    @transactional
    async def exec(self, source: int, target: int, fail: bool) -> Result[AppError, int]:
        moved = await self.tasks.where({"projectId": source}).update({"projectId": target})
        await self.projects.save(Project(name="audit"))
        if fail:
            return Err(Conflict("rolled back"))
        return Ok(moved)


@controller("projects")
class ProjectController:
    def __init__(self, projects: ProjectRepository, tasks: TaskRepository) -> None:
        self.projects = projects
        self.tasks = tasks

    @get("{id}")
    async def one(self, id: int) -> Result[AppError, Project]:
        return await self.projects.where({"id": id}).relations("tasks.tags").get_one()

    @get("{id}/plain")
    async def plain(self, id: int) -> Result[AppError, Project]:
        return await self.projects.find(id)

    @get("tasks/of/{projectId}")
    async def of(self, project_id: int, min_id: int = 0) -> list[Task]:
        return [t for t in await self.tasks.where({"projectId": project_id}).order_by("id").get_many() if t.id >= min_id]

    @get("tasks/page/{page}")
    async def page(self, page: int) -> Page[Task]:
        return await self.tasks.query().order_by("id").paginate(page, 2)


class Config(AppConfig):
    connections = [SQLite("unused.db")]


async def test_relations_pages_and_transactions() -> None:
    app = create_app(Config(), controllers=[ProjectController])
    async with client(app, Config(), memory_database()) as http:
        projects, tasks, tags = inject(ProjectRepository), inject(TaskRepository), inject(TagRepository)
        home = await projects.save(Project(name="home"))
        work = await projects.save(Project(name="work"))
        urgent = await tags.save(Tag(label="urgent"))
        assert len(urgent.id) == 36
        for i in range(5):
            t = Task(title=f"t{i}", project_id=home.id)
            if i == 0:
                t.tags = [urgent]
            await tasks.save(t)

        body: dict[str, Any] = (await http.get(f"/projects/{home.id}")).json()
        assert [t["title"] for t in body["tasks"]] == ["t0", "t1", "t2", "t3", "t4"]
        assert body["tasks"][0]["tags"][0]["label"] == "urgent"
        assert "project" not in body["tasks"][0]  # not loaded: absent, not null
        assert "tasks" not in (await http.get(f"/projects/{home.id}/plain")).json()

        page = (await http.get("/projects/tasks/page/3")).json()
        assert page == {"items": page["items"], "page": 3, "size": 2, "total": 5, "pages": 3}
        assert [t["title"] for t in page["items"]] == ["t4"]

        move = MoveTasks(tasks, projects)
        failed = await move.exec(home.id, work.id, fail=True)
        assert failed.is_err
        assert await tasks.where({"projectId": home.id}).count() == 5  # rolled back
        assert await projects.count() == 2
        done = await move.exec(home.id, work.id, fail=False)
        assert done.is_ok and done.value == 5
        assert await projects.count() == 3

        await projects.remove(work.id)  # ON DELETE CASCADE
        assert await tasks.count() == 0


async def test_the_same_rows_in_every_dialect() -> None:
    """What packages/synapsis-nest/test/data.test.ts checks too: found running one project with both dialects on
    PostgreSQL, MySQL, MariaDB and SQLite (checks/database-check)."""
    app = create_app(Config(), controllers=[ProjectController])
    async with client(app, Config(), memory_database()) as http:
        projects, tasks, tags = inject(ProjectRepository), inject(TaskRepository), inject(TagRepository)
        home = await projects.save(Project(name="Home Sweet"))
        due = datetime(2026, 3, 4, 5, 6, 7, 123000, tzinfo=timezone(timedelta(hours=2)))
        task = await tasks.save(Task(title="paint", project_id=home.id, due_at=due))
        assert task.note is None  # a column left out is null in the row `save` answers
        assert await projects.where({"name": ilike("%SWEET%")}).count() == 1  # any case, on every database

        found = (await tasks.find(task.id)).value
        assert found.due_at == due and found.due_at.utcoffset() == timedelta(0)  # an instant, read back in UTC

        a, b = await tags.save(Tag(label="a")), await tags.save(Tag(label="b"))
        found.tags = [a, b]  # a list set on a found row replaces its rows of the join table
        await tasks.save(found)
        again = (await tasks.find(task.id)).value
        again.tags = [b]
        await tasks.save(again)

        body: dict[str, Any] = (await http.get(f"/projects/{home.id}")).json()
        row = body["tasks"][0]
        assert [t["label"] for t in row["tags"]] == ["b"]
        assert sorted(row["tags"][0]) == ["id", "label"]  # the related row only, with Nuclear's names
        assert (row["dueAt"], row["projectId"], row["note"]) == ("2026-03-04T03:06:07.123Z", home.id, None)
        # a parameter of several words is read by its Nuclear name, in the path and in the query
        listed = (await http.get(f"/projects/tasks/of/{home.id}?minId={task.id}")).json()
        assert [t["title"] for t in listed] == ["paint"]
        assert (await http.get(f"/projects/tasks/of/{home.id}?minId={task.id + 1}")).json() == []


async def test_what_the_database_refuses_for_integrity_is_a_409() -> None:
    """The same cases as data.test.ts: what Spring's DataIntegrityViolationException covers answers 409 `conflict`."""
    app = create_app(Config(), controllers=[MemberController])
    async with client(app, Config(), memory_database()) as http:
        projects, members = inject(ProjectRepository), inject(MemberRepository)
        team = await projects.save(Project(name="team"))
        ana = await members.save(Member(email="ana@x.co", name="Ana", project_id=team.id))

        async def tried(what: str) -> tuple[int, Any]:
            r = await http.get(f"/members/try/{what}")
            return r.status_code, r.json()

        conflict = (409, {"status": 409, "message": "conflict"})
        # a repeated unique value, a foreign key that points at nothing, a row others point to, a null in a required column
        assert await tried("unique") == conflict
        assert await tried("foreign") == conflict
        assert await tried(f"parent?id={team.id}") == conflict
        assert await tried("null") == conflict
        assert await tried(f"null-update?id={ana.id}") == conflict
        # a text longer than its column, counted in characters: 20 of them fit whatever bytes they take
        assert await tried("long") == conflict
        assert await tried("long-default") == conflict
        assert await tried(f"long-update?id={ana.id}") == conflict
        assert await tried("fits") == (200, 2)
        # inside @transactional what was written before the refusal is not kept
        assert await tried("enroll?email=ana@x.co") == conflict
        assert await members.where({"email": "new-ana@x.co"}).count() == 0
        assert await tried("enroll?email=eva@x.co") == (200, 4)
