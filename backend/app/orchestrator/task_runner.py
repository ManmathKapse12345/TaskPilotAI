"""The orchestration pipeline: prompt -> plan -> validated CLI run -> verified response.

Every step emits an event; the UI subscribes over Server-Sent Events so the
user watches the real execution (stages, the exact command, live CLI logs).
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import AsyncIterator

from app.ai.intent_engine import interpret
from app.ai.summarizer import summarize
from app.core.config import settings
from app.core.security import UnsafeURLError, redact, validate_target_url
from app.database import db
from app.orchestrator.cli_manager import run_cli
from app.orchestrator.recovery import decide_recovery
from app.orchestrator.tool_registry import display_command, tool_for_intent
from app.services.output_processor import build_extracted_data, process_output

log = logging.getLogger("taskpilot.runner")

STAGES = [
    ("intent", "Understanding request"),
    ("validate", "Validating input & safety checks"),
    ("prepare", "Selecting tool & preparing CLI arguments"),
    ("execute", "Running CLI process"),
    ("process", "Capturing & validating output"),
    ("respond", "Generating summary & response"),
]
STAGE_LABELS = dict(STAGES)
TERMINAL = {"completed", "partial", "failed", "cancelled", "answered"}


class TaskRun:
    def __init__(self, prompt: str) -> None:
        self.id = uuid.uuid4().hex[:12]
        self.prompt = prompt
        self.status = "queued"
        self.events: list[dict] = []
        self.cond = asyncio.Condition()
        self.cancel_event = asyncio.Event()
        self.finished = False
        self.current_stage: str | None = None
        self.record: dict = {"id": self.id, "prompt": prompt, "status": "queued"}

    async def emit(self, type_: str, **data) -> None:
        event = {"seq": len(self.events), "type": type_, "ts": round(time.time(), 3), **data}
        async with self.cond:
            self.events.append(event)
            self.cond.notify_all()

    async def stage(self, key: str, status: str, detail: str | None = None) -> None:
        if status == "running":
            self.current_stage = key
        await self.emit("stage", stage=key, label=STAGE_LABELS[key], status=status, detail=detail)

    async def finish(self, status: str) -> None:
        self.status = status
        await self.emit("done", status=status)
        async with self.cond:
            self.finished = True
            self.cond.notify_all()


class TaskManager:
    def __init__(self) -> None:
        self.runs: dict[str, TaskRun] = {}
        self._semaphore: asyncio.Semaphore | None = None
        self._tasks: set[asyncio.Task] = set()

    @property
    def semaphore(self) -> asyncio.Semaphore:
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(settings.max_concurrent_tasks)
        return self._semaphore

    def start(self, prompt: str) -> TaskRun:
        run = TaskRun(prompt)
        self.runs[run.id] = run
        if len(self.runs) > 200:  # bound memory; finished runs remain in the DB
            for old_id in [k for k, r in self.runs.items() if r.finished][:50]:
                self.runs.pop(old_id, None)
        db.save_task(id=run.id, prompt=prompt, status="queued")
        task = asyncio.create_task(self._pipeline(run))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return run

    def cancel(self, task_id: str) -> bool:
        run = self.runs.get(task_id)
        if not run or run.finished:
            return False
        run.cancel_event.set()
        return True

    async def stream(self, run: TaskRun) -> AsyncIterator[dict]:
        idx = 0
        while True:
            async with run.cond:
                await run.cond.wait_for(lambda: len(run.events) > idx or run.finished)
                new = run.events[idx:]
                finished = run.finished
            for ev in new:
                yield ev
            idx += len(new)
            if finished and idx >= len(run.events):
                return

    # ------------------------------------------------------------------ pipeline
    async def _pipeline(self, run: TaskRun) -> None:
        result: dict | None = None
        error: str | None = None
        status = "failed"
        try:
            await run.emit("task", task_id=run.id, prompt=run.prompt)
            status, result, error = await self._execute(run)
        except Exception as exc:  # last-resort guard: report honestly, never hang
            log.exception("pipeline crashed")
            error = f"Internal error: {type(exc).__name__}"
            if run.current_stage:
                await run.stage(run.current_stage, "failed", error)
            result = {"status": "failed", "message": "TaskPilot hit an internal error.", "error": error}
            await run.emit("result", result=result)
        finally:
            await run.finish(status)
            run.record.update(status=status, error=redact(error) if error else None,
                              finished_at=datetime.now(timezone.utc),
                              result_json=json.dumps(result, ensure_ascii=False) if result else None,
                              events_json=json.dumps(run.events, ensure_ascii=False))
            try:
                await asyncio.get_running_loop().run_in_executor(None, lambda: db.save_task(**run.record))
            except Exception:
                log.exception("failed to persist task %s", run.id)

    async def _execute(self, run: TaskRun) -> tuple[str, dict | None, str | None]:
        # 1. Intent
        await run.stage("intent", "running")
        plan = await interpret(run.prompt)
        await run.emit("plan", plan=plan.model_dump())
        run.record.update(intent=plan.intent, url=plan.url)
        if plan.intent != "website_crawl":
            await run.stage("intent", "done", f"Intent: {plan.intent} (via {plan.interpreted_by})")
            for key, _ in STAGES[1:]:
                await run.stage(key, "skipped", "No CLI execution needed")
            result = {"status": "answered", "message": plan.reply, "plan": plan.model_dump()}
            await run.emit("result", result=result)
            return "answered", result, None
        await run.stage("intent", "done", f"website_crawl on {plan.url} (interpreted by {plan.interpreted_by})")

        # 2. Validate input (syntax + DNS + private-network block)
        await run.stage("validate", "running")
        try:
            loop = asyncio.get_running_loop()
            plan.url = await loop.run_in_executor(None, validate_target_url, plan.url or "")
        except UnsafeURLError as exc:
            msg = f"Invalid or unsafe URL: {exc}"
            return await self._fail(run, "validate", msg, plan)
        run.record["url"] = plan.url
        await run.stage("validate", "done", f"{plan.url} is a valid public URL")

        # 3. Prepare the approved tool + argv
        await run.stage("prepare", "running")
        tool = tool_for_intent(plan.intent)
        if tool is None:
            return await self._fail(run, "prepare", "No approved CLI tool handles this task.", plan)
        argv = tool.build_argv(plan)
        command = display_command(argv)
        run.record.update(tool=tool.name, command=command)
        await run.emit("command", tool=tool.name, command=command, argv=argv[1:], timeout_s=tool.timeout_seconds)
        await run.stage("prepare", "done", f"Tool `{tool.name}` with {len(argv) - 3} validated arguments")

        # 4. Execute (bounded concurrency, timeout, cancellation, live stderr), with one bounded
        #    observe -> reason -> act recovery for transient / size-related failures (see recovery.py).
        async def on_stderr(line: str) -> None:
            try:
                ev = json.loads(line)
                await run.emit("log", level=ev.get("level", "info"), msg=str(ev.get("msg", ""))[:500],
                               kind=ev.get("event", "log"), stream="stderr")
            except (json.JSONDecodeError, AttributeError):
                await run.emit("log", level="info", msg=line[:500], kind="raw", stream="stderr")

        async def on_start(pid: int) -> None:
            await run.emit("process", state="started", pid=pid)

        attempt = 1
        recovered_from: str | None = None
        while True:
            await run.stage("execute", "running", "Waiting for a free worker..." if self.semaphore.locked() else
                            (f"Attempt {attempt}: reduced scope" if attempt > 1 else None))
            if run.cancel_event.is_set():
                return await self._cancelled(run, plan)
            async with self.semaphore:
                proc = await run_cli(argv, cwd=tool.cwd, timeout=tool.timeout_seconds, on_stderr=on_stderr,
                                     cancel_event=run.cancel_event, on_start=on_start)
            run.record.update(exit_code=proc.exit_code, duration_ms=proc.duration_ms)
            await run.emit("process", state="exited", pid=proc.pid, exit_code=proc.exit_code, duration_ms=proc.duration_ms,
                           timed_out=proc.timed_out, cancelled=proc.cancelled, stdout_bytes=len(proc.stdout.encode()))
            if proc.cancelled:
                return await self._cancelled(run, plan)
            processed = process_output(proc)
            recovery = decide_recovery(proc, processed, plan, attempt)
            if recovery is None:
                break
            # Observation -> Thought -> Action, recorded as a real event so the UI can show the trace.
            await run.emit("reasoning", attempt=attempt, observation=recovery.observation,
                           thought=recovery.thought, action=recovery.action)
            recovered_from = processed.error or recovery.observation
            plan = recovery.plan
            argv = tool.build_argv(plan)
            command = display_command(argv)
            run.record.update(command=command)
            await run.emit("command", tool=tool.name, command=command, argv=argv[1:], timeout_s=tool.timeout_seconds)
            attempt += 1

        exec_detail = f"exit code {proc.exit_code} in {proc.duration_ms / 1000:.1f}s" + (f" (attempt {attempt})" if attempt > 1 else "")
        if proc.timed_out or proc.spawn_error:
            await run.stage("execute", "failed", proc.spawn_error or f"Timed out after {tool.timeout_seconds}s - process killed")
        else:
            await run.stage("execute", "done", exec_detail)

        # 5. Process + validate output
        await run.stage("process", "running")
        execution = {
            "tool": tool.name, "command": command, "pid": proc.pid, "exit_code": proc.exit_code,
            "exit_meaning": processed.exit_meaning, "duration_ms": proc.duration_ms, "timed_out": proc.timed_out,
            "stderr_lines": len(proc.stderr_lines), "stdout_bytes": len(proc.stdout.encode()), "attempts": attempt,
        }
        if processed.status == "failed" or processed.crawl is None:
            await run.stage("process", "failed", processed.error)
            await run.stage("respond", "skipped")
            result = {"status": "failed", "message": "The task failed - no data was returned.", "error": processed.error,
                      "plan": plan.model_dump(), "execution": execution}
            await run.emit("result", result=result)
            return "failed", result, processed.error
        if recovered_from:
            # A reduced-scope result answers the request only partly: report it as partial, with the reason.
            processed.status = "partial"
            processed.error = (f"Recovered on attempt {attempt} with reduced scope (homepage only) "
                               f"after the first run failed: {recovered_from[:200]}")
        crawl = processed.crawl
        data = build_extracted_data(crawl)
        await run.stage("process", "done" if processed.status == "completed" else "warning",
                        f"Valid JSON: {crawl.stats.pages_crawled} page(s) crawled, {crawl.stats.pages_failed} failed")

        # 6. Respond
        await run.stage("respond", "running")
        summary = await summarize(crawl, plan, run.prompt) if plan.wants_summary else None
        await run.stage("respond", "done", f"Summary by {summary['generated_by']}" if summary else "JSON only")
        status = processed.status
        json_output = {
            "task_id": run.id,
            "status": "success" if status == "completed" else status,
            "source_url": crawl.start_url,
            "summary": summary["text"] if summary else None,
            "key_points": summary["key_points"] if summary else [],
            "focus_findings": summary.get("focus_findings", {}) if summary else {},
            "extracted_data": data,
            "execution": execution,
        }
        result = {
            "status": status,
            "message": "Task completed successfully." if status == "completed" else processed.error,
            "error": processed.error if status != "completed" else None,
            "plan": plan.model_dump(),
            "summary": summary,
            "data": data,
            "json_output": json_output,
            "execution": execution,
        }
        await run.emit("result", result=result)
        return status, result, processed.error

    async def _fail(self, run: TaskRun, stage: str, message: str, plan) -> tuple[str, dict, str]:
        await run.stage(stage, "failed", message)
        for key, _ in STAGES[[k for k, _ in STAGES].index(stage) + 1:]:
            await run.stage(key, "skipped")
        result = {"status": "failed", "message": "The task could not be executed.", "error": message, "plan": plan.model_dump()}
        await run.emit("result", result=result)
        return "failed", result, message

    async def _cancelled(self, run: TaskRun, plan) -> tuple[str, dict, str]:
        msg = "Cancelled by user - the CLI process was terminated."
        await run.stage("execute", "failed", msg)
        for key in ("process", "respond"):
            await run.stage(key, "skipped")
        result = {"status": "cancelled", "message": msg, "error": msg, "plan": plan.model_dump()}
        await run.emit("result", result=result)
        return "cancelled", result, msg


task_manager = TaskManager()
