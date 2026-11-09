"""Tell a spending/income statement in the chat ("nay ăn bánh cuốn hết 50k") from a question.

The advisor chat uses this to log the transaction instead of answering it. Rule-based on
purpose: it must be instant, predictable and testable, and a wrong "yes" creates real data,
so anything that looks like a question stays a question.
"""

import re
from datetime import date, timedelta

from app.ai.formatting import parse_amount
from app.ai.rules import strip_accents

# Words that make a message a question even without "?". Matched without accents.
_QUESTION_WORDS = (
    "khong", "duoc khong", "co nen", "nen ", "bao nhieu", "sao", "the nao", "nhu nao",
    "lam the", "co du", "du tien", "lieu", "nao", "gi ", "gi?", "hay chua", "chua?",
    "phai khong", "giup", "tu van", "goi y", "tinh", "neu ", "co the",
)  # fmt: skip
# Verbs/nouns that describe money actually moving. Matched as whole words without accents.
_ACTION_WORDS = (
    "an", "uong", "mua", "tra", "dong", "tieu", "chi", "het", "mat", "ton", "nap", "do",
    "nhan", "luong", "thuong", "di", "grab", "be", "taxi", "xang", "sam", "order", "dat",
    "thanh toan", "chuyen", "gui", "cho", "biu", "bao", "tien",
)  # fmt: skip
_DAY_OFFSETS = (("hom kia", 2), ("hom qua", 1), ("toi qua", 1), ("sang qua", 1))


def _plain(text: str) -> str:
    return " " + re.sub(r"\s+", " ", strip_accents(text).lower()).strip() + " "


def is_entry_statement(text: str) -> bool:
    """True for "nay ăn bánh cuốn hết 50k", False for "mua laptop 3 chai được không?"."""
    if parse_amount(text) is None:
        return False
    plain = _plain(text)
    if "?" in text or any(w in plain for w in _QUESTION_WORDS):
        return False
    return any(re.search(rf"\b{re.escape(w)}\b", plain) for w in _ACTION_WORDS)


def entry_day(text: str, today: date) -> date:
    """'hôm qua' -> yesterday, 'hôm kia' -> 2 days ago, anything else -> today."""
    plain = _plain(text)
    for phrase, offset in _DAY_OFFSETS:
        if phrase in plain:
            return today - timedelta(days=offset)
    return today
