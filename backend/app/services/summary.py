from datetime import date

from sqlalchemy import column
from sqlmodel import Session, select

from app.ai import CategorySummary, ExpenseItem, FinancialSummary
from app.models import Budget, Category, Transaction
from app.services.months import month_bounds, previous_month


def _month_transactions(session: Session, user_id: int, month: str) -> list[Transaction]:
    start, end = month_bounds(month)
    return list(
        session.exec(
            select(Transaction)
            .where(
                Transaction.user_id == user_id,
                Transaction.date >= start,
                Transaction.date <= end,
            )
            .order_by(column("date"), column("id"))
        ).all()
    )


def build_month_summary(session: Session, user_id: int, month: str) -> FinancialSummary:
    transactions = _month_transactions(session, user_id, month)
    income = sum(tx.amount for tx in transactions if tx.kind == "income")
    expense = sum(tx.amount for tx in transactions if tx.kind == "expense")

    budgets = session.exec(
        select(Budget).where(Budget.user_id == user_id, Budget.month == month)
    ).all()
    total_budget = next((budget.limit for budget in budgets if budget.category_id is None), None)
    category_budgets = {
        budget.category_id: budget.limit for budget in budgets if budget.category_id is not None
    }
    categories = session.exec(select(Category).where(Category.user_id == user_id)).all()
    category_names = {category.id: category.name for category in categories}

    spent_by_category: dict[int, int] = {}
    for tx in transactions:
        if tx.kind == "expense":
            spent_by_category[tx.category_id] = spent_by_category.get(tx.category_id, 0) + tx.amount

    category_summaries = [
        CategorySummary(
            name=category.name,
            spent=spent_by_category.get(category.id, 0),
            budget=category_budgets.get(category.id),
            usage_pct=(
                round(spent_by_category.get(category.id, 0) * 100 / category_budgets[category.id])
                if category_budgets.get(category.id)
                else None
            ),
        )
        for category in categories
        if category.kind == "expense"
    ]

    prior_month = previous_month(month)
    previous_expense = sum(
        tx.amount
        for tx in _month_transactions(session, user_id, prior_month)
        if tx.kind == "expense"
    )
    now = date.today()
    selected_year, selected_number = (int(value) for value in month.split("-"))
    month_end = month_bounds(month)[1]
    days_left = (
        max(0, (month_end - now).days)
        if (selected_year, selected_number) == (now.year, now.month)
        else 0
    )

    return FinancialSummary(
        month=month,
        days_left=days_left,
        income=income,
        expense=expense,
        balance=income - expense,
        total_budget=total_budget,
        total_usage_pct=round(expense * 100 / total_budget) if total_budget else None,
        categories=category_summaries,
        top_expenses=[
            ExpenseItem(
                category=category_names.get(tx.category_id, "Khác"),
                amount=tx.amount,
                day=tx.date,
            )
            for tx in sorted(
                (tx for tx in transactions if tx.kind == "expense"),
                key=lambda tx: tx.amount,
                reverse=True,
            )[:5]
        ],
        previous_month_expense=previous_expense,
        change_vs_previous_pct=(
            round((expense - previous_expense) * 100 / previous_expense)
            if previous_expense
            else None
        ),
    )
