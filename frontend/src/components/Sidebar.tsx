"use client";

import type { Health, TaskSummaryRow } from "@/lib/api";
import { StatusDot, cx } from "./ui";

export function Sidebar({ history, activeId, health, healthError, onNew, onOpen, onDelete, open, onClose }: {
  history: TaskSummaryRow[];
  activeId: string | null;
  health: Health | null;
  healthError: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onClose} />}
      <aside className={cx(
        "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800 bg-slate-950 transition-transform md:static md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 font-bold text-white">T</div>
          <div>
            <div className="text-sm font-semibold text-white">TaskPilot AI</div>
            <div className="text-[11px] text-slate-500">Don&apos;t just ask AI. Let it execute.</div>
          </div>
        </div>
        <div className="px-3">
          <button onClick={onNew} className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800">
            + New task
          </button>
        </div>

        <div className="mt-5 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Execution history</div>
        <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {history.length === 0 && <div className="px-2 py-1 text-xs text-slate-600">No tasks yet</div>}
          {history.map((t) => (
            <div key={t.id} className={cx("group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
              activeId === t.id ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200")}>
              <StatusDot status={t.status} />
              <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(t.id)} title={t.prompt}>
                <div className="truncate">{t.url ? t.url.replace(/^https?:\/\//, "").replace(/\/$/, "") : t.prompt}</div>
                <div className="text-[10px] text-slate-600">{new Date(t.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })} · {t.status}</div>
              </button>
              <button onClick={() => onDelete(t.id)} title="Delete" className="hidden text-slate-600 hover:text-rose-400 group-hover:block">✕</button>
            </div>
          ))}
        </nav>

        <div className="space-y-1.5 border-t border-slate-800 px-4 py-3 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className={cx("h-2 w-2 rounded-full", healthError ? "bg-rose-500" : health ? "bg-emerald-500" : "bg-slate-600")} />
            {healthError ? "Backend unreachable" : health ? "Backend online" : "Connecting…"}
          </div>
          {health && (
            <>
              <div>AI layer: <span className="text-slate-300">{health.llm.enabled ? `${health.llm.provider} · ${health.llm.model}` : "rule-based (no LLM key)"}</span></div>
              <div>Approved CLI tools: <span className="font-mono text-slate-300">{health.tools.join(", ")}</span></div>
              <div>Limits: {health.limits.max_pages} pages · depth {health.limits.max_depth} · {health.limits.cli_timeout_s}s</div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
