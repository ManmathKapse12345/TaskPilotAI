# TaskPilot AI

**AI-powered chat-to-CLI execution platform.** *Don't just ask AI. Let it execute.*

TaskPilot takes a natural-language request, interprets it into a structured task plan, launches an
**approved CLI tool as a real OS process** from the backend, streams the process's live progress into the
chat, captures `stdout` / `stderr` / exit code, validates the output, and returns a verified summary and
structured JSON. It also reports partial results, failures, timeouts and cancellations honestly.

Built for **BuildSprint Round 2: CLI-Driven AI Chat Execution for Complex Tasks**.

---

## Architecture

```
 ┌───────────────────────────── Next.js 16 + TypeScript + Tailwind ──────────────────────────────┐
 │  Chat UI · live Execution Inspector (stages, command, PID, exit code, live logs)               │
 │  Result tabs: Summary | Extracted Data | JSON Output (copy/download) | Execution Logs           │
 │  Execution history · Cancel · Retry                                                            │
 └──────────────┬────────────────────────────────────────────────▲───────────────────────────────┘
   POST /api/chat│                       GET /api/tasks/{id}/events (Server-Sent Events)
                 ▼                                                │
 ┌────────────────────────────────────── FastAPI backend ───────────────────────────────────────┐
 │ 1 Intent engine   app/ai/intent_engine.py   LLM (Gemini/OpenAI) → Pydantic TaskPlan,          │
 │                                             rule-based fallback, URL must come from user text  │
 │ 2 Validation      app/core/security.py      URL syntax, DNS → block private/loopback IPs      │
 │ 3 Tool registry   app/orchestrator/tool_registry.py  allow-list → fixed argv (no shell)        │
 │ 4 CLI manager     app/orchestrator/cli_manager.py    Popen(shell=False), minimal env,          │
 │                                             live stderr, timeout kill, cancel kill            │
 │ 5 Output processor app/services/output_processor.py  JSON parse + Pydantic schema + exit code │
 │                                             → completed / partial / failed / cancelled        │
 │ 6 Summarizer      app/ai/summarizer.py      LLM over *untrusted* crawled data, or extractive  │
 │ History           app/database/db.py        SQLAlchemy (SQLite default, Postgres via URL)     │
 └──────────────┬────────────────────────────────────────────────▲──────────────────────────────┘
                │ python -m taskpilot_cli crawl --url=… --max-pages=… …   stdout: JSON result
                ▼                                                │ stderr: JSON-lines progress
 ┌──────────────────────── taskpilot_cli (approved CLI tool: site-crawler) ───────────────────────┐
 │ httpx + BeautifulSoup · robots.txt · same-site BFS · page/depth/time/size limits ·             │
 │ SSRF check on every URL and every redirect hop · exit codes 0/1/2/3/4/5                        │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Request lifecycle

| # | Stage | What really happens |
|---|-------|---------------------|
| 1 | Understanding request | LLM (or rules) converts the prompt into a `TaskPlan` (`intent`, `url`, `max_pages`, `max_depth`, `wants_summary`, `wants_json`, `focus`). Validated with Pydantic and clamped to limits. |
| 2 | Validation | URL normalised, scheme/credentials checked, DNS resolved, **every** resolved IP must be public. |
| 3 | Prepare | The registry maps `website_crawl` → `site-crawler` and builds a fixed argv list. User text never becomes a shell string. |
| 4 | Execute | `subprocess.Popen([...], shell=False)` with a stripped environment (API keys are **not** inherited). stderr is streamed line by line to the UI. A hard timeout or the Cancel button kills the process. |
| 5 | Capture & validate | stdout is parsed as JSON and validated against `CrawlOutput`. Status is decided from the exit code **and** the data, never assumed. |
| 6 | Respond | The summary is generated **only from captured CLI data**, and the JSON is cleaned and deduplicated. Everything is stored in history. |

## Why a custom CLI?

The crawler is a self-contained CLI (`backend/taskpilot_cli`) and not an in-process library call:

* It runs in its **own process**. A crash, hang or memory spike in the crawler cannot take down the API, and the process can be killed on timeout or cancel.
* It has a **strict, documented contract**: one JSON document on stdout, JSON-lines progress on stderr, and meaningful exit codes. The backend can verify every run.
* It **enforces its own safety limits** (page/depth/time/size caps, robots.txt, SSRF guard) even if called directly.
* It is lightweight. httpx + BeautifulSoup avoid the headless-browser dependency of tools such as Crawl4AI/Playwright, so judges can install it in seconds.
* It is reusable and testable on its own:

```bash
cd backend
python -m taskpilot_cli crawl --url https://example.com --max-pages 3 --pretty
```

| Exit code | Meaning |
|---|---|
| 0 | success: every attempted page crawled |
| 1 | partial: some pages failed or the time budget was hit |
| 2 | invalid input / unsafe URL (nothing fetched) |
| 3 | failed: no page could be crawled |
| 4 | start URL disallowed by robots.txt |
| 5 | internal crawler error |

## Security & reliability safeguards

| Concern | Safeguard |
|---|---|
| Command injection | No shell anywhere (`shell=False`, argv list). Only tools in `APPROVED_TOOLS` can run. URL passed as `--url=<value>` so it can never be read as a flag. |
| LLM hallucination / redirection | The crawl URL must literally appear in the user's message; otherwise the LLM plan is rejected. |
| SSRF | Blocks localhost, private, link-local, reserved and metadata IPs, after DNS resolution and **on every redirect hop**. Credentials in URLs are rejected. |
| Prompt injection from websites | Crawled content is wrapped as `<untrusted_website_content>`, common injection phrases are filtered, and the model only summarises. It cannot trigger tools. |
| Resource abuse | Max 10 pages, depth 2, 10 s per request, 90 s per task (hard kill), 2 MB per page, HTML only, 3 concurrent tasks, 2000-char prompts, polite delay between requests. |
| Secret leakage | The CLI gets a minimal env (no API keys). Logs and errors pass through `redact()`. Keys are only in `.env`, which is git-ignored. |
| Honest status | `completed` only with exit code 0 **and** valid schema-checked data. Otherwise the task is `partial`, `failed` or `cancelled`, with the reason and exit code shown. |
| robots.txt | Respected (RFC 9309 behaviour for 4xx/5xx). |

## Setup

**Prerequisites:** Python 3.11+ and Node.js 20+.

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate     macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # optional: add GEMINI_API_KEY or OPENAI_API_KEY
uvicorn app.main:app --port 8000
```

