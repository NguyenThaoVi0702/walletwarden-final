"""Number helpers shared by prompts, rules and output checks."""

import re


def vnd(amount: int | None) -> str:
    """1500000 -> '1.500.000đ' (Vietnamese thousands separator)."""
    if amount is None:
        return "chưa đặt"
    sign = "-" if amount < 0 else ""
    return f"{sign}{abs(amount):,}đ".replace(",", ".")


def pct(value: int | None) -> str:
    return "chưa đặt" if value is None else f"{value}%"


_AMOUNT = re.compile(
    r"(?P<num>\d+(?:[.,]\d+)*)\s*"
    r"(?P<unit>k|nghìn|nghin|ngàn|ngan|tr|triệu|trieu|million|m|đ|d|vnd)?"
    r"(?P<tail>\d)?(?![\w])",
    re.IGNORECASE,
)
_UNIT = {
    "k": 1_000, "nghìn": 1_000, "nghin": 1_000, "ngàn": 1_000, "ngan": 1_000,
    "tr": 1_000_000, "triệu": 1_000_000, "trieu": 1_000_000, "million": 1_000_000, "m": 1_000_000,
}  # fmt: skip


def parse_amount(text: str) -> int | None:
    """Find the first money amount in free text.

    Handles '45k', '1.2tr', '1tr2', '2 triệu', '150.000', '150000đ'.
    Returns None when no plausible amount (>= 1.000đ) is found.
    """
    for m in _AMOUNT.finditer(text):
        num, unit, tail = m.group("num"), (m.group("unit") or "").lower(), m.group("tail")
        multiplier = _UNIT.get(unit, 1)
        if multiplier == 1:
            # '150.000' / '150,000' are thousands separators, not decimals.
            value = float(num.replace(".", "").replace(",", ""))
        else:
            value = float(num.replace(",", "."))
            if tail:  # '1tr2' -> 1.2 triệu
                value += int(tail) / 10
        amount = round(value * multiplier)
        if amount >= 1_000:
            return amount
    return None


_BIG_NUMBER = re.compile(r"\d{1,3}(?:[.,]\d{3})+|\d{4,}")


def big_numbers(text: str) -> set[int]:
    """Integers >= 1000 written in the text, e.g. '1.500.000' or '25000'."""
    return {int(re.sub(r"[.,]", "", n)) for n in _BIG_NUMBER.findall(text)}
