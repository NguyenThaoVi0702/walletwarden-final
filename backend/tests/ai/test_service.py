import json
from pathlib import Path

import pytest

from app.ai import rules
from app.ai.formatting import big_numbers
from app.ai.guard import check_roast
from app.ai.interface import (
    AdviceRequest,
    AIRateLimitError,
    FinancialSummary,
    RoastContext,
    RoastTrigger,
    Tone,
)
from app.ai.prompts import PromptBuilder, summary_facts
from app.ai.providers.base import ProviderError
from app.ai.service import _roast_numbers, _summary_numbers
from app.config import Settings

from .conftest import ScriptedProvider

CATEGORIES = ["Ăn uống", "Di chuyển", "Mua sắm", "Lương", "Khác"]


async def test_fake_mode_answers_without_any_model(make_service, summary, roast_ctx) -> None:  # type: ignore[no-untyped-def]
    ai = make_service()
    reply = await ai.advise(1, AdviceRequest(summary=summary, question="Tháng này thế nào?"))
    assert reply.provider == "fake" and not reply.fallback and reply.text
    roast = await ai.roast(1, roast_ctx)
    assert roast.provider == "fake" and "82%" in roast.text


async def test_first_provider_answers(make_service, roast_ctx) -> None:  # type: ignore[no-untyped-def]
    local = ScriptedProvider("local", ["Ví bạn đang khóc. Nấu cơm ở nhà tuần này."])
    reply = await make_service(local).roast(1, roast_ctx)
    assert reply.provider == "local" and not reply.fallback


async def test_falls_back_to_gemini_then_rules(make_service, roast_ctx) -> None:  # type: ignore[no-untyped-def]
    local = ScriptedProvider("local", [ProviderError("down")])
    gemini = ScriptedProvider("gemini", ["Ổn thôi. Bớt ăn ngoài nhé."])
    reply = await make_service(local, gemini).roast(1, roast_ctx)
    assert (reply.provider, reply.fallback) == ("gemini", True)

    local = ScriptedProvider("local", [ProviderError("down")])
    gemini = ScriptedProvider("gemini", [ProviderError("quota")])
    reply = await make_service(local, gemini).roast(1, roast_ctx)
    assert (reply.provider, reply.fallback) == ("rules", True)


async def test_rejected_output_is_never_shown(make_service, roast_ctx) -> None:  # type: ignore[no-untyped-def]
    local = ScriptedProvider("local", ["Bạn ngu thật. Đừng tiêu nữa."])
    reply = await make_service(local).roast(1, roast_ctx)
    assert reply.provider == "rules" and "ngu" not in reply.text


async def test_calls_are_logged(make_service, roast_ctx, tmp_path: Path) -> None:  # type: ignore[no-untyped-def]
    await make_service(ScriptedProvider("local", [ProviderError("down")])).roast(7, roast_ctx)
    record = json.loads((tmp_path / "ai.jsonl").read_text(encoding="utf-8").splitlines()[-1])
    assert record["task"] == "roast_savage" and record["user_id"] == 7
    assert record["fallback"] is True and record["errors"]


async def test_rate_limit(make_service, summary) -> None:  # type: ignore[no-untyped-def]
    ai = make_service()
    req = AdviceRequest(summary=summary, question="?")
    for _ in range(5):
        await ai.advise(1, req)
    with pytest.raises(AIRateLimitError):
        await ai.advise(1, req)
    await ai.advise(2, req)  # other users are not affected


async def test_monthly_report_uses_code_numbers(make_service, summary) -> None:  # type: ignore[no-untyped-def]
    local = ScriptedProvider(
        "local",
        ['{"headline": "Tháng chi hơi tay", "commentary": "Ăn uống 2.700.000đ.", '
         '"saving_tip": "Nấu ăn 3 bữa/tuần."}'],
    )  # fmt: skip
    report = await make_service(local).monthly_report(1, summary)
    assert report.provider == "local"
    assert [c.name for c in report.top_categories] == ["Ăn uống", "Mua sắm", "Di chuyển"]
    assert report.biggest_expenses[0].amount == 1_500_000


