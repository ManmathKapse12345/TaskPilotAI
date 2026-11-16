"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Clock, Copy, Globe, ListChecks, Loader2, Maximize2, Square } from "lucide-react";
import { buildLogRows, pageHits, type Level } from "@/lib/logs";
import { displayStages, hostOf, type StageView, type TaskView } from "@/lib/taskState";
import { useWorkspace } from "@/lib/workspace";
import { useNow } from "../execution/useNow";
import { clockTime, cx, formatClock, formatMs } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import { RecoveryNote } from "./ReasoningTrace";

type StepState = "pending" | "running" | "done" | "failed";

function stepOf(stages: StageView[], keys: string[]): { state: StepState; start?: number; end?: number } {
  const ss = stages.filter((s) => keys.includes(s.key));
  const start = ss.find((s) => s.startedAt)?.startedAt;
  const end = [...ss].reverse().find((s) => s.endedAt)?.endedAt;
  if (ss.some((s) => s.status === "failed")) return { state: "failed", start, end };
  if (ss.some((s) => s.status === "running")) return { state: "running", start };
  if (ss.length && ss.every((s) => ["done", "warning", "skipped"].includes(s.status)) && !ss.every((s) => s.status === "skipped")) return { state: "done", start, end };
  if (ss.some((s) => s.status === "done" || s.status === "warning")) return { state: "running", start };
  return { state: "pending" };
}

const TAG_CLS: Record<Level, string> = { info: "text-secondary", debug: "text-outline", page: "text-primary", success: "text-primary", warning: "text-warn", error: "text-error" };

