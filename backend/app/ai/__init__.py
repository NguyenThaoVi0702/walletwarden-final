"""AI module (owner: Vi). Import only from here or from `app.ai.interface`."""

from functools import lru_cache

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
    RoastContext,
    RoastTrigger,
    Tone,
)
from app.ai.service import DefaultAIService
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
    "RoastContext",
    "RoastTrigger",
    "Tone",
    "get_ai_service",
]
