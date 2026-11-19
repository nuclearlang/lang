"""Guards and the app's WebSocket (ADR-synapsis-0007, ADR-synapsis-0008): the same test as synapsis-nest's
sockets.test.ts. The app's guards check every route and the upgrade; a controller's guards check its routes over
both transports; a request over the socket answers what HTTP answers; a published event reaches the subscribed."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from synapsis import AppConfig, NoOrigin, Token, controller, create_app, get, post
from synapsis.events import publish
from synapsis.sockets import WebSocketServer

TOKEN = {"X-Token": "s3cret"}


class Config(AppConfig):
    connections = [WebSocketServer(path="ws")]
    guards = [NoOrigin(), Token(value="s3cret", header="X-Token")]


@controller("notes")
class NoteController:
    @get("{id}")
    async def one(self, id: int) -> dict[str, object]:
        return {"id": id}

    @post("")
    async def add(self, text: str) -> dict[str, object]:
        await publish("notes.added", {"text": text})
        return {"text": text}


@controller("admin", guards=[Token(value="root", header="Authorization")])
class AdminController:
    @get("")
    async def info(self) -> dict[str, object]:
        return {"ok": True}


def app() -> TestClient:
    return TestClient(create_app(Config(), controllers=[NoteController, AdminController]))


def test_the_app_guards_check_every_route() -> None:
    with app() as c:
        assert c.get("/notes/1").status_code == 401
        assert c.get("/notes/1", headers={**TOKEN, "Origin": "https://evil.example"}).status_code == 403
        assert c.get("/notes/1", headers=TOKEN).json() == {"id": 1}
        assert c.get("/notes/1?token=s3cret").status_code == 401  # never a token in the query
        assert c.get("/docs").status_code == 404


def test_a_controller_guard_adds_to_the_app_guards() -> None:
    with app() as c:
        assert c.get("/admin", headers=TOKEN).status_code == 401
        assert c.get("/admin", headers={**TOKEN, "Authorization": "Bearer root"}).json() == {"ok": True}


def test_an_empty_token_refuses_every_request() -> None:
    assert Token(value="").check({"Authorization": "Bearer "}) is not None


def test_the_upgrade_passes_the_app_guards() -> None:
    with app() as c:
        for headers in ({}, {**TOKEN, "Origin": "https://evil.example"}):
            with pytest.raises(WebSocketDisconnect):
                with c.websocket_connect("/ws", headers=headers) as ws:
                    ws.receive_text()


def test_requests_and_events_over_the_socket() -> None:
    with app() as c, c.websocket_connect("/ws", headers=TOKEN) as ws:
        ws.send_json({"subscribe": "notes.added"})
        ws.send_json({"id": 1, "method": "GET", "path": "/notes/7"})
        assert ws.receive_json() == {"id": 1, "status": 200, "body": {"id": 7}}
        ws.send_json({"id": 2, "method": "GET", "path": "/admin"})
        assert ws.receive_json()["status"] == 401
        ws.send_json({"id": 3, "method": "GET", "path": "/admin", "headers": {"Authorization": "Bearer root"}})
        assert ws.receive_json() == {"id": 3, "status": 200, "body": {"ok": True}}
        ws.send_json({"id": 4, "method": "POST", "path": "/notes?text=hi"})
        frames = [ws.receive_json(), ws.receive_json()]
        assert {"event": "notes.added", "data": {"text": "hi"}} in frames
        assert {"id": 4, "status": 201, "body": {"text": "hi"}} in frames


# ---------- the test words (ADR-synapsis-0010): the same as synapsis-nest's sockets.test.ts ----------


def create():  # what app/main.py's create() is for a project: app_client() builds the app with it
    return create_app(Config(), controllers=[NoteController, AdminController])


async def test_app_client_over_http_and_the_socket() -> None:
    from synapsis.testing import app_client, running

    async with running(Config(), app=__name__):
        app = app_client()
        assert (await app.get("/notes/1")).status == 401
        assert (await app.get("/notes/1", headers={**TOKEN, "Origin": "https://evil.example"})).status == 403
        answer = await app.get("/notes/1", headers=TOKEN)
        assert (answer.status, answer.body) == (200, {"id": 1})
        refused = await app.socket("/ws")
        assert refused.is_err and refused.error.status == 401
        assert (await app.socket("/ws", headers={**TOKEN, "Origin": "https://evil.example"})).error.status == 403
        ws = (await app.socket("/ws", headers=TOKEN)).value
        await ws.subscribe("notes.added")
        made = await ws.request("POST", "/notes?text=hi")
        assert made.status == 201
        event = await ws.next()
        assert event is not None and (event.topic, event.data) == ("notes.added", {"text": "hi"})
        assert await ws.next(0.1) is None
        await ws.close()
