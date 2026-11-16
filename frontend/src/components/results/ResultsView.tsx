"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, Copy, Download, FileSpreadsheet, Link2, RotateCw, SquareTerminal, Timer } from "lucide-react";
import type { ExtractedData } from "@/lib/api";
import { downloadText } from "@/lib/logs";
import type { TaskView } from "@/lib/taskState";
import { useWorkspace } from "@/lib/workspace";
import { TaskGate } from "../layout/TaskGate";
import { Markdown } from "../ui/Markdown";
import { ErrorState, LoadingState, cx, formatMs, shortId } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import { ExtractedDataView } from "./ExtractedDataView";
import { JsonViewer } from "./JsonViewer";
import { PagesTable, SummaryCard, TargetCard } from "./ResultCards";

/** Screen 3 — Results & Schema (Stitch: "Synapse - Results & JSON Schema"). */
export function ResultsView() {
  return (
    <TaskGate emptyTitle="No results yet" emptyText="Results from completed tasks appear here: summary, extracted pages and the structured JSON produced by the CLI.">
      {(task) => <Results task={task} />}
    </TaskGate>
  );
}

function itemCount(d: ExtractedData) {
  return d.pages.length + d.contact.emails.length + d.contact.phones.length + d.contact.social_profiles.length
    + d.navigation_links.length + d.external_links.length + d.images.length;
}

function toCsv(d: ExtractedData) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["url", "title", "status_code", "depth", "word_count", "headings", "description"];
  return [head.join(","), ...d.pages.map((p) => [p.url, p.title, p.status_code, p.depth, p.word_count, p.headings.length, p.description].map(esc).join(","))].join("\n");
}

