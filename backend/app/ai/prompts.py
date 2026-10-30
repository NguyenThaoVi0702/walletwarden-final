"""Render the Jinja2 templates in /prompts into chat messages.

Prompts live in template files (not in code) so they can be reviewed and
re-tested against the 30-case test set without touching Python.
"""

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from app.ai.formatting import parse_amount, pct, vnd
from app.ai.interface import AdviceRequest, CategorySummary, FinancialSummary, RoastContext

Message = dict[str, str]

# Spending the model should not mock: paying rent or tuition is not a bad habit.
FIXED_COST_CATEGORIES = frozenset({"Nhà ở", "Hóa đơn", "Giáo dục"})


def roast_facts(ctx: RoastContext) -> dict[str, int | None]:
    """Derived numbers for a roast, computed here so the model never does arithmetic."""
    remaining = ctx.budget - ctx.spent if ctx.budget is not None else None
    daily = remaining // ctx.days_left if remaining and remaining > 0 and ctx.days_left else None
    times_avg = round(ctx.amount / ctx.average_expense) if ctx.average_expense else None
    return {"remaining": remaining, "daily_allowance": daily, "times_average": times_avg}


@dataclass
class SummaryFacts:
    """Comparisons a small model gets wrong (e.g. '3.3tr is more than 3.5tr'), decided in code.

    Every number here is one `_summary_numbers` already allows, so the output guard still holds.
    """

    budget_left: int | None = None  # total_budget - expense; negative = over
    over: list[CategorySummary] = field(default_factory=list)
    full: list[CategorySummary] = field(default_factory=list)
    near: list[CategorySummary] = field(default_factory=list)
    within: list[CategorySummary] = field(default_factory=list)
    no_budget: list[CategorySummary] = field(default_factory=list)
    vs_previous: str | None = None  # "ít hơn" / "nhiều hơn" / "bằng"
    price: int | None = None  # amount mentioned in the question
    price_vs_balance: bool | None = None  # True = balance covers it
    price_vs_budget: bool | None = None  # True = remaining total budget covers it


def summary_facts(s: FinancialSummary, question: str | None = None) -> SummaryFacts:
    f = SummaryFacts()
    if s.total_budget is not None:
        f.budget_left = s.total_budget - s.expense
    for c in s.categories:
        if c.budget is None:
            f.no_budget.append(c)
        elif c.spent > c.budget:
            f.over.append(c)
        elif c.spent == c.budget:
            f.full.append(c)
        elif c.budget and c.spent * 100 >= c.budget * 80:
            f.near.append(c)
        else:
            f.within.append(c)
    if s.previous_month_expense is not None:
        diff = s.expense - s.previous_month_expense
        f.vs_previous = "nhiều hơn" if diff > 0 else "ít hơn" if diff < 0 else "bằng"
    if question and (price := parse_amount(question)):
        f.price = price
        f.price_vs_balance = s.balance >= price
        if f.budget_left is not None:
            f.price_vs_budget = f.budget_left >= price
    return f


@lru_cache
def _env(prompts_dir: Path) -> Environment:
    env = Environment(
        loader=FileSystemLoader(prompts_dir),
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=False,
        autoescape=False,  # plain text for an LLM, not HTML
    )
    env.filters["vnd"] = vnd
    env.filters["pct"] = pct
    return env


class PromptBuilder:
    def __init__(self, prompts_dir: Path) -> None:
        self._env = _env(prompts_dir)

    def _render(self, name: str, **ctx: object) -> str:
        return self._env.get_template(name).render(**ctx).strip()

    def advice(self, req: AdviceRequest) -> list[Message]:
        messages = [
            {"role": "system", "content": self._render("advisor_system.j2")},
            {
                "role": "user",
                "content": self._render(
                    "summary.j2", s=req.summary, f=summary_facts(req.summary, req.question)
                ),
            },
        ]
        messages.append({"role": "assistant", "content": "Đã nhận số liệu tháng này."})
        messages += [{"role": t.role, "content": t.content} for t in req.history]
        messages.append({"role": "user", "content": req.question})
        return messages

    def roast(self, ctx: RoastContext) -> list[Message]:
        return [
            {"role": "system", "content": self._render("roast_system.j2", tone=ctx.tone.value)},
            {
                "role": "user",
                "content": self._render(
                    "roast_user.j2",
                    c=ctx,
                    f=roast_facts(ctx),
                    fixed_cost=ctx.category in FIXED_COST_CATEGORIES,
                ),
            },
        ]

    def monthly_report(self, summary: FinancialSummary) -> list[Message]:
        return [
            {"role": "system", "content": self._render("report_system.j2")},
            {
                "role": "user",
                "content": self._render("summary.j2", s=summary, f=summary_facts(summary)),
            },
        ]

    def quick_entry(self, text: str, categories: list[str]) -> list[Message]:
        return [
            {
                "role": "system",
                "content": self._render("quick_entry_system.j2", categories=categories),
            },
            {"role": "user", "content": text},
        ]
