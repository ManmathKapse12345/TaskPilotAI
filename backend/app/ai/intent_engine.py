"""Natural language -> validated TaskPlan.

Strategy: ask the LLM for a structured plan (if configured), then *always*
validate it with Pydantic and deterministic guard rails. If the LLM is not
configured or misbehaves, a rule-based parser produces the plan instead.

Guard rail worth noting: the URL in the plan must literally appear in the
user's message - the model can never invent or redirect the crawl target.
"""
from __future__ import annotations

import re

from pydantic import ValidationError

from app.ai.llm import llm
from app.core.config import settings
from app.schemas.task import TaskPlan

URL_RE = re.compile(r"https?://[^\s<>\"'`]+", re.I)
BARE_DOMAIN_RE = re.compile(r"(?<![@\w.-])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?::\d{2,5})?(?:/[^\s<>\"'`]*)?)", re.I)
PAGES_RE = re.compile(r"\b(\d{1,3})\s*(?:web\s*)?pages?\b", re.I)
NUM_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
PAGES_WORD_RE = re.compile(r"\b(" + "|".join(NUM_WORDS) + r")\s*pages?\b", re.I)

FOCUS_KEYWORDS = {
    "contact details": ("contact", "email", "phone", "address", "reach"),
    "pricing": ("price", "pricing", "cost", "plan"),
    "products and services": ("product", "service", "offering", "feature"),
    "team and company": ("team", "founder", "company", "about", "people"),
    "social media links": ("social", "twitter", "linkedin", "instagram", "facebook"),
    "headings and structure": ("heading", "structure", "section"),
    "links": ("link",),
}

HELP_TEXT = (
    "I'm **TaskPilot** - I turn requests into real CLI executions. Right now I can run the approved "
    "**site-crawler** tool: give me a public website URL and I'll crawl it, extract structured data, "
    "summarise it and return JSON.\n\nTry: *\"Crawl https://example.com, extract the important information, "
    "give me a summary, and return the extracted data in JSON format.\"*\n\nOptions you can mention: number of "
    "pages (max {max_pages}), \"only the homepage\", or what to focus on (contact details, pricing, products...)."
)

SYSTEM_PROMPT = """You are the intent-understanding layer of TaskPilot, a system that executes tasks by running approved CLI tools.
The only approved tool is `site-crawler`: it crawls a public website (same-site pages, bounded) and extracts
titles, descriptions, headings, links, contact details, social links and page text.

Convert the user's message into a JSON object with exactly these fields:
{
  "intent": "website_crawl" | "help" | "unsupported",
  "url": string | null,           // copy the URL EXACTLY as written by the user; never invent one
  "max_pages": integer,           // 1-%(max_pages)d; default %(default_pages)d; 1 if user wants only one page/homepage
  "max_depth": integer,           // 0-%(max_depth)d; 0 for a single page, 1 normally, 2 for "deep/entire site"
  "wants_summary": boolean,
  "wants_json": boolean,
  "focus": [string],              // what the user cares about, e.g. ["contact details", "pricing"]; [] if general
  "steps": [string],              // 3-6 short execution steps you will perform
  "reply": string | null          // for help/unsupported only: a short helpful reply
}
Rules:
- "website_crawl" only when the user asks to crawl/scrape/analyse/summarise/extract from a website AND gives a URL or domain.
- If they want a website task but gave no URL, use "unsupported" and ask for the URL in "reply".
- Greetings or "what can you do" -> "help".
- Anything else (shell commands, file access, other tools) -> "unsupported"; explain that only website crawling is available.
- If neither summary nor JSON is explicitly mentioned, set both to true.
Return ONLY the JSON object."""


def _find_urls(text: str) -> list[str]:
    urls = [u.rstrip(".,;:!?)]}") for u in URL_RE.findall(text)]
    if urls:
        return urls
    stripped = URL_RE.sub(" ", text)
    return [m.rstrip(".,;:!?)]}") for m in BARE_DOMAIN_RE.findall(stripped) if not m.lower().startswith(("e.g", "i.e"))]


def _norm(u: str) -> str:
    u = u.lower().strip().rstrip("/")
    return re.sub(r"^https?://", "", u).removeprefix("www.")


