"""Fannkuch, written by hand in idiomatic Python (the same program as ../fannkuch.nuc)."""


def main() -> None:
    n = 9
    perm = list(range(n))
    counts = [0] * n
    max_flips = 0
    checksum = 0
    sign = 1
    r = n
    while True:
        while r != 1:
            counts[r - 1] = r
            r -= 1
        work = perm[:]
        flips = 0
        k = work[0]
        while k != 0:
            work[: k + 1] = work[k::-1]
            flips += 1
            k = work[0]
        if flips > max_flips:
            max_flips = flips
        checksum += sign * flips
        sign = -sign
        done = True
        while r != n:
            perm.insert(r, perm.pop(0))
            counts[r] -= 1
            if counts[r] > 0:
                done = False
                break
            r += 1
        if done:
            break
    print(f"{checksum} {max_flips}")


main()
