"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Braces, Copy, Maximize2, RotateCw, SquareTerminal, Trash2, X } from "lucide-react";
import type { TaskSummaryRow } from "@/lib/api";
import { buildLogRows } from "@/lib/logs";
import { FINISHED, hostOf } from "@/lib/taskState";
import { useWorkspace } from "@/lib/workspace";
import { STATUS_META, cx, formatMs, shortId } from "../ui/primitives";
import { useToast } from "../ui/Toast";

/** Stitch "Docked Side Inspector Drawer": diagnostics for the selected run, loaded from GET /api/tasks/{id}. */
export function TaskInspector({ row, onClose }: { row: TaskSummaryRow; onClose: () => void }) {
  const ws = useWorkspace();
  const toast = useToast();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const { ensureTask } = ws;
  useEffect(() => { ensureTask(row.id); }, [row.id, ensureTask]);
  useEffect(() => setConfirm(false), [row.id]); // eslint-disable-line react-hooks/set-state-in-effect -- reset confirmation per task

  const task = ws.tasks[row.id];
  const err = ws.loadErrors[row.id];
  const r = task?.result;
  const failed = row.status === "failed" || row.status === "cancelled";
  const live = row.status === "running" || row.status === "queued";
  const rows = task ? buildLogRows(task) : [];
  const tail = rows.slice(-6);
  const meta = STATUS_META[row.status] ?? STATUS_META.queued;

  const copy = (text: string, title: string) => navigator.clipboard.writeText(text).then(() => toast({ tone: "success", title }), () => toast({ tone: "error", title: "Clipboard unavailable" }));
  const retry = async () => {
    try { const id = await ws.submit(row.prompt); router.push(`/live?id=${id}`); }
    catch (e) { toast({ tone: "error", title: (e as Error & { title?: string }).title ?? "Could not retry", body: (e as Error).message }); }
  };

  return (
    <aside aria-label="Task run diagnostics" className="flex w-full shrink-0 flex-col gap-3 rounded-xl bg-surface-container-lowest p-3 shadow-xl 2xl:w-[360px]">
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <span className={cx("h-2.5 w-2.5 rounded-full", meta.dot, failed && "animate-ping")} />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-code-sm font-semibold text-on-surface">{shortId(row.id)}</span>
              <span className={cx("rounded px-1.5 font-mono text-label-code font-bold uppercase", meta.bg, meta.text)}>
                {row.exit_code != null ? `Exit ${row.exit_code}` : meta.label}
              </span>
            </div>
            <div className="font-mono text-label-code text-on-surface-variant">Task Run Diagnostics</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/${live || failed ? "live" : "results"}?id=${row.id}`} title="Open full view" aria-label="Open full view"
            className="rounded bg-surface-container-low p-1 text-on-surface-variant transition-colors hover:text-on-surface"><Maximize2 className="h-4 w-4" /></Link>
          <button type="button" onClick={onClose} title="Close" aria-label="Close inspector"
            className="rounded bg-surface-container-low p-1 text-on-surface-variant transition-colors hover:text-on-surface"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg bg-surface-container-low p-2">
        <span className="font-mono text-label-code uppercase text-on-surface-variant">Target</span>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-code-sm font-medium text-secondary">{row.url ? hostOf(row.url) : "(no URL)"}</span>
          <span className="shrink-0 rounded bg-surface-container-high px-1 font-mono text-label-code text-on-surface-variant">{row.intent ?? "–"}</span>
        </div>
        <div className="flex items-center justify-between pt-1 font-mono text-code-sm text-on-surface-variant">
          <span>{new Date(row.created_at).toLocaleString()}</span>
          <span>{formatMs(row.duration_ms)}</span>
        </div>
      </div>

      <p className="line-clamp-3 font-mono text-code-sm text-on-surface-variant">&ldquo;{row.prompt}&rdquo;</p>

      {failed && (r?.error || r?.execution?.exit_meaning) && (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1 font-mono text-label-code font-semibold uppercase text-error"><AlertTriangle className="h-3.5 w-3.5" />Failure Diagnostics</span>
          <div className="rounded-lg bg-error-container/20 p-2.5 font-mono text-code-sm">
            <p className="mb-1 font-semibold text-error">{r?.status === "cancelled" ? "Cancelled" : "Task failed"}{r?.execution?.exit_code != null ? ` · exit ${r.execution.exit_code}` : ""}</p>
            {r?.error && <p className="break-words text-[11px] leading-relaxed text-on-surface-variant">{r.error}</p>}
            {r?.execution?.exit_meaning && <p className="mt-1 text-[11px] text-on-surface-variant">{r.execution.exit_meaning}</p>}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-label-code font-medium uppercase text-on-surface-variant">Execution Log (tail)</span>
          {rows.length > 0 && (
            <button type="button" onClick={() => copy(rows.map((x) => `[${x.tag}] ${x.msg}`).join("\n"), "Log copied")}
              className="flex items-center gap-0.5 font-mono text-label-code text-secondary hover:underline"><Copy className="h-3 w-3" />Copy log</button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg bg-surface-container-lowest p-2 font-mono text-code-sm leading-tight text-on-surface-variant ring-1 ring-line">
          {err && <span className="text-error">{err}</span>}
          {!err && !task && <span className="animate-pulse">Loading events…</span>}
          {task && tail.length === 0 && <span>No CLI output recorded{live ? " yet" : ""}.</span>}
          {tail.map((x, i) => {
            const bad = x.level === "error" || x.level === "warning";
            return (
              <div key={i} className={cx("flex gap-2 py-px", bad && "-mx-1 rounded bg-error/15 px-1")}>
                <span className={cx("select-none", bad ? "font-semibold text-error" : "text-surface-bright")}>{String(rows.length - tail.length + i + 1).padStart(2, "0")}</span>
                <span className={cx("break-all", bad ? "font-semibold text-error" : x.tag === "EXIT" ? "font-medium text-secondary" : undefined)}>[{x.tag}] {x.msg}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <span className="font-mono text-label-code uppercase text-on-surface-variant">Quick Actions</span>
        {live ? (
          <Link href={`/live?id=${row.id}`} className="glow-primary flex w-full items-center justify-between rounded-lg bg-primary-container px-2 py-2 text-label-md font-semibold text-on-primary-container transition-all hover:bg-primary">
            <span className="flex items-center gap-1.5"><SquareTerminal className="h-4 w-4" />Follow in Live CLI</span><ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button type="button" onClick={retry} disabled={ws.submitting || ws.healthError}
            className="glow-primary flex w-full items-center justify-between rounded-lg bg-primary-container px-2 py-2 text-label-md font-semibold text-on-primary-container transition-all hover:bg-primary disabled:opacity-40">
            <span className="flex items-center gap-1.5"><RotateCw className="h-4 w-4" />{failed ? "Retry task" : "Run again"}</span><ArrowRight className="h-4 w-4" />
          </button>
        )}
        {!live && r && (r.data || r.json_output) && (
          <Link href={`/results?id=${row.id}`} className="flex w-full items-center justify-between rounded-lg bg-surface-container px-2 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-high">
            <span className="flex items-center gap-1.5"><Braces className="h-4 w-4 text-secondary" />Inspect JSON results</span>
            <span className="font-mono text-label-code text-on-surface-variant">{r.data ? `${r.data.pages.length} pgs` : "json"}</span>
          </Link>
        )}
        {task?.command && (
          <button type="button" onClick={() => copy(task.command!.command, "Command copied")}
            className="flex w-full items-center justify-between rounded-lg bg-surface-container px-2 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-high">
            <span className="flex items-center gap-1.5"><SquareTerminal className="h-4 w-4 text-primary" />Copy reproduction CLI command</span>
          </button>
        )}
        {FINISHED.includes(row.status) && (
          confirm ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setConfirm(false); ws.remove(row.id); onClose(); }}
                className="flex-1 rounded-lg bg-error-container/40 px-2 py-2 text-label-md font-semibold text-error hover:bg-error-container/60">Delete permanently</button>
              <button type="button" onClick={() => setConfirm(false)} className="rounded-lg bg-surface-container px-3 py-2 text-label-md text-on-surface hover:bg-surface-container-high">Keep</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)}
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-label-md text-on-surface-variant transition-colors hover:bg-error-container/20 hover:text-error">
              <Trash2 className="h-4 w-4" />Delete task and its logs
            </button>
          )
        )}
      </div>

      <div className="flex items-center justify-between pt-1 font-mono text-label-code text-on-surface-variant">
        <span>Stored in backend DB</span>
        <span className="text-primary">{rows.length} events</span>
      </div>
    </aside>
  );
}