API docs: http://localhost:8000/docs · Health: http://localhost:8000/api/health

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000.

### Environment variables (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER` | `auto` | `auto`, `gemini`, `openai` or `none` |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | – / `gemini-2.5-flash` | Google Gemini for intent + summary |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | – / `gpt-4.1-mini` | OpenAI alternative |
| `DEFAULT_MAX_PAGES` / `MAX_PAGES_LIMIT` | 5 / 10 | Crawl size |
| `MAX_DEPTH_LIMIT` | 2 | Link depth |
| `CLI_TIMEOUT_SECONDS` | 90 | Hard kill for the CLI process |
| `MAX_CONCURRENT_TASKS` | 3 | Parallel CLI processes |
| `DATABASE_URL` | SQLite file | Any SQLAlchemy URL (e.g. PostgreSQL) |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed frontend origins |

**No API key? It still works.** Intent parsing falls back to a deterministic rule-based parser, and summaries become extractive: sentences are taken directly from the crawled pages. The sidebar shows which mode is active.

## Testing the demo

1. Click the **Mandatory demo** card, or type:
   *"Crawl https://example.com, extract the important information, give me a summary, and return the extracted data in JSON format."*
2. Watch the Execution Inspector. You will see six stages, the exact command, the PID, live crawler logs, the exit code and the duration.
3. Open the result tabs: **Summary**, **Extracted Data**, **JSON Output** (copy or download), and **Execution Logs**.
4. Try the edge cases:
   * `Summarise http://localhost:8080/admin`: blocked by the SSRF guard, and the CLI never starts.
   * `crawl https://this-domain-does-not-exist-xyz123.com`: DNS failure is reported honestly.
   * `crawl 10 pages of https://books.toscrape.com deeply`, then press **Cancel**: the process is killed and the task is shown as `cancelled`.
   * `run rm -rf /`: unsupported intent, so no process is started.

Automated tests (URL guard, intent parsing, output validation, timeout/cancel killing a real process):

```bash
cd backend && python -m pytest -q
```

## API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat` | `{ "message": "..." }` → `{ task_id }` (202) |
| GET | `/api/tasks/{id}/events` | SSE stream: `task`, `stage`, `plan`, `command`, `process`, `log`, `result`, `done` |
| POST | `/api/tasks/{id}/cancel` | Kill the running CLI process |
| GET | `/api/tasks` · `/api/tasks/{id}` | Execution history / full detail, including the event log |
| DELETE | `/api/tasks/{id}` | Delete a finished task |
| GET | `/api/health` · `/api/tools` | Status, active LLM, approved tools, limits |

## Project structure

```
backend/
  app/
    ai/            intent_engine.py, summarizer.py, llm.py
    api/           routes.py
    core/          config.py, security.py
    database/      db.py
    orchestrator/  task_runner.py, cli_manager.py, tool_registry.py
    schemas/       task.py
    services/      output_processor.py
    main.py
  taskpilot_cli/   __main__.py (CLI), crawler.py, extract.py, netguard.py
  tests/
frontend/
  src/app/page.tsx              chat + orchestration of SSE streams
  src/components/
    layout/                     Sidebar (collapsible, history, saved, search), Header, SettingsDialog, Logo
    chat/                       ChatInput (URL detection), WelcomeScreen, SuggestedTasks, MessageBubble
    execution/                  ExecutionPanel, ExecutionTimeline (7 stages), ExecutionLogs (stdout/stderr/system)
    results/                    ResultTabs, ResultOverview, SummaryView, ExtractedDataView, JsonViewer (tree + raw)
    ui/                         primitives, Markdown, Toast, Dialog
  src/lib/                      api.ts (typed client), taskState.ts (event reducer), prefs.ts (local preferences)
```

The UI shows seven execution stages, and every one is driven by a real backend event. The backend's
`execute` stage is split in two using the process events: **Launching CLI** ends when the `process: started`
event arrives with a PID, and **Crawling website** ends with `process: exited` and its exit code. Nothing is simulated.
Saved results and UI preferences are stored only in the browser (localStorage). Task data lives in the backend database.

## Technology stack & AI disclosure

* **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Lucide icons
* **Backend:** Python, FastAPI, Pydantic v2, SQLAlchemy 2, httpx
* **CLI tool:** custom `taskpilot_cli` (httpx + BeautifulSoup4 + urllib.robotparser)
* **Runtime AI service:** OpenAI API (`gpt-4.1-mini`), used for intent understanding and summarisation in the demo. Google Gemini is supported as an alternative, and without any key the app falls back to rule-based parsing and extractive summaries.
* **Development:** built with the help of an AI coding assistant (Claude Code). Architecture, security design and verification are the author's own.

## Extending with more tools

Add an entry to `APPROVED_TOOLS` in `app/orchestrator/tool_registry.py` with an `intent` and a `build_argv(plan)` function, and teach the intent engine the new intent. The execution, monitoring, streaming and history layers are tool-agnostic.
