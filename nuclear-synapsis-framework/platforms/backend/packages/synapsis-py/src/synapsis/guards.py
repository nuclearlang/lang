"""Guards (ADR-synapsis-0007): checks a request passes before its route runs, on every route of the app
(`AppConfig.guards`) or of one controller (`@controller("x", guards=[...])`), over HTTP and over the app's WebSocket.
A guard reads only the request's headers: a token in a query parameter would reach the access log."""

from __future__ import annotations

import hmac
from collections.abc import Mapping, Sequence

from .errors import AppError, Forbidden, Unauthorized

__all__ = ["Guard", "Token", "NoOrigin", "refusal"]


class Guard:
    """A check of a request's headers: None lets it through, an AppError refuses it with its status."""

    def check(self, headers: Mapping[str, str]) -> AppError | None:
        return None


class Token(Guard):
    """The request carries `value` in the header `header`. In `Authorization` it is `Bearer <value>`. An empty `value`
    (an unset environment variable) refuses every request: a guard never opens by mistake."""

    def __init__(self, value: str, header: str = "Authorization") -> None:
        self.value = value
        self.header = header

    def check(self, headers: Mapping[str, str]) -> AppError | None:
        sent = _header(headers, self.header)
        if self.header.lower() == "authorization" and sent.startswith("Bearer "):
            sent = sent[len("Bearer "):]
        if not self.value or not hmac.compare_digest(sent.encode(), self.value.encode()):
            return Unauthorized(f"a valid token in the header '{self.header}' is required")
        return None


class NoOrigin(Guard):
    """Refuses a request with an `Origin` header: what a web page sends, so a local service is not reachable from a
    page the user opened in a browser."""

    def check(self, headers: Mapping[str, str]) -> AppError | None:
        if _header(headers, "Origin"):
            return Forbidden("requests from web pages are refused")
        return None


def refusal(guards: Sequence[Guard], headers: Mapping[str, str]) -> AppError | None:
    """The first guard that refuses the request, in order, or None."""
    for g in guards:
        e = g.check(headers)
        if e is not None:
            return e
    return None


def _header(headers: Mapping[str, str], name: str) -> str:
    want = name.lower()
    return next((v for k, v in headers.items() if k.lower() == want), "")
