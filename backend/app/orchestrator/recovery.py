"""Bounded observe -> reason -> act recovery for CLI runs.

Design references:
- ReAct (Yao et al., 2022, arXiv:2210.03629): interleave reasoning with actions so the agent can
  "handle exceptions" by updating its plan from what it observed.
- InterCode (Yang et al., 2023, arXiv:2306.14898): treat each command as an action and its execution
  output (exit code, stdout/stderr) as the observation that drives the next step.

The decision is a deterministic policy, not an LLM call: website content never influences which
command runs (cf. CaMeL, arXiv:2503.18813 - control flow comes only from the trusted request).
Only failures that a smaller crawl can plausibly fix are retried, at most once, and the outcome is
reported as partial so a reduced-scope result is never presented as a full success.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.orchestrator.cli_manager import ProcessResult
from app.schemas.task import TaskPlan
from app.services.output_processor import ProcessedOutput

MAX_ATTEMPTS = 2
# Exit codes the crawler uses for outcomes a retry can never fix (see EXIT_MEANING).
NON_RETRYABLE_EXIT = {2, 4}  # invalid input / unsafe URL, blocked by robots.txt
TRANSIENT = re.compile(r"(?i)time(d)?[ -]?out|timeout|time limit|connect|reset|temporar|HTTP 5\d\d|\b50[234]\b")


@dataclass
class Recovery:
    observation: str
    thought: str
    action: str
    plan: TaskPlan


def decide_recovery(proc: ProcessResult, processed: ProcessedOutput, plan: TaskPlan, attempt: int) -> Recovery | None:
    """Returns a reduced-scope retry when the observed failure is transient or size-related, else None."""
    if attempt >= MAX_ATTEMPTS or proc.cancelled or proc.spawn_error:
        return None
    if processed.status in ("completed", "partial", "cancelled"):
        return None
    if proc.exit_code in NON_RETRYABLE_EXIT:
        return None
    error = processed.error or ""
    if not (proc.timed_out or TRANSIENT.search(error)):
        return None
    if plan.max_pages <= 1 and plan.max_depth == 0:
        return None  # already the smallest crawl; repeating it would not change the outcome

    smaller = plan.model_copy(update={"max_pages": 1, "max_depth": 0})
    seconds = proc.duration_ms / 1000
    observation = (f"Attempt {attempt}: the crawler was killed after {seconds:.0f}s (time limit)." if proc.timed_out
                   else f"Attempt {attempt}: exit code {proc.exit_code} after {seconds:.1f}s - {error[:200]}")
    thought = ("This looks like a slow or temporarily unreachable site, not a policy refusal. "
               f"Crawling {plan.max_pages} page(s) at depth {plan.max_depth} did not finish; "
               "the homepage alone is far more likely to succeed and still answers the request partially.")
    action = "Re-run the approved site-crawler once with --max-pages=1 --max-depth=0."
    return Recovery(observation=observation, thought=thought, action=action, plan=smaller)
