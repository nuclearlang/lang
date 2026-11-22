"""Calls, written by hand in idiomatic Python (the same program as ../dispatch.nuc)."""
from collections.abc import Callable
from typing import Protocol


class Shape(Protocol):
    def area(self) -> int: ...


class Square:
    def __init__(self, side: int) -> None:
        self.side = side

    def area(self) -> int:
        return self.side * self.side


class Rect:
    def __init__(self, w: int, h: int) -> None:
        self.w = w
        self.h = h

    def area(self) -> int:
        return self.w * self.h


class Tri:
    def __init__(self, b: int, h: int) -> None:
        self.b = b
        self.h = h

    def area(self) -> int:
        return self.b * self.h // 2


Fn = Callable[[int], int]


def adder(n: int) -> Fn:
    return lambda x: x + n


def compose(f: Fn, g: Fn) -> Fn:
    return lambda x: g(f(x))


def main() -> None:
    shapes: list[Shape] = [
        Square(i % 7) if i % 3 == 0 else Rect(i % 5, i % 11) if i % 3 == 1 else Tri(i % 13, i % 4) for i in range(1000)
    ]
    total = 0
    for _ in range(1000):
        for s in shapes:
            total += s.area()
    f = compose(adder(3), compose(lambda x: x * 2, adder(-1)))
    acc = 0
    for i in range(2000000):
        acc = (acc + f(i)) % 1000003
    count = 0

    def bump() -> None:
        nonlocal count
        count += 1

    for _ in range(500000):
        bump()
    print(f"{total} {acc} {count}")


main()
