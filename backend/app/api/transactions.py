import csv
import io
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import column
from sqlmodel import Session, select

from app.ai import AIService, RoastCandidate, Tone, TxRecord, detect_roast, get_ai_service
from app.db import engine, get_session
from app.models import AIMessage, Budget, Category, Transaction, User
from app.schemas.transactions import (
    TransactionCreate,
    TransactionCreated,
    TransactionPatch,
    TransactionRead,
)
from app.security import CurrentUser
from app.services.months import current_month, month_bounds

router = APIRouter()


def _owned_transaction(session: Session, user_id: int, transaction_id: int) -> Transaction:
    transaction = session.exec(
        select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user_id)
    ).first()
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


def _owned_category(session: Session, user_id: int, category_id: int) -> Category:
    category = session.exec(
        select(Category).where(Category.id == category_id, Category.user_id == user_id)
    ).first()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


def _record(tx: Transaction, category: Category) -> TxRecord:
    return TxRecord(
        kind=tx.kind, amount=tx.amount, category=category.name, day=tx.date, note=tx.note
    )


async def _run_roast(user_id: int, candidate: RoastCandidate, ai: AIService) -> None:
    reply = await ai.roast(user_id, candidate.context)
    with Session(engine) as session:
        session.add(
            AIMessage(
                user_id=user_id,
                kind="roast",
                trigger_name=candidate.context.trigger.value,
                tone=candidate.context.tone.value,
                category=candidate.context.category,
                text=reply.text,
                provider=reply.provider,
                roast_key=candidate.key,
            )
        )
        session.commit()


def _detect_candidate(
    session: Session, user: User, transaction: Transaction, new_category: Category
) -> RoastCandidate | None:
    start = transaction.date - timedelta(days=35)
    history = session.exec(
        select(Transaction)
        .where(
            Transaction.user_id == user.id,
            Transaction.date >= start,
            Transaction.date <= transaction.date,
        )
        .order_by(column("date"), column("id"))
    ).all()
    categories = {
        category.id: category.name
        for category in session.exec(select(Category).where(Category.user_id == user.id)).all()
    }
    recent = [
        _record(
            tx,
            Category(
                id=tx.category_id, user_id=user.id, name=categories[tx.category_id], kind=tx.kind
            ),
        )
        for tx in history
        if tx.id != transaction.id and tx.category_id in categories
    ]
    recent.append(_record(transaction, new_category))

    month = transaction.date.strftime("%Y-%m")
    budgets = session.exec(
        select(Budget).where(Budget.user_id == user.id, Budget.month == month)
    ).all()
    category_budgets = {
        categories[budget.category_id]: budget.limit
        for budget in budgets
        if budget.category_id in categories
    }
    total_budget = next((budget.limit for budget in budgets if budget.category_id is None), None)
    month_start, _ = month_bounds(month)
    month_start_utc = datetime.combine(month_start, datetime.min.time(), UTC)
    fired = session.exec(
        select(AIMessage.roast_key).where(
            AIMessage.user_id == user.id,
            column("roast_key").is_not(None),
            AIMessage.created_at >= month_start_utc,
        )
    ).all()
    return detect_roast(
        recent[-1],
        recent,
        budgets=category_budgets,
        total_budget=total_budget,
        tone=Tone(user.roast_tone),
        fired=(key for key in fired if key is not None),
    )


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
    month: str = Query(default_factory=current_month, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
) -> list[Transaction]:
    start, end = month_bounds(month)
    return list(
        session.exec(
            select(Transaction)
            .where(
                Transaction.user_id == user.id,
                Transaction.date >= start,
                Transaction.date <= end,
            )
            .order_by(column("date").desc(), column("id").desc())
        ).all()
    )


@router.post("", response_model=TransactionCreated, status_code=201)
async def create_transaction(
    body: TransactionCreate,
    background: BackgroundTasks,
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
    ai: Annotated[AIService, Depends(get_ai_service)],
) -> TransactionCreated:
    return save_transaction(session, user, body, background, ai)


def save_transaction(
    session: Session,
    user: User,
    body: TransactionCreate,
    background: BackgroundTasks,
    ai: AIService,
) -> TransactionCreated:
    """Save a transaction and queue its roast. Shared by the form and the advisor chat."""
    category = _owned_category(session, user.id, body.category_id)
    if category.kind != body.kind:
        raise HTTPException(status_code=422, detail="Transaction kind must match category kind")
    transaction = Transaction(user_id=user.id, **body.model_dump())
    session.add(transaction)
    session.commit()
    session.refresh(transaction)

    candidate = (
        _detect_candidate(session, user, transaction, category)
        if user.roast_enabled and transaction.kind == "expense"
        else None
    )
    if candidate is not None:
        background.add_task(_run_roast, user.id, candidate, ai)
    return TransactionCreated(transaction=transaction, roast_pending=candidate is not None)


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: int,
    body: TransactionPatch,
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> Transaction:
    transaction = _owned_transaction(session, user.id, transaction_id)
    data = body.model_dump(exclude_unset=True)
    category_id = data.get("category_id", transaction.category_id)
    kind = data.get("kind", transaction.kind)
    category = _owned_category(session, user.id, category_id)
    if category.kind != kind:
        raise HTTPException(status_code=422, detail="Transaction kind must match category kind")
    for field, value in data.items():
        setattr(transaction, field, value)
    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int,
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> None:
    transaction = _owned_transaction(session, user.id, transaction_id)
    session.delete(transaction)
    session.commit()


@router.get("/export")
def export_transactions(
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
    month: str = Query(default_factory=current_month, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
) -> StreamingResponse:
    start, end = month_bounds(month)
    transactions = session.exec(
        select(Transaction)
        .where(
            Transaction.user_id == user.id,
            Transaction.date >= start,
            Transaction.date <= end,
        )
        .order_by(column("date"), column("id"))
    ).all()
    categories = {
        category.id: category.name
        for category in session.exec(select(Category).where(Category.user_id == user.id)).all()
    }
    stream = io.StringIO(newline="")
    writer = csv.writer(stream)
    writer.writerow(["date", "kind", "category", "amount", "note"])
    for tx in transactions:
        values = [
            tx.date.isoformat(),
            tx.kind,
            categories.get(tx.category_id, ""),
            str(tx.amount),
            tx.note or "",
        ]
        writer.writerow([_safe_csv_cell(value) for value in values])
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="walletwarden-{month}.csv"'},
    )


def _safe_csv_cell(value: str) -> str:
    if value.lstrip(" \t\r\n").startswith(("=", "+", "-", "@")):
        return f"'{value}"
    return value
