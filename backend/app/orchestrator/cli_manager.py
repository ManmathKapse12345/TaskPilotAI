"""Runs an approved CLI process and captures stdout, stderr, exit code and timing.

* `subprocess.Popen` with an argv list (never `shell=True`)
* minimal environment (no API keys inherited), stdin closed
* stderr streamed line-by-line to a callback for live progress
* hard timeout and cooperative cancellation both kill the process
Threads are used for pipe reading so this works on every OS / event loop
(asyncio subprocesses are unavailable under some Windows loop policies).
"""
from __future__ import annotations

import asyncio
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from typing import Awaitable, Callable

from app.core.security import redact, safe_subprocess_env

MAX_STDOUT_BYTES = 20_000_000
MAX_STDERR_LINES = 500


@dataclass
class ProcessResult:
    argv: list[str]
    exit_code: int | None
    stdout: str
    stderr_lines: list[str] = field(default_factory=list)
    duration_ms: int = 0
    timed_out: bool = False
    cancelled: bool = False
    spawn_error: str | None = None
    pid: int | None = None


async def run_cli(
    argv: list[str],
    cwd: str,
    timeout: float,
    on_stderr: Callable[[str], Awaitable[None]] | None = None,
    cancel_event: asyncio.Event | None = None,
    on_start: Callable[[int], Awaitable[None]] | None = None,
) -> ProcessResult:
    loop = asyncio.get_running_loop()
    started = time.monotonic()
    creationflags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
    try:
        proc = subprocess.Popen(
            argv, cwd=cwd, env=safe_subprocess_env(), shell=False,
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            creationflags=creationflags,
        )
    except OSError as exc:
        return ProcessResult(argv=argv, exit_code=None, stdout="", spawn_error=f"failed to start process: {exc}")

    if on_start:
        await on_start(proc.pid)

    line_queue: asyncio.Queue[str | None] = asyncio.Queue()
    stdout_buf: list[bytes] = []

    def read_stderr() -> None:
        assert proc.stderr is not None
        for raw in iter(proc.stderr.readline, b""):
            loop.call_soon_threadsafe(line_queue.put_nowait, raw.decode("utf-8", errors="replace").rstrip("\r\n"))
        loop.call_soon_threadsafe(line_queue.put_nowait, None)

    def read_stdout() -> None:
        assert proc.stdout is not None
        size = 0
        for chunk in iter(lambda: proc.stdout.read(65536), b""):
            size += len(chunk)
            if size <= MAX_STDOUT_BYTES:
                stdout_buf.append(chunk)

    threads = [threading.Thread(target=read_stderr, daemon=True), threading.Thread(target=read_stdout, daemon=True)]
    for t in threads:
        t.start()

    deadline = started + timeout
    stderr_lines: list[str] = []
    timed_out = cancelled = False
    cancel_wait = asyncio.ensure_future(cancel_event.wait()) if cancel_event else None
    try:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                timed_out = True
                break
            get_line = asyncio.ensure_future(line_queue.get())
            waiters = {get_line} | ({cancel_wait} if cancel_wait else set())
            done, _ = await asyncio.wait(waiters, timeout=remaining, return_when=asyncio.FIRST_COMPLETED)
            if cancel_wait is not None and cancel_wait in done:
                get_line.cancel()
                cancelled = True
                break
            if get_line not in done:
                get_line.cancel()
                timed_out = True
                break
            line = get_line.result()
            if line is None:  # stderr closed -> process is exiting
                break
            line = redact(line)
            if len(stderr_lines) < MAX_STDERR_LINES:
                stderr_lines.append(line)
            if on_stderr:
                await on_stderr(line)
    finally:
        if cancel_wait is not None and not cancel_wait.done():
            cancel_wait.cancel()
        if (timed_out or cancelled) and proc.poll() is None:
            proc.kill()

    remaining = max(1.0, deadline - time.monotonic()) if not (timed_out or cancelled) else 5.0
    try:
        exit_code = await asyncio.wait_for(loop.run_in_executor(None, proc.wait), timeout=remaining)
    except asyncio.TimeoutError:
        proc.kill()
        timed_out = True
        exit_code = await loop.run_in_executor(None, proc.wait)
    await loop.run_in_executor(None, lambda: [t.join(timeout=5) for t in threads])

    return ProcessResult(
        argv=argv,
        exit_code=exit_code,
        stdout=b"".join(stdout_buf).decode("utf-8", errors="replace"),
        stderr_lines=stderr_lines,
        duration_ms=int((time.monotonic() - started) * 1000),
        timed_out=timed_out,
        cancelled=cancelled,
        pid=proc.pid,
    )
