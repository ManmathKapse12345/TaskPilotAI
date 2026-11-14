"""Bounded, polite, same-site crawler.

Safety limits enforced here (independently of the backend):
  * max pages / max depth / per-request timeout / total time budget
  * response size cap, HTML-only content types
  * robots.txt respected, same-site links only
  * every URL *and every redirect hop* is SSRF-checked before it is fetched
"""
from __future__ import annotations

import time
import urllib.robotparser
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable
from urllib.parse import urljoin, urlsplit

import httpx

from . import __version__
from .extract import canonicalize, extract_page
from .netguard import UnsafeURLError, assert_safe_url

USER_AGENT = f"TaskPilotCrawler/{__version__} (+https://github.com/taskpilot-ai; respectful bot)"
MAX_BYTES = 2_000_000
MAX_REDIRECTS = 5
HTML_TYPES = ("text/html", "application/xhtml+xml")
SKIP_EXTENSIONS = (
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico", ".zip", ".gz", ".tar", ".mp4",
    ".mp3", ".avi", ".mov", ".css", ".js", ".json", ".xml", ".rss", ".exe", ".dmg", ".doc", ".docx",
    ".xls", ".xlsx", ".ppt", ".pptx", ".woff", ".woff2", ".ttf",
)
SKIP_PATH_WORDS = ("login", "logout", "signin", "sign-in", "signup", "register", "cart", "checkout", "account", "wp-admin")
PRIORITY_WORDS = ("about", "contact", "product", "service", "feature", "pricing", "solution", "team", "company", "faq", "docs", "career", "blog")

Logger = Callable[..., None]


class FetchError(Exception):
    pass


@dataclass
class CrawlConfig:
    url: str
    max_pages: int = 5
    max_depth: int = 1
    request_timeout: float = 10.0
    total_timeout: float = 60.0
    delay: float = 0.3
    respect_robots: bool = True


@dataclass
class _State:
    pages: list = field(default_factory=list)
    errors: list = field(default_factory=list)
    skipped_robots: list = field(default_factory=list)
    bytes_downloaded: int = 0


def _fetch(client: httpx.Client, url: str, accept_types: tuple[str, ...] | None) -> tuple[httpx.Response, str, str]:
    """GET with manual redirect handling so each hop is SSRF-checked. Returns (response, final_url, body)."""
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        assert_safe_url(current)
        with client.stream("GET", current) as resp:
            if resp.is_redirect and "location" in resp.headers:
                current = urljoin(current, resp.headers["location"])
                continue
            ctype = resp.headers.get("content-type", "").split(";")[0].strip().lower()
            if accept_types and resp.status_code < 400 and ctype and ctype not in accept_types:
                raise FetchError(f"unsupported content-type '{ctype}'")
            chunks, size = [], 0
            for chunk in resp.iter_bytes():
                size += len(chunk)
                if size > MAX_BYTES:
                    raise FetchError(f"response larger than {MAX_BYTES // 1_000_000} MB limit")
                chunks.append(chunk)
            body = b"".join(chunks)
            encoding = resp.encoding or "utf-8"
            try:
                text = body.decode(encoding, errors="replace")
            except LookupError:
                text = body.decode("utf-8", errors="replace")
            return resp, current, text
    raise FetchError(f"too many redirects (> {MAX_REDIRECTS})")


def _load_robots(client: httpx.Client, base_url: str, log: Logger) -> urllib.robotparser.RobotFileParser | None:
    parts = urlsplit(base_url)
    robots_url = f"{parts.scheme}://{parts.netloc}/robots.txt"
    rp = urllib.robotparser.RobotFileParser()
    try:
        resp, _, text = _fetch(client, robots_url, None)
    except (httpx.HTTPError, FetchError, UnsafeURLError) as exc:
        log("warning", f"robots.txt unavailable ({type(exc).__name__}); proceeding with care")
        return None
    if resp.status_code >= 500:
        log("warning", f"robots.txt returned HTTP {resp.status_code}; treating site as disallowed (RFC 9309)")
        rp.disallow_all = True
        return rp
    if resp.status_code >= 400:
        log("info", f"no robots.txt (HTTP {resp.status_code}); all paths allowed")
        return None
    rp.parse(text.splitlines())
    log("info", "robots.txt loaded and will be respected")
    return rp


def _link_priority(url: str) -> int:
    path = urlsplit(url).path.lower()
    return 0 if any(w in path for w in PRIORITY_WORDS) else 1


def _is_crawlable(url: str, site_host: str) -> bool:
    parts = urlsplit(url)
    if (parts.hostname or "").removeprefix("www.") != site_host.removeprefix("www."):
        return False
    path = parts.path.lower()
    if path.endswith(SKIP_EXTENSIONS) or any(w in path for w in SKIP_PATH_WORDS):
        return False
    return len(parts.query) <= 100


