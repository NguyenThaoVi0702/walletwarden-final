# Backend: hướng dẫn cho Khải

> Chủ: **Khải** (Technical Lead, Backend, DevOps) · Người review PR của bạn: **Tùng** · Bạn review PR của: **Vi**

Thư mục `backend/` là **một project Python duy nhất** (uv) chứa cả phần của Khải và module AI của Vi. Bạn sở hữu:

```
backend/
  app/main.py          entry point (đã có bản bootstrap, bạn mở rộng)
  app/db.py            engine + session SQLite (bạn tạo)
  app/models.py        bảng SQLModel (bạn tạo)
  app/security.py      JWT + Argon2 (bạn tạo)
  app/api/             routers
  app/schemas/         Pydantic request/response = CONTRACT
  app/services/        logic nghiệp vụ: ngân sách, roast trigger, tổng hợp tháng
  alembic/             migration
  tests/               pytest (trừ tests/ai của Vi)
  openapi.json         contract sinh tự động — commit cùng mọi thay đổi API
```

Không sửa: `app/ai/` (Vi), `app/config.py` (dùng chung; thêm biến thì báo nhóm).

## 1. Cài đặt

```powershell
cd backend
uv sync                      # cài Python 3.12 + mọi thư viện theo uv.lock
uv run pytest                # phải xanh
uv run uvicorn app.main:app --reload --port 8000
```

Thêm thư viện: `uv add <tên>` (hoặc `uv add --dev <tên>`), commit cả `pyproject.toml` và `uv.lock`.

## 2. Việc của bạn theo plan

| Task | Hạn | Kết quả cần có |
|---|---|---|
| T04 Repo, board, template, branch protection | 27/10 | chạy `scripts/github/setup-github.ps1` (xem [scripts/README.md](../scripts/README.md)) |
| T09 SRS v1.0 | 30/10 | `Documents/SRS_WalletWarden_v1.0.pdf`, ID FR-01…, NFR-01… |
| **T10 Data model + schemas + endpoint stubs + openapi.json** | **29–30/10** | stub trả dữ liệu mẫu cho **mọi** endpoint ở [INTEGRATION.md §1.2](../INTEGRATION.md) |
| T17 Skeleton: SQLite, Alembic, phục vụ React build | 1/11 | |
| T18 F1 Auth: đăng ký, đăng nhập, JWT, Argon2 | 3/11 | |
| T19 REST API transactions, categories, budgets | 7/11 | |
| T20 Budget + roast-trigger engine + unit test | 8/11 | coverage `app/services` ≥ 70% (CI chặn nếu thấp hơn) |
| T21 Test phân quyền: user chỉ thấy dữ liệu của mình | 10/11 | |
| T33 Slide cuối + video demo dự phòng | 16/11 | |

## 3. Contract-first (làm ngay)

1. Viết schema trong `app/schemas/` (tách `auth.py`, `transactions.py`, `budgets.py`, `dashboard.py`, `ai.py`…).
2. Viết router stub trả dữ liệu mẫu, khai báo `response_model` đầy đủ, để OpenAPI có đủ type cho Tùng.
3. `uv run python -m app.export_openapi` → commit `openapi.json`.
4. Từ 31/10, mọi thay đổi `app/schemas/**` hoặc `openapi.json` cần label `contract-approved` (CI kiểm tra).

Với endpoint AI, **dùng lại model của Vi** làm `response_model` để Tùng có type giống hệt:

```python
# app/schemas/ai.py
from pydantic import BaseModel, Field
from app.ai import AIReply, ChatTurn, MonthlyReport, ParsedEntry  # re-export, không định nghĩa lại

class ChatIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    history: list[ChatTurn] = Field(default_factory=list, max_length=6)

class ParseIn(BaseModel):
    text: str = Field(min_length=1, max_length=200)
```

## 4. Gọi module AI

Chỉ import từ `app.ai`. Mọi hàm **luôn trả lời** (model không chạy thì bộ luật trả lời), chỉ có 1 ngoại lệ: `AIRateLimitError` → HTTP 429.

