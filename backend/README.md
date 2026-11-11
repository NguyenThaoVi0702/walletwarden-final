# Backend

FastAPI application with a SQLite database, JWT authentication and the AI module. It also serves the built web app, so one port (8000) is enough for the whole product.

```
app/
  main.py        application entry point; serves frontend/dist at "/"
  config.py      settings from environment variables and .env
  db.py          SQLite engine and sessions
  models.py      SQLModel tables
  security.py    password hashing (Argon2) and JWT
  api/           HTTP routers
  schemas/       request and response models (the API contract)
  services/      budgets, monthly summaries, default categories
  ai/            AI module (see app/ai/README.md)
alembic/         database migrations
tests/           pytest suite
openapi.json     generated API contract
```

## Run

```powershell
cd backend
uv sync                       # installs Python 3.12 and the dependencies
uv run alembic upgrade head   # creates or updates the database
uv run uvicorn app.main:app --reload --port 8000
```

- Health check: <http://localhost:8000/api/health>
- Interactive API docs: <http://localhost:8000/docs>
- Endpoint reference: [API_README.md](API_README.md)

Add `--host 0.0.0.0` to accept connections from other devices on your network.

## Configuration

Settings come from `WW_*` environment variables or a `.env` file in the repository root; see [.env.example](../.env.example). The most useful ones:

| Variable | Purpose |
|---|---|
| `WW_ENV` | `dev` (default) allows a built-in JWT secret; any other value requires `WW_JWT_SECRET` |
| `WW_JWT_SECRET` | Secret used to sign tokens; use a long random string |
| `WW_DATABASE_URL` | Database URL (default: a local SQLite file) |
| `WW_AI_PROVIDERS` | `fake`, `local`, `gemini` or a comma-separated chain |

## Database

SQLite in WAL mode. Tables: `users`, `categories`, `transactions`, `budgets`, `ai_messages`. Default categories are created when a user registers. After changing models, add a migration:

```powershell
uv run alembic revision --autogenerate -m "describe the change"
uv run alembic upgrade head
```

## Security

- Passwords are hashed with Argon2; tokens are signed JWTs.
- Every query is scoped to the authenticated user; another user's records return `404`.
- Sign-in and AI endpoints are rate limited.
- The AI module receives aggregated numbers and category names only, never emails or free-text notes.

## Test and lint

```powershell
uv run pytest --cov=app
uv run ruff check . ../scripts ../llm
uv run ruff format . ../scripts ../llm
uv run mypy app
uv run python -m app.export_openapi    # regenerate openapi.json after API changes
```

Tests run the AI in simulated mode, so no GPU or API key is needed.
