"""The exact numbers on the backend (ADR-lang-0015, the platform's reference §2.1 and §2.3): a JSON text both ways,
the language's parsing, exact columns compared and sorted by value, a value the column cannot hold refused with 409.
The same cases, with the same expected bodies, are in synapsis-nest/test/exact.test.ts."""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated

import pytest
from annotated_types import Ge, Le
from pydantic import ValidationError

from synapsis import (
    AppConfig, AppError, BigDouble, BigInt, Entity, Mapped, Model, Repository, Result, SQLite, between, column,
    controller, get, gt, gte, lt, lte, one_of, post, primary,
)
from synapsis import create_app
from synapsis.exact import bigdouble_text, parse_bigdouble, parse_bigint
from synapsis.testing import client, memory_database


class Amount(Entity):
    __tablename__ = "amounts"
    id: Mapped[int] = primary(generated=True)
    big: Mapped[BigInt] = column()
    price: Mapped[BigDouble] = column(precision=20, scale=4)
    rate: Mapped[BigDouble] = column(default=Decimal("1.5"))
    extra: Mapped[BigDouble | None] = column(nullable=True)


class AmountRepository(Repository[Amount]):
    pass


class NewAmount(Model):
    big: Annotated[BigInt, Le(12345678901234567890123)]
    price: BigDouble
    floor: Annotated[BigDouble, Ge(Decimal("0.1"))] = Decimal("1")
    many: list[BigInt] = []


@controller("amounts")
class AmountController:
    def __init__(self, amounts: AmountRepository) -> None:
        self.amounts = amounts

    @post("")
    async def create(self, input: NewAmount) -> Amount:
        return await self.amounts.save(Amount(big=input.big, price=input.price))

    @get("sum")
    async def sum(self, a: BigDouble, b: BigDouble) -> BigDouble:
        return a + b

    @get("next/{n}")
    async def next(self, n: BigInt) -> BigInt:
        return n + 1

    @get("sorted")
    async def sorted(self, desc: bool = False) -> list[Amount]:
        return await self.amounts.order_by("price", desc=desc).get_many()

    @get("over")
    async def over(self, at: BigDouble, how: str = "gt") -> list[BigDouble]:
        op = {"gt": gt, "gte": gte, "lt": lt, "lte": lte}[how](at)
        return [a.price for a in await self.amounts.where({"price": op}).order_by("price").get_many()]

    @get("within")
    async def within(self, low: BigDouble, high: BigDouble) -> list[BigDouble]:
        return [a.price for a in await self.amounts.where({"price": between(low, high)}).order_by("price").get_many()]

    @get("equal")
    async def equal(self, at: BigDouble) -> int:
        return await self.amounts.where({"price": at}).count() + await self.amounts.where({"price": one_of([at])}).count()

    @get("write/{what}")
    async def write(self, what: str) -> Result[AppError, Amount]:
        from synapsis import Ok

        values = {"beyond": (2**63, Decimal("1")), "edge": (2**63 - 1, Decimal("1")), "decimals": (1, Decimal("0.00001")),
                  "digits": (1, Decimal("12345678901234567.5"))}[what]
        return Ok(await self.amounts.save(Amount(big=values[0], price=values[1])))


class Config(AppConfig):
    connections = [SQLite("unused.db")]


def refused(field: str, rule: str, message: str) -> dict[str, object]:
    return {"status": 400, "message": "invalid", "errors": [{"field": field, "rule": rule, "message": message}]}


def test_the_texts_of_the_language() -> None:
    assert [parse_bigint(t) for t in (" 12 ", "+3", "-0", "1.0", "1e3", "", "0x1", "1_0")] == [12, 3, 0, None, None, None, None, None]
    assert parse_bigdouble("-0.5e2") == Decimal("-50") and parse_bigdouble("1.") is None and parse_bigdouble("abc") is None
    # past MAX_DIGITS: not of the type (a text like this would be a billion digits)
    assert parse_bigdouble("1e999999999") is None and parse_bigint("9" * 1001) is None
    assert [bigdouble_text(Decimal(t)) for t in ("0.3000", "2", "-1.25", "0E-10", "1E+3")] == ["0.3", "2.0", "-1.25", "0.0", "1000.0"]


