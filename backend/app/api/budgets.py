from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import column
from sqlmodel import Session, delete, select

from app.db import get_session
from app.models import Budget, Category
from app.schemas.budgets import BudgetStatus, BudgetUpdate
from app.security import CurrentUser
from app.services.budgets import build_budget_status

router = APIRouter()


@router.get("", response_model=BudgetStatus)
def get_budgets(
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
    month: str = Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
) -> BudgetStatus:
    return build_budget_status(session, user.id, month)


@router.put("", response_model=BudgetStatus)
def put_budgets(
    body: BudgetUpdate,
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> BudgetStatus:
    category_ids = [item.category_id for item in body.categories]
    if len(category_ids) != len(set(category_ids)):
        raise HTTPException(status_code=422, detail="Duplicate category budget")
    if category_ids:
        owned = session.exec(
            select(Category).where(
                Category.user_id == user.id,
                column("id").in_(category_ids),
                Category.kind == "expense",
            )
        ).all()
        if len(owned) != len(category_ids):
            raise HTTPException(status_code=404, detail="Expense category not found")

    session.exec(
        delete(Budget).where(
            column("user_id") == user.id,
            column("month") == body.month,
        )
    )
    if body.total is not None:
        session.add(Budget(user_id=user.id, month=body.month, category_id=None, limit=body.total))
    for item in body.categories:
        session.add(
            Budget(
                user_id=user.id,
                month=body.month,
                category_id=item.category_id,
                limit=item.limit,
            )
        )
    session.commit()
    return build_budget_status(session, user.id, body.month)
