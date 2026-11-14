"""Security helpers: URL validation (re-uses the CLI's SSRF guard) and secret redaction."""
from __future__ import annotations

import os
import re

from taskpilot_cli.netguard import UnsafeURLError, assert_safe_url, normalize_url

from .config import settings

__all__ = ["UnsafeURLError", "validate_target_url", "redact", "safe_subprocess_env"]

_KEY_PATTERNS = [
    re.compile(r"AIza[0-9A-Za-z_\-]{30,}"),          # Google API keys
    re.compile(r"sk-[A-Za-z0-9_\-]{20,}"),           # OpenAI-style keys
    re.compile(r"(?i)(api[_-]?key|token|secret|password)\s*[=:]\s*\S+"),
]


def validate_target_url(raw: str) -> str:
    """Normalize + validate a user-supplied URL. Raises UnsafeURLError."""
    url = normalize_url(raw)
    assert_safe_url(url, resolve=True)
    return url


def redact(text: str) -> str:
    """Strip secrets from anything that could reach logs, the DB, or the chat."""
    if not text:
        return text
    for secret in settings.secret_values():
        text = text.replace(secret, "[REDACTED]")
    for pattern in _KEY_PATTERNS:
        text = pattern.sub("[REDACTED]", text)
    return text


def safe_subprocess_env() -> dict[str, str]:
    """Least-privilege environment for the CLI: no API keys or app secrets are inherited."""
    keep = ("PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE", "LANG", "LC_ALL", "SSL_CERT_FILE")
    env = {k: os.environ[k] for k in keep if k in os.environ}
    env.update({"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", "PYTHONUNBUFFERED": "1"})
    return env
