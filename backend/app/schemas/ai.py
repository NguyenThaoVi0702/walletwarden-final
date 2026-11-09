from pydantic import BaseModel, Field

from app.ai import AIReply, ChatTurn, MonthlyReport, ParsedEntry
from app.schemas.transactions import TransactionRead


class ChatIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    history: list[ChatTurn] = Field(default_factory=list, max_length=6)


class ChatReply(AIReply):
    """Advisor answer. When the message was a spending/income statement ("nay ăn bánh cuốn
    hết 50k"), the backend logs it and returns the new transaction here."""

    transaction: TransactionRead | None = None
    roast_pending: bool = False


class ParseIn(BaseModel):
    text: str = Field(min_length=1, max_length=200)


class RoastAlert(BaseModel):
    id: int
    created_at: str
    trigger: str
    tone: str
    category: str | None
    text: str
    provider: str
    read: bool


__all__ = [
    "AIReply", "ChatTurn", "MonthlyReport", "ParsedEntry", "ChatIn", "ChatReply", "ParseIn",
    "RoastAlert",
]  # fmt: skip
