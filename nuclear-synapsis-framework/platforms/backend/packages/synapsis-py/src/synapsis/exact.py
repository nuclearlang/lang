"""The exact numbers of Nuclear (ADR-lang-0015) on the backend (the platform's reference, §2.1 and §2.3), the same in
every dialect:

- On the wire an exact number is a JSON text, the language's text both ways: a `bigint` is read with the rule of
  `text.toBigInt()` (an optional sign and digits), a `bigdouble` with `text.toBigDouble()` (also decimals and an
  exponent); blanks around it are ignored. A JSON number, another text or a value of more than `MAX_DIGITS` digits
  is refused with the rule `type`. It is written as `toString()` writes it (`12`, `0.3`, `2.0`).
- A column of a `bigint` is the database's 64-bit `BIGINT`; of a `bigdouble`, a `NUMERIC(p, s)` / `DECIMAL(p, s)`
  (`@column(precision = p, scale = s)`, 30 and 10 by default). SQLite has no exact number (it would keep a REAL and
  lose digits): there the column keeps the text of the value, with exactly `s` decimals, and the runtime compares and
  sorts it by value. A value the column cannot hold is never written: 409 `conflict`, on every database.
"""

from __future__ import annotations

import re
from decimal import Context, Decimal, MAX_EMAX, MAX_PREC, MIN_EMIN
from typing import Annotated, Any

from pydantic import GetCoreSchemaHandler, GetJsonSchemaHandler
from pydantic_core import PydanticCustomError, core_schema

__all__ = [
    "BigInt", "BigDouble", "JsonInt", "parse_bigint", "parse_bigdouble", "bigdouble_text", "fits_bigint",
    "fits_bigdouble", "column_text", "BIGINT_MIN", "BIGINT_MAX", "MAX_DIGITS", "PRECISION", "SCALE",
    "BIGINT_PATTERN", "BIGDOUBLE_PATTERN",
]

# a `bigint` column: the database's BIGINT
BIGINT_MIN, BIGINT_MAX = -(2**63), 2**63 - 1
# the most digits an exact number of a request has, written without an exponent: past it, not of the type (a text
# like `1e999999999` would be a billion digits)
MAX_DIGITS = 1000
# a `bigdouble` column without `precision` and `scale`; the most every database takes (MySQL's and MariaDB's)
PRECISION, SCALE = 30, 10
MAX_PRECISION, MAX_SCALE = 65, 30

BIGINT_PATTERN = r"^[+-]?[0-9]+$"
BIGDOUBLE_PATTERN = r"^[+-]?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$"
_BIGINT = re.compile(r"[+-]?[0-9]+")
_BIGDOUBLE = re.compile(r"[+-]?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?")
# computed with no rounding (the default context keeps 28 digits)
_EXACT = Context(prec=MAX_PREC, Emax=MAX_EMAX, Emin=MIN_EMIN)


class JsonInt(int):
    """A whole number read from JSON (synapsis.wire): a `bigint` field refuses it, as it refuses every JSON number;
    a whole number of the program passes."""


def _digits(d: Decimal) -> int:
    """How many digits `d` has written without an exponent (`1e3` → 4, `0.001` → 4)."""
    t = d.as_tuple()
    n, e = len(t.digits), int(t.exponent)
    return n + e if e >= 0 else max(n, -e + 1)


def parse_bigint(text: str) -> int | None:
    """`text.toBigInt()`: the whole number of `text`, or None; also None past `MAX_DIGITS` digits."""
    t = text.strip()
    if len(t.lstrip("+-")) > MAX_DIGITS or not _BIGINT.fullmatch(t):
        return None
    return int(t)


def parse_bigdouble(text: str) -> Decimal | None:
    """`text.toBigDouble()`: the exact decimal of `text`, or None; also None past `MAX_DIGITS` digits."""
    t = text.strip()
    if len(t) > 2 * MAX_DIGITS or not _BIGDOUBLE.fullmatch(t):
        return None
    d = Decimal(t)
    return d if _digits(d) <= MAX_DIGITS else None


def bigdouble_text(d: Decimal) -> str:
    """`toString()` of a `bigdouble`: the shortest exact text with at least one decimal (`0.3`, `2.0`)."""
    if d == 0:
        return "0.0"
    s = format(d.normalize(_EXACT), "f")
    return s if "." in s else s + ".0"


def _scale(d: Decimal) -> int:
    e = d.normalize(_EXACT).as_tuple().exponent
    return -e if isinstance(e, int) and e < 0 else 0


def fits_bigint(n: int) -> bool:
    """Whether a `bigint` column (BIGINT) holds `n`."""
    return BIGINT_MIN <= n <= BIGINT_MAX


def fits_bigdouble(d: Decimal, precision: int, scale: int) -> bool:
    """Whether a `NUMERIC(precision, scale)` holds `d` exactly: at most `scale` decimals and `precision - scale`
    digits before the point (the databases would round the decimals away)."""
    if not d.is_finite() or _scale(d) > scale:
        return False
    whole = abs(int(d))
    return whole == 0 or len(str(whole)) <= precision - scale


def column_text(value: int | Decimal, scale: int | None) -> str:
    """The text SQLite keeps of an exact value: a `bigint`'s digits; a `bigdouble` with `scale` decimals (more when the
    value has more: a value compared, never written, as it is). Of equal values the text is equal, and of two values
    with digits of the same length before the point, the text sorts as the value (synapsis.orm)."""
    if scale is None:
        return str(int(value))
    d = Decimal(value)
    q = d.quantize(Decimal(1).scaleb(-max(scale, _scale(d))), context=_EXACT)
    text = format(q, "f")
    return text[1:] if text.startswith("-") and q == 0 else text


def _refused(kind: str) -> PydanticCustomError:
    return PydanticCustomError(f"{kind}_type", "a value of another type")  # pyright: ignore[reportArgumentType]


def _bigint(value: Any) -> int:
    if isinstance(value, str):
        n = parse_bigint(value)
        if n is None:
            raise _refused("bigint")
        return n
    # a number of JSON (JsonInt, a float) is not of the type; a whole number of the program is
    if isinstance(value, bool) or isinstance(value, JsonInt) or not isinstance(value, int):
        raise _refused("bigint")
    return int(value)


def _bigdouble(value: Any) -> Decimal:
    if isinstance(value, str):
        d = parse_bigdouble(value)
        if d is None:
            raise _refused("bigdouble")
        return d
    # JSON gives no Decimal: one is a value of the program
    if isinstance(value, Decimal) and value.is_finite():
        return value
    raise _refused("bigdouble")


class _Exact:
    """The schema of an exact field of a model: its text in JSON, its value in the program."""

    def __init__(self, read: Any, write: Any, pattern: str) -> None:
        self.read, self.write, self.pattern = read, write, pattern

    def __get_pydantic_core_schema__(self, source: Any, handler: GetCoreSchemaHandler) -> core_schema.CoreSchema:
        del source, handler
        return core_schema.no_info_plain_validator_function(
            self.read, serialization=core_schema.plain_serializer_function_ser_schema(self.write, when_used="json")
        )

    def __get_pydantic_json_schema__(self, schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler) -> dict[str, Any]:
        del schema, handler
        return {"type": "string", "pattern": self.pattern}


# Nuclear's `bigint` and `bigdouble` as the fastapi dialect writes them: an `int` and a `Decimal` of the program
BigInt = Annotated[int, _Exact(_bigint, str, BIGINT_PATTERN)]
BigDouble = Annotated[Decimal, _Exact(_bigdouble, bigdouble_text, BIGDOUBLE_PATTERN)]
