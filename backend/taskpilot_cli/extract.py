"""HTML -> structured data extraction for a single page."""
from __future__ import annotations

import json
import re
from urllib.parse import urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}\b")
SOCIAL_DOMAINS = {
    "twitter.com": "twitter", "x.com": "x", "linkedin.com": "linkedin", "facebook.com": "facebook",
    "instagram.com": "instagram", "github.com": "github", "youtube.com": "youtube",
    "tiktok.com": "tiktok", "medium.com": "medium", "discord.gg": "discord", "t.me": "telegram",
}
NOISE_TAGS = ["script", "style", "noscript", "svg", "template", "iframe", "form", "nav", "footer", "header", "aside"]
MAX_TEXT_CHARS = 5000


def _clean(text: str | None, limit: int = 300) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    return text[:limit]


def canonicalize(url: str) -> str:
    parts = urlsplit(url)
    path = re.sub(r"/{2,}", "/", parts.path or "/")
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, parts.query, ""))


def _meta(soup: BeautifulSoup, *names: str) -> str:
    for name in names:
        tag = soup.find("meta", attrs={"name": name}) or soup.find("meta", attrs={"property": name})
        if tag and tag.get("content"):
            return _clean(tag["content"], 500)
    return ""


def _social_platform(host: str) -> str | None:
    host = host.lower().removeprefix("www.")
    for domain, name in SOCIAL_DOMAINS.items():
        if host == domain or host.endswith("." + domain):
            return name
    return None


def extract_page(html: str, page_url: str, site_host: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    title = _clean(soup.title.string if soup.title and soup.title.string else _meta(soup, "og:title"), 300)
    html_tag = soup.find("html")
    language = _clean(html_tag.get("lang") if html_tag else "", 20)
    canonical_tag = soup.find("link", rel=lambda v: v and "canonical" in v)

    # JSON-LD structured data types (e.g. Organization, Product, Article)
    ld_types: list[str] = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        items = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        for item in items:
            if isinstance(item, dict) and item.get("@type"):
                t = item["@type"]
                ld_types.extend(t if isinstance(t, list) else [t])

    headings = []
    for tag in soup.find_all(["h1", "h2", "h3"]):
        text = _clean(tag.get_text(" "), 200)
        if text:
            headings.append({"level": int(tag.name[1]), "text": text})
        if len(headings) >= 40:
            break

    internal_links: dict[str, str] = {}
    external_links: dict[str, str] = {}
    social_links: dict[str, str] = {}
    emails: set[str] = set()
    phones: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        low = href.lower()
        if low.startswith("mailto:"):
            addr = href[7:].split("?")[0].strip()
            if EMAIL_RE.fullmatch(addr):
                emails.add(addr.lower())
            continue
        if low.startswith("tel:"):
            num = re.sub(r"[^\d+]", "", href[4:])
            if 6 <= len(num) <= 16:
                phones.add(num)
            continue
        if low.startswith(("javascript:", "data:", "#")):
            continue
        absolute = urljoin(page_url, href)
        parts = urlsplit(absolute)
        if parts.scheme not in ("http", "https"):
            continue
        absolute = canonicalize(absolute)
        text = _clean(a.get_text(" "), 120) or _clean(a.get("aria-label") or a.get("title"), 120)
        host = (parts.hostname or "").lower()
        platform = _social_platform(host)
        if platform:
            social_links.setdefault(absolute, platform)
        elif host.removeprefix("www.") == site_host.removeprefix("www."):
            internal_links.setdefault(absolute, text)
        else:
            external_links.setdefault(absolute, text)

    images = []
    for img in soup.find_all("img", src=True)[:200]:
        alt = _clean(img.get("alt"), 150)
        if alt and len(images) < 10:
            images.append({"src": urljoin(page_url, img["src"]), "alt": alt})
    image_count = len(soup.find_all("img"))

    # Main readable text: drop boilerplate, prefer <main>/<article>
    for tag in soup.find_all(NOISE_TAGS):
        tag.decompose()
    root = soup.find("main") or soup.find("article") or soup.body or soup
    text = _clean(root.get_text(" "), 10**7)
    emails.update(e.lower() for e in EMAIL_RE.findall(text)[:20] if not e.lower().endswith((".png", ".jpg", ".svg", ".webp")))

    return {
        "url": page_url,
        "title": title,
        "description": _meta(soup, "description", "og:description", "twitter:description"),
        "keywords": _meta(soup, "keywords"),
        "language": language,
        "canonical_url": canonical_tag.get("href", "") if canonical_tag else "",
        "open_graph": {
            k: v for k, v in {
                "site_name": _meta(soup, "og:site_name"),
                "type": _meta(soup, "og:type"),
                "image": _meta(soup, "og:image"),
            }.items() if v
        },
        "headings": headings,
        "internal_links": [{"url": u, "text": t} for u, t in list(internal_links.items())[:60]],
        "external_links": [{"url": u, "text": t} for u, t in list(external_links.items())[:40]],
        "social_links": [{"platform": p, "url": u} for u, p in social_links.items()],
        "emails": sorted(emails)[:20],
        "phones": sorted(phones)[:20],
        "images": images,
        "image_count": image_count,
        "structured_data_types": sorted(set(map(str, ld_types)))[:20],
        "word_count": len(text.split()),
        "text_excerpt": text[:MAX_TEXT_CHARS],
    }
