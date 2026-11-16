"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BrainCircuit, GitFork, History, Network, ScrollText, ShieldCheck, SquareTerminal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TaskSummaryRow } from "@/lib/api";
import { hostOf } from "@/lib/taskState";
import { useWorkspace } from "@/lib/workspace";
import { COMPOSER_ID } from "../layout/AppShell";
import { STATUS_META, cx, formatMs, timeAgo } from "../ui/primitives";

function EngineRow({ icon: Icon, tone, title, sub, status, statusTone, chip }: {
  icon: LucideIcon; tone: string; title: string; sub: string; status: ReactNode; statusTone: string; chip?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-lowest p-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-container-high", tone)}><Icon className="h-4 w-4" /></div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-body-md font-medium text-on-surface">{title}</span>
          <span className="truncate font-mono text-code-sm text-on-surface-variant">{sub}</span>
        </div>
      </div>
      {chip
        ? <span className={cx("shrink-0 rounded bg-surface-container-high px-2 py-0.5 font-mono text-label-code", statusTone)}>{status}</span>
        : <span className={cx("flex shrink-0 items-center gap-1.5 font-mono text-label-code", statusTone)}>{status}</span>}
    </div>
  );
}

/** Real backend components reported by GET /api/health (Stitch "Active Sub-Agent Swarm"). */
export function EngineCard() {
  const { health, healthError } = useWorkspace();
  const online = !!health && !healthError;
  const off = healthError ? "OFFLINE" : "…";
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 shadow-md">
      <div className="flex items-center justify-between pb-0.5">
        <div className="flex items-center gap-1">
          <Network className="h-4.5 w-4.5 text-primary" />
          <h2 className="text-headline-sm font-semibold text-on-surface">Execution Engine</h2>
        </div>
        <span className={cx("rounded px-2 py-0.5 font-mono text-label-code", online ? "bg-primary/10 text-primary" : "bg-error-container/30 text-error")}>
          {online ? "Live" : healthError ? "Offline" : "Checking"}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <EngineRow icon={BrainCircuit} tone="text-primary" title="Intent Parser"
          sub={health ? (health.llm.enabled ? `${health.llm.provider} · ${health.llm.model}` : "Rule-based (no LLM key configured)") : "Natural language → task plan"}
          status={online ? <><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />LISTENING</> : off}
          statusTone={online ? "text-primary" : "text-error"} />
        <EngineRow icon={SquareTerminal} tone="text-secondary" title="Approved CLI Tools"
          sub={health ? health.tools.join(", ") : "Allow-listed binaries"} chip
          status={online ? `${health!.tools.length} READY` : off} statusTone={online ? "text-secondary" : "text-error"} />
        <EngineRow icon={ScrollText} tone="text-tertiary" title="Summarizer"
          sub={health ? (health.llm.enabled ? "LLM summary from captured content" : "Extractive summary") : "Summaries from CLI output only"}
          status={online ? "READY" : off} statusTone={online ? "text-on-surface-variant" : "text-error"} />
        <EngineRow icon={ShieldCheck} tone="text-primary" title="Network Guard"
          sub="SSRF guard · robots.txt · public URLs"
          status={online ? "ENFORCED" : off} statusTone={online ? "text-primary" : "text-error"} />
      </div>
    </section>
  );
}