async def test_parse_entry(make_service) -> None:  # type: ignore[no-untyped-def]
    local = ScriptedProvider(
        "local",
        ['{"kind": "expense", "category": "ăn uống", "note": "trà sữa"}',
         '{"kind": "expense", "category": "Không tồn tại", "note": "x"}'],
    )  # fmt: skip
    ai = make_service(local)
    entry = await ai.parse_entry(1, "trà sữa 45k", CATEGORIES)
    assert entry and (entry.amount, entry.category, entry.provider) == (45_000, "Ăn uống", "local")
    entry = await ai.parse_entry(1, "grab đi làm 35k", CATEGORIES)
    assert entry and (entry.category, entry.provider) == ("Di chuyển", "rules")
    assert await ai.parse_entry(1, "không có số tiền", CATEGORIES) is None


@pytest.mark.parametrize(
    ("text", "kind", "category"),
    [
        ("nhận lương 8tr", "income", "Lương"),
        ("cơm trưa 45k", "expense", "Ăn uống"),
        ("shopee 300k", "expense", "Mua sắm"),
        ("linh tinh 20k", "expense", "Khác"),
    ],
)
def test_rules_quick_entry(text: str, kind: str, category: str) -> None:
    assert rules.guess_kind(text) == kind
    assert rules.guess_category(text, CATEGORIES) == category


@pytest.mark.parametrize("tone", list(Tone))
@pytest.mark.parametrize(
    "trigger", [RoastTrigger.BUDGET_80, RoastTrigger.BUDGET_100, RoastTrigger.LARGE_EXPENSE]
)  # the other triggers are covered with realistic contexts in test_triggers.py
def test_rule_roasts_pass_their_own_checks(tone: Tone, trigger: RoastTrigger) -> None:
    ctx = RoastContext(
        trigger=trigger,
        tone=tone,
        category=None if trigger == RoastTrigger.BUDGET_100 else "Ăn uống",
        amount=1_200_000,
        spent=6_300_000 if trigger == RoastTrigger.BUDGET_100 else 2_100_000,
        budget=6_000_000 if trigger == RoastTrigger.BUDGET_100 else 2_500_000,
        usage_pct=105 if trigger == RoastTrigger.BUDGET_100 else 84,
        average_expense=150_000,
        days_left=9,
    )
    text = rules.roast(ctx)
    assert check_roast(text, _roast_numbers(ctx)) == text


def test_all_prompts_render(settings: Settings, summary: FinancialSummary, roast_ctx) -> None:  # type: ignore[no-untyped-def]
    p = PromptBuilder(settings.prompts_dir)
    advice = p.advice(AdviceRequest(summary=summary, question="Mua điện thoại 2 triệu được không?"))
    assert "5.400.000đ" in advice[1]["content"] and advice[-1]["role"] == "user"
    for tone in Tone:
        msgs = p.roast(roast_ctx.model_copy(update={"tone": tone}))
        assert tone.value in msgs[0]["content"] and "2.500.000đ" in msgs[-1]["content"]
    assert "JSON" in p.monthly_report(summary)[0]["content"]
    assert "Mua sắm" in p.quick_entry("áo 200k", CATEGORIES)[0]["content"]


def test_summary_facts_decide_comparisons(summary: FinancialSummary) -> None:
    f = summary_facts(summary, "Mua điện thoại 2 triệu được không?")
    assert f.budget_left == 600_000
    assert [c.name for c in f.over] == ["Ăn uống"]
    assert [c.name for c in f.within] == ["Di chuyển"]
    assert [c.name for c in f.no_budget] == ["Mua sắm"]
    assert f.vs_previous == "nhiều hơn"
    assert (f.price, f.price_vs_balance, f.price_vs_budget) == (2_000_000, True, False)


def test_prompt_numbers_pass_the_guard(settings: Settings, summary: FinancialSummary) -> None:
    # Every amount the prompt shows must be one the output guard accepts, or the model
    # would get rejected for repeating it.
    p = PromptBuilder(settings.prompts_dir)
    text = p.monthly_report(summary)[1]["content"]
    assert "Ăn uống: đã chi 2.700.000đ" in text and "vượt 200.000đ" in text
    year = int(summary.month[:4])
    assert big_numbers(text) - {year} <= _summary_numbers(summary)


def test_fixed_cost_roast_gets_a_fairness_note(settings: Settings, roast_ctx) -> None:  # type: ignore[no-untyped-def]
    p = PromptBuilder(settings.prompts_dir)
    rent = roast_ctx.model_copy(update={"category": "Nhà ở"})
    assert "chi phí cố định" in p.roast(rent)[-1]["content"]
    assert "chi phí cố định" not in p.roast(roast_ctx)[-1]["content"]
