"""Public contract of the AI module (frozen at milestone M1, 30 Oct).

The rest of the backend talks to the AI only through `AIService` and the models
below. Every number in these models is calculated by the domain services (Khải)
before the call; the model only writes wording, so it cannot get the maths wrong.

Changing anything in this file after 30 Oct needs approval from all three members
(PR label `contract-approved`).
"""

from datetime import date
from enum import StrEnum
from typing import Any, Literal, Protocol

from pydantic import BaseModel, Field

ProviderName = Literal["local", "gemini", "rules", "fake"]


class Tone(StrEnum):
    GENTLE = "gentle"
    HONEST = "honest"
    SAVAGE = "savage"


class RoastTrigger(StrEnum):
    """Situations worth a roast. `app.ai.detect_roast` decides which one fires."""

    BUDGET_80 = "budget_80"  # a budget just crossed 80%
    BUDGET_100 = "budget_100"  # a budget just crossed 100%
    LARGE_EXPENSE = "large_expense"  # one expense > 3x the user's average
    DAILY_SPIKE = "daily_spike"  # today's spend in a category well above yesterday's
    REPEAT_TODAY = "repeat_today"  # 3rd+ purchase in the same category today
    SMALL_HABIT = "small_habit"  # many small purchases adding up this month
    SPENDING_STREAK = "spending_streak"  # same fun category N days in a row
    PAYDAY_SPLURGE = "payday_splurge"  # big chunk of the salary gone days after payday
    OVER_INCOME = "over_income"  # this month's spending just passed this month's income
    BURN_RATE = "burn_rate"  # at this pace the budget runs out before month end


class CategorySummary(BaseModel):
    name: str
    spent: int = Field(ge=0, description="VND spent in this category this month")
    budget: int | None = Field(default=None, ge=0, description="Monthly limit in VND, if set")
    usage_pct: int | None = Field(default=None, ge=0, description="spent / budget * 100, rounded")


class ExpenseItem(BaseModel):
    category: str
    amount: int = Field(gt=0)
    day: date


class FinancialSummary(BaseModel):
    """Aggregated, anonymised figures for one user and one month. Never names or emails."""

    month: str = Field(pattern=r"^\d{4}-\d{2}$", examples=["2026-11"])
    days_left: int = Field(ge=0, le=31)
    income: int = Field(ge=0)
    expense: int = Field(ge=0)
    balance: int = Field(description="income - expense for the month; may be negative")
    total_budget: int | None = Field(default=None, ge=0)
    total_usage_pct: int | None = Field(default=None, ge=0)
    categories: list[CategorySummary] = Field(default_factory=list, max_length=30)
    top_expenses: list[ExpenseItem] = Field(default_factory=list, max_length=5)
    previous_month_expense: int | None = Field(default=None, ge=0)
    change_vs_previous_pct: int | None = Field(
        default=None, description="(expense - previous) / previous * 100, rounded"
    )


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2000)


class AdviceRequest(BaseModel):
    summary: FinancialSummary
    question: str = Field(min_length=1, max_length=500)
    history: list[ChatTurn] = Field(default_factory=list, max_length=6)


class RoastContext(BaseModel):
    """Built by the roast-trigger engine when a threshold is crossed."""

    trigger: RoastTrigger
    tone: Tone
    category: str | None = Field(default=None, description="None = the whole-month budget")
    amount: int = Field(gt=0, description="The transaction that caused the trigger, VND")
    spent: int = Field(ge=0, description="Spent in this scope this month, including `amount`")
    budget: int | None = Field(default=None, ge=0)
    usage_pct: int | None = Field(default=None, ge=0)
    average_expense: int | None = Field(
        default=None, gt=0, description="User's average single expense; set for large_expense"
    )
    days_left: int = Field(ge=0, le=31)
    previous_spent: int | None = Field(
        default=None, ge=0, description="daily_spike: yesterday's spend in the same category"
    )
    count: int | None = Field(
        default=None,
        ge=0,
        description="repeat_today: purchases today; small_habit: small purchases this month; "
        "spending_streak: days in a row; payday_splurge: days since payday",
    )
    income: int | None = Field(
        default=None, ge=0, description="payday_splurge: the salary; over_income: month income"
    )
    days_until_empty: int | None = Field(
        default=None, ge=0, description="burn_rate: days until the budget is gone at this pace"
    )


class TxRecord(BaseModel):
    """One transaction as `detect_roast` needs it (no notes, no ids)."""

    kind: Literal["expense", "income"]
    amount: int = Field(gt=0)
    category: str
    day: date


class RoastCandidate(BaseModel):
    """What `detect_roast` returns: the roast to write, plus a key for de-duplication.

    Store `key` with the alert; pass the keys already used this month back as `fired`
    so the same situation is not roasted twice.
    """

    key: str
    context: RoastContext


class AIReply(BaseModel):
    text: str
    provider: ProviderName
    fallback: bool = Field(description="True when the first provider in the chain did not answer")
    latency_ms: int


class MonthlyReport(BaseModel):
    month: str
    headline: str
    commentary: str
    saving_tip: str
    top_categories: list[CategorySummary]
    biggest_expenses: list[ExpenseItem]
    provider: ProviderName
    fallback: bool


class ParsedEntry(BaseModel):
    """Result of quick entry by text (F9), e.g. "trà sữa 45k"."""

    kind: Literal["expense", "income"]
    amount: int = Field(gt=0)
    category: str
    note: str
    provider: ProviderName


class AIRateLimitError(Exception):
    """Raised when a user exceeds the per-minute AI quota. Map it to HTTP 429."""

    def __init__(self, retry_after_s: int) -> None:
        super().__init__(f"AI rate limit exceeded, retry after {retry_after_s}s")
        self.retry_after_s = retry_after_s


class AIService(Protocol):
    """What the API layer may call. Every method always returns an answer:
    if no model responds, the rule-based fallback writes one."""

    async def advise(self, user_id: int, request: AdviceRequest) -> AIReply: ...

    async def roast(self, user_id: int, context: RoastContext) -> AIReply: ...

    async def monthly_report(self, user_id: int, summary: FinancialSummary) -> MonthlyReport: ...

    async def parse_entry(
        self, user_id: int, text: str, categories: list[str]
    ) -> ParsedEntry | None: ...

    async def health(self) -> dict[str, Any]: ...