async def test_an_exact_field_is_a_text_in_json() -> None:
    app = create_app(Config(), controllers=[AmountController])
    async with client(app, Config(), memory_database()) as http:
        r = await http.post("/amounts", json={"big": "1234567890123456789", "price": "0.3", "many": ["1", " 2 "]})
        assert (r.status_code, r.json()) == (201, {"id": 1, "big": "1234567890123456789", "price": "0.3", "rate": "1.5", "extra": None})
        whole = "a whole number in a text"
        decimal = "a decimal number in a text"
        for sent, body in [
            ({"big": 5, "price": "1"}, refused("big", "type", f"big must be {whole}")),
            ({"big": "5.0", "price": "1"}, refused("big", "type", f"big must be {whole}")),
            ({"big": "1", "price": 0.3}, refused("price", "type", f"price must be {decimal}")),
            ({"big": "1", "price": "1e999999999"}, refused("price", "type", f"price must be {decimal}")),
            ({"big": "1", "price": "1", "floor": "0.05"}, refused("floor", "min", "floor must be at least 0.1")),
            ({"big": "12345678901234567890124", "price": "1"}, refused("big", "max", "big must be at most 12345678901234567890123")),
            ({"big": "1", "price": "1", "many": ["1", 2]}, refused("many.1", "type", f"many.1 must be {whole}")),
        ]:
            r = await http.post("/amounts", json=sent)
            assert (r.status_code, r.json()) == (400, body), sent
        # a parameter of the path or the query: the same texts
        r = await http.get("/amounts/sum?a=0.1&b=0.2")
        assert (r.status_code, r.json()) == (200, "0.3")
        assert (await http.get("/amounts/next/9223372036854775807")).json() == "9223372036854775808"
        r = await http.get("/amounts/sum?a=0.1&b=x")
        assert (r.status_code, r.json()) == (400, refused("b", "type", f"b must be {decimal}"))
        r = await http.get("/amounts/next/1.5")
        assert (r.status_code, r.json()) == (400, refused("n", "type", f"n must be {whole}"))


def test_a_model_built_in_code_takes_the_values_of_the_program() -> None:
    assert NewAmount(big=5, price=Decimal("0.5")).big == 5
    with pytest.raises(ValidationError):
        NewAmount(big=5, price=0.5)  # pyright: ignore[reportArgumentType]  # a double is not a bigdouble


async def test_an_exact_column_compares_and_sorts_by_value() -> None:
    app = create_app(Config(), controllers=[AmountController])
    async with client(app, Config(), memory_database()) as http:
        prices = ["10", "9.5", "-2", "-10.25", "0.3", "100", "-0.5", "0"]
        for i, p in enumerate(prices):
            assert (await http.post("/amounts", json={"big": str(i), "price": p})).status_code == 201
        ordered = ["-10.25", "-2.0", "-0.5", "0.0", "0.3", "9.5", "10.0", "100.0"]
        assert [a["price"] for a in (await http.get("/amounts/sorted")).json()] == ordered
        assert [a["price"] for a in (await http.get("/amounts/sorted?desc=true")).json()] == ordered[::-1]
        assert (await http.get("/amounts/over?at=0.3")).json() == ["9.5", "10.0", "100.0"]
        assert (await http.get("/amounts/over?at=0.3&how=gte")).json() == ["0.3", "9.5", "10.0", "100.0"]
        assert (await http.get("/amounts/over?at=-0.75&how=lt")).json() == ["-10.25", "-2.0"]
        assert (await http.get("/amounts/over?at=-2&how=lte")).json() == ["-10.25", "-2.0"]
        assert (await http.get("/amounts/over?at=9.50001")).json() == ["10.0", "100.0"]
        assert (await http.get("/amounts/within?low=-2&high=9.5")).json() == ["-2.0", "-0.5", "0.0", "0.3", "9.5"]
        assert (await http.get("/amounts/equal?at=0.30")).json() == 2
        assert (await http.get("/amounts/equal?at=0.30001")).json() == 0


async def test_a_value_the_column_cannot_hold_is_a_409() -> None:
    app = create_app(Config(), controllers=[AmountController])
    async with client(app, Config(), memory_database()) as http:
        assert (await http.get("/amounts/write/edge")).json()["big"] == "9223372036854775807"
        for what in ("beyond", "decimals", "digits"):
            r = await http.get(f"/amounts/write/{what}")
            assert (r.status_code, r.json()) == (409, {"status": 409, "message": "conflict"}), what
