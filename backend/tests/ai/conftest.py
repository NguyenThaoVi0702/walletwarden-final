from datetime import date
from pathlib import Path

import pytest

from app.ai.calllog import CallLog
from app.ai.interface import (
    CategorySummary,
    ExpenseItem,
    FinancialSummary,
    ProviderName,
    RoastContext,
    RoastTrigger,
    Tone,
)
from app.ai.providers.base import Message, ProviderError
from app.ai.service import DefaultAIService
from app.config import Settings


class ScriptedProvider:
    """Test double: returns queued replies, or raises ProviderError when given an exception."""

    def __init__(self, name: ProviderName, replies: list[str | Exception]) -> None:
        self.name = name
        self.replies = list(replies)
        self.calls: list[list[Message]] = []

    async def complete(
        self,
        messages: list[Message],
        *,
        max_tokens: int,
        temperature: float,
        json_mode: bool = False,
    ) -> str:
        self.calls.append(messages)
        reply = self.replies.pop(0) if self.replies else ProviderError("no scripted reply")
        if isinstance(reply, Exception):
            raise reply
        return reply

    async def ping(self) -> bool:
        return True


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        ai_providers="fake", ai_log_file=tmp_path / "ai.jsonl", ai_rate_limit_per_minute=5
    )


@pytest.fixture
def make_service(settings: Settings, tmp_path: Path):  # type: ignore[no-untyped-def]
    def _make(*providers: ScriptedProvider) -> DefaultAIService:
        return DefaultAIService(
            settings, providers=list(providers), call_log=CallLog(tmp_path / "ai.jsonl")
        )

    return _make


@pytest.fixture
def summary() -> FinancialSummary:
    return FinancialSummary(
        month="2026-11",
        days_left=12,
        income=8_000_000,
        expense=5_400_000,
        balance=2_600_000,
        total_budget=6_000_000,
        total_usage_pct=90,
        categories=[
            CategorySummary(name="Ăn uống", spent=2_700_000, budget=2_500_000, usage_pct=108),
            CategorySummary(name="Di chuyển", spent=600_000, budget=800_000, usage_pct=75),
            CategorySummary(name="Mua sắm", spent=2_100_000),
        ],
        top_expenses=[
            ExpenseItem(category="Mua sắm", amount=1_500_000, day=date(2026, 11, 8)),
            ExpenseItem(category="Ăn uống", amount=450_000, day=date(2026, 11, 14)),
        ],
        previous_month_expense=4_500_000,
        change_vs_previous_pct=20,
    )


@pytest.fixture
def roast_ctx() -> RoastContext:
    return RoastContext(
        trigger=RoastTrigger.BUDGET_80,
        tone=Tone.SAVAGE,
        category="Ăn uống",
        amount=120_000,
        spent=2_050_000,
        budget=2_500_000,
        usage_pct=82,
        days_left=10,
    )
