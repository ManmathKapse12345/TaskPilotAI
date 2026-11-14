"""Pydantic models for the task plan, the CLI contract and the final response."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class ChatAccepted(BaseModel):
    task_id: str
    status: str


class TaskPlan(BaseModel):
    """Structured interpretation of a natural-language request."""
    intent: Literal["website_crawl", "help", "unsupported"]
    url: str | None = None
    max_pages: int = Field(default=5, ge=1, le=20)
    max_depth: int = Field(default=1, ge=0, le=3)
    wants_summary: bool = True
    wants_json: bool = True
    focus: list[str] = Field(default_factory=list, description="What the user cares about, e.g. 'contact details'")
    steps: list[str] = Field(default_factory=list)
    reply: str | None = Field(default=None, description="Message for help/unsupported intents")
    interpreted_by: Literal["llm", "rules"] = "rules"


# ---- CLI output contract (validated before anything is shown to the user) ----

class Heading(BaseModel):
    level: int
    text: str


class Link(BaseModel):
    url: str
    text: str = ""


class SocialLink(BaseModel):
    platform: str
    url: str


class CrawledPage(BaseModel):
    url: str
    title: str = ""
    description: str = ""
    keywords: str = ""
    language: str = ""
    canonical_url: str = ""
    open_graph: dict[str, str] = Field(default_factory=dict)
    headings: list[Heading] = Field(default_factory=list)
    internal_links: list[Link] = Field(default_factory=list)
    external_links: list[Link] = Field(default_factory=list)
    social_links: list[SocialLink] = Field(default_factory=list)
    emails: list[str] = Field(default_factory=list)
    phones: list[str] = Field(default_factory=list)
    images: list[dict[str, Any]] = Field(default_factory=list)
    image_count: int = 0
    structured_data_types: list[str] = Field(default_factory=list)
    word_count: int = 0
    text_excerpt: str = ""
    depth: int = 0
    status_code: int = 200
    fetch_ms: int = 0


class CrawlStats(BaseModel):
    pages_crawled: int = 0
    pages_failed: int = 0
    pages_skipped_robots: int = 0
    bytes_downloaded: int = 0


class CrawlOutput(BaseModel):
    tool: str
    status: Literal["success", "partial", "failed"]
    version: str | None = None
    start_url: str | None = None
    final_url: str | None = None
    blocked_by_robots: bool = False
    timed_out: bool = False
    duration_ms: int | None = None
    limits: dict[str, Any] = Field(default_factory=dict)
    stats: CrawlStats = Field(default_factory=CrawlStats)
    pages: list[CrawledPage] = Field(default_factory=list)
    errors: list[dict[str, Any]] = Field(default_factory=list)
    skipped_by_robots: list[str] = Field(default_factory=list)
    error: str | None = None
    error_type: str | None = None
