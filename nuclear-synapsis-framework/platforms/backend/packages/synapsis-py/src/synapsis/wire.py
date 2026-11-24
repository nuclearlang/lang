"""What a request carries, read the same way in every dialect (the platform's reference, §2.3 and §2.7): a JSON body
or frame, and the parameters of the path and the query.

- JSON is UTF-8 text (RFC 8259); `NaN` and `Infinity` are not JSON; a whole number too long to be a number is not
  finite (refused as its field's type); a value nested deeper than `MAX_DEPTH` levels is not read; a text never holds
  the character U+0000 (PostgreSQL cannot keep it: every database refuses it the same way).
- A parameter is a text converted to its type: an `int` is `[+-]digits` within 64 bits, a `double` a finite decimal
  number, a `boolean` exactly `true` or `false`, a `bigint` and a `bigdouble` the texts of the language (synapsis.exact); blanks around it are ignored, and an empty one is not given.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from typing import Any

from .errors import reason
from .exact import JsonInt, parse_bigdouble, parse_bigint
from .models import INT_MAX, INT_MIN

__all__ = ["LIMITS", "MAX_BODY_SIZE", "MAX_PAGE_SIZE", "MAX_DEPTH", "INT_MIN", "INT_MAX", "Unreadable", "read_json", "is_json", "parse_param"]

# the platform's defaults (the reference, §2.8): 1 MB for a body or a frame, 100 rows for a page; an app's
# configuration changes them (`maxBodySize`, `maxPageSize`)
MAX_BODY_SIZE = 1024 * 1024
MAX_PAGE_SIZE = 100
MAX_DEPTH = 512


@dataclass
class Limits:
    body: int = MAX_BODY_SIZE
    page: int = MAX_PAGE_SIZE


# the running app's (create_app sets them)
LIMITS = Limits()


_INT = re.compile(r"[+-]?\d+")
_DOUBLE = re.compile(r"[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?")
_TYPES = {
    "int": "a whole number", "float": "a number", "bool": "true or false", "str": "a text",
    "bigint": "a whole number in a text", "bigdouble": "a decimal number in a text",
}


class Unreadable(ValueError):
    """A body or a frame that cannot be read: `reasons` say why (`json`, or the field of a text with U+0000)."""

    def __init__(self, reasons: list[dict[str, str]]) -> None:
        super().__init__("the JSON cannot be read")
        self.reasons = reasons


def _constant(_: str) -> Any:
    raise ValueError("NaN and Infinity are not JSON")


def _whole(text: str) -> int | float:
    # a number of thousands of digits is past every range: infinite, so its field refuses it by its type
    # (an exact field refuses it: JSON's numbers are never a `bigint`, synapsis.exact)
    return JsonInt(text) if len(text) <= 40 else float(text)


def read_json(raw: bytes | str) -> Any:
    """The JSON value of `raw`, or Unreadable."""
    try:
        text = raw.decode("utf-8") if isinstance(raw, bytes) else raw
        value = json.loads(text, parse_constant=_constant, parse_int=_whole)
    except (ValueError, RecursionError):
        raise Unreadable([reason("", "json")]) from None
    _check(value)
    return value


def _check(value: Any) -> None:
    """Refuses a value deeper than MAX_DEPTH, or with a text that holds U+0000 (named by its place)."""
    stack: list[tuple[Any, int, str]] = [(value, 1, "")]
    while stack:
        v, depth, at = stack.pop()
        if isinstance(v, (dict, list)):
            if depth > MAX_DEPTH:
                raise Unreadable([reason("", "json")])
            items = v.items() if isinstance(v, dict) else enumerate(v)  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]
            for k, item in items:  # pyright: ignore[reportUnknownVariableType]
                stack.append((item, depth + 1, f"{at}.{k}" if at else str(k)))  # pyright: ignore[reportUnknownArgumentType]
                if isinstance(k, str) and "\x00" in k:
                    raise Unreadable([reason(at, "invalid")])
        elif isinstance(v, str) and "\x00" in v:
            raise Unreadable([reason(at, "invalid")])


def is_json(content_type: str) -> bool:
    """`application/json` or `application/<x>+json`, in any case, in UTF-8 (no charset, or `utf-8`)."""
    kind, _, params = content_type.partition(";")
    kind = kind.strip().lower()
    if not (kind == "application/json" or (kind.startswith("application/") and kind.endswith("+json"))):
        return False
    for p in params.split(";"):
        name, _, value = p.partition("=")
        if name.strip().lower() == "charset" and value.strip().strip('"').lower() not in ("utf-8", "utf8"):
            return False
    return True


def parse_param(name: str, values: list[str], kind: str) -> tuple[Any, dict[str, str] | None]:
    """A parameter of the path or the query as its type (`kind`: int, float, bool, str, bigint, bigdouble): (value, None), or (None, the
    reason it is refused). No value, or only blanks: (None, None), the caller decides (a default, None, required)."""
    if len(values) > 1:
        return None, reason(name, "type", _TYPES.get(kind, "a text"))
    text = values[0].strip() if values else ""
    if not text:
        return None, None
    if "\x00" in text:
        return None, reason(name, "invalid")
    if kind == "int":
        # (a text of thousands of digits is not converted: past 64 bits by its length)
        if len(text) <= 21 and _INT.fullmatch(text) and INT_MIN <= (n := int(text)) <= INT_MAX:
            return n, None
        return None, reason(name, "type", _TYPES["int"])
    if kind == "float":
        if _DOUBLE.fullmatch(text) and math.isfinite(f := float(text)):
            return f, None
        return None, reason(name, "type", _TYPES["float"])
    if kind in ("bigint", "bigdouble"):
        exact = parse_bigint(text) if kind == "bigint" else parse_bigdouble(text)
        return (exact, None) if exact is not None else (None, reason(name, "type", _TYPES[kind]))
    if kind == "bool":
        if text in ("true", "false"):
            return text == "true", None
        return None, reason(name, "type", _TYPES["bool"])
    return text, None
