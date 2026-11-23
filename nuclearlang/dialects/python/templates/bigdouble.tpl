# Nuclear's bigdouble is Decimal, computed in a context with no rounding (the default one keeps 28 digits); ADR-lang-0015
_EXACT = Context(prec=MAX_PREC, Emax=MAX_EMAX, Emin=MIN_EMIN)


def _dec_scale(d: Decimal) -> int:
    e = d.normalize(_EXACT).as_tuple().exponent
    return -e if isinstance(e, int) and e < 0 else 0


def _dec_div(a: Decimal, b: Decimal) -> Decimal:
    # rounded half away from zero to max(20, the decimals of each side) decimals
    if b == 0:
        raise ZeroDivisionError("division by zero")
    s = max(20, _dec_scale(a), _dec_scale(b))
    an, ad = a.as_integer_ratio()
    bn, bd = b.as_integer_ratio()
    n, d = an * bd * 10**s, ad * bn
    if d < 0:
        n, d = -n, -d
    q, r = divmod(abs(n), d)
    if 2 * r >= d:
        q += 1
    return Decimal(f"{-q if n < 0 else q}E-{s}")


def _dec_pow(x: Decimal, n: int) -> Decimal:
    if n < 0:
        raise ValueError(f"the exponent {n} is not a whole number >= 0")
    return _EXACT.power(x, n)


def _dec_round(d: Decimal, digits: int) -> Decimal:
    return d.quantize(Decimal(1).scaleb(-digits), rounding=ROUND_HALF_UP, context=_EXACT)


def _dec_fixed(d: Decimal, digits: int) -> str:
    q = _dec_round(d, digits)
    return format(abs(q) if q == 0 else q, "f")


def _dec_from(x: float) -> Decimal:
    if not math.isfinite(x):
        raise ValueError(f"{x} is not a finite number")
    return Decimal(repr(x))


def _to_bigdouble(s: str) -> Decimal | None:
    t = s.strip()
    return Decimal(t) if re.fullmatch(r"[+-]?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?", t) else None


def _dec_text(d: Decimal) -> str:
    # the shortest exact text with at least one decimal: 0.3, 2.0
    if d == 0:
        return "0.0"
    s = format(d.normalize(_EXACT), "f")
    return s if "." in s else s + ".0"


def _dec_text_or_null(d: Decimal | None) -> str:
    return "null" if d is None else _dec_text(d)
