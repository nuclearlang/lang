"""A data pipeline, written by hand in idiomatic Python (the same program as ../pipeline.nuc)."""
from collections import defaultdict
from dataclasses import dataclass


@dataclass(slots=True)
class Order:
    id: int
    customer: str
    amount: int
    paid: bool


def next_seed(seed: int) -> int:
    return (seed * 48271) % 2147483647


def main() -> None:
    names = ["ana", "luis", "eva", "bob", "zoe", "max", "kim", "sam"]
    orders: list[Order] = []
    seed = 7
    for i in range(300000):
        seed = next_seed(seed)
        orders.append(Order(i, names[seed % len(names)], seed % 1000, seed % 3 != 0))
    paid = [o for o in orders if o.paid]
    total = sum(o.amount for o in paid)
    big = sum(1 for o in paid if o.amount > 900)
    by_customer: defaultdict[str, list[Order]] = defaultdict(list)
    for o in paid:
        by_customer[o.customer].append(o)
    ranked = sorted(by_customer, key=lambda c: -len(by_customer[c]))
    for c in ranked[:3]:
        group = by_customer[c]
        print(f"{c} {len(group)} {max(o.amount for o in group)}")
    top = [o.id for o in sorted(paid, key=lambda o: (-o.amount, o.id))[:3]]
    print(f"total {total} big {big} top {','.join(map(str, top))}")
    unique = len({o.amount % 97 for o in orders})
    has = any(o.amount == 999 for o in orders)
    every = all(o.amount < 1000 for o in orders)
    print(f"any {str(has).lower()} all {str(every).lower()} unique {unique}")


main()
