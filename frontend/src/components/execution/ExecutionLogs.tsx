"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Maximize2, Minimize2 } from "lucide-react";
import type { TaskView } from "@/lib/taskState";
import { IconButton, clockTime, cx, formatBytes, formatMs } from "../ui/primitives";
import { useToast } from "../ui/Toast";

type Stream = "system" | "stderr" | "stdout";
type Level = "info" | "warning" | "error" | "success" | "page" | "debug";
interface Row { ts: number; stream: Stream; level: Level; msg: string; order: number }

/** Merges the real execution events into one ordered log: system (process lifecycle), stderr (CLI progress), stdout (result). */
export function buildLogRows(t: TaskView): Row[] {
  const rows: Row[] = [];
  let order = 0;
  if (t.command) rows.push({ ts: t.command.ts, stream: "system", level: "info", msg: `$ ${t.command.command}`, order: order++ });
  if (t.process) rows.push({ ts: t.process.startedTs, stream: "system", level: "info", msg: `process started · pid ${t.process.pid}`, order: order++ });
  for (const l of t.logs) {
    const level: Level = l.kind === "page" ? "page" : (["warning", "error", "debug"].includes(l.level) ? l.level : "info") as Level;
    rows.push({ ts: l.ts, stream: l.stream === "stdout" ? "stdout" : "stderr", level, msg: l.msg, order: order++ });
  }
  const p = t.process;
  if (p && !p.running && p.exitedTs) {
    const code = p.exitCode;
    const msg = p.cancelled ? `process killed (cancelled by user) after ${formatMs(p.durationMs)}`
      : p.timedOut ? `process killed (timeout) after ${formatMs(p.durationMs)}`
      : `process exited with code ${code} in ${formatMs(p.durationMs)}`;
    rows.push({ ts: p.exitedTs, stream: "system", level: code === 0 ? "success" : code === 1 ? "warning" : "error", msg, order: order++ });
    if (p.stdoutBytes) rows.push({ ts: p.exitedTs, stream: "stdout", level: "info", msg: `${formatBytes(p.stdoutBytes)} JSON document captured (shown in JSON Output)`, order: order++ });
  }
  return rows.sort((a, b) => a.ts - b.ts || a.order - b.order);
}

const LEVEL: Record<Level, { tag: string; cls: string }> = {
  info: { tag: "INFO", cls: "text-muted" },
  debug: { tag: "DEBUG", cls: "text-subtle" },
  page: { tag: "PAGE", cls: "text-ok" },
  success: { tag: "OK", cls: "text-ok" },
  warning: { tag: "WARN", cls: "text-warn" },
  error: { tag: "ERROR", cls: "text-bad" },
};
const STREAM_CLS: Record<Stream, string> = { system: "text-accent/80", stderr: "text-subtle", stdout: "text-[#7dd3c0]" };

type Filter = "all" | "stderr" | "stdout" | "problems";

export function ExecutionLogs({ task, compact, live }: { task: TaskView; compact?: boolean; live?: boolean }) {
  const toast = useToast();
  const rows = useMemo(() => buildLogRows(task), [task]);
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const follow = useRef(true);

  const shown = rows.filter((r) =>
    filter === "all" ? true
      : filter === "stderr" ? r.stream === "stderr"
      : filter === "stdout" ? r.stream !== "stderr"
      : r.level === "warning" || r.level === "error");
  const problems = rows.filter((r) => r.level === "warning" || r.level === "error").length;

  useEffect(() => {
    const el = ref.current;
    if (el && follow.current) el.scrollTop = el.scrollHeight;
  }, [shown.length]);

  const copy = () => {
    const text = rows.map((r) => `${clockTime(r.ts)} [${r.stream}] ${LEVEL[r.level].tag} ${r.msg}`).join("\n");
    navigator.clipboard.writeText(text).then(
      () => toast({ tone: "success", title: "Logs copied", body: `${rows.length} lines` }),
      () => toast({ tone: "error", title: "Clipboard unavailable" }));
  };

  const filters: [Filter, string][] = [["all", `All ${rows.length}`], ["stderr", "stderr"], ["stdout", "stdout · system"], ["problems", `Problems ${problems}`]];

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#09090c]">
      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {filters.map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={cx("whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                filter === k ? "bg-raised text-fg" : "text-subtle hover:text-muted",
                k === "problems" && problems > 0 && filter !== k && "text-warn/80")}>
              {label}
            </button>
          ))}
        </div>
        {live && <span className="mr-1 flex items-center gap-1.5 text-[11px] text-accent"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />live</span>}
        <IconButton label="Copy logs" onClick={copy} disabled={!rows.length} className="h-7 w-7"><Copy className="h-3.5 w-3.5" /></IconButton>
        <IconButton label={expanded ? "Collapse logs" : "Expand logs"} onClick={() => setExpanded((e) => !e)} className="h-7 w-7">
          {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </IconButton>
      </div>
      <div ref={ref}
        onScroll={(e) => { const el = e.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24; }}
        className={cx("overflow-auto py-2 font-mono text-[11.5px] leading-[1.7]",
          expanded ? "max-h-[70vh]" : compact ? "max-h-56" : "max-h-96")}>
        {shown.length === 0 && (
          <div className="px-3 text-subtle">{rows.length === 0 ? (live ? "waiting for CLI output…" : "No CLI output was produced for this task.") : "No lines match this filter."}</div>
        )}
        {shown.map((r, i) => (
          <div key={i} className={cx("flex gap-3 px-3 hover:bg-white/[0.02]", r.level === "error" && "bg-bad/[0.04]")}>
            <span className="shrink-0 tabular-nums text-subtle/70">{clockTime(r.ts)}</span>
            <span className={cx("w-12 shrink-0", STREAM_CLS[r.stream])}>{r.stream}</span>
            <span className={cx("w-11 shrink-0 font-semibold", LEVEL[r.level].cls)}>{LEVEL[r.level].tag}</span>
            <span className={cx("min-w-0 whitespace-pre-wrap break-all", r.stream === "system" && r.msg.startsWith("$") ? "text-fg" : LEVEL[r.level].cls === "text-muted" ? "text-[#c9c9d3]" : LEVEL[r.level].cls)}>
              {r.msg}
            </span>
          </div>
        ))}
        {live && <div className="px-3 text-accent"><span className="animate-blink">▍</span></div>}
      </div>
    </div>
  );
}
