from datetime import date, timedelta

import pytest

from app.ai import rules
from app.ai.guard import check_roast
from app.ai.interface import RoastCandidate, RoastTrigger, Tone, TxRecord
from app.ai.prompts import PromptBuilder
from app.ai.service import _roast_numbers
from app.ai.triggers import detect_roast
from app.config import Settings

TODAY = date(2026, 11, 14)


def tx(
    amount: int, category: str = "Ăn uống", days_ago: int = 0, kind: str = "expense"
) -> TxRecord:
    return TxRecord(kind=kind, amount=amount, category=category, day=TODAY - timedelta(days_ago))  # type: ignore[arg-type]


def run(
    new: TxRecord,
    history: list[TxRecord],
    budgets: dict[str, int] | None = None,
    total: int | None = None,
    fired: tuple[str, ...] = (),
) -> RoastCandidate | None:
    return detect_roast(
        new,
        [*history, new],
        budgets=budgets or {},
        total_budget=total,
        tone=Tone.SAVAGE,
        fired=fired,
    )


def trigger(c: RoastCandidate | None) -> RoastTrigger | None:
    return c.context.trigger if c else None


def test_ate_more_today_than_yesterday() -> None:
    # The example from the team: 300k on food yesterday, 500k today.
    c = run(tx(250_000), [tx(300_000, days_ago=1), tx(250_000)])
    assert trigger(c) == RoastTrigger.DAILY_SPIKE
    assert c and (c.context.spent, c.context.previous_spent) == (500_000, 300_000)


def test_no_spike_when_yesterday_was_small_or_today_is_not_much_more() -> None:
    assert run(tx(500_000), [tx(50_000, days_ago=1)]) is None
    assert run(tx(350_000), [tx(300_000, days_ago=1)]) is None


def test_third_bubble_tea_today() -> None:
    c = run(tx(45_000), [tx(45_000), tx(50_000)])
    assert trigger(c) == RoastTrigger.REPEAT_TODAY and c and c.context.count == 3


def test_small_purchases_add_up() -> None:
    history = [tx(45_000, days_ago=d) for d in range(1, 8)]  # 7 earlier, the new one is the 8th
    c = run(tx(45_000), history)
    assert trigger(c) == RoastTrigger.SMALL_HABIT
    assert c and (c.context.count, c.context.spent) == (8, 360_000)


def test_shopping_four_days_in_a_row() -> None:
    history = [tx(150_000, "Mua sắm", days_ago=d) for d in (1, 2, 3)]
    c = run(tx(150_000, "Mua sắm"), history)
    assert trigger(c) == RoastTrigger.SPENDING_STREAK and c and c.context.count == 4


def test_payday_splurge() -> None:
    salary = tx(10_000_000, "Lương", days_ago=2, kind="income")
    c = run(tx(1_500_000, "Mua sắm"), [salary, tx(2_800_000, "Mua sắm", days_ago=1)])
    assert trigger(c) == RoastTrigger.PAYDAY_SPLURGE
    assert c and (c.context.income, c.context.spent, c.context.usage_pct) == (
        10_000_000,
        4_300_000,
        43,
    )


def test_spending_passes_income_beats_everything_else() -> None:
    history = [
        tx(4_000_000, "Lương", days_ago=13, kind="income"),
        tx(3_900_000, "Mua sắm", days_ago=5),
    ]
    c = run(tx(200_000), history, budgets={"Ăn uống": 150_000})
    assert trigger(c) == RoastTrigger.OVER_INCOME and c and c.context.category is None


def test_budget_crossing_and_priority() -> None:
    history = [tx(1_900_000, days_ago=3)]
    c = run(tx(150_000), history, budgets={"Ăn uống": 2_500_000})
    assert trigger(c) == RoastTrigger.BUDGET_80 and c and c.context.usage_pct == 82
    c = run(tx(700_000), history, budgets={"Ăn uống": 2_500_000})
    assert trigger(c) == RoastTrigger.BUDGET_100
    # Already above 80% before this transaction: no new 80% alert.
    assert run(tx(10_000), [tx(2_100_000, days_ago=3)], budgets={"Ăn uống": 2_500_000}) is None


def test_large_expense_needs_history() -> None:
    history = [tx(100_000, "Khác", days_ago=d) for d in range(1, 6)]
    assert trigger(run(tx(400_000, "Mua sắm"), history)) == RoastTrigger.LARGE_EXPENSE
    assert run(tx(400_000, "Mua sắm"), history[:3]) is None


def test_burn_rate() -> None:
    # Day 14, 3.5M of a 6M month budget gone (58%): at this pace it lasts ~10 days, 16 left.
    c = run(tx(100_000, "Khác"), [tx(3_400_000, "Khác", days_ago=5)], total=6_000_000)
    assert trigger(c) == RoastTrigger.BURN_RATE
    assert c and c.context.days_until_empty == 10 and c.context.days_left == 16


def test_fired_keys_are_not_repeated() -> None:
    first = run(tx(45_000), [tx(45_000), tx(50_000)])
    assert first is not None
    assert run(tx(45_000), [tx(45_000), tx(50_000)], fired=(first.key,)) is None


def test_income_and_fixed_costs_are_not_roasted_for_habits() -> None:
    assert run(tx(8_000_000, "Lương", kind="income"), []) is None
    assert run(tx(300_000, "Sức khỏe"), [tx(200_000, "Sức khỏe", days_ago=1)]) is None
    assert (
        run(tx(800_000, "Hóa đơn"), [tx(300_000, "Hóa đơn", days_ago=1), tx(1, "Hóa đơn")]) is None
    )


SAMPLES = {
    RoastTrigger.DAILY_SPIKE: run(tx(250_000), [tx(300_000, days_ago=1), tx(250_000)]),
    RoastTrigger.REPEAT_TODAY: run(tx(45_000), [tx(45_000), tx(50_000)]),
    RoastTrigger.SMALL_HABIT: run(tx(45_000), [tx(45_000, days_ago=d) for d in range(1, 8)]),
    RoastTrigger.SPENDING_STREAK: run(
        tx(150_000, "Mua sắm"), [tx(150_000, "Mua sắm", days_ago=d) for d in (1, 2, 3)]
    ),
    RoastTrigger.PAYDAY_SPLURGE: run(
        tx(1_500_000, "Mua sắm"),
        [tx(10_000_000, "Lương", days_ago=2, kind="income"), tx(2_800_000, "Mua sắm", days_ago=1)],
    ),
    RoastTrigger.OVER_INCOME: run(
        tx(200_000),
        [tx(4_000_000, "Lương", days_ago=13, kind="income"), tx(3_900_000, "Mua sắm", days_ago=5)],
    ),
    RoastTrigger.BURN_RATE: run(
        tx(100_000, "Khác"), [tx(3_400_000, "Khác", days_ago=5)], total=6_000_000
    ),
}


@pytest.mark.parametrize("tone", list(Tone))
@pytest.mark.parametrize("trig", list(SAMPLES))
def test_new_triggers_have_safe_rule_roasts_and_prompts(
    tone: Tone, trig: RoastTrigger, settings: Settings
) -> None:
    cand = SAMPLES[trig]
    assert cand is not None and cand.context.trigger == trig
    ctx = cand.context.model_copy(update={"tone": tone})
    text = rules.roast(ctx)
    assert check_roast(text, _roast_numbers(ctx)) == text
    prompt = PromptBuilder(settings.prompts_dir).roast(ctx)[1]["content"]
    assert "Sự kiện:" in prompt and "None" not in prompt
