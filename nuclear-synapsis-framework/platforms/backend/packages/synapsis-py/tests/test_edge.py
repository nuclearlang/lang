"""What every request passes before its route (the platform's reference, §2.7 and §2.8): the same test as
synapsis-nest's edge.test.ts. The body's limit and type, how JSON and the parameters are read, the methods and paths
a route answers, CORS, the headers of an answer, and the WebSocket's frames and paths."""

from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient
from starlette.testclient import WebSocketDenialResponse
from starlette.websockets import WebSocketDisconnect

from synapsis import AppConfig, Model, Token, controller, create_app, get, post
from synapsis.sockets import WebSocketServer


class Config(AppConfig):
    connections = [WebSocketServer(path="ws")]
    origins = ["http://localhost:5173"]
    max_body_size = 2048


class Note(Model):
    text: str
    stars: int | None = None


@controller("notes")
class NoteController:
    @get("")
    async def list(self, page: int = 1, desc: bool = False) -> str:
        return f"{page}:{str(desc).lower()}"

    @get("find")
    async def find(self, text: str, min: float | None = None) -> str:
        return f"{text}:{'-' if min is None else min}"

    @get("{id}")
    async def one(self, id: int) -> dict[str, int]:
        return {"id": id}

    @post("")
    async def add(self, note: Note) -> Note:
        return note


def app() -> TestClient:
    return TestClient(create_app(Config(), controllers=[NoteController]))


def rule(body: Any) -> str:
    return " ".join(f"{e['field']}:{e['rule']}" for e in body["errors"])


def test_a_body_is_json_in_utf8_as_large_as_the_app_reads() -> None:
    with app() as c:
        post_ = lambda body, kind="application/json": c.post("/notes", content=body, headers={"content-type": kind})  # noqa: E731
        assert post_('{"text":"a"}').status_code == 201
        assert post_('{"text":"a"}', "application/vnd.api+json").status_code == 201
        big = post_(json.dumps({"text": "x" * 3000}))
        assert (big.status_code, big.json()) == (413, {"status": 413, "message": "content too large"})
        for kind in ("application/x-www-form-urlencoded", "text/plain", "application/json; charset=utf-16"):
            assert post_('{"text":"a"}', kind).json() == {"status": 415, "message": "unsupported media type"}
        assert rule(post_('{"text":NaN}').json()) == ":json"
        assert rule(post_("[" * 600 + "]" * 600).json()) == ":json"
        assert rule(post_('{"text":"a\\u0000b"}').json()) == "text:invalid"
        assert rule(post_("null").json()) == ":required"
        assert rule(post_("[1]").json()) == ":type"
        assert rule(post_('{"text":"a","stars":' + "9" * 30 + "}").json()) == "stars:type"
        assert post_('{"text":"a","stars":9007199254740991}').status_code == 201


def test_a_parameter_is_read_by_the_platform_rules() -> None:
    with app() as c:
        assert c.get("/notes").json() == "1:false"  # the defaults
        for path, why in (("/notes/0x1", "id:type"), ("/notes/1e0", "id:type"), ("/notes?desc=maybe", "desc:type"), ("/notes?desc=1", "desc:type"),
                          ("/notes/find", "text:required"), ("/notes/find?text=a&text=b", "text:type"), ("/notes/find?text=a&min=NaN", "min:type"),
                          ("/notes/find?text=a&min=1e400", "min:type"), (f"/notes/{'9' * 20}", "id:type"), ("/notes?page=x&desc=y", "desc:type page:type")):
            assert rule(c.get(path).json()) == why, path
        assert c.get("/notes/%201").json() == {"id": 1}
        assert c.get("/notes?desc=true&page=2").json() == "2:true"


def test_a_path_is_matched_as_written_and_another_method_is_405() -> None:
    with app() as c:
        assert c.get("/NOTES").status_code == 404
        assert c.get("/notes/").status_code == 404
        assert c.get("/%6Eotes").status_code == 200
        assert c.get("/notes/1%2F2").status_code == 404
        wrong = c.delete("/notes")
        assert (wrong.status_code, wrong.headers["allow"], wrong.json()) == (405, "GET, HEAD, POST, OPTIONS", {"status": 405, "message": "method not allowed"})
        options = c.options("/notes/1")
        assert (options.status_code, options.headers["allow"]) == (200, "GET, HEAD, OPTIONS")
        assert c.head("/notes/1").status_code == 200


