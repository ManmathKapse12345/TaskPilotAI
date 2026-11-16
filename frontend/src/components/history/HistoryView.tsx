"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertCircle, Bookmark, BookmarkCheck, Calendar, CheckCircle2, Copy, Download, Inbox, Plus, RotateCw, Search } from "lucide-react";
import type { TaskSummaryRow } from "@/lib/api";
import { downloadText } from "@/lib/logs";
import { hostOf } from "@/lib/taskState";
import { useWorkspace } from "@/lib/workspace";
import { EmptyState, ErrorState, STATUS_META, cx, formatMs, shortId, timeAgo } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import { MetricCards } from "./MetricCards";
import { TaskInspector } from "./TaskInspector";

type Filter = "all" | "running" | "completed" | "failed";
type Range = "all" | "1" | "7" | "30";
const PAGE = 8;

const GROUP: Record<Filter, (t: TaskSummaryRow) => boolean> = {
  all: () => true,
  running: (t) => t.status === "running" || t.status === "queued",
  completed: (t) => t.status === "completed" || t.status === "partial" || t.status === "answered",
  failed: (t) => t.status === "failed" || t.status === "cancelled",
};

function StatusPill({ status }: { status: TaskSummaryRow["status"] }) {
  const m = STATUS_META[status] ?? STATUS_META.queued;
  const Icon = status === "completed" ? CheckCircle2 : status === "failed" ? AlertCircle : null;
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-label-code font-semibold uppercase tracking-wide", m.bg, m.text)}>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className={cx("h-1.5 w-1.5 rounded-full", m.dot)} />}
      {m.label}
    </span>
  );
}

/** Screen 4 — Task Runs & History (Stitch: "Synapse - Task Runs & History"). Re-mounts when the header search changes `?q=`. */
export function HistoryView() {
  const q = useSearchParams().get("q") ?? "";
  return <History key={q} initialQuery={q} />;
}

