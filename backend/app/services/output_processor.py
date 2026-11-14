"""Turns raw process output into a verified, honest status + clean data.

Status is decided from evidence (exit code + validated stdout), never assumed:
    completed  - exit 0 and valid JSON with >=1 page
    partial    - some data, but failures/time limits occurred
    failed     - no usable data (invalid input, network error, robots, crash, timeout)
    cancelled  - user stopped the task
"""
from __future__ import annotations

import json
from dataclasses import dataclass

from pydantic import ValidationError

from app.orchestrator.cli_manager import ProcessResult
from app.schemas.task import CrawlOutput

EXIT_MEANING = {
    0: "success", 1: "partial result", 2: "invalid input / unsafe URL", 3: "no page could be crawled",
    4: "blocked by robots.txt", 5: "internal crawler error",
}


@dataclass
class ProcessedOutput:
    status: str  # completed | partial | failed | cancelled
    crawl: CrawlOutput | None
    error: str | None
    exit_meaning: str


def process_output(proc: ProcessResult) -> ProcessedOutput:
    if proc.spawn_error:
        return ProcessedOutput("failed", None, proc.spawn_error, "process did not start")
    if proc.cancelled:
        return ProcessedOutput("cancelled", None, "Task was cancelled by the user; the CLI process was terminated.", "killed")
    if proc.timed_out:
        return ProcessedOutput("failed", None, f"The CLI exceeded its time limit after {proc.duration_ms / 1000:.0f}s and was terminated.", "killed (timeout)")

    meaning = EXIT_MEANING.get(proc.exit_code, f"unknown exit code {proc.exit_code}")
    raw = proc.stdout.strip()
    if not raw:
        tail = " | ".join(proc.stderr_lines[-3:])
        return ProcessedOutput("failed", None, f"The CLI produced no output (exit code {proc.exit_code}). {tail}".strip(), meaning)

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        return ProcessedOutput("failed", None, f"The CLI output was not valid JSON ({exc.msg}).", meaning)
    try:
        crawl = CrawlOutput.model_validate(payload)
    except ValidationError as exc:
        return ProcessedOutput("failed", None, f"The CLI output did not match the expected schema ({exc.error_count()} errors).", meaning)

    if crawl.error and not crawl.pages:
        return ProcessedOutput("failed", crawl, crawl.error, meaning)
    if proc.exit_code == 4:
        return ProcessedOutput("failed", crawl, "The website's robots.txt disallows crawling this URL, so it was not accessed.", meaning)
    if not crawl.pages:
        reasons = "; ".join(f"{e.get('url')}: {e.get('error')}" for e in crawl.errors[:3]) or "no reachable pages"
        return ProcessedOutput("failed", crawl, f"The website could not be crawled - {reasons}", meaning)
    if proc.exit_code == 0 and crawl.status == "success":
        return ProcessedOutput("completed", crawl, None, meaning)
    issues = []
    if crawl.errors:
        issues.append(f"{len(crawl.errors)} page(s) failed")
    if crawl.timed_out:
        issues.append("time budget reached")
    return ProcessedOutput("partial", crawl, "Partial result: " + (", ".join(issues) or f"exit code {proc.exit_code}"), meaning)


def build_extracted_data(crawl: CrawlOutput) -> dict:
    """Clean, clearly named JSON for the user (deduplicated across pages)."""
    home = crawl.pages[0]

    def uniq(items, key):
        seen, out = set(), []
        for it in items:
            k = key(it)
            if k not in seen:
                seen.add(k)
                out.append(it)
        return out

    all_internal = uniq([l for p in crawl.pages for l in p.internal_links], lambda l: l.url)
    all_external = uniq([l for p in crawl.pages for l in p.external_links], lambda l: l.url)
    socials = uniq([s for p in crawl.pages for s in p.social_links], lambda s: s.url)
    return {
        "website": {
            "url": crawl.start_url,
            "final_url": crawl.final_url,
            "title": home.title,
            "description": home.description,
            "site_name": home.open_graph.get("site_name", ""),
            "language": home.language,
            "keywords": [k.strip() for k in home.keywords.split(",") if k.strip()][:15],
            "structured_data_types": sorted({t for p in crawl.pages for t in p.structured_data_types}),
        },
        "contact": {
            "emails": sorted({e for p in crawl.pages for e in p.emails}),
            "phones": sorted({ph for p in crawl.pages for ph in p.phones}),
            "social_profiles": [{"platform": s.platform, "url": s.url} for s in socials][:15],
        },
        "pages": [
            {
                "url": p.url,
                "title": p.title,
                "description": p.description,
                "depth": p.depth,
                "status_code": p.status_code,
                "word_count": p.word_count,
                "headings": [{"level": h.level, "text": h.text} for h in p.headings[:20]],
                "content_preview": p.text_excerpt[:400],
            }
            for p in crawl.pages
        ],
        "navigation_links": [{"text": l.text, "url": l.url} for l in all_internal if l.text][:25],
        "external_links": [{"text": l.text, "url": l.url} for l in all_external][:20],
        "images": [img for p in crawl.pages for img in p.images][:10],
        "crawl_stats": {
            **crawl.stats.model_dump(),
            "duration_ms": crawl.duration_ms,
            "errors": crawl.errors[:10],
            "skipped_by_robots": crawl.skipped_by_robots[:10],
        },
    }
