"""Decide automatically whether a new transaction deserves a roast, and which one.

Pure function, no database: the backend passes the new transaction plus the last
~35 days of transactions and the budgets, and gets back at most one roast. All
numbers are computed here, so the model only has to write the words.

    from app.ai import detect_roast
    cand = detect_roast(new_tx, recent, budgets={"Ăn uống": 2_500_000},
                        total_budget=6_000_000, tone=user.roast_tone, fired=keys_this_month)
    if cand:
        background.add_task(run_roast, user.id, cand.context)   # save cand.key with the alert
"""

import calendar
from collections.abc import Iterable
from datetime import date, timedelta

from app.ai.interface import RoastCandidate, RoastContext, RoastTrigger, Tone, TxRecord

# Spending the model should not mock: paying rent or tuition is not a bad habit.
FIXED_COST_CATEGORIES = frozenset({"Nhà ở", "Hóa đơn", "Giáo dục"})
# Never roasted for habits or spikes (budget alerts still apply).
_NO_HABIT_ROAST = FIXED_COST_CATEGORIES | {"Sức khỏe"}
# Categories where buying something every day is a streak worth mocking.
_STREAK_CATEGORIES = frozenset({"Mua sắm", "Giải trí"})
_PAYDAY_CATEGORIES = frozenset({"Lương", "Thưởng"})

SPIKE_RATIO = 1.5  # today >= 1.5x yesterday ...
SPIKE_MIN_TODAY = 200_000  # ... and today >= 200k ...
SPIKE_MIN_YESTERDAY = 100_000  # ... and yesterday was already >= 100k
REPEAT_MIN = 3  # 3rd purchase in the same category today
SMALL_MAX = 60_000  # a "small" purchase (trà sữa, cà phê, snack)
SMALL_MIN_COUNT = 8  # fires at 8, 16, 24 ... small purchases in a month
SMALL_MIN_TOTAL = 300_000
STREAK_MIN = 4  # days in a row
PAYDAY_WINDOW_DAYS = 3
PAYDAY_SHARE_PCT = 40  # 40% of the salary gone within the window
LARGE_RATIO = 3  # one expense > 3x the average
LARGE_MIN_HISTORY = 5
BURN_MIN_DAYS = 5  # need some history before projecting
BURN_MARGIN_DAYS = 3  # only when the money runs out clearly before month end

_TOTAL = "_total"


def _days_left(day: date) -> int:
    return calendar.monthrange(day.year, day.month)[1] - day.day


def _pct(part: int, whole: int) -> int:
    return round(part * 100 / whole)


def _sum(txs: Iterable[TxRecord]) -> int:
    return sum(t.amount for t in txs)


def detect_roast(
    new: TxRecord,
    recent: list[TxRecord],
    *,
    budgets: dict[str, int],
    total_budget: int | None,
    tone: Tone,
    fired: Iterable[str] = (),
) -> RoastCandidate | None:
    """Return the most important roast for `new`, or None.

    recent: transactions of the last ~35 days, INCLUDING `new`.
    budgets: monthly limit per category name (only categories that have one).
    fired: keys of roasts already sent this month; they are skipped.
    """
    if new.kind != "expense":
        return None
    used = set(fired)
    for cand in _candidates(new, recent, budgets, total_budget, tone):
        if cand.key not in used:
            return cand
    return None


