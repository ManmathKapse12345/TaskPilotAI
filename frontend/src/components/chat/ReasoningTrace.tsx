"use client";

import { Brain, Eye, RotateCcw, Terminal } from "lucide-react";
import type { TaskView, TraceStep } from "@/lib/taskState";
import { clockTime, cx } from "../ui/primitives";

const META: Record<TraceStep["kind"], { label: string; icon: typeof Brain; cls: string }> = {
  thought: { label: "Thought", icon: Brain, cls: "text-tertiary" },
  action: { label: "Action", icon: Terminal, cls: "text-secondary" },
  observation: { label: "Observation", icon: Eye, cls: "text-on-surface-variant" },
};
const TONE = { ok: "text-primary", warn: "text-warn", bad: "text-error" };

/**
 * ReAct-style trace (Yao et al., 2022): interleaved Thought -> Action -> Observation steps.
 * Every step is derived from a real backend event (plan, command, process exit, reasoning, result).
 */
export function ReasoningTrace({ task }: { task: TaskView }) {
  if (!task.trace.length) return <p className="text-body-sm text-on-surface-variant">No steps recorded yet.</p>;
  return (
    <ol className="space-y-2">
      {task.trace.map((s, i) => {
        const m = META[s.kind];
        return (
          <li key={i} className="flex gap-2.5">
            <m.icon className={cx("mt-0.5 h-4 w-4 shrink-0", m.cls)} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className={cx("font-mono text-label-code font-semibold uppercase tracking-wider", m.cls)}>{m.label}</span>
                <span className="font-mono text-label-code text-on-surface-variant/60">{clockTime(s.ts)}</span>
              </div>
              <p className={cx("break-words text-body-sm", s.kind === "action" ? "font-mono text-on-surface" : s.tone ? TONE[s.tone] : "text-on-surface")}>{s.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Compact callout shown in the chat when the agent adapted its plan after observing a failure. */
export function RecoveryNote({ task }: { task: TaskView }) {
  if (!task.recoveries) return null;
  let idx = -1;
  for (let i = task.trace.length - 2; i >= 0; i--) {
    if (task.trace[i].kind === "observation" && task.trace[i].tone === "bad" && task.trace[i + 1].kind === "thought") { idx = i; break; }
  }
  const obs = idx >= 0 ? task.trace[idx] : undefined;
  const thought = idx >= 0 ? task.trace[idx + 1] : undefined;
  return (
    <div className="rounded-lg bg-tertiary-container/15 p-3">
      <div className="mb-1 flex items-center gap-1.5 font-mono text-label-code font-semibold uppercase tracking-wider text-tertiary">
        <RotateCcw className="h-3.5 w-3.5" />Agent adapted its plan
      </div>
      {obs && <p className="text-body-sm text-on-surface"><span className="font-semibold text-error">Observed:</span> {obs.text}</p>}
      {thought && <p className="mt-0.5 text-body-sm text-on-surface"><span className="font-semibold text-tertiary">Reasoned:</span> {thought.text}</p>}
      <p className="mt-0.5 text-body-sm text-on-surface-variant">Retried once with a smaller scope (homepage only). See Run details for the full trace.</p>
    </div>
  );
}
