import asyncio
import json
import sys

import pytest

from app.ai.intent_engine import parse_with_rules
from app.core.security import redact
from app.orchestrator.cli_manager import ProcessResult, run_cli
from app.orchestrator.tool_registry import APPROVED_TOOLS
from app.services.output_processor import process_output
from taskpilot_cli.netguard import UnsafeURLError, assert_safe_url, normalize_url


# ---------------------------------------------------------------- URL safety
@pytest.mark.parametrize("url", [
    "http://localhost/admin", "http://127.0.0.1:8000", "http://10.0.0.5", "http://192.168.1.1",
    "http://169.254.169.254/latest/meta-data", "http://[::1]/", "file:///etc/passwd", "ftp://example.com",
    "https://user:pass@example.com", "http://intranet", "javascript:alert(1)",
])
def test_unsafe_urls_rejected(url):
    with pytest.raises(UnsafeURLError):
        assert_safe_url(url, resolve=False)


def test_normalize_adds_scheme_and_strips_fragment():
    assert normalize_url("example.com/about#team") == "https://example.com/about"


# ---------------------------------------------------------------- intent parsing
def test_mandatory_prompt_parsed():
    plan = parse_with_rules("Crawl https://example.com, extract the important information, give me a summary, "
                            "and return the extracted data in JSON format.")
    assert plan.intent == "website_crawl"
    assert plan.url == "https://example.com"
    assert plan.wants_json and plan.wants_summary


def test_page_count_and_homepage_only():
    assert parse_with_rules("crawl 3 pages of quotes.toscrape.com").max_pages == 3
    p = parse_with_rules("analyse only the homepage of https://python.org")
    assert p.max_pages == 1 and p.max_depth == 0


def test_page_count_is_clamped():
    assert parse_with_rules("crawl 500 pages of example.com").max_pages <= 10


def test_non_task_requests_never_reach_cli():
    assert parse_with_rules("hello").intent == "help"
    assert parse_with_rules("run rm -rf / on the server").intent == "unsupported"
    assert parse_with_rules("please crawl the website").intent == "unsupported"  # no URL


def test_argv_has_no_shell_and_url_is_bound_to_flag():
    plan = parse_with_rules("crawl https://example.com")
    argv = APPROVED_TOOLS["site-crawler"].build_argv(plan)
    assert argv[1:4] == ["-m", "taskpilot_cli", "crawl"]
    assert "--url=https://example.com" in argv


# ---------------------------------------------------------------- output processing
def _proc(stdout, code=0, **kw):
    return ProcessResult(argv=["x"], exit_code=code, stdout=stdout, **kw)


def test_invalid_json_is_failure():
    assert process_output(_proc("not json")).status == "failed"


def test_empty_output_is_failure():
    assert process_output(_proc("", code=3)).status == "failed"


def test_timeout_and_cancel_reported_honestly():
    assert process_output(_proc("", code=None, timed_out=True)).status == "failed"
    assert process_output(_proc("", code=None, cancelled=True)).status == "cancelled"


def test_valid_output_completed():
    payload = {"tool": "taskpilot-crawler", "status": "success", "start_url": "https://example.com/",
               "final_url": "https://example.com/", "pages": [{"url": "https://example.com/", "title": "Example"}],
               "stats": {"pages_crawled": 1}}
    out = process_output(_proc(json.dumps(payload)))
    assert out.status == "completed" and out.crawl.pages[0].title == "Example"


def test_partial_when_some_pages_fail():
    payload = {"tool": "t", "status": "partial", "pages": [{"url": "https://a.com/"}],
               "errors": [{"url": "https://a.com/x", "error": "HTTP 500"}]}
    assert process_output(_proc(json.dumps(payload), code=1)).status == "partial"


def test_redaction():
    assert "AIza" not in redact("key AIzaSyA1234567890abcdefghijklmnopqrstuv")
    assert "sk-" not in redact("Authorization sk-abcdefghijklmnopqrstuvwxyz123")


# ---------------------------------------------------------------- process control
def test_timeout_kills_process():
    argv = [sys.executable, "-c", "import time; time.sleep(30)"]
    res = asyncio.run(run_cli(argv, cwd=".", timeout=1.5))
    assert res.timed_out and res.duration_ms < 10_000


def test_cancel_kills_process():
    async def go():
        ev = asyncio.Event()
        asyncio.get_running_loop().call_later(0.5, ev.set)
        return await run_cli([sys.executable, "-c", "import time; time.sleep(30)"], cwd=".", timeout=20, cancel_event=ev)
    res = asyncio.run(go())
    assert res.cancelled and res.duration_ms < 10_000


def test_stdout_stderr_exit_code_captured():
    code = "import sys; sys.stderr.write('progress\\n'); print('{\"ok\": 1}'); sys.exit(3)"
    lines = []

    async def on_err(line):
        lines.append(line)
    res = asyncio.run(run_cli([sys.executable, "-c", code], cwd=".", timeout=10, on_stderr=on_err))
    assert res.exit_code == 3 and json.loads(res.stdout) == {"ok": 1} and lines == ["progress"]
