"""Texts, written by hand in idiomatic Python (the same program as ../texts.nuc)."""


def main() -> None:
    parts = [f"item-{i % 1000}:{i * 7 % 13}" for i in range(200000)]
    text = ";".join(parts)
    fields = text.split(";")
    upper = 0
    long = 0
    for f in fields:
        key, value = f.split(":")
        name = key.upper().replace("ITEM-", "", 1)
        if len(name) == 3:
            long += 1
        if value == "0" and f.startswith("item-1"):
            upper += 1
    print("|".join(f.rjust(12, ".") for f in fields[:5]))
    print(f"length {len(text)} fields {len(fields)} long {long} upper {upper}")
    print(f"index {text.find('item-999')} last {text.rfind('item-0:')} has {str('item-500:' in text).lower()}")
    print(text[:40].replace("-", "_").strip())


main()
