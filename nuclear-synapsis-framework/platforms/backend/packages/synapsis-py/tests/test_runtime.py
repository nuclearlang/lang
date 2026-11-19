from __future__ import annotations

from typing import TypedDict

from synapsis import (
    AppConfig, AppError, Entity, Mapped, Ok, Repository, Result, SQLite, column, controller, create_app,
    get, gt, inject, one_of, post, primary,
)
from synapsis.ai import Agent, Graph, Messages, Tools, next, start, text_of
from synapsis.testing import FakeModel, client, memory_database


class Hero(Entity):
    __tablename__ = "heroes"
    id: Mapped[int] = primary(generated=True)
    name: Mapped[str] = column(length=50)
    power: Mapped[int] = column(default=1)


class HeroRepository(Repository[Hero]):
    def strong(self, minimum: int):
        q = self.query()
        q.where({"power": gt(minimum)})
        q.order_by("name")
        return q.get_many()


@controller("/heroes")
class HeroController:
    def __init__(self, repo: HeroRepository) -> None:
        self.repo = repo

    @post("")
    async def create(self, hero: Hero) -> Hero:
        return await self.repo.save(hero)

    @get("/{id}")
    async def one(self, id: int) -> Result[AppError, Hero]:
        return await self.repo.find(id)

    @get("/strong/{minimum}")
    async def strong(self, minimum: int) -> list[Hero]:
        return await self.repo.strong(minimum)

    @get("/total")
    async def total(self) -> int:
        return await self.repo.count()


class Config(AppConfig):
    connections = [SQLite("unused.db")]


async def test_crud_query_and_controller() -> None:
    app = create_app(Config(), controllers=[HeroController])
    async with client(app, Config(), memory_database()) as http:
        a = await http.post("/heroes", json={"name": "Rick", "power": 9})
        assert a.status_code == 201, a.text
        await http.post("/heroes", json={"name": "Morty", "power": 2})
        assert (await http.get(f"/heroes/{a.json()['id']}")).json()["name"] == "Rick"
        assert (await http.get("/heroes/99")).status_code == 404
        assert [h["name"] for h in (await http.get("/heroes/strong/1")).json()] == ["Morty", "Rick"]
        # a fixed segment wins over `{id}`, though its method comes after `one`
        assert (await http.get("/heroes/total")).json() == 2
        repo = inject(HeroRepository)
        assert await repo.where({"name": "Rick"}).count() == 1
        one = await repo.where(name="Morty").get_one()
        assert one.is_ok and one.value.power == 2
        assert (await repo.where(name="Nobody").get_one()).is_err
        assert await repo.where({"name": one_of(["Rick", "Morty"])}).count() == 2


@controller("/items")
class ItemController:
    """Nuclear writes `type`, `list` and `from` as `type_`, `list_` and `from_` (they are Python's words)."""

    @get("/{type}")
    async def by_type(self, type_: str, list_: int = 0, from_: str = "") -> str:
        return f"{type_}:{list_}:{from_}"


async def test_a_renamed_parameter_keeps_its_public_name() -> None:
    app = create_app(Config(), controllers=[ItemController])
    async with client(app, Config(), memory_database()) as http:
        answer = await http.get("/items/book", params={"list": 3, "from": "shelf"})
        assert answer.status_code == 200, answer.text
        assert answer.json() == "book:3:shelf"
        names = {p["name"] for p in app.openapi()["paths"]["/items/{type_}"]["get"]["parameters"]}
        assert {"list", "from"} <= names


class WeatherTools(Tools):
    def weather(self, city: str) -> str:
        """The weather of a city."""
        return self.describe([city])

    def describe(self, cities: list[Hero]) -> str:  # a helper: no doc comment, so not a tool
        return f"sunny in {cities[0]}"


class Helper(Agent):
    prompt = "Be brief."

    def __init__(self, tools: WeatherTools) -> None:
        self.tools_ = tools


async def test_agent_and_graph_with_a_fake_model() -> None:
    app = create_app(Config())
    async with client(app, Config(), memory_database(), FakeModel(["hello there"])):
        assert [t.name for t in WeatherTools().tools()] == ["weather"]
        assert await inject(Helper).ask("hi") == "hello there"

    class State(TypedDict):
        messages: Messages
        steps: int

    class Flow(Graph[State]):
        state = State

        @start
        @next("second")
        def first(self, s: State) -> dict[str, int]:
            return {"steps": s["steps"] + 1}

        @next("end")
        def second(self, s: State) -> dict[str, int]:
            return {"steps": s["steps"] * 10}

    out = await Flow().run({"messages": [], "steps": 1})
    assert out["steps"] == 20
    assert text_of(Ok("x").value) == "x"


def test_a_model_has_nuclears_names_on_the_wire() -> None:
    """ADR-synapsis-0012: the JSON of a model is the same in every dialect (synapsis-nest writes the fields as they are)."""
    from synapsis import Model

    class Read(Model):
        last_read: int = 0
        cost_usd: float | None = None

    r = Read(last_read=3)
    assert r.model_dump() == {"lastRead": 3, "costUsd": None}
    assert Read.model_validate({"lastRead": 4}).last_read == 4 and Read.model_validate({"last_read": 5}).last_read == 5
