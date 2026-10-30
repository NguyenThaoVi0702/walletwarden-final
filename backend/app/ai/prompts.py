"""Render the Jinja2 templates in /prompts into chat messages.

Prompts live in template files (not in code) so they can be reviewed and
re-tested against the 30-case test set without touching Python.
"""

from functools import lru_cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from app.ai.formatting import pct, vnd
from app.ai.interface import AdviceRequest, FinancialSummary, RoastContext

Message = dict[str, str]


def roast_facts(ctx: RoastContext) -> dict[str, int | None]:
    """Derived numbers for a roast, computed here so the model never does arithmetic."""
    remaining = ctx.budget - ctx.spent if ctx.budget is not None else None
    daily = remaining // ctx.days_left if remaining and remaining > 0 and ctx.days_left else None
    times_avg = round(ctx.amount / ctx.average_expense) if ctx.average_expense else None
    return {"remaining": remaining, "daily_allowance": daily, "times_average": times_avg}


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
            {"role": "user", "content": self._render("summary.j2", s=req.summary)},
        ]
        messages.append({"role": "assistant", "content": "Đã nhận số liệu tháng này."})
        messages += [{"role": t.role, "content": t.content} for t in req.history]
        messages.append({"role": "user", "content": req.question})
        return messages

    def roast(self, ctx: RoastContext) -> list[Message]:
        return [
            {"role": "system", "content": self._render("roast_system.j2", tone=ctx.tone.value)},
            {"role": "user", "content": self._render("roast_user.j2", c=ctx, f=roast_facts(ctx))},
        ]

    def monthly_report(self, summary: FinancialSummary) -> list[Message]:
        return [
            {"role": "system", "content": self._render("report_system.j2")},
            {"role": "user", "content": self._render("summary.j2", s=summary)},
        ]

    def quick_entry(self, text: str, categories: list[str]) -> list[Message]:
        return [
            {
                "role": "system",
                "content": self._render("quick_entry_system.j2", categories=categories),
            },
            {"role": "user", "content": text},
        ]
