"""FastAPI entry point.

Bootstrap version so every track can start the server on day one.
Khải extends it in T17 (database, Alembic, routers); keep the health route
and the static-files mount at the end, the demo script depends on both.
"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response
from starlette.types import Scope

from app.ai import get_ai_service
from app.config import get_settings

settings = get_settings()

app = FastAPI(title="WalletWarden API", version="0.0.1")


@app.get("/api/health", tags=["system"])
async def health() -> dict[str, object]:
    ai = get_ai_service()
    return {"status": "ok", "env": settings.env, "ai": await ai.health()}


# Routers are registered here by Khải, e.g.:
# from app.api import auth, transactions, categories, budgets, ai
# app.include_router(auth.router, prefix="/api/auth", tags=["auth"])


class SPAStaticFiles(StaticFiles):
    """Serve index.html for client-side routes, so reloading /dashboard works."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and not path.startswith("api"):
                return await super().get_response("index.html", scope)
            raise


# Must stay last: serves the React build on "/" so one tunnel link serves everything.
if settings.frontend_dist.is_dir():
    app.mount("/", SPAStaticFiles(directory=settings.frontend_dist, html=True), name="frontend")
