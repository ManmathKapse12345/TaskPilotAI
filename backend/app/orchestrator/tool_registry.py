"""Allow-list of CLI tools the backend may execute.

The model never produces a command line. It produces a TaskPlan; this registry
maps a validated plan to a fixed argv list (no shell, no string concatenation).
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from typing import Callable

from app.core.config import BACKEND_DIR, settings
from app.schemas.task import TaskPlan


@dataclass(frozen=True)
class ToolSpec:
    name: str
    intent: str
    description: str
    build_argv: Callable[[TaskPlan], list[str]]
    cwd: str
    timeout_seconds: int


def _crawler_argv(plan: TaskPlan) -> list[str]:
    if not plan.url:
        raise ValueError("site-crawler requires a validated URL")
    # Leave headroom so the CLI's own budget fires before the hard kill.
    total = max(10, settings.cli_timeout_seconds - 15)
    return [
        sys.executable, "-m", "taskpilot_cli", "crawl",
        f"--url={plan.url}",  # '=' form: a value can never be parsed as another flag
        f"--max-pages={plan.max_pages}",
        f"--max-depth={plan.max_depth}",
        "--timeout=10",
        f"--total-timeout={total}",
    ]


APPROVED_TOOLS: dict[str, ToolSpec] = {
    "site-crawler": ToolSpec(
        name="site-crawler",
        intent="website_crawl",
        description="Bounded same-site crawler that extracts metadata, headings, links, contacts and text as JSON",
        build_argv=_crawler_argv,
        cwd=str(BACKEND_DIR),
        timeout_seconds=settings.cli_timeout_seconds,
    ),
}


def tool_for_intent(intent: str) -> ToolSpec | None:
    return next((t for t in APPROVED_TOOLS.values() if t.intent == intent), None)


def display_command(argv: list[str]) -> str:
    """Human-readable command for the UI (interpreter path shortened)."""
    shown = ["python" if i == 0 else a for i, a in enumerate(argv)]
    return " ".join(f'"{a}"' if " " in a else a for a in shown)
