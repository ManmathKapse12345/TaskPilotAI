"""Command-line entry point.

    python -m taskpilot_cli crawl --url https://example.com --max-pages 5 --max-depth 1

Contract with the backend:
  * stdout  -> exactly one JSON document (the crawl result) - machine readable
  * stderr  -> JSON-lines progress events {"event": "log"|"page", "level", "msg", ...}
  * exit code:
        0  success          - every attempted page was crawled
        1  partial          - some pages crawled, some failed / time budget hit
        2  invalid input    - bad arguments or unsafe URL (nothing fetched)
        3  failed           - no page could be crawled (network/HTTP errors)
        4  robots blocked   - the start URL is disallowed by robots.txt
        5  internal error   - unexpected crash
"""
from __future__ import annotations

import argparse
import json
import sys
import time

from . import __version__
from .crawler import CrawlConfig, crawl
from .netguard import UnsafeURLError, assert_safe_url, normalize_url

EXIT_SUCCESS, EXIT_PARTIAL, EXIT_INVALID, EXIT_FAILED, EXIT_ROBOTS, EXIT_INTERNAL = 0, 1, 2, 3, 4, 5


def _emit(event: str, level: str, msg: str, **extra) -> None:
    sys.stderr.write(json.dumps({"event": event, "level": level, "msg": msg, "ts": round(time.time(), 3), **extra}) + "\n")
    sys.stderr.flush()


def _log(level: str, msg: str, **extra) -> None:
    _emit("page" if level == "page" else "log", "info" if level == "page" else level, msg, **extra)


def _bounded_int(lo: int, hi: int):
    def parse(value: str) -> int:
        n = int(value)
        if not lo <= n <= hi:
            raise argparse.ArgumentTypeError(f"must be between {lo} and {hi}")
        return n
    return parse


def _bounded_float(lo: float, hi: float):
    def parse(value: str) -> float:
        n = float(value)
        if not lo <= n <= hi:
            raise argparse.ArgumentTypeError(f"must be between {lo} and {hi}")
        return n
    return parse


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="taskpilot_cli", description="TaskPilot approved CLI tools")
    parser.add_argument("--version", action="version", version=f"taskpilot_cli {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    c = sub.add_parser("crawl", help="Crawl a website and extract structured data as JSON")
    c.add_argument("--url", required=True, help="Start URL (http/https, public hosts only)")
    c.add_argument("--max-pages", type=_bounded_int(1, 20), default=5)
    c.add_argument("--max-depth", type=_bounded_int(0, 3), default=1)
    c.add_argument("--timeout", type=_bounded_float(1, 30), default=10.0, help="Per-request timeout (s)")
    c.add_argument("--total-timeout", type=_bounded_float(5, 300), default=60.0, help="Whole crawl budget (s)")
    c.add_argument("--delay", type=_bounded_float(0, 5), default=0.3, help="Politeness delay between requests (s)")
    c.add_argument("--pretty", action="store_true", help="Pretty-print the JSON output")
    return parser


def main(argv: list[str] | None = None) -> int:
    # Windows consoles default to a legacy code page; force UTF-8 so JSON never breaks.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    parser = build_parser()
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:  # argparse already printed usage to stderr
        return EXIT_INVALID if exc.code else EXIT_SUCCESS

    try:
        url = normalize_url(args.url)
        _log("info", f"validating target {url}")
        assert_safe_url(url)
    except UnsafeURLError as exc:
        _log("error", f"invalid URL: {exc}")
        print(json.dumps({"tool": "taskpilot-crawler", "status": "failed", "error": str(exc), "error_type": "invalid_input"}))
        return EXIT_INVALID

    cfg = CrawlConfig(url=url, max_pages=args.max_pages, max_depth=args.max_depth,
                      request_timeout=args.timeout, total_timeout=args.total_timeout, delay=args.delay)
    _log("info", f"crawl started: max_pages={cfg.max_pages} max_depth={cfg.max_depth} timeout={cfg.request_timeout}s")
    try:
        result = crawl(cfg, _log)
    except Exception as exc:  # never die silently: report on stderr + structured stdout
        _log("error", f"internal crawler error: {type(exc).__name__}: {exc}")
        print(json.dumps({"tool": "taskpilot-crawler", "status": "failed", "error": f"{type(exc).__name__}: {exc}", "error_type": "internal"}))
        return EXIT_INTERNAL

    print(json.dumps(result, ensure_ascii=False, indent=2 if args.pretty else None))
    s = result["stats"]
    _log("info", f"crawl finished: status={result['status']} pages={s['pages_crawled']} failed={s['pages_failed']} in {result['duration_ms']}ms")

    if result["blocked_by_robots"] and not result["pages"]:
        return EXIT_ROBOTS
    return {"success": EXIT_SUCCESS, "partial": EXIT_PARTIAL}.get(result["status"], EXIT_FAILED)


if __name__ == "__main__":
    sys.exit(main())
