from sqlmodel import Session, select

from app.models import Budget, Category, Transaction
from app.schemas.budgets import BudgetLine, BudgetStatus
from app.services.months import month_bounds


def build_budget_status(session: Session, user_id: int, month: str) -> BudgetStatus:
    start, end = month_bounds(month)
    budgets = session.exec(
        select(Budget).where(Budget.user_id == user_id, Budget.month == month)
    ).all()
    categories = {
        category.id: category
        for category in session.exec(select(Category).where(Category.user_id == user_id)).all()
    }
    transactions = session.exec(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.kind == "expense",
            Transaction.date >= start,
            Transaction.date <= end,
        )
    ).all()
    spent_by_category: dict[int, int] = {}
    for transaction in transactions:
        spent_by_category[transaction.category_id] = (
            spent_by_category.get(transaction.category_id, 0) + transaction.amount
        )
    total_spent = sum(transaction.amount for transaction in transactions)
    total_budget = next((budget for budget in budgets if budget.category_id is None), None)

    def line(category_id: int | None, limit: int, spent: int, name: str | None) -> BudgetLine:
        return BudgetLine(
            category_id=category_id,
            name=name,
            limit=limit,
            spent=spent,
            usage_pct=round(spent * 100 / limit),
        )

    return BudgetStatus(
        month=month,
        total=(
            line(None, total_budget.limit, total_spent, None) if total_budget is not None else None
        ),
        categories=[
            line(
                budget.category_id,
                budget.limit,
                spent_by_category.get(budget.category_id, 0),
                categories[budget.category_id].name,
            )
            for budget in budgets
            if budget.category_id is not None and budget.category_id in categories
        ],
    )
