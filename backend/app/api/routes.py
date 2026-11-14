"""HTTP API: submit chat tasks, stream execution events (SSE), history, cancel."""
from __future__ import annotations

import asyncio
import json
import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.ai.llm import llm
from app.core.config import settings
from app.database import db
from app.orchestrator.task_runner import task_manager
from app.orchestrator.tool_registry import APPROVED_TOOLS
from app.schemas.task import ChatAccepted, ChatRequest

router = APIRouter(prefix="/api")
TASK_ID_RE = re.compile(r"^[0-9a-f]{12}$")


def _check_id(task_id: str) -> None:
    if not TASK_ID_RE.match(task_id):
        raise HTTPException(400, "Invalid task id")


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "llm": {"provider": llm.provider, "model": llm.model, "enabled": llm.enabled},
        "tools": list(APPROVED_TOOLS),
        "limits": {"max_pages": settings.max_pages_limit, "max_depth": settings.max_depth_limit,
                   "cli_timeout_s": settings.cli_timeout_seconds, "max_concurrent_tasks": settings.max_concurrent_tasks},
    }


@router.get("/tools")
def tools() -> list[dict]:
    return [{"name": t.name, "intent": t.intent, "description": t.description, "timeout_s": t.timeout_seconds}
            for t in APPROVED_TOOLS.values()]


@router.post("/chat", response_model=ChatAccepted, status_code=202)
async def chat(req: ChatRequest) -> ChatAccepted:
    message = req.message.strip()
    if not message:
        raise HTTPException(422, "Message is empty")
    if len(message) > settings.max_prompt_chars:
        raise HTTPException(422, f"Message is too long (max {settings.max_prompt_chars} characters)")
    run = task_manager.start(message)
    return ChatAccepted(task_id=run.id, status=run.status)


@router.get("/tasks/{task_id}/events")
async def task_events(task_id: str) -> StreamingResponse:
    """Server-Sent Events: replays past events, then streams live ones until the task finishes."""
    _check_id(task_id)
    run = task_manager.runs.get(task_id)
    if run is None:
        rec = db.get_task(task_id)
        if rec is None:
            raise HTTPException(404, "Task not found")
        stored = json.loads(rec.events_json) if rec.events_json else []

        async def replay():
            for ev in stored:
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
            if not stored or stored[-1].get("type") != "done":
                yield f"data: {json.dumps({'type': 'done', 'status': rec.status})}\n\n"
        return StreamingResponse(replay(), media_type="text/event-stream")

    async def live():
        iterator = task_manager.stream(run).__aiter__()
        while True:
            try:
                ev = await asyncio.wait_for(iterator.__anext__(), timeout=15)
            except asyncio.TimeoutError:
                yield ": keep-alive\n\n"
                continue
            except StopAsyncIteration:
                return
            yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"

    return StreamingResponse(live(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/tasks/{task_id}/cancel")
def cancel_task(task_id: str) -> dict:
    _check_id(task_id)
    if not task_manager.cancel(task_id):
        raise HTTPException(409, "Task is not running")
    return {"task_id": task_id, "cancelling": True}


@router.get("/tasks")
def list_tasks(limit: int = 50) -> list[dict]:
    return [r.summary() for r in db.list_tasks(min(max(limit, 1), 200))]


@router.get("/tasks/{task_id}")
def get_task(task_id: str) -> dict:
    _check_id(task_id)
    run = task_manager.runs.get(task_id)
    rec = db.get_task(task_id)
    if rec is None:
        raise HTTPException(404, "Task not found")
    detail = rec.detail()
    if run is not None and not run.finished:
        detail.update(status=run.status if run.status != "queued" else "running", events=run.events)
    return detail


@router.delete("/tasks/{task_id}")
def delete_task(task_id: str) -> dict:
    _check_id(task_id)
    run = task_manager.runs.get(task_id)
    if run is not None and not run.finished:
        raise HTTPException(409, "Cancel the task before deleting it")
    task_manager.runs.pop(task_id, None)
    if not db.delete_task(task_id):
        raise HTTPException(404, "Task not found")
    return {"deleted": task_id}