/** Stitch "Running Task": live execution card inside the chat, driven only by streamed task events. */
export function RunCard({ task }: { task: TaskView }) {
  const ws = useWorkspace();
  const toast = useToast();
  const [stopping, setStopping] = useState(false);
  const [logOpen, setLogOpen] = useState(true);
  const [tab, setTab] = useState<"all" | "stdout" | "stderr">("all");
  const now = useNow(true, 250);
  const stages = displayStages(task);
  const pages = pageHits(task).length;
  const plan = task.plan;
  const rows = useMemo(() => buildLogRows(task), [task]);
  const shown = rows.filter((r) => tab === "all" || (tab === "stderr" ? r.stream === "stderr" : r.stream !== "stderr")).slice(-60);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [shown.length]);

  const understand = stepOf(stages, ["intent", "validate"]);
  const start = stepOf(stages, ["prepare", "launch"]);
  const read = stepOf(stages, ["crawl"]);
  const summarise = stepOf(stages, ["process", "respond"]);
  const steps = [
    { label: "Understand", s: understand, sub: understand.state === "done" && understand.start && understand.end ? `Resolved in ${formatMs((understand.end - understand.start) * 1000)}` : understand.state === "running" ? "Reading your request" : "" },
    { label: "Start crawler", s: start, sub: task.process ? `Spun PID ${task.process.pid}` : start.state === "running" ? "Preparing" : "" },
    { label: "Read pages", s: read, sub: read.state !== "pending" ? `${pages}${plan?.max_pages ? ` of ${plan.max_pages}` : ""} pages` : "" },
    { label: "Summarise", s: summarise, sub: summarise.state === "pending" ? "Queued" : summarise.state === "running" ? "Writing summary" : "Done" },
  ];
  const elapsed = task.startedAt ? (now - task.startedAt) * 1000 : null;

  const stop = async () => { setStopping(true); await ws.cancel(task.id); setStopping(false); };

  return (
    <div className="glow-secondary flex flex-col gap-4 rounded-xl bg-surface-container-low p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-secondary/10 px-2.5 py-1 text-body-sm font-semibold text-secondary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />Running
          </span>
          {plan?.url && <span className="flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-1 font-mono text-code-sm text-on-surface"><Globe className="h-3.5 w-3.5 text-secondary" />{hostOf(plan.url)}</span>}
          <span className="flex items-center gap-1.5 font-mono text-code-lg text-on-surface"><Clock className="h-3.5 w-3.5 text-on-surface-variant" />{formatClock(elapsed).slice(0, 5)}</span>
        </div>
        <button type="button" onClick={stop} disabled={stopping}
          className="flex items-center gap-1.5 rounded-lg bg-error-container/30 px-3 py-1.5 text-body-sm font-semibold text-error hover:bg-error-container/50 disabled:opacity-50">
          <Square className="h-3 w-3" fill="currentColor" />{stopping ? "Stopping…" : "Stop Task"}
        </button>
      </div>

      <ol className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Progress">
        {steps.map(({ label, s, sub }) => (
          <li key={label} className="flex flex-col items-center gap-1 text-center">
            <span className={cx("flex h-8 w-8 items-center justify-center rounded-full",
              s.state === "done" ? "bg-primary/15 text-primary" : s.state === "running" ? "bg-secondary/15 text-secondary" : s.state === "failed" ? "bg-error-container/40 text-error" : "bg-surface-container text-outline")}>
              {s.state === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : s.state === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <span className={cx("font-mono text-code-sm font-semibold", s.state === "done" ? "text-primary" : s.state === "running" ? "text-secondary" : "text-on-surface-variant")}>{label}</span>
            <span className="font-mono text-label-code text-on-surface-variant">{sub || " "}</span>
            {label === "Read pages" && s.state === "running" && plan?.max_pages ? (
              <span className="h-1 w-20 overflow-hidden rounded-full bg-surface-container-lowest">
                <span className="block h-full rounded-full bg-secondary transition-all" style={{ width: `${Math.min(100, (pages / plan.max_pages) * 100)}%` }} />
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <RecoveryNote task={task} />

      {plan?.intent === "website_crawl" && (
        <div className="rounded-lg bg-surface-container p-3">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono text-label-code uppercase tracking-wider text-on-surface-variant"><ListChecks className="h-3.5 w-3.5" />Execution plan</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-code-sm text-on-surface">
            <span><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />Intent: website crawl</span>
            <span><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-secondary" />Up to {plan.max_pages} page{plan.max_pages === 1 ? "" : "s"} · depth {plan.max_depth}</span>
            <span><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-tertiary" />Output: {[plan.wants_summary && "summary", plan.wants_json && "JSON"].filter(Boolean).join(" + ")}</span>
            <span className="text-on-surface-variant">parsed by {plan.interpreted_by === "llm" ? "LLM" : "rules"}</span>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-surface-container-lowest">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen} className="flex items-center gap-1 text-body-md font-medium text-on-surface">
              <ChevronDown className={cx("h-4 w-4 transition-transform", !logOpen && "-rotate-90")} />Live CLI Log
            </button>
            {logOpen && (
              <div role="tablist" className="flex rounded bg-surface-container p-0.5">
                {(["all", "stdout", "stderr"] as const).map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                    className={cx("rounded px-2 py-0.5 font-mono text-code-sm capitalize", tab === k ? "bg-surface-container-high text-secondary" : "text-on-surface-variant hover:text-on-surface")}>
                    {k === "all" ? "All" : k}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-on-surface-variant">
            <button type="button" title="Copy log" aria-label="Copy log" className="rounded p-1 hover:bg-surface-container hover:text-on-surface"
              onClick={() => navigator.clipboard.writeText(rows.map((r) => `[${clockTime(r.ts)}] [${r.tag}] ${r.msg}`).join("\n")).then(() => toast({ tone: "success", title: "Log copied" }), () => {})}>
              <Copy className="h-4 w-4" />
            </button>
            <button type="button" title="Open run details" aria-label="Open run details" onClick={() => ws.setDetailsId(task.id)} className="rounded p-1 hover:bg-surface-container hover:text-on-surface">
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {logOpen && (
          <>
            <div ref={logRef} role="log" aria-live="polite" className="max-h-64 overflow-y-auto bg-terminal px-3 py-2 font-mono text-code-sm leading-relaxed">
              {shown.length === 0 && <div className="text-on-surface-variant">Waiting for the CLI to start…</div>}
              {shown.map((r) => (
                <div key={r.order} className="break-all text-on-surface-variant">
                  <span className="text-on-surface-variant/60">[{clockTime(r.ts)}]</span>{" "}
                  {r.msg.startsWith("$ ") ? <span className="text-on-surface">{r.msg}</span> : <><span className={cx("font-semibold", TAG_CLS[r.level])}>[{r.tag}]</span> <span className="text-on-surface">{r.msg}</span></>}
                </div>
              ))}
              <div className="flex items-center gap-1 pt-0.5 text-secondary">
                <span>➜</span><span>{task.process?.running ? "streaming CLI events" : "working"}…</span>
                <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-secondary" />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 font-mono text-label-code text-on-surface-variant">
              <span>CLI PID: <span className="text-on-surface">{task.process?.pid ?? "–"}</span></span>
              <span>Tool: <span className="text-on-surface">{task.command?.tool ?? "–"}</span></span>
              <span>Timeout: <span className="text-on-surface">{task.command ? `${task.command.timeout_s}s` : "–"}</span></span>
              <span className="ml-auto">{rows.length} log lines</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
