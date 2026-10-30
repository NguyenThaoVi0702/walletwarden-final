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


_UNIT = {
    "k": 1_000, "nghìn": 1_000, "nghin": 1_000, "ngàn": 1_000, "ngan": 1_000,
    "tr": 1_000_000, "triệu": 1_000_000, "trieu": 1_000_000, "million": 1_000_000, "m": 1_000_000,
    "tỷ": 1_000_000_000,
}  # fmt: skip
# Spoken money slang. Several are also counting words ("2 chai bia 50k", "1 lít xăng 25k"),
# so a standard amount anywhere in the text always wins over slang.
XI_VALUE = 10_000  # "xị" is 10k in most of the team's usage; some regions say 100k
SLANG_UNIT = {
    "lít": 100_000, "lốp": 100_000, "sọi": 100_000,
    "xị": XI_VALUE, "lá": 10_000,
    "củ": 1_000_000, "chai": 1_000_000,
    "tỏi": 1_000_000_000,
}  # fmt: skip
_ALL_UNITS = {**_UNIT, **SLANG_UNIT}
_UNIT_RE = "|".join(sorted(map(re.escape, [*_ALL_UNITS, "đ", "d", "vnd"]), key=len, reverse=True))
_AMOUNT = re.compile(
    rf"(?P<num>\d+(?:[.,]\d+)*)\s*(?P<unit>{_UNIT_RE})?(?P<tail>\d)?"
    r"(?P<half>\s*r[ưu][ỡởo]i)?(?![\w])",
    re.IGNORECASE,
)


def parse_amount(text: str) -> int | None:
    """Find the money amount in free text.

    Handles '45k', '1.2tr', '1tr2', '2 triệu', '150.000', '150000đ', and slang:
    '3 lốp' (300k), '5 xị' (50k), '2 củ' / '2 chai' (2tr), '1 củ rưỡi' (1.5tr), '1 tỏi' (1 tỷ).
    Returns None when no plausible amount (>= 1.000đ) is found.
    """
    slang: int | None = None
    for m in _AMOUNT.finditer(text):
        num, unit, tail = m.group("num"), (m.group("unit") or "").lower(), m.group("tail")
        multiplier = _ALL_UNITS.get(unit, 1)
        if multiplier == 1:
            # '150.000' / '150,000' are thousands separators, not decimals.
            value = float(num.replace(".", "").replace(",", ""))
        else:
            value = float(num.replace(",", "."))
            if tail:  # '1tr2' -> 1.2 triệu
                value += int(tail) / 10
            if m.group("half"):  # '1 củ rưỡi' -> 1.5 củ
                value += 0.5
        amount = round(value * multiplier)
        if amount < 1_000:
            continue
        if unit not in SLANG_UNIT:
            return amount
        slang = slang or amount
    return slang


def strip_amounts(text: str) -> str:
    """'trà sữa 5 xị' -> 'trà sữa'. Used to keep amounts out of notes."""
    return re.sub(r"\s+", " ", _AMOUNT.sub("", text)).strip(" -,.")


def money_slang_help() -> str:
    """One line for prompts, built from SLANG_UNIT so prompts and parser never disagree."""
    by_value: dict[int, list[str]] = {}
    for word, value in SLANG_UNIT.items():
        by_value.setdefault(value, []).append(word)
    return ", ".join(f"{'/'.join(words)} = {vnd(v)}" for v, words in sorted(by_value.items()))


_BIG_NUMBER = re.compile(r"\d{1,3}(?:[.,]\d{3})+|\d{4,}")


def big_numbers(text: str) -> set[int]:
    """Integers >= 1000 written in the text, e.g. '1.500.000' or '25000'."""
    return {int(re.sub(r"[.,]", "", n)) for n in _BIG_NUMBER.findall(text)}
