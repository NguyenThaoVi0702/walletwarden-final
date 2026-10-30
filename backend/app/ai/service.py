"""Provider router: local model -> Gemini -> rules.

Each AI feature is one prompt. For every request the router tries the configured
LLM providers in order, checks the reply, and falls back to the rule-based text
if none passes, so the user always gets an answer.
"""

import time
from collections.abc import Callable
from typing import Any

from app.ai import rules
from app.ai.calllog import CallLog
from app.ai.formatting import parse_amount
from app.ai.guard import (
    OutputRejectedError,
    check_advice,
    check_report,
    check_roast,
    parse_json,
)
from app.ai.interface import (
    AdviceRequest,
    AIReply,
    FinancialSummary,
    MonthlyReport,
    ParsedEntry,
    ProviderName,
    RoastContext,
)
from app.ai.prompts import Message, PromptBuilder, roast_facts
from app.ai.providers import GeminiProvider, LlamaCppProvider, LLMProvider, ProviderError
from app.ai.ratelimit import SlidingWindowLimiter
from app.config import Settings


def build_providers(settings: Settings) -> list[LLMProvider]:
    providers: list[LLMProvider] = []
    for name in settings.ai_provider_chain:
        if name == "local":
            providers.append(
                LlamaCppProvider(
                    settings.llama_base_url,
                    settings.llama_model,
                    settings.llama_timeout_s,
                    settings.llama_max_concurrency,
                )
            )
        elif name == "gemini" and settings.gemini_api_key:
            providers.append(
                GeminiProvider(
                    settings.gemini_api_key, settings.gemini_model, settings.gemini_timeout_s
                )
            )
    return providers


def _roast_numbers(ctx: RoastContext) -> set[int]:
    values = [ctx.amount, ctx.spent, ctx.budget, ctx.average_expense, *roast_facts(ctx).values()]
    return {abs(v) for v in values if v is not None}


def _summary_numbers(s: FinancialSummary) -> set[int]:
    values: list[int | None] = [
        s.income, s.expense, s.balance, s.total_budget, s.previous_month_expense,
        s.total_budget - s.expense if s.total_budget is not None else None,
        s.expense - s.previous_month_expense if s.previous_month_expense is not None else None,
    ]  # fmt: skip
    for c in s.categories:
        values += [c.spent, c.budget, c.budget - c.spent if c.budget is not None else None]
    values += [e.amount for e in s.top_expenses]
    return {abs(v) for v in values if v is not None}


class DefaultAIService:
    def __init__(
        self,
        settings: Settings,
        providers: list[LLMProvider] | None = None,
        call_log: CallLog | None = None,
    ) -> None:
        self._providers = build_providers(settings) if providers is None else providers
        # With no LLM configured (WW_AI_PROVIDERS=fake) the rules engine *is* the AI.
        self._rules_name: ProviderName = "rules" if self._providers else "fake"
        self._prompts = PromptBuilder(settings.prompts_dir)
        self._limiter = SlidingWindowLimiter(settings.ai_rate_limit_per_minute)
        self._log = call_log or CallLog(settings.ai_log_file)
        self._chain = settings.ai_provider_chain

    async def _answer[T](
        self,
        task: str,
        user_id: int,
        messages: list[Message],
        *,
        max_tokens: int,
        temperature: float,
        check: Callable[[str], T],
        fallback: Callable[[], T],
        json_mode: bool = False,
    ) -> tuple[T, ProviderName, bool, int]:
        start = time.perf_counter()
        errors: list[str] = []
        result: T | None = None
        provider: ProviderName = self._rules_name
        for llm in self._providers:
            try:
                raw = await llm.complete(
                    messages, max_tokens=max_tokens, temperature=temperature, json_mode=json_mode
                )
                result, provider = check(raw), llm.name
                break
            except (ProviderError, OutputRejectedError) as exc:
                errors.append(f"{llm.name}: {exc}"[:300])
        if result is None:
            result = fallback()
        latency_ms = round((time.perf_counter() - start) * 1000)
        is_fallback = bool(self._providers) and provider != self._providers[0].name
        self._log.write(
            task=task,
            user_id=user_id,
            provider=provider,
            fallback=is_fallback,
            latency_ms=latency_ms,
            errors=errors,
        )
        return result, provider, is_fallback, latency_ms

    async def advise(self, user_id: int, request: AdviceRequest) -> AIReply:
        self._limiter.check(user_id)
        text, provider, fb, ms = await self._answer(
            "advice",
            user_id,
            self._prompts.advice(request),
            max_tokens=250,
            temperature=0.6,
            check=check_advice,
            fallback=lambda: rules.advice(request),
        )
        return AIReply(text=text, provider=provider, fallback=fb, latency_ms=ms)

    async def roast(self, user_id: int, context: RoastContext) -> AIReply:
        # Not rate-limited: roasts are triggered by saving a transaction, not by asking.
        allowed = _roast_numbers(context)
        text, provider, fb, ms = await self._answer(
            f"roast_{context.tone.value}",
            user_id,
            self._prompts.roast(context),
            max_tokens=160,
            temperature=0.7,  # 0.9 made a 9B model's savage roasts drift into nonsense
            check=lambda raw: check_roast(raw, allowed),
            fallback=lambda: rules.roast(context),
        )
        return AIReply(text=text, provider=provider, fallback=fb, latency_ms=ms)

    async def monthly_report(self, user_id: int, summary: FinancialSummary) -> MonthlyReport:
        self._limiter.check(user_id)
        allowed = _summary_numbers(summary)
        data, provider, fb, _ = await self._answer(
            "monthly_report",
            user_id,
            self._prompts.monthly_report(summary),
            max_tokens=350,
            temperature=0.5,
            json_mode=True,
            check=lambda raw: check_report(raw, allowed),
            fallback=lambda: rules.report(summary),
        )
        return MonthlyReport(
            month=summary.month,
            top_categories=sorted(summary.categories, key=lambda c: c.spent, reverse=True)[:3],
            biggest_expenses=sorted(summary.top_expenses, key=lambda e: e.amount, reverse=True)[:3],
            provider=provider,
            fallback=fb,
            **data,
        )

    async def parse_entry(
        self, user_id: int, text: str, categories: list[str]
    ) -> ParsedEntry | None:
        self._limiter.check(user_id)
        # The amount is always parsed in code; the model only picks kind, category and note.
        amount = parse_amount(text)
        if amount is None:
            return None
        by_lower = {c.lower(): c for c in categories}

        def check(raw: str) -> dict[str, str]:
            data = parse_json(raw, ["kind", "category", "note"])
            category = by_lower.get(data["category"].strip().lower())
            if data["kind"] not in ("expense", "income") or category is None:
                raise OutputRejectedError(f"unknown kind/category: {data}")
            return {"kind": data["kind"], "category": category, "note": data["note"].strip()}

        def fallback() -> dict[str, str]:
            return {
                "kind": rules.guess_kind(text),
                "category": rules.guess_category(text, categories),
                "note": rules.entry_note(text),
            }

        data, provider, _, _ = await self._answer(
            "quick_entry",
            user_id,
            self._prompts.quick_entry(text, categories),
            max_tokens=100,
            temperature=0.0,
            json_mode=True,
            check=check,
            fallback=fallback,
        )
        return ParsedEntry(amount=amount, provider=provider, **data)

    async def health(self) -> dict[str, Any]:
        return {
            "chain": self._chain,
            "providers": {p.name: await p.ping() for p in self._providers},
        }
