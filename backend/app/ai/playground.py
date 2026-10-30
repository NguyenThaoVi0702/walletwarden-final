"""Dev-only page for trying the AI module by hand (owner: Vi). Not part of the real app.

    cd backend
    $env:WW_AI_PROVIDERS="local"      # or local,gemini / fake
    uv run uvicorn app.ai.playground:app --port 8001
    -> http://127.0.0.1:8001

Calls the same AIService the backend uses, so prompts, output guard, fallback and
rate limit all behave exactly as in production. Presets come from the 30-case test set.
"""

from datetime import date
from pathlib import Path
from typing import Any

import yaml
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app.ai import detect_roast, get_ai_service
from app.ai.interface import (
    AdviceRequest,
    AIRateLimitError,
    AIReply,
    FinancialSummary,
    MonthlyReport,
    ParsedEntry,
    RoastContext,
    Tone,
    TxRecord,
)
from app.config import REPO_ROOT

CASES = REPO_ROOT / "prompts" / "testset" / "cases.yaml"
PAGE = Path(__file__).with_name("playground.html")

app = FastAPI(title="WalletWarden AI playground", docs_url=None, redoc_url=None)


class EntryRequest(BaseModel):
    text: str


class SimulateRequest(BaseModel):
    """One step of the auto-roast simulation: the page keeps the history, the server decides."""

    text: str
    day: date
    tone: Tone
    category: str | None = None  # force a category instead of letting the AI pick
    history: list[TxRecord] = []
    budgets: dict[str, int] = {}
    total_budget: int | None = None
    fired: list[str] = []


class SimulateResponse(BaseModel):
    tx: TxRecord
    entry_provider: str
    trigger: str | None = None
    key: str | None = None
    context: RoastContext | None = None
    roast: AIReply | None = None


def _limited(exc: AIRateLimitError) -> HTTPException:
    return HTTPException(429, f"Rate limit: thử lại sau {exc.retry_after_s} giây")


@app.get("/", response_class=HTMLResponse)
def page() -> str:
    return PAGE.read_text(encoding="utf-8")


@app.get("/presets")
def presets() -> dict[str, Any]:
    data = yaml.safe_load(CASES.read_text(encoding="utf-8"))
    roasts = {c["id"]: c["context"] for c in data["cases"] if c["task"] == "roast"}
    questions = [
        {"id": c["id"], "summary": c["summary"], "question": c["question"]}
        for c in data["cases"]
        if c["task"] == "advice"
    ]
    return {
        "summaries": data["summaries"],
        "categories": data["categories"],
        "roasts": roasts,
        "questions": questions,
    }


@app.get("/health")
async def health() -> dict[str, Any]:
    return await get_ai_service().health()


@app.post("/advice")
async def advice(req: AdviceRequest) -> AIReply:
    try:
        return await get_ai_service().advise(1, req)
    except AIRateLimitError as exc:
        raise _limited(exc) from exc


@app.post("/roast")
async def roast(ctx: RoastContext) -> AIReply:
    return await get_ai_service().roast(1, ctx)


@app.post("/report")
async def report(summary: FinancialSummary) -> MonthlyReport:
    try:
        return await get_ai_service().monthly_report(1, summary)
    except AIRateLimitError as exc:
        raise _limited(exc) from exc


@app.post("/entry")
async def entry(req: EntryRequest) -> ParsedEntry:
    categories: list[str] = yaml.safe_load(CASES.read_text(encoding="utf-8"))["categories"]
    try:
        parsed = await get_ai_service().parse_entry(1, req.text, categories)
    except AIRateLimitError as exc:
        raise _limited(exc) from exc
    if parsed is None:
        raise HTTPException(422, "Không tìm thấy số tiền trong câu (ví dụ: 45k, 1tr2, 150.000)")
    return parsed


@app.post("/simulate")
async def simulate(req: SimulateRequest) -> SimulateResponse:
    """Quick entry -> detect_roast -> roast, exactly what the real app will do on save."""
    parsed = await entry(EntryRequest(text=req.text))
    category = req.category or parsed.category
    tx = TxRecord(kind=parsed.kind, amount=parsed.amount, category=category, day=req.day)
    cand = detect_roast(
        tx,
        [*req.history, tx],
        budgets=req.budgets,
        total_budget=req.total_budget,
        tone=req.tone,
        fired=req.fired,
    )
    if cand is None:
        return SimulateResponse(tx=tx, entry_provider=parsed.provider)
    reply = await get_ai_service().roast(1, cand.context)
    return SimulateResponse(
        tx=tx,
        entry_provider=parsed.provider,
        trigger=cand.context.trigger,
        key=cand.key,
        context=cand.context,
        roast=reply,
    )
