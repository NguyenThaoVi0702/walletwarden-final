from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.db import get_session
from app.models import Category, Transaction
from app.schemas.budgets import (
    DashboardCategory,
    DashboardDay,
    DashboardDayCategory,
    DashboardResponse,
)
from app.security import CurrentUser
from app.services.months import current_month, month_bounds

router = APIRouter()


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
    month: str = Query(default_factory=current_month, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
) -> DashboardResponse:
    start, end = month_bounds(month)
    transactions = session.exec(
        select(Transaction).where(
            Transaction.user_id == user.id,
            Transaction.date >= start,
            Transaction.date <= end,
        )
    ).all()
    names = {
        category.id: category.name
        for category in session.exec(select(Category).where(Category.user_id == user.id)).all()
    }
    income = sum(tx.amount for tx in transactions if tx.kind == "income")
    expense = sum(tx.amount for tx in transactions if tx.kind == "expense")
    by_category: dict[int, int] = defaultdict(int)
    daily: dict[str, dict[str, int]] = defaultdict(lambda: {"income": 0, "expense": 0})
    daily_by_category: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    for tx in transactions:
        day = tx.date.isoformat()
        daily[day][tx.kind] += tx.amount
        if tx.kind == "expense":
            by_category[tx.category_id] += tx.amount
            daily_by_category[day][tx.category_id] += tx.amount
    return DashboardResponse(
        month=month,
        income=income,
        expense=expense,
        balance=income - expense,
        by_category=[
            DashboardCategory(
                category_id=category_id,
                name=names.get(category_id, "Khác"),
                amount=amount,
            )
            for category_id, amount in sorted(
                by_category.items(), key=lambda item: item[1], reverse=True
            )
        ],
        daily=[
            DashboardDay(
                date=day,
                income=values["income"],
                expense=values["expense"],
                categories=[
                    DashboardDayCategory(category_id=category_id, amount=amount)
                    for category_id, amount in sorted(
                        daily_by_category[day].items(), key=lambda item: item[1], reverse=True
                    )
                ],
            )
            for day, values in sorted(daily.items())
        ],
    )