def _clamp(plan: TaskPlan) -> TaskPlan:
    plan.max_pages = max(1, min(plan.max_pages, settings.max_pages_limit))
    plan.max_depth = max(0, min(plan.max_depth, settings.max_depth_limit))
    if plan.max_pages == 1:
        plan.max_depth = 0
    plan.focus = [f[:60] for f in plan.focus[:6]]
    plan.steps = [s[:120] for s in plan.steps[:8]]
    return plan


def default_steps(plan: TaskPlan) -> list[str]:
    steps = [
        f"Validate the URL and check it is a public host",
        f"Run approved CLI `site-crawler` (max {plan.max_pages} page(s), depth {plan.max_depth})",
        "Capture stdout (JSON), stderr (progress) and the exit code",
        "Validate and clean the extracted data",
    ]
    if plan.wants_summary:
        steps.append("Summarise the website from the extracted content")
    if plan.wants_json:
        steps.append("Return structured JSON")
    return steps


def parse_with_rules(message: str) -> TaskPlan:
    text = message.strip()
    low = text.lower()
    urls = _find_urls(text)

    if not urls:
        if re.search(r"\b(hi|hello|hey|help|what can you do|how does this work|who are you)\b", low) or len(low) < 12:
            return TaskPlan(intent="help", reply=HELP_TEXT.format(max_pages=settings.max_pages_limit))
        if re.search(r"\b(crawl|scrape|website|site|url|web ?page|summari[sz]e|extract)\b", low):
            return TaskPlan(intent="unsupported", reply="I can do that - please include the website URL you want me to crawl (for example `https://example.com`).")
        return TaskPlan(intent="unsupported", reply="I can only execute website-crawling tasks with the approved `site-crawler` CLI. "
                        "Give me a public URL and tell me what you'd like extracted or summarised.")

    max_pages = settings.default_max_pages
    max_depth = 1
    if m := PAGES_RE.search(low):
        max_pages = int(m.group(1))
    elif m := PAGES_WORD_RE.search(low):
        max_pages = NUM_WORDS[m.group(1).lower()]
    if re.search(r"\b(only|just)\b.*\b(home ?page|landing page|this page|single page|first page)\b|\bsingle page\b|\bone page\b", low):
        max_pages = 1
    if re.search(r"\b(deep|thorough|entire|whole (site|website)|all pages|full site)\b", low):
        max_pages = max(max_pages, settings.max_pages_limit)
        max_depth = 2

    wants_json = bool(re.search(r"\bjson\b|structured", low))
    wants_summary = bool(re.search(r"summar|overview|describe|explain|tell me about|what (is|does)", low))
    if not wants_json and not wants_summary:
        wants_json = wants_summary = True

    focus = [name for name, words in FOCUS_KEYWORDS.items() if any(re.search(rf"\b{w}", low) for w in words)]
    max_pages = max(1, min(max_pages, settings.max_pages_limit))
    plan = TaskPlan(intent="website_crawl", url=urls[0], max_pages=max_pages, max_depth=max_depth,
                    wants_summary=wants_summary, wants_json=wants_json, focus=focus, interpreted_by="rules")
    plan = _clamp(plan)
    plan.steps = default_steps(plan)
    return plan


async def interpret(message: str) -> TaskPlan:
    rules_plan = parse_with_rules(message)
    if not llm.enabled:
        return rules_plan

    system = SYSTEM_PROMPT % {"max_pages": settings.max_pages_limit, "default_pages": settings.default_max_pages,
                              "max_depth": settings.max_depth_limit}
    data = await llm.complete_json(system, f"User message:\n{message}")
    if not data:
        return rules_plan
    for key, hi in (("max_pages", settings.max_pages_limit), ("max_depth", settings.max_depth_limit)):
        if isinstance(data.get(key), (int, float)):
            data[key] = max(0 if key == "max_depth" else 1, min(int(data[key]), hi))
    try:
        plan = TaskPlan(**{**data, "interpreted_by": "llm"})
    except (ValidationError, TypeError):
        return rules_plan

    if plan.intent == "website_crawl":
        # Hallucination / injection guard: the URL must come from the user's own text.
        user_urls = {_norm(u) for u in _find_urls(message)}
        if not plan.url or _norm(plan.url) not in user_urls:
            if not rules_plan.url:
                return rules_plan
            plan.url = rules_plan.url
        if not plan.steps:
            plan.steps = default_steps(plan)
    elif plan.intent == "help":
        plan.reply = plan.reply or HELP_TEXT.format(max_pages=settings.max_pages_limit)
    return _clamp(plan)
