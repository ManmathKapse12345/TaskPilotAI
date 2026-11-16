"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Braces, Download, FileStack, Gauge, Hash, Hourglass, RotateCw, Timer, Waypoints } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { buildLogRows, downloadText, logsAsText, pageHits } from "@/lib/logs";
import { displayStages, hostOf, type TaskView } from "@/lib/taskState";
import { useWorkspace } from "@/lib/workspace";
import { useNow } from "./useNow";
import { STATUS_META, StatusBadge, clockTime, cx, formatBytes, formatClock, shortId } from "../ui/primitives";
import { useToast } from "../ui/Toast";

function Metric({ icon: Icon, tone, label, value, valueClass }: { icon: LucideIcon; tone?: string; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded bg-surface-container-low p-2">
      <div className="flex min-w-0 items-center gap-1.5 text-on-surface-variant">
        <Icon className={cx("h-3.5 w-3.5 shrink-0", tone)} />
        <span className="truncate font-mono text-label-code uppercase">{label}</span>
      </div>
      <span className={cx("truncate font-mono text-code-sm font-semibold", valueClass ?? "text-on-surface")}>{value}</span>
    </div>
  );
}

/** Stitch "Control & Telemetry Strip": identifiers, actions and six live metrics, all from task events. */
export function ControlStrip({ task }: { task: TaskView }) {
  const ws = useWorkspace();
  const router = useRouter();
  const toast = useToast();
  const [cancelling, setCancelling] = useState(false);
  const running = !task.finished;
  const now = useNow(running, 100);
  const elapsed = task.startedAt ? ((task.endedAt ?? now) - task.startedAt) * 1000 : null;
  const p = task.process;
  const stages = displayStages(task);
  const current = stages.find((s) => s.status === "running") ?? [...stages].reverse().find((s) => s.status !== "pending" && s.status !== "skipped");
  const pages = pageHits(task).length;
  const hasResults = !!task.result && (!!task.result.data || !!task.result.json_output || !!task.result.summary);
  const url = task.plan?.url;

  const cancel = async () => { setCancelling(true); await ws.cancel(task.id); setCancelling(false); };
  const retry = async () => {
    try { const id = await ws.submit(task.prompt); router.push(`/live?id=${id}`); }
    catch (e) { toast({ tone: "error", title: (e as Error & { title?: string }).title ?? "Could not rerun", body: (e as Error).message }); }
  };
  const raw = () => downloadText(logsAsText(buildLogRows(task), (ts) => clockTime(ts, true)), `taskpilot-${task.id.slice(0, 8)}.log`);

  return (
    <section className="flex flex-col gap-1 rounded-xl bg-surface-container-lowest p-3 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          <span className="font-mono text-code-lg font-semibold tracking-tight text-on-surface">{shortId(task.id)}</span>
          {url && <><span className="font-mono text-code-sm text-outline-variant">/</span>
            <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="max-w-[280px] truncate font-mono text-code-sm text-secondary hover:underline">{hostOf(url)}</a></>}
          {p && <span className="rounded bg-surface-container-high px-2 py-0.5 font-mono text-label-code text-on-surface-variant">PID {p.pid}</span>}
          {task.command && <span className="rounded bg-surface-container-high px-2 py-0.5 font-mono text-label-code text-on-surface-variant">{task.command.tool}</span>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {running ? (
            <button type="button" onClick={cancel} disabled={cancelling}
              className="flex items-center gap-1.5 rounded-lg bg-error-container/30 px-2 py-1.5 text-label-md font-medium text-error transition-all hover:bg-error-container/50 active:scale-95 disabled:opacity-50">
              <Ban className="h-4 w-4" />{cancelling ? "Aborting…" : "Abort"}
            </button>
          ) : (
            <button type="button" onClick={retry} disabled={ws.submitting || ws.healthError}
              className="flex items-center gap-1.5 rounded-lg bg-surface-container-high px-2 py-1.5 text-label-md font-medium text-on-surface transition-all hover:bg-surface-container-highest active:scale-95 disabled:opacity-50">
              <RotateCw className="h-4 w-4 text-secondary" />Rerun
            </button>
          )}
          <button type="button" onClick={raw} title="Download the execution log"
            className="flex items-center gap-1.5 rounded-lg bg-surface-container px-2 py-1.5 text-label-md font-medium text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-on-surface">
            <Download className="h-4 w-4" />.log
          </button>
          {hasResults ? (
            <Link href={`/results?id=${task.id}`}
              className="glow-primary flex items-center gap-1.5 rounded-lg bg-primary-container px-2 py-1.5 text-label-md font-medium text-on-primary-container transition-all hover:bg-primary">
              <Braces className="h-4 w-4" />Results
            </Link>
          ) : (
            <span title={running ? "Results appear when the CLI finishes" : "This task produced no extracted data"}
              className="flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-surface-container px-2 py-1.5 text-label-md font-medium text-on-surface-variant opacity-50">
              <Braces className="h-4 w-4" />Results
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 pt-1 md:grid-cols-3 xl:grid-cols-6">
        <Metric icon={Timer} tone="text-primary" label="Elapsed" value={formatClock(elapsed)} />
        <Metric icon={Hourglass} tone="text-secondary" label="Stage" value={task.finished ? STATUS_META[task.status].label : current?.label ?? "Queued"}
          valueClass={task.finished ? STATUS_META[task.status].text : "text-secondary"} />
        <Metric icon={FileStack} label="Pages" value={task.plan?.max_pages ? `${pages} / ${task.plan.max_pages}` : String(pages)} valueClass="text-primary" />
        <Metric icon={Hash} label="Exit code" value={p && !p.running ? String(p.exitCode ?? "killed") : "–"}
          valueClass={p && !p.running ? (p.exitCode === 0 ? "text-primary" : p.exitCode === 1 ? "text-warn" : "text-error") : undefined} />
        <Metric icon={Waypoints} label="Stdout" value={p?.stdoutBytes != null ? formatBytes(p.stdoutBytes) : "–"} valueClass="text-secondary" />
        <Metric icon={Gauge} label="Timeout" value={task.command ? `${task.command.timeout_s}s` : "–"} />
      </div>
    </section>
  );
}
