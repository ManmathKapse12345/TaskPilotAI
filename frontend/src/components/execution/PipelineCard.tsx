"use client";

import { Workflow } from "lucide-react";
import { pageHits } from "@/lib/logs";
import { displayStages, type StageView, type TaskView } from "@/lib/taskState";
import { useNow } from "./useNow";
import { cx, formatMs } from "../ui/primitives";

const DOT: Record<StageView["status"], string> = {
  done: "bg-primary",
  running: "bg-secondary",
  failed: "bg-error",
  warning: "bg-warn",
  skipped: "bg-surface-container-highest",
  pending: "bg-surface-container-highest",
};

const STATE_LABEL: Record<StageView["status"], string> = {
  done: "DONE", running: "ACTIVE", failed: "FAILED", warning: "WARNING", skipped: "SKIPPED", pending: "QUEUED",
};

/**
 * Stitch "Execution Pipeline". Seven phases from displayStages(): every phase only advances when its
 * backend event arrives. The only progress bar is pages fetched vs. the plan's page cap.
 */
export function PipelineCard({ task }: { task: TaskView }) {
  const stages = displayStages(task);
  const anyRunning = stages.some((s) => s.status === "running");
  const now = useNow(anyRunning);
  const done = stages.filter((s) => s.status === "done" || s.status === "warning").length;
  const pages = pageHits(task).length;

  return (
    <section className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 shadow-md">
      <div className="flex items-center justify-between pb-0.5">
        <div className="flex items-center gap-1">
          <Workflow className="h-4.5 w-4.5 text-primary" />
          <h2 className="text-headline-sm font-semibold tracking-tight text-on-surface">Execution Pipeline</h2>
        </div>
        <span className="font-mono text-label-code text-on-surface-variant">{done}/{stages.length} PHASES</span>
      </div>

      <ol className="relative flex flex-col gap-1 pl-4 before:absolute before:bottom-4 before:left-1.5 before:top-2 before:w-0.5 before:bg-surface-container-highest">
        {stages.map((s, i) => {
          const dur = s.startedAt != null
            ? s.endedAt != null ? (s.endedAt - s.startedAt) * 1000 : s.status === "running" ? (now - s.startedAt) * 1000 : null
            : null;
          const active = s.status === "running";
          const dim = s.status === "pending" || s.status === "skipped";
          const crawl = s.key === "crawl" && active && task.plan?.max_pages;
          return (
            <li key={s.key}
              className={cx("relative flex flex-col gap-0.5 rounded p-2 transition-all",
                active ? "glow-secondary gap-1 bg-surface-container-high p-2.5" : dim ? "bg-surface-container/60 opacity-60" : "bg-surface-container hover:bg-surface-container-high",
                s.status === "failed" && "bg-error-container/20")}>
              {active && <span className="absolute -left-[19px] top-3 h-2.5 w-2.5 animate-ping rounded-full bg-secondary" />}
              <span className={cx("absolute -left-[19px] top-3 h-2.5 w-2.5 rounded-full ring-4 ring-surface-container-low", DOT[s.status])} />
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={cx("truncate font-mono text-code-sm", active ? "font-semibold text-secondary" : dim ? "text-on-surface-variant" : "font-medium text-on-surface")}>
                    Phase {i + 1}: {s.label}
                  </span>
                  {active && <span className="animate-pulse rounded bg-secondary/15 px-1.5 font-mono text-label-code text-secondary">ACTIVE</span>}
                </span>
                <span className={cx("shrink-0 font-mono text-label-code",
                  s.status === "done" ? "text-primary" : s.status === "failed" ? "text-error" : s.status === "warning" ? "text-warn" : active ? "font-medium text-secondary" : "text-on-surface-variant")}>
                  {dur != null && s.status !== "skipped" ? `${formatMs(dur)}${active ? "" : ` • ${STATE_LABEL[s.status]}`}` : STATE_LABEL[s.status]}
                </span>
              </div>
              {s.detail && (
                <span className={cx("break-words text-body-sm", active ? "text-on-surface" : s.status === "failed" ? "text-error" : s.status === "warning" ? "text-warn" : "text-on-surface-variant")}>
                  {s.detail}
                </span>
              )}
              {crawl ? (
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-lowest" title={`${pages} of at most ${task.plan!.max_pages} pages fetched`}>
                  <div className="h-full rounded-full bg-secondary transition-all duration-300" style={{ width: `${Math.min(100, (pages / task.plan!.max_pages) * 100)}%` }} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
