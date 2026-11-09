import time
from datetime import date
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy import column
from sqlmodel import Session, select

from app.ai import (
    AdviceRequest,
    AIRateLimitError,
    AIService,
    MonthlyReport,
    ParsedEntry,
    entry_day,
    get_ai_service,
    is_entry_statement,
)
from app.ai.formatting import vnd
from app.api.transactions import save_transaction
from app.db import get_session
from app.models import AIMessage, Category, User
from app.schemas.ai import ChatIn, ChatReply, ParseIn, RoastAlert
from app.schemas.transactions import TransactionCreate
from app.security import CurrentUser
from app.services.months import current_month
from app.services.summary import build_month_summary

router = APIRouter()


def _rate_limit(error: AIRateLimitError) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail="Bạn hỏi hơi nhanh, thử lại sau ít giây",
        headers={"Retry-After": str(error.retry_after_s)},
    )


@router.post("/chat", response_model=ChatReply)
async def chat(
    body: ChatIn,
    background: BackgroundTasks,
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
    ai: Annotated[AIService, Depends(get_ai_service)],
) -> ChatReply:
    try:
        if is_entry_statement(body.question):
            logged = await _log_entry(body.question, background, user, session, ai)
            if logged is not None:
                return logged
        summary = build_month_summary(session, user.id, current_month())
        reply = await ai.advise(
            user.id,
            AdviceRequest(summary=summary, question=body.question, history=body.history),
        )
    except AIRateLimitError as error:
        raise _rate_limit(error) from error
    return ChatReply(**reply.model_dump())


async def _log_entry(
    text: str, background: BackgroundTasks, user: User, session: Session, ai: AIService
) -> ChatReply | None:
    """'Nay ăn bánh cuốn hết 50k' in the chat -> a real transaction, like the quick-entry form.
    Returns None (answer it as a normal question) when the amount or category cannot be read."""
    started = time.perf_counter()
    categories = session.exec(select(Category).where(Category.user_id == user.id)).all()
    parsed = await ai.parse_entry(user.id, text, [category.name for category in categories])
    if parsed is None:
        return None
    category = next(
        (c for c in categories if c.name == parsed.category and c.kind == parsed.kind), None
    )
    if category is None or category.id is None:
        return None
    day = entry_day(text, date.today())
    created = save_transaction(
        session,
        user,
        TransactionCreate(
            kind=parsed.kind,
            amount=parsed.amount,
            category_id=category.id,
            date=day,
            note=parsed.note or None,
        ),
        background,
        ai,
    )
    when = "hôm nay" if day == date.today() else day.strftime("%d/%m")
    label = "khoản chi" if parsed.kind == "expense" else "khoản thu"
    note = f" ({parsed.note})" if parsed.note else ""
    return ChatReply(
        text=(
            f"Đã ghi {label} {vnd(parsed.amount)} vào mục {category.name}{note}, {when}. "
            "Bạn xem lại trong trang Giao dịch nhé."
        ),
        provider=parsed.provider,
        fallback=False,
        latency_ms=round((time.perf_counter() - started) * 1000),
        transaction=created.transaction,
        roast_pending=created.roast_pending,
    )


@router.get("/alerts", response_model=list[RoastAlert])
def list_alerts(
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
    unread: bool = False,
) -> list[RoastAlert]:
    statement = select(AIMessage).where(AIMessage.user_id == user.id, AIMessage.kind == "roast")
    if unread:
        statement = statement.where(column("read").is_(False))
    messages = session.exec(statement.order_by(column("created_at").desc())).all()
    return [
        RoastAlert(
            id=message.id,
            created_at=message.created_at.isoformat(),
            trigger=message.trigger_name or "",
            tone=message.tone or "honest",
            category=message.category,
            text=message.text,
            provider=message.provider,
            read=message.read,
        )
        for message in messages
    ]


def _owned_alert(session: Session, user_id: int, alert_id: int) -> AIMessage:
    message = session.exec(
        select(AIMessage).where(
            AIMessage.id == alert_id,
            AIMessage.user_id == user_id,
            AIMessage.kind == "roast",
        )
    ).first()
    if message is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return message


@router.post("/alerts/{alert_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_alert_read(
    alert_id: int,
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> Response:
    message = _owned_alert(session, user.id, alert_id)
    message.read = True
    session.add(message)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/alerts/{alert_id}/report", status_code=status.HTTP_204_NO_CONTENT)
def report_alert(
    alert_id: int,
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> Response:
    message = _owned_alert(session, user.id, alert_id)
    message.reported = True
    session.add(message)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/report", response_model=MonthlyReport)
async def monthly_report(
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
    ai: Annotated[AIService, Depends(get_ai_service)],
    month: str = Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
) -> MonthlyReport:
    summary = build_month_summary(session, user.id, month)
    try:
        return await ai.monthly_report(user.id, summary)
    except AIRateLimitError as error:
        raise _rate_limit(error) from error


@router.post("/parse", response_model=ParsedEntry)
async def parse_entry(
    body: ParseIn,
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
    ai: Annotated[AIService, Depends(get_ai_service)],
) -> ParsedEntry:
    categories = session.exec(select(Category).where(Category.user_id == user.id)).all()
    try:
        result = await ai.parse_entry(
            user.id, body.text, [category.name for category in categories]
        )
    except AIRateLimitError as error:
        raise _rate_limit(error) from error
    if result is None:
        raise HTTPException(status_code=422, detail="Could not find an amount in the entry")
    if not any(
        category.name == result.category and category.kind == result.kind for category in categories
    ):
        raise HTTPException(status_code=422, detail="Could not determine a matching category")
    return result
