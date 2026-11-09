"""AI module (owner: Vi). Import only from here or from `app.ai.interface`."""

from functools import lru_cache

from app.ai.entry import entry_day, is_entry_statement
from app.ai.interface import (
    AdviceRequest,
    AIRateLimitError,
    AIReply,
    AIService,
    CategorySummary,
    ChatTurn,
    ExpenseItem,
    FinancialSummary,
    MonthlyReport,
    ParsedEntry,
    RoastCandidate,
    RoastContext,
    RoastTrigger,
    Tone,
    TxRecord,
)
from app.ai.service import DefaultAIService
from app.ai.triggers import detect_roast
from app.config import get_settings


@lru_cache
def get_ai_service() -> AIService:
    """FastAPI dependency: `ai: AIService = Depends(get_ai_service)`."""
    return DefaultAIService(get_settings())


__all__ = [
    "AIRateLimitError",
    "AIReply",
    "AIService",
    "AdviceRequest",
    "CategorySummary",
    "ChatTurn",
    "ExpenseItem",
    "FinancialSummary",
    "MonthlyReport",
    "ParsedEntry",
    "RoastCandidate",
    "RoastContext",
    "RoastTrigger",
    "Tone",
    "TxRecord",
    "detect_roast",
    "entry_day",
    "is_entry_statement",
    "get_ai_service",
]