def crawl(cfg: CrawlConfig, log: Logger) -> dict:
    started = time.monotonic()
    started_at = datetime.now(timezone.utc).isoformat()
    deadline = started + cfg.total_timeout
    state = _State()
    start_url = canonicalize(cfg.url)
    site_host = urlsplit(start_url).hostname or ""
    timed_out = False
    blocked_by_robots = False
    final_start_url = start_url

    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5"}
    timeout = httpx.Timeout(cfg.request_timeout, connect=min(cfg.request_timeout, 8.0))
    with httpx.Client(headers=headers, timeout=timeout, follow_redirects=False, trust_env=False) as client:
        robots = _load_robots(client, start_url, log) if cfg.respect_robots else None

        def key(u: str) -> str:  # http/https and trailing-slash variants are the same page
            return u.split("://", 1)[-1].rstrip("/")

        queue: list[tuple[str, int]] = [(start_url, 0)]
        seen = {key(start_url)}
        while queue and len(state.pages) < cfg.max_pages:
            if time.monotonic() > deadline:
                timed_out = True
                log("warning", f"total time budget of {cfg.total_timeout:.0f}s reached; stopping early")
                break
            url, depth = queue.pop(0)
            if robots is not None and not robots.can_fetch(USER_AGENT, url):
                state.skipped_robots.append(url)
                log("warning", f"skipped (disallowed by robots.txt): {url}")
                if url == start_url:
                    blocked_by_robots = True
                continue

            log("info", f"fetching [{len(state.pages) + 1}/{cfg.max_pages}] depth={depth} {url}")
            t0 = time.monotonic()
            try:
                resp, final_url, body = _fetch(client, url, HTML_TYPES)
            except UnsafeURLError as exc:
                state.errors.append({"url": url, "error": str(exc)})
                log("error", f"blocked: {exc}")
                continue
            except httpx.TimeoutException:
                state.errors.append({"url": url, "error": f"request timed out after {cfg.request_timeout:.0f}s"})
                log("error", f"timeout: {url}")
                continue
            except (httpx.HTTPError, FetchError) as exc:
                msg = str(exc) or type(exc).__name__
                state.errors.append({"url": url, "error": msg})
                log("error", f"failed: {url} ({msg})")
                continue

            elapsed_ms = int((time.monotonic() - t0) * 1000)
            state.bytes_downloaded += len(body.encode("utf-8", errors="ignore"))
            if url == start_url:
                final_start_url = canonicalize(final_url)
                site_host = urlsplit(final_url).hostname or site_host  # follow e.g. example.com -> www.example.com
            if resp.status_code >= 400:
                state.errors.append({"url": url, "error": f"HTTP {resp.status_code}", "status_code": resp.status_code})
                log("error", f"HTTP {resp.status_code}: {url}")
                continue

            page = extract_page(body, canonicalize(final_url), site_host)
            page.update({"depth": depth, "status_code": resp.status_code, "fetch_ms": elapsed_ms})
            state.pages.append(page)
            log("page", f"ok {resp.status_code} in {elapsed_ms}ms: {page['title'] or final_url}",
                url=final_url, status=resp.status_code, words=page["word_count"])

            if depth < cfg.max_depth:
                candidates = [l["url"] for l in page["internal_links"] if _is_crawlable(l["url"], site_host)]
                new: list[str] = []
                for u in candidates:
                    if key(u) not in seen:
                        seen.add(key(u))
                        new.append(u)
                new.sort(key=_link_priority)
                queue.extend((u, depth + 1) for u in new)
            if queue and cfg.delay:
                time.sleep(cfg.delay)  # be polite to the target server

    duration_ms = int((time.monotonic() - started) * 1000)
    if state.pages and not state.errors and not timed_out:
        status = "success"
    elif state.pages:
        status = "partial"
    else:
        status = "failed"

    return {
        "tool": "taskpilot-crawler",
        "version": __version__,
        "status": status,
        "start_url": start_url,
        "final_url": final_start_url,
        "blocked_by_robots": blocked_by_robots,
        "timed_out": timed_out,
        "started_at": started_at,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "duration_ms": duration_ms,
        "limits": {
            "max_pages": cfg.max_pages, "max_depth": cfg.max_depth,
            "request_timeout_s": cfg.request_timeout, "total_timeout_s": cfg.total_timeout,
            "max_bytes_per_page": MAX_BYTES, "respect_robots": cfg.respect_robots,
        },
        "stats": {
            "pages_crawled": len(state.pages),
            "pages_failed": len(state.errors),
            "pages_skipped_robots": len(state.skipped_robots),
            "bytes_downloaded": state.bytes_downloaded,
        },
        "pages": state.pages,
        "errors": state.errors,
        "skipped_by_robots": state.skipped_robots,
    }
