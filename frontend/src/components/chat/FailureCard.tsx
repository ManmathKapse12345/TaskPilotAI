"use client";

import { Ban, FileText, Globe, RotateCw, ShieldAlert, Terminal, XCircle } from "lucide-react";
import { buildLogRows } from "@/lib/logs";
import type { TaskView } from "@/lib/taskState";
import { useWorkspace } from "@/lib/workspace";
import { clockTime, cx, formatMs } from "../ui/primitives";
import { Evidence, failureKind } from "./bits";
import { RecoveryNote } from "./ReasoningTrace";

/** Stitch "Execution Statuses": honest blocked / failed / timed-out / stopped replies. */
export function FailureCard({ task, onRetry, onTryPublic }: { task: TaskView; onRetry: () => void; onTryPublic: () => void }) {
  const ws = useWorkspace();
  const kind = failureKind(task);
  const r = task.result;
  const p = task.process;
  const reason = r?.error ?? r?.message ?? "No reason was reported.";
  const tail = buildLogRows(task).filter((x) => x.level === "error" || x.level === "warning" || x.tag === "EXIT").slice(-3);

  const meta = {
    blocked: { icon: ShieldAlert, title: "I can't crawl this address", badge: "Blocked · safety policy", border: "border-error", tone: "text-error", bg: "bg-error-container/30" },
    unreachable: { icon: Globe, title: "I couldn't reach this website", badge: "Failed · unreachable", border: "border-warn", tone: "text-warn", bg: "bg-warn/10" },
    timeout: { icon: XCircle, title: `The crawler stopped: timed out${task.command ? ` after ${task.command.timeout_s}s` : ""}`, badge: "Failed · process killed", border: "border-error", tone: "text-error", bg: "bg-error-container/30" },
    failed: { icon: XCircle, title: "This task failed", badge: "Failed", border: "border-error", tone: "text-error", bg: "bg-error-container/30" },
    cancelled: { icon: Ban, title: "Stopped by you", badge: "Cancelled", border: "border-outline", tone: "text-on-surface-variant", bg: "bg-surface-container-high" },
  }[kind];

  return (
    <div className={cx("flex flex-col gap-3 rounded-xl border-l-4 bg-surface-container-low p-4", meta.border)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", meta.bg, meta.tone)}><meta.icon className="h-5 w-5" /></span>
          <div>
            <div className="text-headline-sm font-semibold text-on-surface">{meta.title}</div>
            {(kind === "blocked" || (kind === "unreachable" && !task.command)) && <div className="font-mono text-code-sm text-on-surface-variant">checked before any process was started</div>}
          </div>
        </div>
        <span className={cx("flex items-center gap-1.5 rounded px-2 py-1 font-mono text-label-code font-semibold uppercase", meta.bg, meta.tone)}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />{meta.badge}
        </span>
      </div>

      {(p || task.command) && (
        <div className="flex flex-wrap gap-1.5">
          {task.command && <Evidence>{task.command.tool}</Evidence>}
          {p && !p.running && <Evidence tone="bad">{p.exitCode != null ? `exit code ${p.exitCode}` : "no exit code"}</Evidence>}
          {p && (p.cancelled || p.timedOut) && <Evidence tone="bad">process killed</Evidence>}
          {p && <Evidence>PID {p.pid}</Evidence>}
          {p?.durationMs != null && <Evidence>duration: {formatMs(p.durationMs)}</Evidence>}
        </div>
      )}

      <RecoveryNote task={task} />

      {kind !== "cancelled" && (
        <div className="rounded-lg bg-surface-container p-3 text-body-md">
          <p className="break-words text-on-surface">{reason}</p>
          {kind === "blocked" && <p className="mt-1 text-body-sm text-on-surface-variant">For safety, TaskPilot only crawls public websites. Private, local and internal addresses are refused before any process starts.</p>}
          {kind === "unreachable" && <p className="mt-1 text-body-sm text-on-surface-variant">The address doesn&apos;t seem to exist or isn&apos;t responding. Check the spelling, or try again later.</p>}
          {r?.execution?.exit_meaning && kind !== "blocked" && <p className="mt-1 font-mono text-code-sm text-on-surface-variant">exit code {r.execution.exit_code ?? "–"}: {r.execution.exit_meaning}</p>}
        </div>
      )}

      {tail.length > 0 && (
        <div className="rounded-lg bg-terminal p-3 font-mono text-code-sm">
          <div className="mb-1 flex items-center gap-1.5 text-label-code uppercase tracking-wider text-on-surface-variant"><Terminal className="h-3.5 w-3.5" />Last log lines</div>
          {tail.map((x) => (
            <div key={x.order} className={cx("break-all", x.level === "error" ? "text-error" : x.level === "warning" ? "text-warn" : "text-on-surface-variant")}>
              <span className="text-on-surface-variant/60">[{clockTime(x.ts)}]</span> [{x.tag}] {x.msg}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {kind === "blocked" || kind === "unreachable"
          ? <Btn onClick={onTryPublic} icon={<Globe className="h-4 w-4 text-secondary" />}>{kind === "blocked" ? "Try a public URL" : "Try another URL"}</Btn>
          : <Btn onClick={onRetry} disabled={ws.submitting || ws.healthError} icon={<RotateCw className="h-4 w-4 text-secondary" />}>Retry</Btn>}
        {task.command && <Btn onClick={() => ws.setDetailsId(task.id)} icon={<FileText className="h-4 w-4 text-on-surface-variant" />}>View full log</Btn>}
      </div>
    </div>
  );
}

function Btn({ onClick, icon, children, disabled }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-1.5 text-body-md text-on-surface transition-colors hover:bg-surface-bright disabled:opacity-40">
      {icon}{children}
    </button>
  );
}