function Results({ task }: { task: TaskView }) {
  const ws = useWorkspace();
  const toast = useToast();
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const r = task.result;
  const d = r?.data;
  const doc = r?.json_output ?? d ?? null;
  const docName = r?.json_output ? "json_output" : "data";
  const text = useMemo(() => (doc ? JSON.stringify(doc, null, 2) : ""), [doc]);

  if (!task.finished) {
    return (
      <div className="flex flex-col gap-3">
        <LoadingState label={`Task ${shortId(task.id)} is still running — results appear when the CLI finishes.`} />
        <Link href={`/live?id=${task.id}`} className="self-center font-mono text-code-sm text-secondary hover:underline">Follow it in Live CLI Execution →</Link>
      </div>
    );
  }
  if (r?.status === "answered") {
    return (
      <section className="rounded-xl bg-surface-container-low p-4">
        <div className="mb-2 font-mono text-label-code uppercase tracking-wider text-on-surface-variant">Direct answer · no CLI execution needed</div>
        <div className="text-body-md text-on-surface"><Markdown text={r.message ?? ""} /></div>
      </section>
    );
  }
  if (!doc) {
    return (
      <ErrorState title={r?.status === "cancelled" ? "Task was cancelled before producing data" : "This task produced no extracted data"}>
        {r?.error ?? r?.message ?? "No result was recorded."}{" "}
        <Link href={`/live?id=${task.id}`} className="text-secondary hover:underline">Open the execution log</Link>
      </ErrorState>
    );
  }

  const ex = r!.execution;
  const url = d ? d.website.final_url || d.website.url : task.plan?.url;
  const saved = ws.saved.includes(task.id);
  const nodeValue = selected != null && d ? d.pages[selected] : doc;
  const nodePath = selected != null && d ? `data.pages[${selected}]` : docName;
  const fname = `taskpilot-${task.id.slice(0, 8)}`;

  const copy = () => navigator.clipboard.writeText(text).then(() => toast({ tone: "success", title: "JSON copied" }), () => toast({ tone: "error", title: "Clipboard unavailable" }));
  const rerun = async () => {
    try { const id = await ws.submit(task.prompt); router.push(`/live?id=${id}`); }
    catch (e) { toast({ tone: "error", title: (e as Error & { title?: string }).title ?? "Could not rerun", body: (e as Error).message }); }
  };

  const status = r!.status;
  const badge = status === "completed" ? ["bg-primary/10 text-primary", "bg-primary", "Verified CLI output"]
    : status === "partial" ? ["bg-warn/10 text-warn", "bg-warn", "Partial result"] : ["bg-error-container/30 text-error", "bg-error", status];

  return (
    <div className="flex w-full flex-col gap-4">
      <section className="flex flex-col justify-between gap-3 rounded-xl bg-surface-container-low p-4 shadow-sm xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-headline-sm font-semibold tracking-tight text-on-surface">Extraction Results & Structured Data</h1>
            <span className={cx("flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-label-code uppercase tracking-wider", badge[0])}>
              <span className={cx("h-1.5 w-1.5 rounded-full", badge[1])} />{badge[2]}
            </span>
            <Link href={`/live?id=${task.id}`} className="rounded-full bg-surface-container-high px-2 py-0.5 font-mono text-code-sm text-on-surface-variant hover:text-on-surface">Task: {shortId(task.id)}</Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-code-sm text-on-surface-variant">
            {url && <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="flex min-w-0 items-center gap-1 text-on-surface hover:text-primary"><Link2 className="h-3.5 w-3.5 shrink-0 text-secondary" /><span className="truncate">{url.replace(/^https?:\/\//, "")}</span></a>}
            {ex && <><span className="text-surface-bright">•</span><span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5 text-primary" />Completed in <strong className="font-medium text-on-surface">{formatMs(ex.duration_ms)}</strong></span></>}
            {d && <><span className="text-surface-bright">•</span><span><strong className="font-medium text-on-surface">{d.crawl_stats.pages_crawled}</strong> Pages Crawled</span></>}
            {d && <><span className="text-surface-bright">•</span><span><strong className="font-medium text-secondary">{itemCount(d).toLocaleString()}</strong> Items Extracted</span></>}
            {ex?.exit_code != null && <><span className="text-surface-bright">•</span><span>exit <strong className={ex.exit_code === 0 ? "text-primary" : "text-warn"}>{ex.exit_code}</strong></span></>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <HeadBtn onClick={copy} icon={<Copy className="h-4 w-4 text-primary" />}>Copy JSON</HeadBtn>
          <HeadBtn onClick={() => { downloadText(text, `${fname}.json`, "application/json"); toast({ tone: "success", title: "Download started", body: `${fname}.json` }); }} icon={<Download className="h-4 w-4 text-secondary" />}>Download .json</HeadBtn>
          {d && d.pages.length > 0 && <HeadBtn onClick={() => downloadText(toCsv(d), `${fname}-pages.csv`, "text/csv")} icon={<FileSpreadsheet className="h-4 w-4 text-on-surface-variant" />}>Export CSV</HeadBtn>}
          <HeadBtn onClick={() => router.push(`/live?id=${task.id}`)} icon={<SquareTerminal className="h-4 w-4 text-tertiary" />}>CLI Log</HeadBtn>
          <HeadBtn onClick={() => ws.toggleSave(task.id)} icon={saved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4 text-on-surface-variant" />}>{saved ? "Saved" : "Save"}</HeadBtn>
          <button type="button" onClick={rerun} disabled={ws.submitting || ws.healthError}
            className="flex items-center gap-1.5 rounded-lg bg-primary-container px-3.5 py-1.5 text-label-md font-medium text-on-primary-container shadow-sm transition-all hover:bg-primary active:scale-[0.99] disabled:opacity-40">
            <RotateCw className="h-4 w-4" />Rerun Task
          </button>
        </div>
      </section>

      {status === "partial" && d && d.crawl_stats.errors.length > 0 && (
        <ErrorState title={`${d.crawl_stats.errors.length} page${d.crawl_stats.errors.length === 1 ? "" : "s"} could not be crawled`}>
          {d.crawl_stats.errors.slice(0, 3).map((e) => `${e.url} — ${e.error}`).join(" · ")}
        </ErrorState>
      )}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-5">
          {d && <TargetCard data={d} />}
          <SummaryCard summary={r!.summary} data={d} />
          {d && <PagesTable data={d} selected={selected} onSelect={setSelected} />}
        </div>
        <div className="min-w-0 xl:col-span-7">
          <JsonViewer value={nodeValue} nodePath={nodePath} onClearNode={selected != null ? () => setSelected(null) : undefined}
            extra={d ? { label: "Extracted", render: () => <ExtractedDataView data={d} /> } : undefined}
            meta={<>
              <span className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-label-code text-on-surface">Schema-validated</span>
              {ex && <span className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-label-code text-secondary">{ex.tool}</span>}
            </>} />
        </div>
      </div>
    </div>
  );
}

function HeadBtn({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg bg-surface-container px-3 py-1.5 text-label-md font-medium text-on-surface transition-colors hover:bg-surface-container-high">
      {icon}<span>{children}</span>
    </button>
  );
}
