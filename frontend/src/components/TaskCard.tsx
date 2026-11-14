"use client";

import { useEffect, useState } from "react";
import type { TaskView } from "@/lib/taskState";
import { LogConsole } from "./LogConsole";
import { ResultTabs } from "./ResultTabs";
import { Button, Markdown, StageIcon, StatusBadge, cx, formatMs } from "./ui";

function Elapsed({ from, running }: { from?: number; running: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [running]);
  if (!from) return null;
  return <span className="font-mono text-xs text-slate-500">{((now / 1000) - from).toFixed(1)}s</span>;
}

export function TaskCard({ task, onCancel, onRetry }: { task: TaskView; onCancel: () => void; onRetry: () => void }) {
  const isCrawl = task.plan?.intent === "website_crawl" || !!task.command;
  const running = !task.finished;
  const [showDetails, setShowDetails] = useState(true);
  const r = task.result;

  // Chat-only answers (help / unsupported) render as a simple assistant message.
  if (task.finished && r && r.status === "answered") {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
        <Markdown text={r.message ?? ""} />
        <div className="mt-2 text-[11px] text-slate-600">No CLI execution was needed · intent: {r.plan?.intent} · via {r.plan?.interpreted_by}</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-lg shadow-black/20">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-slate-500">TASK {task.id.toUpperCase()}</span>
          <StatusBadge status={task.status} />
          {running && <Elapsed from={task.startedAt} running={running} />}
        </div>
        <div className="flex gap-1.5">
          {running && task.process?.running && <Button variant="danger" onClick={onCancel}>■ Cancel</Button>}
          {task.finished && <Button onClick={onRetry} title="Run the same prompt again">↻ Retry</Button>}
          {isCrawl && <Button onClick={() => setShowDetails((s) => !s)}>{showDetails ? "Hide" : "Show"} execution</Button>}
        </div>
      </div>

      {showDetails && isCrawl && (
        <div className="grid gap-4 border-b border-slate-800 p-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          {/* stage timeline */}
          <ol className="space-y-2.5">
            {task.stages.map((s) => (
              <li key={s.key} className="flex gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 items-center justify-center"><StageIcon status={s.status} /></span>
                <div className="min-w-0">
                  <div className={cx("text-xs font-medium", s.status === "pending" || s.status === "skipped" ? "text-slate-500" : "text-slate-200")}>
                    {s.label}
                    {s.startedAt && s.endedAt && s.status !== "skipped" && (
                      <span className="ml-1.5 font-normal text-slate-600">{formatMs(Math.round((s.endedAt - s.startedAt) * 1000))}</span>
                    )}
                  </div>
                  {s.detail && <div className={cx("break-words text-[11px]", s.status === "failed" ? "text-rose-300" : "text-slate-500")}>{s.detail}</div>}
                </div>
              </li>
            ))}
          </ol>

          {/* plan + command + live logs */}
          <div className="min-w-0 space-y-3">
            {task.plan && task.plan.intent === "website_crawl" && (
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span className="rounded bg-indigo-500/15 px-2 py-0.5 text-indigo-300">intent: website_crawl</span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">max_pages: {task.plan.max_pages}</span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">depth: {task.plan.max_depth}</span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">output: {[task.plan.wants_summary && "summary", task.plan.wants_json && "json"].filter(Boolean).join(" + ")}</span>
                {task.plan.focus.map((f) => <span key={f} className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">focus: {f}</span>)}
                <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-500">parsed by {task.plan.interpreted_by}</span>
              </div>
            )}
            {task.command && (
              <div className="rounded-md bg-black/60 ring-1 ring-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-1.5 text-[11px] text-slate-500">
                  <span>approved tool: <span className="text-slate-300">{task.command.tool}</span> · shell=False · timeout {task.command.timeout_s}s</span>
                  {task.process && (
                    <span className="font-mono">
                      pid {task.process.pid}
                      {task.process.running ? <span className="ml-2 text-sky-400">● running</span> : (
                        <span className={cx("ml-2", task.process.exitCode === 0 ? "text-emerald-400" : "text-amber-300")}>
                          exit {task.process.exitCode ?? "killed"} · {formatMs(task.process.durationMs)}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <pre className="overflow-x-auto px-3 py-2 font-mono text-xs text-emerald-300"><span className="text-slate-500">$ </span>{task.command.command}</pre>
              </div>
            )}
            {(task.command || task.logs.length > 0) && <LogConsole logs={task.logs} />}
          </div>
        </div>
      )}

      {/* outcome */}
      {r && r.status !== "answered" && (
        <div className="space-y-3 p-4">
          {r.status === "completed" ? (
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <span>✓</span> Verified result from live CLI execution
              {r.execution && <span className="text-xs text-slate-500">(exit {r.execution.exit_code}, {r.data?.crawl_stats.pages_crawled} page(s), {formatMs(r.execution.duration_ms)})</span>}
            </div>
          ) : (
            <div className={cx("rounded-md border px-3 py-2 text-sm",
              r.status === "partial" ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200")}>
              <div className="font-medium">{r.status === "partial" ? "⚠ Partial result" : r.status === "cancelled" ? "■ Cancelled" : "✕ Task failed"}</div>
              {r.error && <div className="mt-0.5 text-xs opacity-90">{r.error}</div>}
              {r.execution && <div className="mt-1 font-mono text-[11px] opacity-70">exit code {r.execution.exit_code ?? "–"} ({r.execution.exit_meaning})</div>}
            </div>
          )}
          {(r.summary || r.data) && <ResultTabs result={r} logs={task.logs} taskId={task.id} />}
        </div>
      )}
    </div>
  );
}
