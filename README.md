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
 │  Chat UI · live run card & Run details (steps, command, PID, exit code, logs)                │
 │  Result in chat: Summary · Extracted data · Valid JSON (copy/download) · Reasoning trace       │
 │  Past chats & history · Stop · Retry · honest blocked / partial / failed replies               │
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

If the first CLI run fails in a way a smaller crawl can fix (time limit or a transient network error), the agent
**observes** the result, records its **reasoning**, and re-runs the approved tool **once** with a reduced scope
(homepage only). The outcome is reported as `partial`, never as a full success. See [Research foundations](#research-foundations).

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
| Failure recovery | At most one automatic retry, only for time-limit or transient network failures, with a *smaller* scope. Never for safety blocks, robots.txt, invalid input or user cancellation. The retry decision is a deterministic policy, not an LLM call, and a recovered result is reported as `partial`. |

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
npm run dev
```

Open http://localhost:3000. The frontend calls `http://localhost:8000` by default. Only if your backend runs elsewhere,
create `frontend/.env.local` containing `NEXT_PUBLIC_API_URL=http://your-backend:port`.

For a faster production run: `npm run build` then `npm run start`.

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

1. Click the **Quickstart** example card on the chat screen, or type:
   *"Crawl https://example.com, extract the important information, give me a summary, and return the extracted data in JSON format."*
2. Watch the agent's reply in the chat. It is a live run card with progress steps (Understand → Start crawler → Read pages → Summarise), the execution plan, the PID and the live CLI log (stdout/stderr).
3. When it finishes, the reply shows **Done**, evidence chips (tool, exit code, PID, JSON size), the **Summary**, the **Extracted data** table and the **JSON result** (Valid JSON, Copy, Download, Expand).
4. Click **View run details** for the reasoning trace (Thought → Action → Observation), the 7-stage pipeline with timings, the exact argv command, process data and stdout/stderr.
5. Try the edge cases:
   * `Summarise http://localhost:8080/admin`: blocked by the SSRF guard ("I can't crawl this address"), and the CLI never starts.
   * `crawl https://this-domain-does-not-exist-xyz123.com`: "I couldn't reach this website", with the real DNS error.
   * `crawl 10 pages of https://books.toscrape.com deeply`, then press **Stop Task**: the process is killed and the reply says "Stopped by you".
   * `What can you do?` or `run rm -rf /`: answered directly, and no process is started.
   * Recovery: start the backend with `CLI_TIMEOUT_SECONDS=8` and ask for 10 pages of a slow site. The reply shows "Agent adapted its plan", with the observation, the reasoning and the reduced-scope retry.

Automated tests (URL guard, intent parsing, output validation, timeout/cancel killing a real process, the recovery policy and pipeline, and prompt-injection isolation):

```bash
cd backend && python -m pytest -q
```

## API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat` | `{ "message": "..." }` → `{ task_id }` (202) |
| GET | `/api/tasks/{id}/events` | SSE stream: `task`, `stage`, `plan`, `command`, `process`, `log`, `reasoning`, `result`, `done` |
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
    orchestrator/  task_runner.py, cli_manager.py, tool_registry.py, recovery.py (observe → reason → act)
    schemas/       task.py
    services/      output_processor.py
    main.py
  taskpilot_cli/   __main__.py (CLI), crawler.py, extract.py, netguard.py
  tests/
frontend/
  src/app/page.tsx              chat screen (/?task=<id> opens a stored task)
  src/app/history/page.tsx      all tasks, stats, diagnostics drawer
  src/components/
    chat/                       ChatView, Welcome, Composer, RunCard (live), ResultCard, FailureCard,
                                RunDetails (slide-over), ReasoningTrace (ReAct trace)
    layout/                     AppShell, AppSidebar (past chats), MainHeader, SettingsDialog, Logo
    history/                    HistoryView, MetricCards, TaskInspector
    results/                    JsonViewer (formatted, tree, minified, TypeScript types), ExtractedDataView
    ui/                         primitives, Markdown, Toast, Dialog
  src/lib/                      api.ts (typed client), taskState.ts (event reducer + reasoning trace),
                                workspace.tsx (app state, SSE streams, chat thread), directive.ts, logs.ts, jsonTypes.ts
```

The UI shows seven execution stages, and every one is driven by a real backend event. The backend's
`execute` stage is split in two using the process events: **Launching CLI** ends when the `process: started`
event arrives with a PID, and **Crawling website** ends with `process: exited` and its exit code. Nothing is simulated.
Saved results and UI preferences are stored only in the browser (localStorage). Task data lives in the backend database.

## Research foundations

Five papers informed the design. For each one, the table shows what TaskPilot adopts and, just as importantly,
where it deliberately differs, so no claim goes beyond what is implemented and tested.

| Paper | What the paper does | What TaskPilot adopts | Where TaskPilot differs |
|---|---|---|---|
| **ReAct**: Yao et al., ICLR 2023 ([arXiv:2210.03629](https://arxiv.org/abs/2210.03629)) | The LLM interleaves free-form *thoughts* with *actions*, so it can "handle exceptions and adjust action plans" from what it observes; the trajectories are interpretable. | A Thought → Action → Observation **trace** built from real events (Run details), and an observe → adjust-plan step: after a time-limit or transient failure, the agent re-runs the crawler once with a smaller scope (`orchestrator/recovery.py`). | The recovery "thought" comes from a **deterministic policy, not the LLM**, so website content can never decide what runs next (see CaMeL). It is limited to **one** retry, since both ReAct and InterCode report repetitive, looping actions as a failure mode. |
| **InterCode**: Yang et al., NeurIPS 2023 ([arXiv:2306.14898](https://arxiv.org/abs/2306.14898)) | Interactive coding as an RL environment: code is the action and execution feedback is the observation, run in **Docker** sandboxes, with up to 10 "try again" turns. | Execution feedback (exit code, stdout JSON, stderr events, timeout/kill) is captured and decides both the status and whether to retry. | The action space is **one allow-listed tool with validated argv**; the LLM never writes commands. Isolation is a **separate process with a stripped environment, not a container**. |
| **SWE-agent**: Yang et al., NeurIPS 2024 ([arXiv:2405.15793](https://arxiv.org/abs/2405.15793)) | Agent–computer interface (ACI) principles: actions should be simple and compact, feedback informative but concise, and guardrails should stop error propagation (e.g. a linter rejects bad edits). | `taskpilot_cli` follows these: one compact `crawl` action with few flags, a single schema-validated JSON result, JSON-lines progress, documented exit codes 0–5, and built-in limits. Output that fails validation is rejected rather than shown, and the LLM sees a size-bounded digest, not raw HTML. | The CLI's main consumer is the orchestrator (plus the summarizer), not an LLM issuing many interactive commands. |
| **AutoScraper**: Huang et al., EMNLP 2024 ([arXiv:2404.12753](https://arxiv.org/abs/2404.12753)) | The LLM **generates reusable scrapers** (XPath action sequences) by traversing the HTML tree top-down, with a "step-back" on failure, then synthesises them across pages. | The motivation: executable, reusable extraction instead of asking an LLM to read every page. Extraction is deterministic code (title, heading hierarchy, links, contacts, structured data, with scripts and styles stripped), and the LLM is called once, on the validated result. | TaskPilot uses a **hand-written extractor** (what the paper calls the wrapper-based approach). LLM-generated scrapers are **not implemented**; they are a natural next step. |
| **CaMeL**: Debenedetti et al., 2025 ([arXiv:2503.18813](https://arxiv.org/abs/2503.18813)) | Builds on the Dual-LLM pattern: a *privileged* LLM plans from the trusted query only, and a *quarantined* LLM parses untrusted data with no tools. CaMeL adds an interpreter, data-flow tracking, **capabilities** and security policies. The paper calls delimiter/"ignore instructions" prompts heuristic, with no guarantees. | The Dual-LLM **separation**: the intent planner sees only the user's message; the summarizer sees website data but has **no tool access**, and its output is only shown to the user. It never becomes a tool argument, which is the data-flow attack CaMeL warns about. Fencing and phrase filtering are kept as an extra heuristic layer. Covered by `tests/test_recovery.py`. | **No capabilities, data-flow graph or policy interpreter.** The crawler follows links found on pages, so untrusted content does influence which same-site URLs are fetched; this is bounded by the same-site rule, the SSRF check on every hop, robots.txt and the page/depth/time limits. A malicious page could still skew its own summary (a text-to-text attack, which CaMeL also lists as a non-goal); the source pages are shown so the user can check. |

## Technology stack & AI disclosure

* **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Lucide icons. The UI was designed in Google Stitch and implemented by hand against the real API.
* **Backend:** Python, FastAPI, Pydantic v2, SQLAlchemy 2, httpx
* **CLI tool:** custom `taskpilot_cli` (httpx + BeautifulSoup4 + urllib.robotparser)
* **Runtime AI service:** OpenAI API (`gpt-4.1-mini`), used for intent understanding and summarisation in the demo. Google Gemini is supported as an alternative, and without any key the app falls back to rule-based parsing and extractive summaries.
* **Development:** built with the help of an AI coding assistant (Claude Code). Architecture, security design and verification are the author's own.

## Extending with more tools

Add an entry to `APPROVED_TOOLS` in `app/orchestrator/tool_registry.py` with an `intent` and a `build_argv(plan)` function, and teach the intent engine the new intent. The execution, monitoring, streaming and history layers are tool-agnostic.
