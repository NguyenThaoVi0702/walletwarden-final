from datetime import date

import pytest
from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine

from app.models import Budget, Category, Transaction, User
from app.services.months import month_bounds, previous_month
from app.services.summary import build_month_summary


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db_session:
        yield db_session
    engine.dispose()


def test_month_helpers_validate_and_roll_over() -> None:
    assert month_bounds("2024-02") == (date(2024, 2, 1), date(2024, 2, 29))
    assert previous_month("2026-01") == "2025-12"
    with pytest.raises(HTTPException) as error:
        month_bounds("2026-13")
    assert error.value.status_code == 422


def test_month_summary_aggregates_server_calculated_values(session: Session) -> None:
    user = User(email="summary@example.com", password_hash="hash", display_name="Summary")
    session.add(user)
    session.commit()
    session.refresh(user)
    food = Category(user_id=user.id, name="Food", kind="expense")
    salary = Category(user_id=user.id, name="Salary", kind="income")
    session.add(food)
    session.add(salary)
    session.commit()
    session.refresh(food)
    session.refresh(salary)
    session.add_all(
        [
            Transaction(
                user_id=user.id,
                kind="expense",
                amount=1200,
                category_id=food.id,
                date=date(2026, 11, 2),
                note="private note",
            ),
            Transaction(
                user_id=user.id,
                kind="expense",
                amount=800,
                category_id=food.id,
                date=date(2026, 11, 3),
            ),
            Transaction(
                user_id=user.id,
                kind="income",
                amount=5000,
                category_id=salary.id,
                date=date(2026, 11, 3),
            ),
            Transaction(
                user_id=user.id,
                kind="expense",
                amount=1000,
                category_id=food.id,
                date=date(2026, 10, 3),
            ),
        ]
    )
    session.add_all(
        [
            Budget(user_id=user.id, month="2026-11", category_id=None, limit=4000),
            Budget(user_id=user.id, month="2026-11", category_id=food.id, limit=2000),
        ]
    )
    session.commit()

    summary = build_month_summary(session, user.id, "2026-11")
    assert summary.income == 5000
    assert summary.expense == 2000
    assert summary.balance == 3000
    assert summary.total_budget == 4000
    assert summary.total_usage_pct == 50
    assert summary.categories[0].usage_pct == 100
    assert summary.top_expenses[0].amount == 1200
    assert summary.previous_month_expense == 1000
    assert summary.change_vs_previous_pct == 100
    assert all(not hasattr(item, "note") for item in summary.top_expenses)