def _candidates(
    new: TxRecord,
    recent: list[TxRecord],
    budgets: dict[str, int],
    total_budget: int | None,
    tone: Tone,
) -> Iterable[RoastCandidate]:
    """All roasts that apply, most important first. A generator: stops as soon as one is used."""
    today, cat = new.day, new.category
    month = f"{today:%Y-%m}"
    days_left = _days_left(today)
    this_month = [t for t in recent if (t.day.year, t.day.month) == (today.year, today.month)]
    expenses = [t for t in this_month if t.kind == "expense"]
    in_cat = [t for t in expenses if t.category == cat]

    def ctx(trigger: RoastTrigger, **kw: object) -> RoastContext:
        base: dict[str, object] = {
            "trigger": trigger, "tone": tone, "category": cat, "amount": new.amount,
            "days_left": days_left,
        }  # fmt: skip
        base.update(kw)
        return RoastContext.model_validate(base)

    # Budget scopes: the category budget, then the whole-month budget.
    scopes: list[tuple[str | None, int, int]] = []
    if budgets.get(cat):
        scopes.append((cat, _sum(in_cat), budgets[cat]))
    if total_budget:
        scopes.append((None, _sum(expenses), total_budget))

    def budget_cross(threshold: int, trigger: RoastTrigger) -> Iterable[RoastCandidate]:
        for scope, spent, limit in scopes:
            if _pct(spent - new.amount, limit) < threshold <= _pct(spent, limit):
                yield RoastCandidate(
                    key=f"{trigger}:{scope or _TOTAL}:{month}",
                    context=ctx(
                        trigger,
                        category=scope,
                        spent=spent,
                        budget=limit,
                        usage_pct=_pct(spent, limit),
                    ),  # fmt: skip
                )

    # 1. Spending passed income this month.
    income = _sum(t for t in this_month if t.kind == "income")
    month_spent = _sum(expenses)
    if income and month_spent - new.amount <= income < month_spent:
        yield RoastCandidate(
            key=f"{RoastTrigger.OVER_INCOME}:{month}",
            context=ctx(RoastTrigger.OVER_INCOME, category=None, spent=month_spent, income=income),
        )

    # 2. Budget fully used.
    yield from budget_cross(100, RoastTrigger.BUDGET_100)

    # 3. Salary just arrived and a big part is already gone.
    paydays = [
        t
        for t in recent
        if t.kind == "income"
        and t.category in _PAYDAY_CATEGORIES
        and 0 <= (today - t.day).days <= PAYDAY_WINDOW_DAYS
    ]
    if paydays:
        pay = max(paydays, key=lambda t: (t.day, t.amount))
        since = _sum(t for t in recent if t.kind == "expense" and t.day >= pay.day)
        if _pct(since - new.amount, pay.amount) < PAYDAY_SHARE_PCT <= _pct(since, pay.amount):
            yield RoastCandidate(
                key=f"{RoastTrigger.PAYDAY_SPLURGE}:{pay.day.isoformat()}",
                context=ctx(
                    RoastTrigger.PAYDAY_SPLURGE,
                    category=None,
                    spent=since,
                    income=pay.amount,
                    usage_pct=_pct(since, pay.amount),
                    count=(today - pay.day).days,
                ),  # fmt: skip
            )

    # 4. Budget at 80%.
    yield from budget_cross(80, RoastTrigger.BUDGET_80)

    habit_ok = cat not in _NO_HABIT_ROAST
    today_cat = [t for t in in_cat if t.day == today]
    today_spent = _sum(today_cat)

    # 5. Today much more than yesterday (e.g. ate 300k yesterday, 500k today).
    yesterday = today - timedelta(days=1)
    prev = _sum(
        t for t in recent if t.kind == "expense" and t.category == cat and t.day == yesterday
    )
    if (
        habit_ok
        and prev >= SPIKE_MIN_YESTERDAY
        and today_spent >= SPIKE_MIN_TODAY
        and today_spent >= prev * SPIKE_RATIO
    ):
        yield RoastCandidate(
            key=f"{RoastTrigger.DAILY_SPIKE}:{cat}:{today.isoformat()}",
            context=ctx(RoastTrigger.DAILY_SPIKE, spent=today_spent, previous_spent=prev),
        )

    # 6. One unusually large expense.
    history = [t for t in recent if t.kind == "expense"]
    if new in history:
        history.remove(new)  # the average is of the expenses *before* this one
    history = history[-30:]
    if len(history) >= LARGE_MIN_HISTORY:
        avg = max(1, _sum(history) // len(history))
        if new.amount > LARGE_RATIO * avg:
            yield RoastCandidate(
                key=f"{RoastTrigger.LARGE_EXPENSE}:{today.isoformat()}:{cat}:{new.amount}",
                context=ctx(RoastTrigger.LARGE_EXPENSE, spent=_sum(in_cat), average_expense=avg),
            )

    # 7. Third (or more) purchase in the same category today.
    if habit_ok and len(today_cat) >= REPEAT_MIN:
        yield RoastCandidate(
            key=f"{RoastTrigger.REPEAT_TODAY}:{cat}:{today.isoformat()}",
            context=ctx(RoastTrigger.REPEAT_TODAY, spent=today_spent, count=len(today_cat)),
        )

    # 8. Many small purchases adding up (the "latte factor").
    small = [t for t in in_cat if t.amount <= SMALL_MAX]
    if (
        habit_ok
        and new.amount <= SMALL_MAX
        and len(small) >= SMALL_MIN_COUNT
        and len(small) % SMALL_MIN_COUNT == 0
        and _sum(small) >= SMALL_MIN_TOTAL
    ):
        yield RoastCandidate(
            key=f"{RoastTrigger.SMALL_HABIT}:{cat}:{month}:{len(small)}",
            context=ctx(RoastTrigger.SMALL_HABIT, spent=_sum(small), count=len(small)),
        )

    # 9. Shopping / entertainment N days in a row.
    if cat in _STREAK_CATEGORIES:
        days_with = {t.day for t in recent if t.kind == "expense" and t.category == cat}
        streak = 0
        while today - timedelta(days=streak) in days_with:
            streak += 1
        if streak >= STREAK_MIN:
            first = today - timedelta(days=streak - 1)
            spent = _sum(
                t for t in recent if t.kind == "expense" and t.category == cat and t.day >= first
            )
            yield RoastCandidate(
                key=f"{RoastTrigger.SPENDING_STREAK}:{cat}:{today.isoformat()}",
                context=ctx(RoastTrigger.SPENDING_STREAK, spent=spent, count=streak),
            )

    # 10. At this pace the budget runs out well before the month ends.
    if today.day >= BURN_MIN_DAYS:
        for scope, spent, limit in scopes:
            if spent >= limit or _pct(spent, limit) >= 80:
                continue  # budget_80 / budget_100 cover these
            per_day = spent / today.day
            until_empty = int((limit - spent) / per_day) if per_day else days_left
            if until_empty + BURN_MARGIN_DAYS <= days_left:
                yield RoastCandidate(
                    key=f"{RoastTrigger.BURN_RATE}:{scope or _TOTAL}:{month}",
                    context=ctx(
                        RoastTrigger.BURN_RATE,
                        category=scope,
                        spent=spent,
                        budget=limit,
                        usage_pct=_pct(spent, limit),
                        days_until_empty=until_empty,
                    ),  # fmt: skip
                )
