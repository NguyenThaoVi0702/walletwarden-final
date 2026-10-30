"""Keeps the 30-case test set valid: every case must parse against the frozen contract."""

from typing import Any

import pytest
import yaml

from app.ai.interface import FinancialSummary, RoastContext
from app.config import REPO_ROOT

DATA: dict[str, Any] = yaml.safe_load(
    (REPO_ROOT / "prompts" / "testset" / "cases.yaml").read_text(encoding="utf-8")
)


def test_at_least_thirty_unique_cases() -> None:
    ids = [c["id"] for c in DATA["cases"]]
    assert len(ids) >= 30 and len(set(ids)) == len(ids)


@pytest.mark.parametrize("case", DATA["cases"], ids=lambda c: c["id"])
def test_case_matches_contract(case: dict[str, Any]) -> None:
    if case["task"] == "roast":
        RoastContext.model_validate(case["context"])
    elif case["task"] in ("advice", "report"):
        FinancialSummary.model_validate(DATA["summaries"][case["summary"]])
    else:
        assert case["task"] == "quick_entry" and case["expect"]["category"] in DATA["categories"]
