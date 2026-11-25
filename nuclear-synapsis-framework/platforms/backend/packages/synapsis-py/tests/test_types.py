"""A value's JSON type is its field's: nothing converts (the platform's reference, §2.3), and a model built in code
is checked as a body is. The same cases, with the same expected bodies, are in synapsis-nest/test/types.test.ts."""

from __future__ import annotations

import datetime
from typing import Annotated

import httpx
import pytest
from annotated_types import MinLen
from pydantic import ValidationError

from synapsis import AppConfig, Database, Model, Page, controller, create_app, get, post
from synapsis.testing import client, memory_database


class Typed(Model):
    count: int = 1
    price: float = 1.0
    on: bool = False
    name: Annotated[str, MinLen(2)] = "name"
    at: datetime.datetime | None = None
    tags: list[str] = []
    sizes: list[int] = []


class Box(Model):
    note: str | None = None
    inner: Typed | None = None
    items: list[Typed] = []


@controller("/typed")
class TypedController:
    @post("")
    async def create(self, typed: Typed) -> Typed:
        return typed

    @get("/built")
    async def built(self, name: str, count: int = 1) -> Typed:
        # a model built in code: its rules are checked here, and nothing handles what it raises
        return Typed(name=name, count=count)

    @get("/box")
    async def box(self) -> Box:
        return Box(items=[Typed()])

    @get("/page")
    async def page(self) -> Page[Typed]:
        return Page(items=[Typed()], page=1, size=20, total=1, pages=1)


class Config(AppConfig):
    connections = [Database("sqlite:///unused.db")]


def refused(field: str, type_: str) -> dict[str, object]:
    return {"status": 400, "message": "invalid", "errors": [{"field": field, "rule": "type", "message": f"{field} must be {type_}"}]}


# (what is sent, the body of the refusal): the same list as types.test.ts
REFUSED = [
    ({"count": "3"}, refused("count", "a whole number")),
    ({"count": True}, refused("count", "a whole number")),
    ({"count": 3.5}, refused("count", "a whole number")),
    ({"count": [3]}, refused("count", "a whole number")),
    ({"price": "1.5"}, refused("price", "a number")),
    ({"price": True}, refused("price", "a number")),
    ({"on": "true"}, refused("on", "true or false")),
    ({"on": 1}, refused("on", "true or false")),
    ({"name": 5}, refused("name", "a text")),
    ({"name": True}, refused("name", "a text")),
    ({"at": 5}, refused("at", "a date and time")),
    ({"at": "soon"}, refused("at", "a date and time")),
    ({"tags": "a"}, refused("tags", "a list")),
    ({"tags": ["a", 7]}, refused("tags.1", "a text")),
    ({"sizes": [1, "2", 3.5]}, {"status": 400, "message": "invalid", "errors": [
        {"field": "sizes.1", "rule": "type", "message": "sizes.1 must be a whole number"},
        {"field": "sizes.2", "rule": "type", "message": "sizes.2 must be a whole number"},
    ]}),
    ({"sizes": [1, None]}, {"status": 400, "message": "invalid", "errors": [{"field": "sizes.1", "rule": "required", "message": "sizes.1 is required"}]}),
]


async def test_a_value_of_another_json_type_is_refused() -> None:
    app = create_app(Config(), controllers=[TypedController])
    async with client(app, Config(), memory_database()) as http:
        for sent, body in REFUSED:
            r = await http.post("/typed", json=sent)
            assert (r.status_code, r.json()) == (400, body), sent
        # a number without a fraction is a whole number, a whole number is a number, a date is a text
        r = await http.post("/typed", content='{"count": 3.0, "price": 5, "on": true, "at": "2026-03-04T05:06:07.089Z", "sizes": [2.0]}', headers={"content-type": "application/json"})
        assert r.status_code == 201
        answer = r.json()
        assert (answer["count"], answer["price"], answer["on"], answer["at"], answer["sizes"]) == (3, 5, True, "2026-03-04T05:06:07.089Z", [2])
        # a parameter of the query has no JSON type: it converts from its text
        assert (await http.get("/typed/built?name=ok&count=4")).json()["count"] == 4


async def test_a_model_built_in_code_is_checked() -> None:
    with pytest.raises(ValidationError):
        Typed(name="x")
    assert Typed(name="ok").count == 1
    app = create_app(Config(), controllers=[TypedController])
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        r = await http.get("/typed/built?name=x")
        assert (r.status_code, r.json()) == (500, {"status": 500, "message": "error"})
        assert (await http.get("/typed/built?name=ok")).json()["name"] == "ok"


def test_a_field_may_have_the_name_of_a_key_of_the_schema() -> None:
    """A field named `type`, `schema` or `fields` is a field like any other: its number is still checked."""

    class Event(Model):
        type: int
        schema_: Annotated[int, MinLen(0)] | None = None
        fields: list[int] = []

    assert Event(type=3, fields=[1]).type == 3
    with pytest.raises(ValidationError):
        Event(type="3")  # pyright: ignore[reportArgumentType]
    with pytest.raises(ValidationError):
        Event(type=1, fields=["1"])  # pyright: ignore[reportArgumentType]


async def test_an_optional_field_left_empty_is_null_in_the_answer() -> None:
    """The same as types.test.ts: null, never absent, in a model, a body, a model inside one, a list and a page."""
    app = create_app(Config(), controllers=[TypedController])
    async with client(app, Config(), memory_database()) as http:
        typed = {"count": 1, "price": 1.0, "on": False, "name": "name", "at": None, "tags": [], "sizes": []}
        assert (await http.get("/typed/built?name=name")).json() == typed
        assert (await http.post("/typed", json={})).json() == typed
        assert (await http.get("/typed/box")).json() == {"note": None, "inner": None, "items": [typed]}
        assert (await http.get("/typed/page")).json() == {"items": [typed], "page": 1, "size": 20, "total": 1, "pages": 1}