/** Backend limits and current load (Stitch "Compute Allocation & Quota"). */
export function CapacityCard() {
  const { health, history } = useWorkspace();
  const running = history.filter((t) => t.status === "running" || t.status === "queued").length;
  const max = health?.limits.max_concurrent_tasks ?? 0;
  const pct = max ? Math.min(100, (running / max) * 100) : 0;
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 shadow-md">
      <div className="flex items-center justify-between">
        <span className="font-mono text-label-code uppercase tracking-wider text-on-surface-variant">Backend Capacity & Limits</span>
        <span className="font-mono text-code-sm text-primary">{health ? "per task" : "…"}</span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between font-mono text-code-sm">
          <span className="text-on-surface-variant">Concurrent tasks</span>
          <span className="font-medium text-on-surface">{health ? `${running} / ${max}` : "–"}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-lowest">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between font-mono text-label-code text-on-surface-variant/70">
          <span>{health ? `${Math.round(pct)}% of slots in use` : "waiting for /api/health"}</span>
          <span>refreshes every 15s</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 pt-1">
        {([["Max pages", health?.limits.max_pages, "text-secondary"], ["Max depth", health?.limits.max_depth, "text-primary"], ["Timeout", health ? `${health.limits.cli_timeout_s}s` : undefined, "text-tertiary"]] as const).map(([k, v, c]) => (
          <div key={k} className="flex flex-col rounded-lg bg-surface-container-lowest p-2">
            <span className="font-mono text-label-code uppercase text-on-surface-variant">{k}</span>
            <span className={cx("font-mono text-code-lg font-semibold", c)}>{v ?? "–"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const STATUS_TONE: Partial<Record<TaskSummaryRow["status"], string>> = {
  completed: "bg-primary/10 text-primary",
  partial: "bg-warn/10 text-warn",
  failed: "bg-error-container/30 text-error",
  running: "bg-secondary/10 text-secondary",
  queued: "bg-secondary/10 text-secondary",
};

/** Latest tasks from GET /api/tasks (Stitch "Query Execution History"). */
export function RecentExecutions() {
  const ws = useWorkspace();
  const rows = ws.history.slice(0, 4);
  const reuse = (prompt: string) => {
    ws.setDraft(prompt);
    requestAnimationFrame(() => document.getElementById(COMPOSER_ID)?.focus());
  };
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <History className="h-4 w-4 text-tertiary" />
          <span className="font-mono text-label-code uppercase tracking-wider text-on-surface-variant">Recent Executions</span>
        </div>
        <Link href="/history" className="font-mono text-code-sm text-secondary hover:underline">View all</Link>
      </div>

      {!ws.historyLoaded && [0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-container-lowest" />)}
      {ws.historyLoaded && ws.historyError && <p className="rounded-lg bg-error-container/20 p-2 text-body-sm text-error">{ws.historyError}</p>}
      {ws.historyLoaded && !ws.historyError && rows.length === 0 && (
        <p className="rounded-lg bg-surface-container-lowest p-3 text-body-sm text-on-surface-variant">No tasks yet. Dispatch one and it will appear here with its full execution log.</p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((t, i) => {
          const live = t.status === "running" || t.status === "queued";
          return (
            <div key={t.id} className="group flex flex-col gap-1 rounded-lg bg-surface-container-lowest p-2 transition-colors hover:bg-surface-container">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/${live || t.status === "failed" ? "live" : "results"}?id=${t.id}`}
                  className={cx("truncate font-mono text-code-sm font-medium hover:underline", ["text-primary", "text-secondary", "text-tertiary", "text-primary"][i])}>
                  {t.url ? hostOf(t.url) : t.intent ?? "request"}
                </Link>
                <span className="shrink-0 font-mono text-label-code text-on-surface-variant">{timeAgo(t.created_at)}</span>
              </div>
              <p className="line-clamp-2 text-body-sm text-on-surface-variant">&ldquo;{t.prompt}&rdquo;</p>
              <div className="flex items-center justify-between pt-1">
                <span className={cx("rounded px-1.5 py-0.5 font-mono text-label-code uppercase", STATUS_TONE[t.status] ?? "bg-surface-container text-on-surface-variant")}>
                  {STATUS_META[t.status]?.label ?? t.status}{t.duration_ms != null && ` (${formatMs(t.duration_ms)})`}
                </span>
                <button type="button" onClick={() => reuse(t.prompt)}
                  className="flex items-center gap-0.5 font-mono text-label-code text-secondary opacity-100 transition-opacity group-hover:opacity-100 lg:opacity-0 lg:focus:opacity-100">
                  <GitFork className="h-3 w-3" /> Reuse prompt
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
