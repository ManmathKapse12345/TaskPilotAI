"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Eraser, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { buildLogRows, downloadText, logsAsText, type Level, type LogRow } from "@/lib/logs";
import type { TaskView } from "@/lib/taskState";
import { useWorkspace } from "@/lib/workspace";
import { clockTime, cx } from "../ui/primitives";
import { useToast } from "../ui/Toast";

type Tab = "all" | "stderr" | "system" | "problems";

const TAG_CLS: Record<Level, string> = {
  info: "text-secondary",
  debug: "text-outline",
  page: "text-primary",
  success: "text-primary",
  warning: "text-warn",
  error: "text-error",
};

function matches(r: LogRow, tab: Tab) {
  if (tab === "stderr") return r.stream === "stderr";
  if (tab === "system") return r.stream !== "stderr";
  if (tab === "problems") return r.level === "warning" || r.level === "error";
  return true;
}

/** Live monospace terminal fed by the task's SSE log events (Stitch "Live Monospace CLI Terminal"). */
export function TerminalPanel({ task, className }: { task: TaskView; className?: string }) {
  const toast = useToast();
  const { prefs } = useWorkspace();
  const rows = useMemo(() => buildLogRows(task), [task]);
  const [tab, setTab] = useState<Tab>("all");
  const [grep, setGrep] = useState("");
  const [regex, setRegex] = useState(false);
  const [clearedAt, setClearedAt] = useState(0);
  const [full, setFull] = useState(false);
  const screen = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const live = !task.finished;

  const { shown, badPattern } = useMemo(() => {
    let test: (s: string) => boolean = () => true;
    let bad = false;
    const q = grep.trim();
    if (q) {
      if (regex) {
        try { const re = new RegExp(q, "i"); test = (s) => re.test(s); } catch { bad = true; }
      } else {
        const low = q.toLowerCase();
        test = (s) => s.toLowerCase().includes(low);
      }
    }
    return { shown: rows.slice(clearedAt).filter((r) => matches(r, tab) && test(`${r.tag} ${r.msg}`)), badPattern: bad };
  }, [rows, tab, grep, regex, clearedAt]);

  const problems = rows.filter((r) => r.level === "warning" || r.level === "error").length;

  useEffect(() => {
    const el = screen.current;
    if (el && follow.current && prefs.autoScroll) el.scrollTop = el.scrollHeight;
  }, [shown.length, prefs.autoScroll]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  const text = () => logsAsText(rows, (ts) => clockTime(ts, true));
  const copy = () => navigator.clipboard.writeText(text()).then(
    () => toast({ tone: "success", title: "Log copied", body: `${rows.length} lines` }),
    () => toast({ tone: "error", title: "Clipboard unavailable" }));

  const tabs: [Tab, string, number?][] = [
    ["all", "taskpilot-stream.log", rows.length],
    ["stderr", "cli-stderr.log"],
    ["system", "process.log"],
    ["problems", "problems", problems],
  ];

  const p = task.process;
  const promptTail = live
    ? p?.running ? "streaming CLI events…" : task.command ? "launching process…" : "interpreting request…"
    : p ? `process exited${p.exitCode != null ? ` with code ${p.exitCode}` : ""}` : `task ${task.status}`;

  return (
    <section className={cx("flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-3 shadow-2xl",
      full && "fixed inset-2 z-50 sm:inset-6", className)} aria-label="CLI output">
      {full && <div className="fixed inset-0 -z-10 bg-black/70" onClick={() => setFull(false)} />}

      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div role="tablist" className="flex items-center gap-1 overflow-x-auto rounded bg-surface-container-low p-1 no-scrollbar">
          {tabs.map(([k, label, count]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cx("flex shrink-0 items-center gap-1.5 rounded px-3 py-1 font-mono text-code-sm transition-colors",
                tab === k ? "bg-surface-container-high font-semibold text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface",
                k === "problems" && problems > 0 && tab !== k && "text-warn")}>
              {k === "all" && live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
              <span>{label}</span>
              {count != null && <span className="text-[10px] text-on-surface-variant">{count}</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-on-surface-variant">
          <TermBtn label="Copy log" onClick={copy} disabled={!rows.length}><Copy className="h-4 w-4" /></TermBtn>
          <TermBtn label="Download log" onClick={() => downloadText(text(), `taskpilot-${task.id.slice(0, 8)}.log`)} disabled={!rows.length}><Download className="h-4 w-4" /></TermBtn>
          {clearedAt > 0
            ? <TermBtn label="Show cleared lines" onClick={() => setClearedAt(0)} className="text-secondary"><RefreshCw className="h-4 w-4" /></TermBtn>
            : <TermBtn label="Clear view (does not delete logs)" onClick={() => setClearedAt(rows.length)} disabled={!rows.length}><Eraser className="h-4 w-4" /></TermBtn>}
          <TermBtn label={full ? "Exit fullscreen" : "Fullscreen"} onClick={() => setFull((f) => !f)}>
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </TermBtn>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded bg-surface-container-low px-2 py-1.5">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="font-mono text-code-sm font-bold text-primary">grep</span>
          <input value={grep} onChange={(e) => setGrep(e.target.value)} aria-label="Filter output"
            placeholder="Filter output (e.g. page, warn, robots)…"
            className={cx("w-full bg-transparent font-mono text-code-sm outline-none placeholder:text-on-surface-variant/60", badPattern ? "text-error" : "text-on-surface")} />
        </label>
        <div className="flex shrink-0 items-center gap-2 font-mono text-label-code text-on-surface-variant">
          <button type="button" onClick={() => setRegex((r) => !r)} aria-pressed={regex}
            className={cx("rounded px-1.5 py-0.5", regex ? "bg-surface-container text-secondary" : "bg-surface-container text-on-surface-variant")}>
            regex: {regex ? "ON" : "OFF"}
          </button>
          <span>{shown.length} line{shown.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div ref={screen} role="log" aria-live="polite"
        onScroll={(e) => { const el = e.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24; }}
        className={cx("flex w-full select-text flex-col gap-1 overflow-y-auto rounded bg-terminal p-2 font-mono text-code-sm leading-relaxed shadow-inner",
          full ? "min-h-0 flex-1" : "h-[420px] lg:h-[520px]")}>
        {shown.length === 0 && (
          <div className="text-on-surface-variant">
            {rows.length === 0 ? (live ? "Waiting for CLI output…" : "No CLI output was produced for this task.") : clearedAt ? "View cleared. New lines will appear here." : "No lines match this filter."}
          </div>
        )}
        {shown.map((r, i) => (
          <div key={`${r.order}-${i}`} className={cx("break-all text-on-surface-variant", r.level === "error" && "rounded bg-error/10 px-1")}>
            [{clockTime(r.ts, true)}] <span className={cx("font-semibold", TAG_CLS[r.level])}>[{r.tag}]</span>{" "}
            <span className={r.msg.startsWith("$ ") ? "text-on-surface" : r.level === "error" ? "text-error" : undefined}>{r.msg}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 pt-1 text-primary">
          <span className="font-bold">&gt;</span>
          <span className="font-medium text-on-surface">taskpilot@{task.command?.tool ?? "agent"}:~$</span>
          <span className={live ? "text-secondary" : "text-on-surface-variant"}>{promptTail}</span>
          {live && <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-primary" />}
        </div>
      </div>

      {task.command && (
        <div className="flex items-center gap-1 rounded bg-surface-container-low p-1">
          <span className="pl-2 font-mono text-code-sm font-bold text-primary">$</span>
          <code className="min-w-0 flex-1 truncate px-1 font-mono text-code-sm text-on-surface" title={task.command.command}>{task.command.command}</code>
          <button type="button"
            onClick={() => navigator.clipboard.writeText(task.command!.command).then(() => toast({ tone: "success", title: "Command copied" }), () => toast({ tone: "error", title: "Clipboard unavailable" }))}
            className="shrink-0 rounded bg-primary px-3 py-1 text-label-md font-semibold text-on-primary transition-all hover:bg-primary-container active:scale-95">
            Copy
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 font-mono text-label-code text-on-surface-variant">
        <div className="flex items-center gap-3">
          <span>argv exec · shell disabled</span>
          {full && <span><kbd className="rounded bg-surface-container px-1 py-0.5 text-on-surface">Esc</kbd> Exit fullscreen</span>}
        </div>
        <div className={cx("flex items-center gap-1", live ? "text-primary" : "text-on-surface-variant")}>
          <RefreshCw className={cx("h-3 w-3", live && "animate-spin [animation-duration:3s]")} />
          <span>{live ? "Live SSE stream" : `Stream closed · task ${task.status}`}</span>
        </div>
      </div>
    </section>
  );
}

function TermBtn({ label, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" title={label} aria-label={label}
      className={cx("rounded p-1.5 transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-40", className)} {...rest}>
      {children}
    </button>
  );
}
