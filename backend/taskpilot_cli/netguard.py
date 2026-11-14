"""Network safety checks shared by the crawler CLI and the backend.

Blocks SSRF-style targets: non-HTTP schemes, embedded credentials, and any
host that resolves to a loopback / private / link-local / reserved address.
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlsplit, urlunsplit

MAX_URL_LENGTH = 2048
ALLOWED_SCHEMES = {"http", "https"}
BLOCKED_HOSTNAMES = {"localhost", "localhost.localdomain", "metadata.google.internal"}


class UnsafeURLError(ValueError):
    """Raised when a URL is malformed or points somewhere we refuse to go."""


def normalize_url(raw: str) -> str:
    """Trim, add a scheme if missing, and drop the fragment."""
    url = (raw or "").strip().strip("<>\"'()[],.;")
    if not url:
        raise UnsafeURLError("URL is empty")
    if "://" not in url:
        url = "https://" + url
    parts = urlsplit(url)
    path = parts.path or "/"
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, parts.query, ""))


def validate_url_syntax(url: str) -> str:
    """Static checks that need no network access. Returns the hostname."""
    if len(url) > MAX_URL_LENGTH:
        raise UnsafeURLError(f"URL is longer than {MAX_URL_LENGTH} characters")
    if any(c.isspace() for c in url) or any(ord(c) < 32 for c in url):
        raise UnsafeURLError("URL contains whitespace or control characters")
    try:
        parts = urlsplit(url)
        port = parts.port  # raises ValueError for a bad port
    except ValueError as exc:
        raise UnsafeURLError(f"URL is malformed: {exc}") from None
    if parts.scheme not in ALLOWED_SCHEMES:
        raise UnsafeURLError(f"Only http/https URLs are allowed (got '{parts.scheme or 'none'}')")
    if parts.username or parts.password:
        raise UnsafeURLError("URLs with embedded credentials are not allowed")
    host = (parts.hostname or "").rstrip(".")
    if not host:
        raise UnsafeURLError("URL has no hostname")
    if host in BLOCKED_HOSTNAMES or host.endswith(".localhost") or host.endswith(".internal") or host.endswith(".local"):
        raise UnsafeURLError(f"Host '{host}' is not allowed")
    if port is not None and not (1 <= port <= 65535):
        raise UnsafeURLError("URL port is out of range")
    # Literal IPs are checked immediately; hostnames need DNS (see check_host_resolves_public)
    try:
        ip = ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        if "." not in host:
            raise UnsafeURLError(f"Host '{host}' is not a public domain name") from None
    else:
        _ensure_public_ip(ip, host)
    return host


def _ensure_public_ip(ip: ipaddress._BaseAddress, host: str) -> None:
    if not ip.is_global or ip.is_multicast:
        raise UnsafeURLError(f"Host '{host}' resolves to a non-public address ({ip}); private networks are blocked")


def check_host_resolves_public(host: str) -> None:
    """Resolve DNS and make sure *every* address is public (SSRF protection)."""
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise UnsafeURLError(f"Could not resolve host '{host}' (DNS lookup failed)") from None
    if not infos:
        raise UnsafeURLError(f"Host '{host}' did not resolve to any address")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        _ensure_public_ip(ip, host)


def assert_safe_url(url: str, resolve: bool = True) -> str:
    host = validate_url_syntax(url)
    if resolve:
        check_host_resolves_public(host)
    return host
