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
from typing import Any, cast

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .config import Connection
from .events import sinks
from .guards import Guard, refusal

__all__ = ["WebSocketServer"]

# the headers of the upgrade that are the socket's, not a request's
_HOP = {"host", "connection", "upgrade", "content-length", "content-type"}


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

        app.add_api_websocket_route(self.path, endpoint)


async def _serve(socket: WebSocket, app: FastAPI, guards: list[Guard]) -> None:
    refused = refusal(guards, socket.headers)
    if refused is not None:
        # before accept: a server answers the upgrade 403; the code says the guard's status (4401, 4403)
        await socket.close(code=4000 + refused.status, reason=refused.message)
        return
    await socket.accept()
    import httpx

    base = {k: v for k, v in socket.headers.items() if k.lower() not in _HOP and not k.lower().startswith("sec-websocket")}
    client = _Client(socket)
    _clients.append(client)
    pending: set[asyncio.Task[None]] = set()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://app") as http:

        async def answer(frame: dict[str, Any]) -> None:
            headers = {**base, **{str(k): str(v) for k, v in cast(dict[str, Any], frame.get("headers") or {}).items()}}
            body = frame.get("body")
            try:
                r = await http.request(str(frame.get("method", "GET")), str(frame.get("path", "/")), headers=headers, json=body)
                out: Any = _parse(r.text)
                await client.send({"id": frame.get("id"), "status": r.status_code, "body": out})
            except Exception as e:  # the socket closed, or the app failed: the request answers 500
                try:
                    await client.send({"id": frame.get("id"), "status": 500, "body": {"detail": str(e)}})
                except Exception:
                    pass

        try:
            while True:
                frame = cast(dict[str, Any], json.loads(await socket.receive_text()))
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
        except json.JSONDecodeError:
            await socket.close(code=1003)  # a frame that is not JSON
        finally:
            _clients.remove(client)
            for t in pending:
                t.cancel()
