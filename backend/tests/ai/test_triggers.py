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
    prompt = PromptBuilder(settings.prompts_dir).roast(ctx)[-1]["content"]
    assert "Sự kiện:" in prompt and "None" not in prompt


def test_note_of_the_new_transaction_becomes_the_roast_item(settings: Settings) -> None:
    new = tx(350_000, "Giải trí").model_copy(update={"note": "vé concert"})
    c = run(new, [tx(700_000, "Giải trí", days_ago=4)], budgets={"Giải trí": 800_000})
    assert c and c.context.trigger == RoastTrigger.BUDGET_100 and c.context.item == "vé concert"
    prompt = PromptBuilder(settings.prompts_dir).roast(c.context)[-1]["content"]
    assert "Món vừa mua: vé concert" in prompt
    history = [tx(700_000, "Giải trí", days_ago=4)]
    no_note = run(tx(350_000, "Giải trí"), history, {"Giải trí": 800_000})
    assert (
        no_note
        and "không rõ (đừng đoán)"
        in PromptBuilder(settings.prompts_dir).roast(no_note.context)[-1]["content"]
    )


def test_paying_the_full_rent_is_not_a_roast() -> None:
    assert run(tx(4_500_000, "Nhà ở"), [], budgets={"Nhà ở": 4_500_000}) is None
    over = run(tx(4_800_000, "Nhà ở"), [], budgets={"Nhà ở": 4_500_000})
    assert trigger(over) == RoastTrigger.BUDGET_100
    assert over and "Ngân sách chỉ là gợi ý" not in rules.roast(over.context)


def test_rent_does_not_count_as_burning_money() -> None:
    assert run(tx(4_500_000, "Nhà ở"), [], budgets={"Nhà ở": 4_500_000}, total=8_000_000) is None
    c = run(tx(100_000, "Khác"), [tx(4_500_000, "Nhà ở", days_ago=13)], total=8_000_000)
    assert c is None


@pytest.mark.parametrize(
    ("note", "item"),
    [("mua giày", "giày"), ("ăn lẩu tối", "lẩu tối"), ("vé concert", "vé concert"), ("", None)],
)
def test_roast_item_drops_the_leading_verb(note: str, item: str | None) -> None:
    new = tx(45_000).model_copy(update={"note": note})
    c = run(new, [tx(45_000), tx(50_000)])
    assert c and c.context.item == item


def test_roast_examples_only_use_their_own_numbers(settings: Settings) -> None:
    from app.ai.formatting import big_numbers
    from app.ai.guard import check_roast
    from app.ai.prompts import roast_examples

    examples = roast_examples(settings.prompts_dir)
    assert set(examples) == {t.value for t in Tone}
    for tone_examples in examples.values():
        for e in tone_examples:
            assert big_numbers(e.reply) <= _roast_numbers(e.context), e.reply
            check_roast(e.reply, _roast_numbers(e.context), e.context.item, e.context.amount)


def test_roast_prompt_puts_same_trigger_example_first(settings: Settings) -> None:
    cand = SAMPLES[RoastTrigger.DAILY_SPIKE]
    assert cand is not None
    msgs = PromptBuilder(settings.prompts_dir).roast(cand.context)
    roles = [m["role"] for m in msgs]
    assert roles == ["system", *["user", "assistant"] * 3, "user"]
    assert "hôm qua" in msgs[1]["content"].lower() and "bánh tráng trộn" in msgs[1]["content"]