```python
# app/api/ai.py
from fastapi import APIRouter, Depends, HTTPException
from app.ai import AdviceRequest, AIRateLimitError, AIReply, AIService, get_ai_service
from app.schemas.ai import ChatIn
from app.services.summary import build_month_summary   # bạn viết, xem mục 5

router = APIRouter()

@router.post("/chat", response_model=AIReply)
async def chat(
    body: ChatIn,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
    ai: AIService = Depends(get_ai_service),
) -> AIReply:
    summary = build_month_summary(session, user.id, month=current_month())
    try:
        return await ai.advise(user.id, AdviceRequest(summary=summary, **body.model_dump()))
    except AIRateLimitError as e:
        raise HTTPException(429, "Bạn hỏi hơi nhanh, thử lại sau ít giây", headers={"Retry-After": str(e.retry_after_s)})
```

| Hàm | Dùng ở | Rate limit |
|---|---|---|
| `await ai.advise(user_id, AdviceRequest)` → `AIReply` | `POST /api/ai/chat` | có |
| `await ai.roast(user_id, RoastContext)` → `AIReply` | background task sau khi lưu giao dịch | không |
| `await ai.monthly_report(user_id, FinancialSummary)` → `MonthlyReport` | `GET /api/ai/report` | có |
| `await ai.parse_entry(user_id, text, category_names)` → `ParsedEntry \| None` | `POST /api/ai/parse` (None → 422) | có |

Định nghĩa từng field: [app/ai/interface.py](app/ai/interface.py). Trong test của bạn, AI tự chạy chế độ giả lập (`WW_AI_PROVIDERS=fake`), không cần GPU.

## 5. Services: mọi con số do code tính

AI **không bao giờ tự tính**. Service của bạn tính hết rồi đưa vào model của Vi.

`app/services/summary.py`: `build_month_summary(session, user_id, month) -> FinancialSummary`:
`income`, `expense`, `balance`, `total_budget`, `total_usage_pct = round(expense/total_budget*100)`, `categories[]` (spent, budget, usage_pct), `top_expenses` (5 khoản lớn nhất, **không gửi ghi chú** của người dùng), `previous_month_expense`, `change_vs_previous_pct`, `days_left`.

**Phát hiện roast: dùng `app.ai.detect_roast`, không cần tự viết** (Vi đã viết và test, file [app/ai/triggers.py](app/ai/triggers.py)). Đây là hàm thuần, không đụng DB. Nó nhận giao dịch mới, lịch sử 35 ngày và ngân sách, rồi trả về **tối đa 1** roast theo thứ tự ưu tiên:

| Ưu tiên | Trigger | Khi nào |
|---|---|---|
| 1 | `over_income` | tổng chi tháng vừa vượt tổng thu tháng |
| 2 | `budget_100` | ngân sách danh mục hoặc cả tháng vừa vượt 100% |
| 3 | `payday_splurge` | lương/thưởng về ≤ 3 ngày mà đã tiêu ≥ 40% |
| 4 | `budget_80` | ngân sách vừa vượt 80% |
| 5 | `daily_spike` | hôm nay chi ≥ 1,5× hôm qua (hôm qua ≥ 100k, hôm nay ≥ 200k) |
| 6 | `large_expense` | khoản > 3× trung bình 30 khoản gần nhất (cần ≥ 5 khoản) |
| 7 | `repeat_today` | lần thứ 3+ trong ngày cùng danh mục |
| 8 | `small_habit` | 8, 16, 24… khoản ≤ 60k cùng danh mục trong tháng, tổng ≥ 300k |
| 9 | `spending_streak` | Mua sắm/Giải trí 4+ ngày liên tiếp |
| 10 | `burn_rate` | chưa tới 80% nhưng theo tốc độ hiện tại sẽ hết ngân sách sớm hơn cuối tháng ≥ 3 ngày |

Hàm không bao giờ roast khoản thu. Với Nhà ở, Hóa đơn, Giáo dục, Sức khỏe thì không roast thói quen hay chi tăng đột biến, chỉ cảnh báo ngân sách.

