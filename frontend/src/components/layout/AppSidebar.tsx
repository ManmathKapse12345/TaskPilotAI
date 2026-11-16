"use client";

import Link from "next/link";
import { useMemo } from "react";
import { History, Plus, Settings, X } from "lucide-react";
import type { TaskSummaryRow } from "@/lib/api";
import { hostOf } from "@/lib/taskState";
import { useWorkspace } from "@/lib/workspace";
import { STATUS_META, cx } from "../ui/primitives";
import { LogoMark, Wordmark } from "./Logo";

function group(iso: string) {
  const d = new Date(iso); const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000;
  return diff <= 0 ? "Today" : diff === 1 ? "Yesterday" : diff < 7 ? "Previous 7 days" : "Older";
}

/** Chat sidebar: new chat, past chats (stored tasks), server status. Drawer on small screens. */
export function AppSidebar({ open, onClose, onNew, onOpen, current }: {
  open: boolean; onClose: () => void; onNew: () => void; onOpen: (id: string) => void; current: "chat" | "history";
}) {
  const ws = useWorkspace();
  const online = !!ws.health && !ws.healthError;
  const activeIds = new Set(ws.thread.flatMap((t) => (t.kind === "task" ? [t.id] : [])));

  const groups = useMemo(() => {
    const out: [string, TaskSummaryRow[]][] = [];
    for (const t of ws.history.slice(0, 40)) {
      const g = group(t.created_at);
      const b = out.find(([k]) => k === g);
      if (b) b[1].push(t); else out.push([g, [t]]);
    }
    return out;
  }, [ws.history]);

  return (
    <>
      <div onClick={onClose} className={cx("fixed inset-0 z-40 bg-black/60 transition-opacity lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")} />
      <aside className={cx("fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-surface-container-lowest p-3 transition-transform duration-200 lg:static lg:z-auto lg:w-[260px] lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center justify-between gap-2 p-1">
          <div className="flex items-center gap-2"><LogoMark /><Wordmark sub="CLI-powered web agent" /></div>
          <button type="button" onClick={onClose} aria-label="Close menu" className="rounded p-1 text-on-surface-variant hover:text-on-surface lg:hidden"><X className="h-5 w-5" /></button>
        </div>

        <button type="button" onClick={onNew}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-body-md font-medium text-primary transition-colors hover:bg-surface-container">
          <Plus className="h-4 w-4" />New chat <kbd className="ml-auto rounded bg-surface-container-high px-1.5 py-0.5 text-label-code text-on-surface-variant">Alt N</kbd>
        </button>

        <nav className="mt-4 flex-1 overflow-y-auto" aria-label="Past chats">
          {!ws.historyLoaded && [0, 1, 2, 3].map((i) => <div key={i} className="mb-1.5 h-7 animate-pulse rounded bg-surface-container-low" />)}
          {ws.historyLoaded && ws.history.length === 0 && (
            <p className="px-2 py-3 text-body-sm text-on-surface-variant">Your chats appear here. Each one keeps its results and full run log.</p>
          )}
          {groups.map(([g, rows]) => (
            <div key={g} className="mb-3">
              <div className="px-2 pb-1 font-mono text-label-code uppercase tracking-wider text-on-surface-variant">{g}</div>
              {rows.map((t) => {
                const active = current === "chat" && activeIds.has(t.id);
                return (
                  <button key={t.id} type="button" onClick={() => onOpen(t.id)} title={t.prompt}
                    className={cx("flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                      active ? "bg-surface-container-high text-primary" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface")}>
                    <span className="truncate font-mono text-code-sm">{t.url ? hostOf(t.url) : t.prompt}</span>
                    <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_META[t.status]?.dot)} title={STATUS_META[t.status]?.label} />
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <Link href="/history" onClick={onClose}
          className={cx("mb-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-body-md transition-colors",
            current === "history" ? "bg-surface-container-high text-primary" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface")}>
          <History className="h-4 w-4" />All tasks &amp; stats
        </Link>

        <div className="flex items-center justify-between rounded-lg bg-surface-container-low px-2 py-2">
          <span className={cx("flex items-center gap-2 font-mono text-code-sm", online ? "text-on-surface-variant" : "text-error")} title={ws.health ? `${ws.health.llm.enabled ? `AI: ${ws.health.llm.provider} · ${ws.health.llm.model}` : "Rule-based parser"}` : undefined}>
            <span className={cx("h-2 w-2 rounded-full", online ? "bg-primary" : ws.healthError ? "bg-error" : "animate-pulse bg-outline")} />
            {online ? `Server online${ws.latencyMs != null ? ` · ${ws.latencyMs}ms` : ""}` : ws.healthError ? "Server offline" : "Connecting…"}
          </span>
          <button type="button" onClick={() => ws.setSettingsOpen(true)} aria-label="Settings" title="Settings" className="rounded p-1 text-on-surface-variant hover:bg-surface-container hover:text-on-surface">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