function History({ initialQuery }: { initialQuery: string }) {
  const ws = useWorkspace();
  const toast = useToast();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [range, setRange] = useState<Range>("all");
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  const inRange = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity -- cutoff is recomputed whenever the range or history changes
    const cutoff = range === "all" ? 0 : Date.now() - Number(range) * 86_400_000;
    return ws.history.filter((t) => new Date(t.created_at).getTime() >= cutoff);
  }, [ws.history, range]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inRange.filter(GROUP[filter]).filter((t) => !q
      || t.prompt.toLowerCase().includes(q) || (t.url ?? "").toLowerCase().includes(q)
      || t.id.toLowerCase().includes(q.replace(/^tp-/, "")) || shortId(t.id).includes(q)
      || (t.exit_code != null && `exit ${t.exit_code}`.includes(q)) || t.status.includes(q));
  }, [inRange, filter, query]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const shown = rows.slice(cur * PAGE, cur * PAGE + PAGE);
  const counts = { all: inRange.length, running: inRange.filter(GROUP.running).length, completed: inRange.filter(GROUP.completed).length, failed: inRange.filter(GROUP.failed).length };

  const selected = closed ? null
    : rows.find((t) => t.id === selectedId) ?? rows.find((t) => GROUP.failed(t)) ?? rows[0] ?? null;

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["id", "created_at", "status", "intent", "url", "duration_ms", "exit_code", "prompt"];
    downloadText([head.join(","), ...rows.map((t) => head.map((k) => esc(t[k as keyof TaskSummaryRow])).join(","))].join("\n"), "taskpilot-history.csv", "text/csv");
    toast({ tone: "success", title: "Export started", body: `${rows.length} task${rows.length === 1 ? "" : "s"}` });
  };

  const retry = async (t: TaskSummaryRow) => {
    try { const id = await ws.submit(t.prompt); router.push(`/live?id=${id}`); }
    catch (e) { toast({ tone: "error", title: (e as Error & { title?: string }).title ?? "Could not retry", body: (e as Error).message }); }
  };

  const select = (id: string) => { setSelectedId(id); setClosed(false); };

  return (
    <div className="flex w-full flex-col">
      <div className="mb-6"><MetricCards rows={ws.history} /></div>

      <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div role="tablist" className="flex items-center overflow-x-auto rounded-xl bg-surface-container-lowest p-1 no-scrollbar">
          {([["all", "All Tasks"], ["running", "Running"], ["completed", "Completed"], ["failed", "Failed"]] as [Filter, string][]).map(([k, label]) => {
            const active = filter === k;
            return (
              <button key={k} type="button" role="tab" aria-selected={active} onClick={() => { setFilter(k); setPage(0); }}
                className={cx("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1 text-label-md font-medium transition-all",
                  active ? "glow-nav bg-surface-container-high text-primary" : "text-on-surface-variant hover:text-on-surface")}>
                {k === "running" && counts.running > 0 && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />}
                {label}
                <span className={cx("font-mono text-label-code", k === "failed" && counts.failed ? "rounded-full bg-error/10 px-1 text-error" : active ? "text-primary/80" : "text-on-surface-variant")}>{counts[k]}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex w-full items-center gap-1 rounded-lg bg-surface-container-low px-2 py-2 text-on-surface-variant focus-within:ring-1 focus-within:ring-primary/40 sm:w-80">
            <Search className="h-4 w-4" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Filter by URL, ID, prompt or exit code…" aria-label="Filter tasks"
              className="w-full border-0 bg-transparent text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant" />
          </label>
          <label className="flex items-center gap-1 rounded-lg bg-surface-container-low px-3 py-2 text-label-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface">
            <Calendar className="h-4 w-4" />
            <select value={range} onChange={(e) => { setRange(e.target.value as Range); setPage(0); }} aria-label="Date range"
              className="cursor-pointer border-0 bg-transparent text-label-md text-on-surface outline-none">
              <option value="all">All time</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option>
            </select>
          </label>
          <button type="button" onClick={exportCsv} disabled={!rows.length}
            className="flex items-center gap-1 rounded-lg bg-surface-container-low px-3 py-2 text-label-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-40">
            <Download className="h-4 w-4" />Export CSV
          </button>
          <Link href="/" className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-label-md font-semibold text-on-primary shadow-[0_0_14px_-3px_rgba(16,185,129,0.35)] transition-all hover:bg-primary/90 active:scale-[0.99]">
            <Plus className="h-4 w-4" />New Task Run
          </Link>
        </div>
      </div>

      {ws.historyError && <ErrorState className="mb-4" title="Could not load task history" onRetry={ws.refreshHistory}>{ws.historyError}</ErrorState>}

      <div className="flex w-full flex-col items-start gap-4 2xl:flex-row">
        <div className="w-full flex-1 overflow-hidden rounded-xl bg-surface-container-low shadow-sm">
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="select-none bg-surface-container-lowest font-mono text-label-code uppercase tracking-wider text-on-surface-variant">
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Task ID</th>
                  <th className="px-4 py-3 font-semibold">Target</th>
                  <th className="px-4 py-3 font-semibold">Directive</th>
                  <th className="px-4 py-3 font-semibold">Exit / Intent</th>
                  <th className="px-4 py-3 font-semibold">Runtime</th>
                  <th className="px-4 py-3 font-semibold">Started</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="text-body-sm text-on-surface">
                {!ws.historyLoaded && Array.from({ length: 4 }, (_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-6 animate-pulse rounded bg-surface-container" /></td></tr>
                ))}
                {ws.historyLoaded && shown.length === 0 && (
                  <tr><td colSpan={8} className="p-4">
                    <EmptyState className="bg-transparent py-8" icon={<Inbox className="h-5 w-5" />} title={ws.history.length ? "No tasks match these filters" : "No tasks yet"}>
                      {ws.history.length ? "Clear the search or pick another status or date range." : "Dispatch a task from the Agent Workspace; every run is stored with its full execution log."}
                    </EmptyState>
                  </td></tr>
                )}
                {shown.map((t, i) => {
                  const isSel = selected?.id === t.id;
                  const failed = GROUP.failed(t);
                  const live = GROUP.running(t);
                  const host = t.url ? hostOf(t.url) : null;
                  const [domain, ...path] = (host ?? "").split("/");
                  const isSaved = ws.saved.includes(t.id);
                  return (
                    <tr key={t.id} onClick={() => select(t.id)} aria-selected={isSel}
                      className={cx("group cursor-pointer transition-colors",
                        isSel ? cx("bg-surface-container-high/70 hover:bg-surface-container-high", failed ? "shadow-[inset_3px_0_0_0_#ffb4ab]" : "shadow-[inset_3px_0_0_0_#4edea3]")
                          : cx("hover:bg-surface-container/60", i % 2 ? "bg-surface-container" : "bg-surface-container-low"))}>
                      <td className="whitespace-nowrap px-4 py-3"><StatusPill status={t.status} /></td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className={cx("font-mono text-code-sm font-medium", isSel && failed ? "font-semibold text-error" : live ? "text-primary" : "text-on-surface")}>{shortId(t.id)}</span>
                          <button type="button" title="Copy task ID" aria-label="Copy task ID"
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(t.id).then(() => toast({ tone: "success", title: "Task ID copied" }), () => {}); }}
                            className="rounded p-0.5 text-on-surface-variant opacity-0 transition-opacity hover:text-on-surface group-hover:opacity-100 focus:opacity-100">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded", failed ? "bg-error-container/40" : "bg-surface-container-highest")}>
                            <span className={cx("font-mono text-label-code font-bold uppercase", failed ? "text-error" : "text-on-surface-variant")}>{(domain || "?").replace(/^www\./, "")[0]}</span>
                          </div>
                          <div className="flex min-w-0 max-w-[200px] flex-col">
                            <span className="truncate font-mono text-code-sm font-medium text-on-surface">{domain || "(no URL)"}</span>
                            <span className={cx("truncate font-mono text-code-sm", failed && t.exit_code != null ? "text-error" : "text-on-surface-variant")}>
                              {failed && t.exit_code != null ? `Exit ${t.exit_code}` : path.length ? `/${path.join("/")}` : "/"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-on-surface-variant group-hover:text-on-surface" title={t.prompt}>{t.prompt}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-code-sm">
                        {t.exit_code != null
                          ? <span className={t.exit_code === 0 ? "text-primary" : t.exit_code === 1 ? "text-warn" : "text-error"}>exit {t.exit_code}</span>
                          : <span className="text-on-surface-variant">–</span>}
                        <span className="ml-1 text-on-surface-variant">• {t.intent ?? "pending"}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-code-sm text-on-surface">{live ? <span className="text-secondary">running</span> : formatMs(t.duration_ms)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-code-sm text-on-surface-variant" title={new Date(t.created_at).toLocaleString()}>{timeAgo(t.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {live ? (
                            <Link href={`/live?id=${t.id}`} className="rounded bg-secondary/10 px-2 py-1 font-mono text-label-code font-medium text-secondary transition-colors hover:bg-secondary/20">Live CLI</Link>
                          ) : failed ? (
                            <button type="button" onClick={() => retry(t)} disabled={ws.submitting || ws.healthError}
                              className="flex items-center gap-1 rounded bg-error/10 px-2 py-1 font-mono text-label-code font-semibold text-error transition-colors hover:bg-error/20 disabled:opacity-40">
                              <RotateCw className="h-3.5 w-3.5" />Retry
                            </button>
                          ) : t.status === "answered" ? (
                            <Link href={`/live?id=${t.id}`} className="rounded bg-surface-container-high px-2 py-1 font-mono text-label-code text-on-surface transition-colors hover:bg-surface-bright">View answer</Link>
                          ) : (
                            <Link href={`/results?id=${t.id}`} className="rounded bg-surface-container-high px-2 py-1 font-mono text-label-code text-on-surface transition-colors hover:bg-surface-bright">View JSON</Link>
                          )}
                          <button type="button" onClick={() => ws.toggleSave(t.id)} title={isSaved ? "Remove from saved" : "Save result"} aria-label={isSaved ? "Remove from saved" : "Save result"}
                            className={cx("rounded p-1 transition-colors hover:bg-surface-container", isSaved ? "text-primary" : "text-on-surface-variant hover:text-on-surface")}>
                            {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-container-lowest px-3 py-3 font-mono text-code-sm text-on-surface-variant">
            <div className="flex items-center gap-1">
              <span>{rows.length ? `Showing ${cur * PAGE + 1} to ${Math.min(rows.length, (cur + 1) * PAGE)} of ${rows.length} tasks` : "0 tasks"}</span>
              {ws.saved.length > 0 && <><span className="text-surface-container-high">•</span><span className="text-primary">{ws.saved.length} saved</span></>}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage(cur - 1)} disabled={cur === 0}
                className="rounded bg-surface-container px-2 py-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40">Prev</button>
              {Array.from({ length: pages }, (_, i) => i).filter((i) => Math.abs(i - cur) <= 2 || i === 0 || i === pages - 1).map((i) => (
                <button key={i} type="button" onClick={() => setPage(i)} aria-current={i === cur ? "page" : undefined}
                  className={cx("rounded px-2.5 py-1", i === cur ? "bg-primary-container font-medium text-on-primary-container" : "bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface")}>{i + 1}</button>
              ))}
              <button type="button" onClick={() => setPage(cur + 1)} disabled={cur >= pages - 1}
                className="rounded bg-surface-container px-2 py-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>

        {selected && <TaskInspector row={selected} onClose={() => setClosed(true)} />}
      </div>
    </div>
  );
}
