"""Output checks applied to every model reply before a user sees it.

A rejected reply is not shown: the router moves on to the next provider,
and finally to the rule-based text, which is always safe.
"""

import json
import re
from typing import Any

from app.ai.formatting import big_numbers


class OutputRejectedError(Exception):
    pass


# Roasts are about spending only: no insults about intelligence, appearance, identity or family.
_BANNED = [
    r"\bngu\b", r"đồ ngu", r"óc chó", r"đần", r"khốn nạn", r"mẹ mày", r"bố mày", r"cha mày",
    r"con mẹ", r"thằng", r"xấu xí", r"\bmập\b", r"\bbéo\b", r"địt", r"\bđụ\b", r"vãi l",
    r"fuck", r"stupid", r"idiot", r"\bdumb\b",
]  # fmt: skip
_BANNED_RE = re.compile("|".join(_BANNED), re.IGNORECASE)
_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
# A sentence ends at . ! ? … followed by whitespace, so "1.200.000đ" stays in one piece.
_SENTENCE_END_RE = re.compile(r"(?<=[.!?…])[\"'”)]*\s+")


def clean(text: str) -> str:
    text = _THINK_RE.sub("", text)
    text = text.replace("**", "").replace("```", "")
    return re.sub(r"[ \t]+", " ", text).strip()


def _check_common(text: str, max_chars: int) -> str:
    text = clean(text)
    if not text:
        raise OutputRejectedError("empty")
    if len(text) > max_chars:
        raise OutputRejectedError(f"too long ({len(text)} chars)")
    if match := _BANNED_RE.search(text):
        raise OutputRejectedError(f"banned term: {match.group(0)!r}")
    return text


def _check_numbers(text: str, allowed: set[int]) -> None:
    """Reject replies that invent large amounts. Years are tolerated."""
    invented = {n for n in big_numbers(text) if n not in allowed and not 1900 <= n <= 2100}
    if invented:
        raise OutputRejectedError(f"numbers not in the input: {sorted(invented)}")


def sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_END_RE.split(text) if s.strip()]


def check_roast(text: str, allowed_numbers: set[int]) -> str:
    text = _check_common(text, max_chars=600)
    _check_numbers(text, allowed_numbers)
    parts = sentences(text)
    if len(parts) > 3:
        # Keep the opening and the practical suggestion, which the prompt puts last.
        parts = [*parts[:2], parts[-1]]
    return " ".join(parts)


def check_advice(text: str) -> str:
    return _check_common(text, max_chars=1500)


def parse_json(text: str, required: list[str]) -> dict[str, Any]:
    text = clean(text)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise OutputRejectedError("no JSON object")
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise OutputRejectedError(f"invalid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise OutputRejectedError("JSON is not an object")
    missing = [k for k in required if not isinstance(data.get(k), str) or not data[k].strip()]
    if missing:
        raise OutputRejectedError(f"missing fields: {missing}")
    return data


def check_report(text: str, allowed_numbers: set[int]) -> dict[str, str]:
    data = parse_json(text, ["headline", "commentary", "saving_tip"])
    out: dict[str, str] = {}
    for key, limit in (("headline", 160), ("commentary", 900), ("saving_tip", 400)):
        value = _check_common(str(data[key]), max_chars=limit)
        _check_numbers(value, allowed_numbers)
        out[key] = value
    return out
