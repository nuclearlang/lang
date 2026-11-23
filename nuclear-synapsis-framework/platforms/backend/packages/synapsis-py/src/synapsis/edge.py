"""What every request passes before its route, the same in every dialect (the platform's reference, §2.8):

- one line in the log per request: `<time> <METHOD> <path> <status> <ms>ms`, the path without its query, never a
  value the client sent; a 500 also logs its cause (`<time> ERROR <METHOD> <path> <type>: <message>` and the stack),
  whose message never holds a value of the request (a validation error says its fields and rules, a database error
  its code, never its parameters);
- a body larger than `max_body_size` answers 413; a body that is not JSON in UTF-8 answers 415;
- an encoded `/` or `\\` in the path matches no route (404);
- CORS: a preflight from a listed origin answers 200 with what it may send, from any other origin 403; a listed
  origin's request is answered with `Access-Control-Allow-Origin`.
"""

from __future__ import annotations

import sys
import time
import traceback
from collections.abc import Awaitable, Callable, MutableMapping
from datetime import UTC, datetime
from typing import Any

from .errors import error_body
from .models import wire_date
from .wire import is_json

__all__ = ["Edge", "log_request", "log_cause", "said"]

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]

METHODS = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"


def _now() -> str:
    return wire_date(datetime.now(UTC))


def log_request(method: str, path: str, status: int, started: float) -> None:
    """The line of one request (stdout)."""
    ms = round((time.perf_counter() - started) * 1000)
    sys.stdout.write(f"{_now()} {method} {path} {status} {ms}ms\n")
    sys.stdout.flush()


def said(e: BaseException) -> str:
    """`<type>: <message>` of an error, with no value a client sent."""
    kind = type(e)
    name = kind.__qualname__ if kind.__module__ == "builtins" else f"{kind.__module__}.{kind.__qualname__}"
    from pydantic import ValidationError

    if isinstance(e, ValidationError):
        fields = "; ".join(f"{'.'.join(str(p) for p in err['loc']) or 'the model'}: {err['msg']}" for err in e.errors(include_input=False, include_url=False, include_context=False))
        return f"{name}: {e.error_count()} validation error(s) for {e.title}: {fields}"
    try:
        from sqlalchemy.exc import StatementError
    except ImportError:  # pragma: no cover
        StatementError = ()  # type: ignore[assignment,misc]
    if isinstance(e, StatementError):
        orig = e.orig
        code = getattr(orig, "sqlstate", None) or getattr(orig, "pgcode", None) or getattr(orig, "sqlite_errorname", None)
        if code is None and orig is not None and getattr(orig, "args", None) and isinstance(orig.args[0], int):
            code = orig.args[0]  # MySQL's error number
        cause = type(orig).__name__ if orig is not None else "error"
        return f"{name}: {cause}" + (f" (code {code})" if code else "")
    return f"{name}: {e}"


def log_cause(method: str, path: str, e: BaseException) -> None:
    """The cause of a 500 (stderr): the error and its stack, never the values of the request."""
    stack = "".join(traceback.format_tb(e.__traceback__)).rstrip("\n")
    sys.stderr.write(f"{_now()} ERROR {method} {path} {said(e)}\n{stack}\n")
    sys.stderr.flush()


def _json(status: int, body: Any, headers: list[tuple[bytes, bytes]] | None = None) -> tuple[int, list[tuple[bytes, bytes]], bytes]:
    import json

    data = json.dumps(body).encode()
    return status, [(b"content-type", b"application/json"), (b"content-length", str(len(data)).encode()), *(headers or [])], data


class Edge:
    """The ASGI middleware of every Synapsis app (`create_app` adds it)."""

    def __init__(self, app: Callable[[Scope, Receive, Send], Awaitable[None]], max_body_size: int, origins: list[str]) -> None:
        self.app = app
        self.max = max_body_size
        self.origins = set(origins)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = time.perf_counter()
        method = str(scope["method"])
        raw = scope.get("raw_path") or str(scope["path"]).encode()
        path = raw.split(b"?", 1)[0].decode("latin-1")
        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}
        status = 0
        origin = headers.get("origin")
        allowed = origin is not None and origin in self.origins

        async def sending(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = int(message["status"])
                if allowed:
                    out = list(message.get("headers", []))
                    out.append((b"access-control-allow-origin", origin.encode()))  # type: ignore[union-attr]
                    if not any(k.lower() == b"vary" for k, _ in out):
                        out.append((b"vary", b"Origin"))
                    message["headers"] = out
            await send(message)

        try:
            early, receive = await self._early(method, path, headers, receive)
            if early is not None:
                code, out, data = early
                await sending({"type": "http.response.start", "status": code, "headers": out})
                await sending({"type": "http.response.body", "body": data})
            else:
                await self.app(scope, receive, sending)
        except Exception as e:
            log_cause(method, path, e)
            if status == 0:
                code, out, data = _json(500, error_body(500, "error"))
                await sending({"type": "http.response.start", "status": code, "headers": out})
                await sending({"type": "http.response.body", "body": data})
        finally:
            log_request(method, path, status or 500, started)

    async def _early(self, method: str, path: str, headers: dict[str, str], receive: Receive) -> tuple[tuple[int, list[tuple[bytes, bytes]], bytes] | None, Receive]:
        """The answer given before the app, if any, and the receive the app reads the body with."""
        lower = path.lower()
        if "%2f" in lower or "%5c" in lower:
            return _json(404, error_body(404, "not found")), receive
        if method == "OPTIONS" and "origin" in headers and "access-control-request-method" in headers:
            if headers["origin"] not in self.origins:
                return _json(403, error_body(403, "origin not allowed")), receive
            out = [
                (b"access-control-allow-origin", headers["origin"].encode()),
                (b"access-control-allow-methods", METHODS.encode()),
                (b"access-control-max-age", b"1800"),
                (b"vary", b"Origin, Access-Control-Request-Method, Access-Control-Request-Headers"),
                (b"content-length", b"0"),
            ]
            if asked := headers.get("access-control-request-headers"):
                out.append((b"access-control-allow-headers", asked.encode()))
            # the origin's header is added by `sending`, only once
            return (200, [h for h in out if h[0] != b"access-control-allow-origin"], b""), receive
        length = headers.get("content-length")
        chunked = "transfer-encoding" in headers
        if not chunked and (length is None or length.strip() in ("", "0")):
            return None, receive
        if not is_json(headers.get("content-type", "")):
            return _json(415, error_body(415, "unsupported media type")), receive
        if length is not None and length.strip().isdigit() and int(length) > self.max:
            return _json(413, error_body(413, "content too large")), receive
        if not chunked:
            return None, receive
        # a body of unknown length: read it, up to the limit, before the app sees it
        body = bytearray()
        while True:
            message = await receive()
            body += message.get("body", b"")
            if len(body) > self.max:
                return _json(413, error_body(413, "content too large")), receive
            if not message.get("more_body", False):
                break
        sent = False

        async def replay() -> Message:
            nonlocal sent
            if sent:
                return await receive()
            sent = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}

        return None, replay
