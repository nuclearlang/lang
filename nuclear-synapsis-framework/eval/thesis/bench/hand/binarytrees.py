"""Binary trees, written by hand in idiomatic Python (the same program as ../binarytrees.nuc)."""
from __future__ import annotations


class Tree:
    __slots__ = ("left", "right")

    def __init__(self, left: Tree | None, right: Tree | None) -> None:
        self.left = left
        self.right = right


def build(depth: int) -> Tree:
    return Tree(None, None) if depth == 0 else Tree(build(depth - 1), build(depth - 1))


def count(t: Tree) -> int:
    if t.left is None or t.right is None:
        return 1
    return 1 + count(t.left) + count(t.right)


def main() -> None:
    max_depth = 16
    print(f"stretch {count(build(max_depth + 1))}")
    long = build(max_depth)
    for depth in range(4, max_depth + 1, 4):
        rounds = 1 << (max_depth - depth + 4)
        total = sum(count(build(depth)) for _ in range(rounds))
        print(f"{rounds} trees of depth {depth}: {total}")
    print(f"long lived {count(long)}")


main()