def test_cors_only_the_listed_origins_and_answers_do_not_name_the_server() -> None:
    with app() as c:
        preflight = lambda origin: c.options("/notes", headers={"origin": origin, "access-control-request-method": "POST"})  # noqa: E731
        ok = preflight("http://localhost:5173")
        assert (ok.status_code, ok.headers.get("access-control-allow-origin")) == (200, "http://localhost:5173")
        evil = preflight("https://evil.example")
        assert (evil.status_code, evil.headers.get("access-control-allow-origin")) == (403, None)
        r = c.get("/notes", headers={"origin": "http://localhost:5173"})
        assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"
        for h in ("x-powered-by", "server", "etag"):
            assert h not in r.headers, h
        assert c.get("/docs").status_code == 404
        assert c.get("/redoc").status_code == 404
        # out of development, an address of this machine is one more origin: only the listed ones
        assert preflight("http://127.0.0.1:49152").status_code == 403


def test_cors_in_development_lets_this_machine_and_the_registry_call(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NUCLEAR_ENV", "development")
    monkeypatch.setenv("NUCLEAR_DEV_ORIGINS", "http://192.168.1.20:8080,http://127.0.0.1:8001")
    with app() as c:
        preflight = lambda origin: c.options("/notes", headers={"origin": origin, "access-control-request-method": "GET"})  # noqa: E731
        for origin in ("http://localhost:5173", "http://127.0.0.1:49152", "http://localhost:8081", "http://[::1]:3000", "http://localhost", "https://127.0.0.1:8443", "http://192.168.1.20:8080"):
            r = preflight(origin)
            assert (r.status_code, r.headers.get("access-control-allow-origin")) == (200, origin), origin
            assert c.get("/notes", headers={"origin": origin}).headers.get("access-control-allow-origin") == origin
        for origin in ("https://evil.example", "http://localhost.evil.example", "http://127.0.0.1.evil.example:80", "http://127.0.0.1:80/x", "null", "http://192.168.1.21:8080"):
            assert preflight(origin).status_code == 403, origin
            assert "access-control-allow-origin" not in c.get("/notes", headers={"origin": origin}).headers, origin
        # never credentials, in any environment
        assert "access-control-allow-credentials" not in preflight("http://127.0.0.1:49152").headers


def frames(c: TestClient, sent: list[str | bytes], path: str = "/ws") -> str:
    got: list[str] = []
    try:
        with c.websocket_connect(path) as ws:
            for s in sent:
                ws.send_bytes(s) if isinstance(s, bytes) else ws.send_text(s)
            while True:
                got.append(str(json.loads(ws.receive_text())["status"]))
                if len(got) == len(sent):
                    return " ".join(got)
    except WebSocketDenialResponse as e:
        return f"refused {e.status_code}"
    except WebSocketDisconnect as e:
        return " ".join([*got, f"closed {e.code}"])


@pytest.mark.parametrize("frame", ["null", "5", "[1]", '"x"', '{"id":1,"headers":"x"}', '{"id":1,"path":5}', "[" * 600 + "]" * 600, b"\x00\x01"])
def test_a_frame_that_is_not_a_request_closes_the_socket(frame: str | bytes) -> None:
    with app() as c:
        assert frames(c, [frame]) == "closed 1003"


def test_the_socket_answers_only_paths_of_the_app_within_its_limit() -> None:
    with app() as c:
        assert frames(c, ['{"id":1,"path":"' + "x" * 3000 + '"}']) == "closed 1009"
        assert frames(c, ['{"id":1,"path":"7/x"}', '{"id":2,"path":"//evil.example/x"}', '{"id":3,"method":"NOPE","path":"/notes"}']) == "404 404 405"
        assert frames(c, ['{"id":1,"path":"/notes/1","headers":{"Transfer-Encoding":"chunked","Host":"evil.example"}}']) == "200"
        assert frames(c, [], "/elsewhere") == "refused 404"


def test_a_guard_reads_a_header_once_without_its_blanks() -> None:
    from starlette.datastructures import Headers

    guard = Token(value="s3cret", header="X-Token")
    assert guard.check({"x-token": "  s3cret  "}) is None
    assert guard.check(Headers(raw=[(b"x-token", b"s3cret"), (b"x-token", b"other")])) is not None
