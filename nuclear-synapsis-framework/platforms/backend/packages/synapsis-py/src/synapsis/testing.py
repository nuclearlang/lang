"""Helpers for the tests of an app: an in-memory database, fake models, an HTTP client."""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from typing import Any, cast

import asyncio
import json

import httpx
from fastapi import FastAPI

from .errors import AppError
from .result import Err, Ok, Result

from .inject import inject, reset
from .app import start, stop
from .config import AppConfig, ChatModel, Connection, Database, SQLite

__all__ = ["FakeModel", "memory_database", "running", "client", "app_client", "AppClient", "AppSocket", "HttpAnswer", "SocketEvent"]


def _fake_class() -> type:
    from langchain_core.language_models.fake_chat_models import GenericFakeChatModel

    class _Fake(GenericFakeChatModel):
        def bind_tools(self, tools: Any, **kwargs: Any) -> Any:
            # the answers are fixed, but each tool must be describable to a real model (its JSON schema)
            from langchain_core.utils.function_calling import convert_to_openai_tool

            for t in tools:
                convert_to_openai_tool(t)
            return self

    return _Fake


class FakeModel(ChatModel):
    """A chat model that answers `answers` in order (no network), for tests of agents and graphs."""

    def __init__(self, answers: list[str], name: str = "default") -> None:
        super().__init__(model="fake", name=name)
        self.answers = answers

    async def open(self) -> None:
        from langchain_core.messages import AIMessage

        self.client = _fake_class()(messages=iter([AIMessage(content=a) for a in self.answers]))


def memory_database() -> SQLite:
    """A fresh SQLite database in memory, with the tables of every entity."""
    return SQLite(":memory:", create_tables=True)


def _family(c: Connection) -> type:
    """The class right under Connection: Database for Postgres, ChatModel for OpenAI."""
    mro = type(c).__mro__
    return mro[mro.index(Connection) - 1]


def _swap(config: AppConfig, replace: tuple[Connection, ...]) -> AppConfig:
    """`config` with each database in memory and the connections of `replace` instead of those of their type and name."""
    out: list[Connection] = []
    for c in config.connections:
        same = next((r for r in replace if isinstance(r, _family(c)) and r.name == c.name), None)
        if same is None and isinstance(c, Database):
            same = SQLite(":memory:", name=c.name, create_tables=True)
        out.append(same or c)
    out += [r for r in replace if r not in out]
    swapped = AppConfig()
    swapped.connections = out
    return swapped


_app_module = "app.main"


@asynccontextmanager
async def running(
    config: AppConfig,
    *replace: Connection,
    listeners: Sequence[type] = (),
    entities: Sequence[type] = (),
    app: str = "app.main",
) -> AsyncIterator[None]:
    """The app's connections open for a test: databases in memory, `replace` (FakeModel([...])) swapped in, and the
    `listeners` of the project created, so a published event reaches them. `entities`: the project's tables, listed so
    every one is imported before the relations between them are resolved. `app`: the module whose `create()` builds
    the web app, for `app_client()`."""
    del entities
    global _app_module
    _app_module = app
    reset()
    await start(_swap(config, replace))
    for l in listeners:
        inject(cast(type[Any], l))
    try:
        yield
    finally:
        await stop()


@asynccontextmanager
async def client(app: FastAPI, config: AppConfig, *replace: Connection) -> AsyncIterator[httpx.AsyncClient]:
    """An HTTP client of `app` with the connections of `config` (as in `running`)."""
    async with running(config, *replace):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
            yield c


# ---------- the app over HTTP and its WebSocket, from a test (ADR-synapsis-0010) ----------


class HttpAnswer:
    """What the app answered: its `status` and its `body` (JSON, or the text)."""

    def __init__(self, status: int, body: Any) -> None:
        self.status = status
        self.body = body


class SocketEvent:
    """An event the app pushed: its `topic` and its `data`."""

    def __init__(self, topic: str, data: Any) -> None:
        self.topic = topic
        self.data = data


def _parse(text: str) -> Any:
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


