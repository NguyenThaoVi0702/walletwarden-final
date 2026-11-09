<p align="center"><img src="assets/brand/logo-192.png" width="120" alt="WalletWarden logo"></p>

# WalletWarden

> Spend less. Or get roasted.

Logo và bảng màu chính thức (trắng, xanh lá `#36AB66`, xanh dương đậm `#0E2F51`): [assets/brand/](assets/brand/README.md).

Trợ lý chi tiêu cá nhân dùng AI: ghi thu/chi, đặt ngân sách, xem dashboard, hỏi AI và bị AI "roast" khi tiêu quá tay. Toàn bộ hệ thống (app, database, LLM) chạy trên **một laptop** và mở ra cho người test qua **một link HTTPS tạm thời**.

Đồ án môn Phát triển phần mềm, 24/10 – 17/11/2026. Nhóm: Nguyễn Thảo Vi, Bùi Quang Khải, Nguyễn Đình Tùng.

## Ai làm gì, đọc file nào

| Thành viên | Track | Thư mục sở hữu | Hướng dẫn riêng | Review PR của |
|---|---|---|---|---|
| **Vi** (PM, AI, Architect) | AI | `backend/app/ai`, `prompts`, `llm`, `scripts` | [backend/app/ai/README.md](backend/app/ai/README.md) | Tùng |
| **Khải** (Tech Lead, Backend, DevOps) | Backend | `backend/app/api`, `backend/app/schemas`, `backend/app/services`, `backend/alembic` | [backend/README.md](backend/README.md) | Vi |
| **Tùng** (Frontend, UI/UX) | Frontend | `frontend` | [frontend/README.md](frontend/README.md) | Khải |
| Cả ba | QA, tài liệu | `tests`, `Documents`, `Meetings` | [tests/README.md](tests/README.md) | — |

Tài liệu chung, **ai cũng phải đọc**:

1. [CONTRIBUTING.md](CONTRIBUTING.md): quy trình nhánh, commit, PR, review và CI kiểm tra những gì.
2. [INTEGRATION.md](INTEGRATION.md): contract giữa 3 track và kế hoạch ghép thành một ứng dụng hoàn chỉnh (4/11, 6/11, 10/11, demo 17/11).

## Kiến trúc

```
 Trình duyệt người test (laptop / điện thoại)
        │  https://xxxx.trycloudflare.com
        ▼
 cloudflared quick tunnel  ──(chỉ port 8000)──┐
                                              ▼
 ┌──────────────────────── Laptop demo ────────────────────────┐
 │ FastAPI :8000                                               │
 │  ├─ "/"        → React PWA build (frontend/dist)     [Tùng] │
 │  ├─ /api/*     → routers + Pydantic schemas          [Khải] │
 │  ├─ services   → ngân sách, roast trigger, tổng hợp  [Khải] │
 │  ├─ app/ai     → prompt + router local→Gemini→rules  [Vi]   │
 │  └─ SQLite (WAL)                                            │
 │ llama-server 127.0.0.1:8080 (GPU, 4 slot)            [Vi]   │
 └─────────────────────────────────────────────────────────────┘
          Gemini API (chỉ khi model local không trả lời)
```

## Cấu trúc repo

```
.github/            CI (quét mọi push/PR), CODEOWNERS, template PR/issue
backend/            Python 3.12 + FastAPI (một project uv duy nhất)
  app/main.py       entry point (Khải)
  app/config.py     cấu hình từ .env (dùng chung)
  app/api/          routers (Khải)
  app/schemas/      Pydantic schemas = contract (Khải, đóng băng 30/10)
  app/services/     logic nghiệp vụ (Khải)
  app/ai/           module AI (Vi) — interface.py là contract
  tests/            pytest
  openapi.json      contract API sinh tự động, frontend sinh type từ file này
frontend/           React + TypeScript + Vite PWA (Tùng)
prompts/            Jinja2 prompt + bộ test 30 case (Vi)
llm/                cài và chạy llama.cpp, benchmark (Vi)
scripts/            start-demo.ps1, chạy test AI, metrics, setup GitHub (Vi)
tests/              e2e Playwright, kịch bản cross-test, UAT (cả nhóm)
Documents/          SRS, Design Document, báo cáo (PDF)
Meetings/           biên bản họp
```

## Chạy nhanh (máy dev, không cần GPU)

Cần: [uv](https://docs.astral.sh/uv/), Node.js 20+, Git.

```powershell
git clone https://github.com/<owner>/walletwarden.git
cd walletwarden
copy .env.example .env            # mặc định dùng AI giả lập (WW_AI_PROVIDERS=fake)

cd backend
uv sync                           # tự cài Python 3.12 + thư viện
uv run alembic upgrade head       # tạo/cập nhật schema SQLite
uv run pytest                     # phải xanh hết
uv run uvicorn app.main:app --reload --port 8000
# mở http://localhost:8000/docs  (Swagger) và http://localhost:8000/api/health
```

Frontend (khi Tùng đã khởi tạo): `cd frontend && npm install && npm run dev` → http://localhost:5173.

Chạy demo đầy đủ trên laptop có GPU: `.\scripts\start-demo.ps1` (xem [scripts/README.md](scripts/README.md)).
