"""The findings of a run against the known ones (known.txt: `<stage> <id> | what it is`). A finding that is not in
the file is new: the check fails. A line of the file whose stage ran and that no longer happens is fixed: the check
fails until the line is deleted, so the file never says more than the truth.

Run: python known.py <known.txt> <findings file> "<stages that ran>"
"""

from __future__ import annotations

import sys


def read(path: str) -> dict[str, str]:
    out: dict[str, str] = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                key, _, said = line.partition("|")
                out[" ".join(key.split())] = said.strip()
    return out


def main() -> int:
    known, found, stages = read(sys.argv[1]), read(sys.argv[2]), sys.argv[3].split()
    new = [k for k in found if k not in known]
    fixed = [k for k in known if k.split()[0] in stages and k not in found]
    for k in found:
        if k in known:
            print(f"known {k}: {known[k]}")
    for k in new:
        print(f"FAIL new finding, not in known.txt: {k} | {found[k]}")
    for k in fixed:
        print(f"FAIL no longer happens (delete its line of known.txt): {k} | {known[k]}")
    return 1 if new or fixed else 0


sys.exit(main())
