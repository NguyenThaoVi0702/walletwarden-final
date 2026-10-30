"""Application settings, read from environment variables or the repo-root .env file."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="WW_",
        env_file=(REPO_ROOT / ".env", BACKEND_DIR / ".env"),
        extra="ignore",
    )

    env: str = "dev"

    # --- Backend (owned by Khải) ---
    database_url: str = "sqlite:///./walletwarden.db"
    jwt_secret: str = "dev-only-secret-change-me"
    jwt_expire_minutes: int = 1440
    frontend_dist: Path = REPO_ROOT / "frontend" / "dist"

    # --- AI module (owned by Vi) ---
    ai_providers: str = "fake"
    llama_base_url: str = "http://127.0.0.1:8080/v1"
    llama_model: str = "walletwarden-local"
    llama_timeout_s: float = 25.0
    llama_max_concurrency: int = 4
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_s: float = 20.0
    ai_rate_limit_per_minute: int = 10
    ai_log_file: Path = REPO_ROOT / "logs" / "ai_calls.jsonl"
    prompts_dir: Path = REPO_ROOT / "prompts"

    @property
    def ai_provider_chain(self) -> list[str]:
        return [p.strip() for p in self.ai_providers.split(",") if p.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