class AppSocket:
    """A client of the app's WebSocket inside the test's event loop: requests answered as over HTTP, subscriptions,
    and the events pushed to it."""

    def __init__(self, app: FastAPI, path: str, headers: dict[str, str]) -> None:
        self._app = app
        self._path = path
        self._headers = headers
        self._in: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._out: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._events: list[SocketEvent] = []
        self._answers: dict[int, HttpAnswer] = {}
        self._next = 0
        self._task: asyncio.Task[None] | None = None

    async def _open(self) -> AppError | None:
        scope: dict[str, Any] = {
            "type": "websocket", "path": self._path, "raw_path": self._path.encode(), "query_string": b"",
            "headers": [(k.lower().encode(), v.encode()) for k, v in self._headers.items()],
            "scheme": "ws", "server": ("test", 80), "client": ("127.0.0.1", 0), "subprotocols": [],
            "asgi": {"version": "3.0"}, "root_path": "", "app": self._app, "extensions": {"websocket.http.response": {}},
        }
        await self._in.put({"type": "websocket.connect"})

        async def receive() -> dict[str, Any]:
            return await self._in.get()

        async def send(message: dict[str, Any]) -> None:
            await self._out.put(message)

        self._task = asyncio.create_task(self._app(scope, receive, send))  # type: ignore[arg-type]
        first = await asyncio.wait_for(self._out.get(), 5)
        if first["type"] == "websocket.accept":
            return None
        if first["type"] == "websocket.http.response.start":
            # the upgrade refused with an HTTP answer: its status and the error's message
            body = await asyncio.wait_for(self._out.get(), 5)
            said = _parse(bytes(body.get("body", b"")).decode())
            message = said.get("message") if isinstance(said, dict) else None
            return AppError(str(message or "the socket was refused"), int(first["status"]))
        code = int(first.get("code", 1008))
        return AppError(str(first.get("reason") or "the socket was refused"), code - 4000 if code >= 4000 else 403)

    async def _read(self, seconds: float) -> bool:
        """One frame from the app into the answers or the events; False when none came in `seconds`."""
        try:
            message = await asyncio.wait_for(self._out.get(), seconds)
        except TimeoutError:
            return False
        if message["type"] != "websocket.send":
            raise AppError("the socket was closed by the app", 500)
        frame = cast(dict[str, Any], json.loads(message.get("text") or "null"))
        if "event" in frame:
            self._events.append(SocketEvent(str(frame["event"]), frame.get("data")))
        else:
            self._answers[int(frame["id"])] = HttpAnswer(int(frame["status"]), frame.get("body"))
        return True

    async def _send(self, frame: dict[str, Any]) -> None:
        await self._in.put({"type": "websocket.receive", "text": json.dumps(frame)})

    async def request(self, method: str, path: str, body: Any = None, headers: dict[str, str] | None = None) -> HttpAnswer:
        """A request frame and its answer (the events that arrive meanwhile are kept for `next`)."""
        self._next += 1
        id = self._next
        frame: dict[str, Any] = {"id": id, "method": method.upper(), "path": path, "headers": headers or {}}
        if body is not None:
            frame["body"] = _jsonable(body)
        await self._send(frame)
        while id not in self._answers:
            if not await self._read(5):
                raise AppError(f"{method} {path}: no answer over the socket", 504)
        return self._answers.pop(id)

    async def subscribe(self, topic: str) -> None:
        await self._send({"subscribe": topic})

    async def unsubscribe(self, topic: str) -> None:
        await self._send({"unsubscribe": topic})

    async def next(self, seconds: float = 2) -> SocketEvent | None:
        """The next event pushed to this socket, or None when none comes in `seconds`."""
        if not self._events and not await self._read(seconds):
            return None
        while not self._events:
            if not await self._read(seconds):
                return None
        return self._events.pop(0)

    async def close(self) -> None:
        await self._in.put({"type": "websocket.disconnect", "code": 1000})
        if self._task is not None:
            await asyncio.wait_for(self._task, 5)


def _jsonable(value: Any) -> Any:
    from pydantic import BaseModel

    return value.model_dump(mode="json") if isinstance(value, BaseModel) else value


class AppClient:
    """The app of the test over HTTP and over its WebSocket, with the test's connections (`app_client()`)."""

    def __init__(self) -> None:
        self._app: FastAPI | None = None

    def app(self) -> FastAPI:
        if self._app is None:
            import importlib

            self._app = cast(FastAPI, importlib.import_module(_app_module).create())
        return self._app

    async def request(self, method: str, path: str, body: Any = None, headers: dict[str, str] | None = None) -> HttpAnswer:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app()), base_url="http://test") as c:
            r = await c.request(method.upper(), path, headers=headers or {}, json=_jsonable(body) if body is not None else None)
            return HttpAnswer(r.status_code, _parse(r.text))

    async def get(self, path: str, headers: dict[str, str] | None = None) -> HttpAnswer:
        return await self.request("GET", path, None, headers)

    async def post(self, path: str, body: Any = None, headers: dict[str, str] | None = None) -> HttpAnswer:
        return await self.request("POST", path, body, headers)

    async def put(self, path: str, body: Any = None, headers: dict[str, str] | None = None) -> HttpAnswer:
        return await self.request("PUT", path, body, headers)

    async def patch(self, path: str, body: Any = None, headers: dict[str, str] | None = None) -> HttpAnswer:
        return await self.request("PATCH", path, body, headers)

    async def delete(self, path: str, headers: dict[str, str] | None = None) -> HttpAnswer:
        return await self.request("DELETE", path, None, headers)

    async def socket(self, path: str = "/ws", headers: dict[str, str] | None = None) -> Result[AppError, AppSocket]:
        """The app's WebSocket opened with `headers`; `Err` with the status (401, 403) when its guards refuse it."""
        s = AppSocket(self.app(), path, headers or {})
        refused = await s._open()  # pyright: ignore[reportPrivateUsage]
        return Err(refused) if refused is not None else Ok(s)


def app_client() -> AppClient:
    """The test's app over HTTP and its WebSocket: built from the project's `create()` with the test's connections."""
    return AppClient()
