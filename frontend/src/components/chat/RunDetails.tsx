"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Brain, Check, Copy, Download, Gauge, Loader2, ShieldCheck, SlidersHorizontal, Terminal, X } from "lucide-react";
import { buildLogRows, downloadText } from "@/lib/logs";
import { displayStages } from "@/lib/taskState";
import { useWorkspace } from "@/lib/workspace";
import { useNow } from "../execution/useNow";
import { clockTime, cx, formatBytes, formatMs } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import { taskDurationMs } from "./bits";
import { ReasoningTrace } from "./ReasoningTrace";

/** Stitch "Run Details Slide-over Panel": evidence of the CLI execution, from recorded task events only. */
export function RunDetails() {
  const ws = useWorkspace();
  const toast = useToast();
  const id = ws.detailsId;
  const task = id ? ws.tasks[id] : undefined;
  const [tab, setTab] = useState<"stdout" | "stderr" | "system">("stderr");
  const now = useNow(!!task && !task.finished, 500);
  const close = () => ws.setDetailsId(null);
  const { setDetailsId } = ws;

  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDetailsId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, setDetailsId]);

  const rows = useMemo(() => (task ? buildLogRows(task) : []), [task]);
  if (!id || !task) return null;

  const stages = displayStages(task);
  const p = task.process;
  const ex = task.result?.execution;
  const stderrLines = rows.filter((r) => r.stream === "stderr").length;
  const stream = rows.filter((r) => (tab === "stderr" ? r.stream === "stderr" : tab === "stdout" ? r.stream === "stdout" : r.stream === "system"));
  const total = taskDurationMs(task) ?? (task.startedAt ? (now - task.startedAt) * 1000 : null);
  const status = task.finished ? task.status : "running";

  const exportAudit = () => {
    const audit = {
      task_id: task.id, prompt: task.prompt, status: task.status, plan: task.plan ?? null,
      command: task.command ?? null, process: task.process ?? null,
      stages: stages.map(({ key, label, status, detail, startedAt, endedAt }) => ({ key, label, status, detail, startedAt, endedAt })),
      execution: ex ?? null, logs: rows.map(({ ts, stream, tag, msg }) => ({ ts, stream, tag, msg })),
    };
    downloadText(JSON.stringify(audit, null, 2), `taskpilot-${task.id.slice(0, 8)}-audit.json`, "application/json");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Run details">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <aside className="animate-fade-up relative flex h-full w-full max-w-[460px] flex-col bg-surface-container-low shadow-2xl">
        <header className="flex flex-col gap-1 bg-surface-container px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              <h2 className="text-headline-sm font-semibold text-on-surface">Run details</h2>
              <span className={cx("flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-label-code",
                status === "completed" ? "bg-primary/10 text-primary" : status === "running" ? "bg-secondary/10 text-secondary" : status === "partial" ? "bg-warn/10 text-warn" : "bg-error-container/30 text-error")}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />{p ? `PID ${p.pid} · ` : ""}{status}
              </span>
            </div>
            <button type="button" onClick={close} aria-label="Close run details" className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex items-center justify-between gap-2 font-mono text-code-sm text-on-surface-variant">
            <span className="truncate">Target: {task.plan?.url ?? "–"}</span>
            <button type="button" onClick={exportAudit} className="flex shrink-0 items-center gap-1 text-primary hover:underline"><Download className="h-3.5 w-3.5" />Export audit (.json)</button>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-label-code uppercase tracking-wider text-on-surface-variant"><Activity className="h-4 w-4 text-primary" />Pipeline timeline</span>
              {total != null && <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-label-code text-primary">{formatMs(total)} wall-clock</span>}
            </div>
            <ol className="space-y-1 rounded-lg bg-surface-container-lowest p-3">
              {stages.map((s, i) => {
                const dur = s.startedAt != null && s.endedAt != null ? (s.endedAt - s.startedAt) * 1000 : s.status === "running" && s.startedAt ? (now - s.startedAt) * 1000 : null;
                return (
                  <li key={s.key} className="flex items-start gap-2.5 py-1">
                    <span className={cx("mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full",
                      s.status === "done" ? "bg-primary/15 text-primary" : s.status === "running" ? "text-secondary" : s.status === "failed" ? "bg-error-container/40 text-error" : s.status === "warning" ? "bg-warn/15 text-warn" : "text-outline")}>
                      {s.status === "done" || s.status === "warning" ? <Check className="h-3 w-3" strokeWidth={3} /> : s.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : s.status === "failed" ? <X className="h-3 w-3" strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx("block text-body-md", s.status === "pending" || s.status === "skipped" ? "text-on-surface-variant" : s.status === "failed" ? "text-error" : "text-on-surface")}>{i + 1}. {s.label}</span>
                      {s.detail && <span className="block break-words text-body-sm text-on-surface-variant">{s.detail}</span>}
                    </span>
                    <span className="shrink-0 font-mono text-code-sm text-on-surface-variant">{s.status === "skipped" ? "skipped" : dur != null ? formatMs(dur) : ""}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-label-code uppercase tracking-wider text-on-surface-variant"><Brain className="h-4 w-4 text-tertiary" />Reasoning trace (ReAct-style)</span>
              {task.recoveries > 0 && <span className="rounded bg-tertiary-container/20 px-2 py-0.5 font-mono text-label-code text-tertiary">{task.recoveries} recovery</span>}
            </div>
            <div className="rounded-lg bg-surface-container-lowest p-3"><ReasoningTrace task={task} /></div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-label-code uppercase tracking-wider text-on-surface-variant"><Terminal className="h-4 w-4 text-tertiary" />Command (argv)</span>
              {task.command && (
                <button type="button" onClick={() => navigator.clipboard.writeText(task.command!.command).then(() => toast({ tone: "success", title: "Command copied" }), () => {})}
                  className="flex items-center gap-1 font-mono text-code-sm text-on-surface-variant hover:text-on-surface"><Copy className="h-3.5 w-3.5" />Copy</button>
              )}
            </div>
            {task.command ? (
              <>
                <pre className="whitespace-pre-wrap break-all rounded-lg bg-terminal p-3 font-mono text-code-sm text-on-surface"><span className="text-primary">$ </span>{task.command.command}</pre>
                <p className="mt-1.5 flex items-center gap-1.5 font-mono text-label-code text-on-surface-variant"><ShieldCheck className="h-3.5 w-3.5 text-primary" />Executed without a shell · validated arguments · {task.command.timeout_s}s timeout</p>
              </>
            ) : <p className="rounded-lg bg-surface-container-lowest p-3 text-body-sm text-on-surface-variant">{task.finished ? "No CLI process was started for this task." : "Waiting for the command to be prepared…"}</p>}
          </section>

          <section>
            <span className="mb-2 flex items-center gap-1.5 font-mono text-label-code uppercase tracking-wider text-on-surface-variant"><Gauge className="h-4 w-4 text-secondary" />Process</span>
            <div className="grid grid-cols-2 gap-2">
              <Tile label="Process ID" value={p ? String(p.pid) : "–"} />
              <Tile label="Exit code" value={p && !p.running ? String(p.exitCode ?? "killed") : p ? "running" : "–"}
                note={ex?.exit_meaning} tone={p && !p.running ? (p.exitCode === 0 ? "text-primary" : p.exitCode === 1 ? "text-warn" : "text-error") : undefined} />
              <Tile label="Duration" value={p?.durationMs != null ? formatMs(p.durationMs) : "–"} note={p?.timedOut ? "timed out" : p?.cancelled ? "cancelled" : undefined} />
              <Tile label="stdout output" value={p?.stdoutBytes != null ? formatBytes(p.stdoutBytes) : "–"} note="JSON payload" />
              <Tile label="stderr stream" value={`${ex?.stderr_lines ?? stderrLines} lines`} note="progress events" />
              <Tile label="Timeout limit" value={task.command ? `${task.command.timeout_s}s` : "–"} note={task.recoveries ? `${task.recoveries + 1} CLI attempts` : undefined} />
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <div role="tablist" className="flex rounded bg-surface-container p-0.5">
                {(["stdout", "stderr", "system"] as const).map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                    className={cx("rounded px-2.5 py-1 font-mono text-code-sm", tab === k ? "bg-surface-container-high text-on-surface" : "text-on-surface-variant hover:text-on-surface")}>
                    {k} ({rows.filter((r) => r.stream === k).length})
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => downloadText(rows.map((r) => `[${clockTime(r.ts, true)}] [${r.stream}] [${r.tag}] ${r.msg}`).join("\n"), `taskpilot-${task.id.slice(0, 8)}.log`)}
                className="flex items-center gap-1 font-mono text-code-sm text-on-surface-variant hover:text-on-surface"><Download className="h-3.5 w-3.5" />Raw</button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg bg-terminal p-3 font-mono text-code-sm leading-relaxed">
              {stream.length === 0 && <div className="text-on-surface-variant">No {tab} output recorded.</div>}
              {stream.map((r) => (
                <div key={r.order} className={cx("break-all", r.level === "error" ? "text-error" : r.level === "warning" ? "text-warn" : "text-on-surface-variant")}>
                  <span className="text-on-surface-variant/60">[{clockTime(r.ts, true)}]</span> <span className="font-semibold">[{r.tag}]</span> <span className="text-on-surface">{r.msg}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <span className="mb-2 flex items-center gap-1.5 font-mono text-label-code uppercase tracking-wider text-on-surface-variant"><ShieldCheck className="h-4 w-4 text-primary" />Safeguards</span>
            <ul className="space-y-1.5 rounded-lg bg-surface-container-lowest p-3 text-body-md text-on-surface">
              {["URL validated: public hosts only (SSRF guard)", "robots.txt respected by the crawler",
                `Page and depth limits${task.plan ? `: ≤ ${task.plan.max_pages} pages, depth ${task.plan.max_depth}` : ""}`,
                "Approved tool only, run without a shell", "Secrets are never written to logs or chat"].map((t) => (
                <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={3} />{t}</li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="flex items-center justify-between bg-surface-container px-4 py-3">
          <span className="flex items-center gap-1.5 font-mono text-code-sm text-on-surface-variant"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Recorded by the backend · {rows.length} events</span>
          <button type="button" onClick={close} className="rounded-lg bg-surface-container-high px-3 py-1.5 text-body-md text-on-surface hover:bg-surface-bright">Dismiss</button>
        </footer>
      </aside>
    </div>
  );
}

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-surface-container-lowest p-3">
      <span className="font-mono text-label-code text-on-surface-variant">{label}</span>
      <span className={cx("font-mono text-code-lg font-semibold", tone ?? "text-on-surface")}>{value}</span>
      {note && <span className="truncate font-mono text-label-code text-on-surface-variant" title={note}>{note}</span>}
    </div>
  );
}