Trong router `POST /api/transactions`:

```python
from app.ai import AIService, TxRecord, detect_roast, get_ai_service

async def create_tx(..., background: BackgroundTasks, ai: AIService = Depends(get_ai_service)):
    tx = save(...)                                              # commit trước
    cand = None
    if user.roast_enabled:
        def rec(t: Transaction) -> TxRecord:
            return TxRecord(kind=t.kind, amount=t.amount, category=t.category.name, day=t.date)
        new = rec(tx)
        recent = [rec(t) for t in transactions_since(session, user.id, tx.date - timedelta(days=35))
                  if t.id != tx.id] + [new]                     # lịch sử + giao dịch mới
        cand = detect_roast(
            new, recent,
            budgets=category_budgets(session, user.id, month),  # {"Ăn uống": 2_500_000, ...}
            total_budget=total_budget(session, user.id, month), # None nếu chưa đặt
            tone=user.roast_tone,
            fired=roast_keys_this_month(session, user.id),      # các key đã roast trong tháng
        )
    if cand:
        background.add_task(run_roast, user.id, cand, ai)  # await ai.roast(user_id, cand.context), lưu text + cand.key vào ai_messages
    return {"transaction": tx, "roast_pending": cand is not None}
```

Bảng `ai_messages` cần thêm cột `roast_key` (TEXT, có index). `roast_keys_this_month` = các `roast_key` của user trong tháng hiện tại; nhờ đó cùng một tình huống không bị roast 2 lần.

## 6. Database

- SQLite file, bật WAL khi khởi tạo engine:

```python
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _):
    cur = dbapi_conn.cursor(); cur.execute("PRAGMA journal_mode=WAL"); cur.execute("PRAGMA foreign_keys=ON"); cur.close()
```

- Bảng tối thiểu: `users` (email, password_hash, display_name, roast_enabled, roast_tone), `categories` (user_id, name, kind, icon, is_default), `transactions` (user_id, kind, amount INT, category_id, date, note), `budgets` (user_id, month, category_id NULL = tổng, limit), `ai_messages` (user_id, kind, trigger, tone, category, text, provider, read, reported, roast_key, created_at).
- Đăng ký xong thì tạo sẵn danh mục mặc định ở [INTEGRATION.md §1.3](../INTEGRATION.md) (bộ luật quick entry của AI dựa vào các tên này).
- Alembic: `uv run alembic init alembic` → sửa `env.py` dùng `SQLModel.metadata` → `uv run alembic revision --autogenerate -m "init"` → `uv run alembic upgrade head`.

## 7. Bảo mật (rủi ro R8)

- Argon2 qua `pwdlib`, JWT qua `PyJWT`, secret lấy từ `WW_JWT_SECRET` (không hard-code).
- **Mọi query lọc theo `user_id` của token**; T21 test: user A gọi `/api/transactions/{id của B}` → 404.
- Rate limit đăng nhập bằng `slowapi` (ví dụ 10/phút/IP).
- Không log mật khẩu, token, email.

## 8. Test và CI

```powershell
uv run ruff check . ../scripts ../llm ; uv run ruff format . ../scripts ../llm
uv run mypy app
uv run pytest --cov=app --cov-report=term-missing
uv run python -m app.export_openapi        # đổi API thì commit openapi.json
```

Gợi ý fixture: SQLite in-memory + `TestClient`, override dependency `get_session`. `detect_roast` đã có test của Vi (`tests/ai/test_triggers.py`); phần của bạn là test router: lưu giao dịch → `roast_pending` đúng, tắt Roast Mode → không roast, cùng tình huống lần 2 → không roast (nhờ `roast_key`).

## 9. Ngày tích hợp

Checklist chi tiết ở [INTEGRATION.md §4](../INTEGRATION.md). Giữ nguyên trong `main.py`: route `/api/health` và đoạn mount `frontend/dist` **ở cuối cùng** (script demo dựa vào cả hai).
