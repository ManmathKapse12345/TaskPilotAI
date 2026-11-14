"""Central configuration, loaded from environment variables / backend/.env."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    # LLM (optional - the app works without a key using rule-based fallbacks)
    llm_provider: str = os.getenv("LLM_PROVIDER", "auto").lower()  # auto | gemini | openai | none
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    llm_timeout_seconds: int = _int("LLM_TIMEOUT_SECONDS", 30)

    # Execution limits
    default_max_pages: int = _int("DEFAULT_MAX_PAGES", 5)
    max_pages_limit: int = _int("MAX_PAGES_LIMIT", 10)
    max_depth_limit: int = _int("MAX_DEPTH_LIMIT", 2)
    cli_timeout_seconds: int = _int("CLI_TIMEOUT_SECONDS", 90)
    max_concurrent_tasks: int = _int("MAX_CONCURRENT_TASKS", 3)
    max_prompt_chars: int = _int("MAX_PROMPT_CHARS", 2000)

    database_url: str = os.getenv("DATABASE_URL", f"sqlite:///{(BACKEND_DIR / 'taskpilot.db').as_posix()}")
    cors_origins: list[str] = field(default_factory=lambda: [
        o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()
    ])

    @property
    def active_llm(self) -> str:
        if self.llm_provider == "none":
            return "none"
        if self.llm_provider == "gemini":
            return "gemini" if self.gemini_api_key else "none"
        if self.llm_provider == "openai":
            return "openai" if self.openai_api_key else "none"
        if self.gemini_api_key:
            return "gemini"
        if self.openai_api_key:
            return "openai"
        return "none"

    def secret_values(self) -> list[str]:
        return [v for v in (self.gemini_api_key, self.openai_api_key) if v]


settings = Settings()
