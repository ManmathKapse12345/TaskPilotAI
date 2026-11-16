"use client";

import { useState } from "react";
import { AlertTriangle, Ban, Bookmark, BookmarkCheck, CheckCircle2, ChevronDown, Copy, RotateCw, Square, XCircle } from "lucide-react";
import { displayStages, hostOf, type TaskView } from "@/lib/taskState";
import { LogoMark } from "../layout/Logo";
import { ResultTabs } from "../results/ResultTabs";
import { Button, IconButton, SectionLabel, StatusBadge, cx, formatMs } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import { ExecutionLogs } from "./ExecutionLogs";
import { ExecutionTimeline, useNow } from "./ExecutionTimeline";

export function ExecutionPanel({ task, saved, defaultExpanded, onCancel, onRetry, onToggleSave }: {
  task: TaskView;
  saved: boolean;
  defaultExpanded: boolean;
  onCancel: () => Promise<void>;
  onRetry: () => void;
  onToggleSave: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(defaultExpanded);
  const [cancelling, setCancelling] = useState(false);
  const running = !task.finished;
  const now = useNow(running, 100);
  const elapsed = task.startedAt ? ((task.endedAt ?? now) - task.startedAt) * 1000 : null;
  const r = task.result;
  const stages = displayStages(task);
  const hasResultView = !!(r && (r.summary || r.data));

  const cancel = async () => {
    setCancelling(true);
    try {
      await onCancel();
      toast({ tone: "info", title: "Cancellation requested", body: "The CLI process is being terminated." });
    } catch (e) {
      toast({ tone: "error", title: "Could not cancel", body: (e as Error).message });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section className="animate-fade-up flex gap-3" aria-label="Task execution">
      <LogoMark className="mt-0.5 hidden h-7 w-7 rounded-lg sm:flex" />
      <div className="min-w-0 flex-1 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-xl shadow-black/20">
        {/* header */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <StatusBadge status={task.status} />
            <span className="min-w-0 truncate text-[13px] font-medium text-fg">
              {task.plan?.url ? hostOf(task.plan.url) : running ? "Interpreting request…" : "Execution"}
            </span>
            <span className="hidden font-mono text-[11px] text-subtle sm:inline">#{task.id.slice(0, 8)}</span>
            {elapsed != null && <span className={cx("font-mono text-[11px] tabular-nums", running ? "text-accent" : "text-subtle")}>{formatMs(elapsed)}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {running && (
              <Button variant="danger" onClick={cancel} disabled={cancelling} icon={<Square className="h-3 w-3" fill="currentColor" />}>
                {cancelling ? "Cancelling…" : "Cancel"}
              </Button>
            )}
            {task.finished && <Button onClick={onRetry} icon={<RotateCw className="h-3.5 w-3.5" />} title="Run the same prompt again">Retry</Button>}
            {task.finished && (
              <IconButton label={saved ? "Remove from saved results" : "Save result"} onClick={onToggleSave} className={cx("h-7 w-7", saved && "text-accent")}>
                {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              </IconButton>
            )}
            <IconButton label={open ? "Hide execution details" : "Show execution details"} onClick={() => setOpen((o) => !o)} className="h-7 w-7">
              <ChevronDown className={cx("h-4 w-4 transition-transform", !open && "-rotate-90")} />
            </IconButton>
          </div>
        </div>

        {open && (
          <div className="grid border-b border-line lg:grid-cols-[minmax(0,290px)_minmax(0,1fr)]">
            <div className="border-b border-line p-4 lg:border-b-0 lg:border-r">
              <SectionLabel className="mb-3">Execution pipeline</SectionLabel>
              <ExecutionTimeline stages={stages} />
            </div>
            <div className="min-w-0 space-y-4 p-4">
              <PlanView task={task} />
              {task.command && <CommandBlock task={task} />}
              {(running || !hasResultView) && (task.command || task.logs.length > 0) && (
                <div>
                  <SectionLabel className="mb-2">CLI output</SectionLabel>
                  <ExecutionLogs task={task} compact live={running && !!task.process?.running} />
                </div>
              )}
              {!task.plan && running && (
                <div className="space-y-2">
                  <div className="h-3 w-40 animate-pulse rounded bg-raised" />
                  <div className="h-3 w-64 animate-pulse rounded bg-raised" />
                </div>
              )}
            </div>
          </div>
        )}

        {r && r.status !== "answered" && (
          <div className="space-y-4 p-4">
            <Outcome task={task} />
            {hasResultView && <ResultTabs task={task} />}
          </div>
        )}
      </div>
    </section>
  );
}

function PlanView({ task }: { task: TaskView }) {
  const p = task.plan;
  if (!p || p.intent !== "website_crawl") return null;
  const rows: [string, string][] = [
    ["Target", p.url ?? "–"],
    ["Scope", `up to ${p.max_pages} page${p.max_pages === 1 ? "" : "s"} · depth ${p.max_depth}`],
    ["Output", [p.wants_summary && "summary", p.wants_json && "JSON"].filter(Boolean).join(" + ") || "–"],
  ];
  if (p.focus.length) rows.push(["Focus", p.focus.join(", ")]);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <SectionLabel>Interpreted task</SectionLabel>
        <span className="text-[11px] text-subtle">
          intent <span className="font-mono text-accent">website_crawl</span> · parsed by {p.interpreted_by === "llm" ? "LLM" : "rules"}
        </span>
      </div>
      <dl className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
        {rows.map(([k, v], i) => (
          <div key={k} className={cx("min-w-0 bg-surface px-3 py-2", rows.length % 2 === 1 && i === rows.length - 1 && "sm:col-span-2")}>
            <dt className="text-[11px] text-subtle">{k}</dt>
            <dd className="mt-0.5 truncate text-[13px] text-fg" title={v}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CommandBlock({ task }: { task: TaskView }) {
  const toast = useToast();
  const c = task.command!;
  const p = task.process;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <SectionLabel>Command</SectionLabel>
        <span className="text-[11px] text-subtle">approved tool <span className="font-mono text-muted">{c.tool}</span> · shell disabled · {c.timeout_s}s limit</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-[#09090c]">
        <div className="flex items-start gap-2 px-3 py-2.5">
          <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-fg"><span className="select-none text-accent">$ </span>{c.command}</pre>
          <IconButton label="Copy command" className="-mr-1 -mt-1 h-7 w-7"
            onClick={() => navigator.clipboard.writeText(c.command).then(() => toast({ tone: "success", title: "Command copied" }), () => toast({ tone: "error", title: "Clipboard unavailable" }))}>
            <Copy className="h-3.5 w-3.5" />
          </IconButton>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-3 py-1.5 font-mono text-[11px] text-subtle">
          <span>pid <span className="text-muted">{p?.pid ?? "–"}</span></span>
          <span>state {p ? (p.running ? <span className="text-accent">running</span> : <span className="text-muted">exited</span>) : <span className="text-muted">starting</span>}</span>
          <span>exit code <span className={cx(p?.exitCode === 0 ? "text-ok" : p?.exitCode == null ? "text-muted" : p.exitCode === 1 ? "text-warn" : "text-bad")}>
            {p && !p.running ? (p.exitCode ?? "killed") : "–"}</span></span>
          {p?.durationMs != null && <span>duration <span className="text-muted">{formatMs(p.durationMs)}</span></span>}
        </div>
      </div>
    </div>
  );
}

function Outcome({ task }: { task: TaskView }) {
  const r = task.result!;
  const ex = r.execution;
  const pages = r.data?.crawl_stats.pages_crawled;
  const meta = [ex?.exit_code != null && `exit ${ex.exit_code}`, pages != null && `${pages} page${pages === 1 ? "" : "s"}`, ex && formatMs(ex.duration_ms)].filter(Boolean).join(" · ");

  const style = {
    completed: { icon: CheckCircle2, cls: "border-ok/20 bg-ok/[0.05]", ic: "text-ok", title: "Verified result from a live CLI execution" },
    partial: { icon: AlertTriangle, cls: "border-warn/25 bg-warn/[0.06]", ic: "text-warn", title: "Partial result" },
    failed: { icon: XCircle, cls: "border-bad/25 bg-bad/[0.06]", ic: "text-bad", title: "Task failed" },
    cancelled: { icon: Ban, cls: "border-line-strong bg-raised/50", ic: "text-muted", title: "Task cancelled" },
  }[r.status as "completed" | "partial" | "failed" | "cancelled"] ?? { icon: AlertTriangle, cls: "border-line", ic: "text-muted", title: r.status };

  return (
    <div className={cx("flex items-start gap-3 rounded-xl border px-3.5 py-3", style.cls)}>
      <style.icon className={cx("mt-0.5 h-4 w-4 shrink-0", style.ic)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="text-[13px] font-medium text-fg">{style.title}</span>
          {meta && <span className="font-mono text-[11px] text-subtle">{meta}</span>}
        </div>
        {r.error && <p className="mt-1 break-words text-[13px] text-muted">{r.error}</p>}
        {!r.error && r.message && r.status !== "completed" && <p className="mt-1 break-words text-[13px] text-muted">{r.message}</p>}
        {ex && r.status !== "completed" && ex.exit_meaning && <p className="mt-1 font-mono text-[11px] text-subtle">exit code {ex.exit_code ?? "–"}: {ex.exit_meaning}</p>}
      </div>
    </div>
  );
}
