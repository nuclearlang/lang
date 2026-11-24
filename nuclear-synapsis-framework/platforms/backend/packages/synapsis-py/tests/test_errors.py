"""Every error answers Nuclear's body, the same in every dialect (ADR-synapsis-0013). The same cases, with the same
expected bodies, are in synapsis-nest/test/errors.test.ts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated

import pytest
from annotated_types import Ge, Le, MaxLen, MinLen
from pydantic import AfterValidator, Field

from synapsis import AppConfig, AppError, Model, NotFound, Ok, Err, Result, SQLite, controller, create_app, get, post
from synapsis.testing import client, memory_database
from synapsis.validators import is_email, is_given, is_url


class Signup(Model):
    email: Annotated[str, AfterValidator(is_email)]
    name: Annotated[str, MinLen(3), MaxLen(5)]
    age: Annotated[int, Ge(18), Le(99)]
    code: Annotated[str, Field(pattern=r"^[A-Z]+$")]
    site: Annotated[str | None, AfterValidator(is_url)] = None
    note: Annotated[str, AfterValidator(is_given)]


@controller("/signups")
class SignupController:
    @post("")
    async def create(self, signup: Signup) -> Signup:
        return signup

    @get("/{id}")
    async def one(self, id: int, page: int = 1) -> Result[AppError, int]:
        if id > 1:
            return Err(NotFound(f"no signup {id}"))
        return Ok(id * page)

    @get("/boom/now")
    async def boom(self) -> int:
        raise RuntimeError("a secret the answer must not show")


class Config(AppConfig):
    connections = [SQLite("unused.db")]


GOOD = {"email": "a@b.co", "name": "Anna", "age": 30, "code": "ABC", "note": "x"}

# (what is sent, the status, the body): the same list as errors.test.ts
BODIES = [
    ({}, 400, {"status": 400, "message": "invalid", "errors": [
        {"field": "age", "rule": "required", "message": "age is required"},
        {"field": "code", "rule": "required", "message": "code is required"},
        {"field": "email", "rule": "required", "message": "email is required"},
        {"field": "name", "rule": "required", "message": "name is required"},
        {"field": "note", "rule": "required", "message": "note is required"},
    ]}),
    ({**GOOD, "email": "nope", "name": "Al", "age": 7, "code": "abc", "site": "x"}, 400, {"status": 400, "message": "invalid", "errors": [
        {"field": "age", "rule": "min", "message": "age must be at least 18"},
        {"field": "code", "rule": "pattern", "message": "code does not match its pattern"},
        {"field": "email", "rule": "email", "message": "email must be an e-mail address"},
        {"field": "name", "rule": "minLength", "message": "name must have at least 3 characters"},
        {"field": "site", "rule": "url", "message": "site must be a URL"},
    ]}),
    ({**GOOD, "name": "Annabelle", "age": 120}, 400, {"status": 400, "message": "invalid", "errors": [
        {"field": "age", "rule": "max", "message": "age must be at most 99"},
        {"field": "name", "rule": "maxLength", "message": "name must have at most 5 characters"},
    ]}),
    ({**GOOD, "name": 5, "age": "old", "email": None}, 400, {"status": 400, "message": "invalid", "errors": [
        {"field": "age", "rule": "type", "message": "age must be a whole number"},
        {"field": "email", "rule": "required", "message": "email is required"},
        {"field": "name", "rule": "type", "message": "name must be a text"},
    ]}),
    # an empty text under @required is not given: `required`, never `minLength`
    ({**GOOD, "note": ""}, 400, {"status": 400, "message": "invalid", "errors": [
        {"field": "note", "rule": "required", "message": "note is required"},
    ]}),
]


@pytest.fixture
def served(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # the document the transpiler writes next to the app
    (tmp_path / ".nuclear").mkdir()
    (tmp_path / ".nuclear" / "openapi.json").write_text(json.dumps({"openapi": "3.1.0", "info": {"title": "from nuclear"}, "paths": {}}))
    monkeypatch.chdir(tmp_path)


async def test_every_error_has_nuclears_body(served: None) -> None:
    app = create_app(Config(), controllers=[SignupController])
    async with client(app, Config(), memory_database()) as http:
        assert (await http.post("/signups", json=GOOD)).status_code == 201
        for sent, status, body in BODIES:
            r = await http.post("/signups", json=sent)
            assert (r.status_code, r.json()) == (status, body)
        # a body that is not JSON
        r = await http.post("/signups", content="{nope", headers={"content-type": "application/json"})
        assert (r.status_code, r.json()) == (400, {"status": 400, "message": "invalid", "errors": [{"field": "", "rule": "json", "message": "the body is not valid JSON"}]})
        # a parameter of the route and one of the query
        r = await http.get("/signups/abc")
        assert (r.status_code, r.json()) == (400, {"status": 400, "message": "invalid", "errors": [{"field": "id", "rule": "type", "message": "id must be a whole number"}]})
        r = await http.get("/signups/1?page=x")
        assert (r.status_code, r.json()) == (400, {"status": 400, "message": "invalid", "errors": [{"field": "page", "rule": "type", "message": "page must be a whole number"}]})
        assert (await http.get("/signups/1?page=3")).json() == 3
        # the error of a Result, a route that does not exist
        r = await http.get("/signups/9")
        assert (r.status_code, r.json()) == (404, {"status": 404, "message": "no signup 9"})
        r = await http.get("/nowhere")
        assert (r.status_code, r.json()) == (404, {"status": 404, "message": "not found"})


async def test_what_nothing_handled_is_a_500_that_does_not_say_why(served: None) -> None:
    import httpx

    app = create_app(Config(), controllers=[SignupController])
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        r = await http.get("/signups/boom/now")
        assert (r.status_code, r.json()) == (500, {"status": 500, "message": "error"})


async def test_openapi_is_the_document_written_from_the_nuclear(served: None) -> None:
    app = create_app(Config(), controllers=[SignupController])
    async with client(app, Config(), memory_database()) as http:
        assert (await http.get("/openapi.json")).json()["info"]["title"] == "from nuclear"
        assert (await http.get("/.nuclear/openapi.json")).json()["info"]["title"] == "from nuclear"
