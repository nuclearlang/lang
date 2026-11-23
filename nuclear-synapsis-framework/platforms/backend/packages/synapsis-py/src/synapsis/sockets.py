"""The app's WebSocket (ADR-synapsis-0008): `WebSocketServer(path = "ws")` in the configuration serves the same
controllers over one socket, and sends the events the app publishes to the clients subscribed to them.

The frames are JSON text, the same in every dialect:
  client → app   {"id": 1, "method": "GET", "path": "/tasks/1", "headers": {...}, "body": ...}
                 {"subscribe": "tasks.created"}   {"unsubscribe": "tasks.created"}
  app → client   {"id": 1, "status": 200, "body": ...}
                 {"event": "tasks.created", "data": ...}
The upgrade passes the app's guards; each request then goes through the app as an HTTP request with the upgrade's
headers and its own, so a controller's guards, validation and answers are the HTTP ones."""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any, cast

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from .config import Connection
from .edge import log_request
from .errors import error_body
from .events import sinks
from .guards import Guard, refusal
from .wire import LIMITS, Unreadable, read_json

__all__ = ["WebSocketServer"]

# the headers of the upgrade that are the socket's, not a request's
_HOP = {"host", "connection", "upgrade", "content-length", "content-type", "transfer-encoding", "keep-alive", "te", "trailer"}


def _parse(text: str) -> Any:
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


class _Client:
    def __init__(self, socket: WebSocket) -> None:
        self.socket = socket
        self.topics: set[str] = set()
        self.lock = asyncio.Lock()

    async def send(self, frame: dict[str, Any]) -> None:
        async with self.lock:
            await self.socket.send_text(json.dumps(frame, default=str))


_clients: list[_Client] = []


async def _fanout(topic: str, raw: bytes) -> None:
    data = json.loads(raw)
    for c in [c for c in _clients if topic in c.topics]:
        try:
            await c.send({"event": topic, "data": data})
        except Exception:  # a client that left between the check and the send
            pass


sinks.append(_fanout)


class WebSocketServer(Connection):
    """The app also answers over a WebSocket at `path` (`"ws"` → `/ws`)."""

    def __init__(self, path: str = "ws", name: str = "default") -> None:
        self.path = "/" + path.strip("/")
        self.name = name

    def instrument(self, app: Any) -> None:
        app = cast(FastAPI, app)
        guards: list[Guard] = list(getattr(app.state.synapsis_config, "guards", []))

        async def endpoint(socket: WebSocket) -> None:
            await _serve(socket, app, guards)

        async def elsewhere(socket: WebSocket) -> None:
            # an upgrade on a path that is not the socket's: 404, as a request for a route that does not exist
            started = time.perf_counter()
            await _deny(socket, 404, "not found")
            log_request("GET", _path(socket), 404, started)

        app.add_api_websocket_route(self.path, endpoint)
        app.add_api_websocket_route("/{rest:path}", elsewhere)


def _path(socket: WebSocket) -> str:
    raw = cast(bytes, socket.scope.get("raw_path") or str(socket.scope["path"]).encode())
    return raw.split(b"?", 1)[0].decode("latin-1")


async def _deny(socket: WebSocket, status: int, message: str) -> None:
    """Refuses the upgrade with `status` and the error's body, as an HTTP answer; a server that cannot answer an
    upgrade with a body closes it with the code 4000 + status."""
    if "websocket.http.response" in socket.scope.get("extensions", {}):
        await socket.send_denial_response(JSONResponse(status_code=status, content=error_body(status, message)))
    else:
        await socket.close(code=4000 + status, reason=message)


# the methods a request frame may have; another is answered 405 without reaching the app
_METHODS = {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"}


def _request(frame: Any) -> bool:
    """A frame is a JSON object whose `method` and `path` are texts and whose `headers` is an object of texts."""
    if not isinstance(frame, dict):
        return False
    f = cast(dict[str, Any], frame)
    headers = f.get("headers", {})
    return (
        isinstance(f.get("method", "GET"), str)
        and isinstance(f.get("path", "/"), str)
        and (headers is None or (isinstance(headers, dict) and all(isinstance(v, str) for v in cast(dict[str, Any], headers).values())))
    )


async def _serve(socket: WebSocket, app: FastAPI, guards: list[Guard]) -> None:
    started = time.perf_counter()
    refused = refusal(guards, socket.headers)
    if refused is not None:
        await _deny(socket, refused.status, refused.message)
        log_request("GET", _path(socket), refused.status, started)
        return
    await socket.accept()
    log_request("GET", _path(socket), 101, started)
    import httpx

    base = [(k, v) for k, v in socket.headers.items() if k.lower() not in _HOP and not k.lower().startswith("sec-websocket")]
    client = _Client(socket)
    _clients.append(client)
    pending: set[asyncio.Task[None]] = set()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://app") as http:

        async def answer(frame: dict[str, Any]) -> None:
            id = frame.get("id")
            method = str(frame.get("method", "GET")).upper()
            path = str(frame.get("path", "/"))
            try:
                if method not in _METHODS:
                    reply: dict[str, Any] = {"id": id, "status": 405, "body": error_body(405, "method not allowed")}
                elif not path.startswith("/") or path.startswith("//"):
                    # only a path of the app itself: never another host, port or scheme
                    reply = {"id": id, "status": 404, "body": error_body(404, "not found")}
                else:
                    # a frame's own headers replace the upgrade's of the same name (the socket's own are never sent)
                    own = {str(k).lower(): str(v) for k, v in cast(dict[str, Any], frame.get("headers") or {}).items() if str(k).lower() not in _HOP}
                    headers = [(k, v) for k, v in base if k.lower() not in own] + list(own.items())
                    r = await http.request(method, path, headers=headers, json=frame.get("body"))
                    reply = {"id": id, "status": r.status_code, "body": _parse(r.text)}
            except Exception:  # the app failed: the request answers 500 (the Edge logged its cause)
                reply = {"id": id, "status": 500, "body": error_body(500, "error")}
            try:
                await client.send(reply)
            except Exception:  # the socket closed meanwhile
                pass

        try:
            while True:
                message = await socket.receive()
                if message["type"] == "websocket.disconnect":
                    break
                text = message.get("text")
                if text is None:
                    await socket.close(code=1003)  # a binary frame: the frames are JSON text
                    break
                if len(text.encode()) > LIMITS.body:
                    await socket.close(code=1009)  # larger than the app reads (maxBodySize)
                    break
                try:
                    frame = read_json(text)
                except Unreadable:
                    frame = None
                if not _request(frame):
                    await socket.close(code=1003)  # not JSON, or not an object the protocol knows
                    break
                frame = cast(dict[str, Any], frame)
                if "subscribe" in frame:
                    client.topics.add(str(frame["subscribe"]))
                elif "unsubscribe" in frame:
                    client.topics.discard(str(frame["unsubscribe"]))
                elif "id" in frame:
                    task = asyncio.create_task(answer(frame))
                    pending.add(task)
                    task.add_done_callback(pending.discard)
        except WebSocketDisconnect:
            pass
        finally:
            _clients.remove(client)
            for t in pending:
                t.cancel()
