"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Braces, CheckCircle2, Copy, Download, FileText, Globe, KeyRound, LayoutGrid, Link2, Maximize2, ShieldCheck, Sparkles, X } from "lucide-react";
import type { ExtractedData } from "@/lib/api";
import { downloadText } from "@/lib/logs";
import type { TaskView } from "@/lib/taskState";
import { useWorkspace } from "@/lib/workspace";
import { ExtractedDataView } from "../results/ExtractedDataView";
import { Highlighted, JsonViewer } from "../results/JsonViewer";
import { Markdown } from "../ui/Markdown";
import { cx, formatBytes, formatMs } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import { Evidence, SectionTitle, pagesCsv, taskDurationMs } from "./bits";
import { RecoveryNote } from "./ReasoningTrace";

const POINT_ICONS = [Globe, FileText, Link2, ShieldCheck, KeyRound, Sparkles];
const JSON_PREVIEW_LINES = 24;

/** Stitch "Completed Task": verified result from the CLI run, shown as the agent's chat reply. */
export function ResultCard({ task, onFollowUp }: { task: TaskView; onFollowUp: (text: string) => void }) {
  const ws = useWorkspace();
  const toast = useToast();
  const r = task.result!;
  const d = r.data;
  const ex = r.execution;
  const doc = r.json_output ?? d ?? null;
  const text = useMemo(() => (doc ? JSON.stringify(doc, null, 2) : ""), [doc]);
  const lines = useMemo(() => text.split("\n"), [text]);
  const [allLines, setAllLines] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [allPages, setAllPages] = useState(false);
  const partial = r.status === "partial";
  const pages = d?.crawl_stats.pages_crawled ?? 0;
  const dur = taskDurationMs(task);
  const fname = `taskpilot-${task.id.slice(0, 8)}`;
  const url = d ? d.website.final_url || d.website.url : task.plan?.url ?? "";
  const words = d?.pages.reduce((n, p) => n + p.word_count, 0) ?? 0;
  const first = d?.pages[0];

  const copy = () => navigator.clipboard.writeText(text).then(() => toast({ tone: "success", title: "JSON copied" }), () => toast({ tone: "error", title: "Clipboard unavailable" }));
  const download = () => { downloadText(text, `${fname}.json`, "application/json"); toast({ tone: "success", title: "Download started", body: `${fname}.json` }); };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-5 rounded-xl bg-surface-container-low p-4 sm:p-5">
        {/* status + evidence */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cx("flex items-center gap-2 font-mono text-code-lg font-semibold", partial ? "text-warn" : "text-primary")}>
              {partial ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              {partial ? `Finished with partial results: ${pages} page${pages === 1 ? "" : "s"} read` : `Done: crawled ${pages} page${pages === 1 ? "" : "s"}${dur != null ? ` in ${formatMs(dur)}` : ""}`}
            </span>
            {first && <span className="font-mono text-code-sm text-on-surface-variant">HTTP {first.status_code} · output schema-validated</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {ex && <Evidence title="Approved CLI tool that ran">{ex.tool}</Evidence>}
            {ex?.exit_code != null && <Evidence tone={ex.exit_code === 0 ? "ok" : "warn"} title={ex.exit_meaning}><span className={cx("h-1.5 w-1.5 rounded-full", ex.exit_code === 0 ? "bg-primary" : "bg-warn")} />exit code {ex.exit_code}</Evidence>}
            {ex?.pid != null && <Evidence>PID {ex.pid}</Evidence>}
            {ex && <Evidence tone="info">{formatBytes(ex.stdout_bytes)} JSON</Evidence>}
            <button type="button" onClick={() => ws.setDetailsId(task.id)} className="ml-auto flex items-center gap-1 font-mono text-code-sm text-on-surface-variant hover:text-primary">
              View run details <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <RecoveryNote task={task} />
        {partial && r.error && !task.recoveries && !(d && d.crawl_stats.errors.length) && (
          <p className="rounded-lg bg-warn/10 p-3 text-body-md text-warn">{r.error}</p>
        )}

        {partial && d && d.crawl_stats.errors.length > 0 && (
          <div className="rounded-lg bg-warn/10 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 font-mono text-label-code font-semibold uppercase tracking-wider text-warn"><AlertTriangle className="h-3.5 w-3.5" />Pages that could not be read</div>
            <ul className="space-y-1">
              {d.crawl_stats.errors.slice(0, 5).map((e, i) => (
                <li key={i} className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-code-sm">
                  <span className="rounded bg-error-container/30 px-1.5 py-0.5 text-error">{e.error}</span>
                  <span className="min-w-0 truncate text-on-surface-variant">{e.url}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* summary */}
        <section>
          <SectionTitle icon={<FileText className="h-5 w-5 text-primary" />}
            right={r.summary && <span className="font-mono text-label-code text-on-surface-variant" title="Written only from content the CLI captured">{r.summary.generated_by}{r.summary.site_type ? ` · ${r.summary.site_type}` : ""}</span>}>
            Summary
          </SectionTitle>
          {r.summary ? (
            <>
              <div className="text-body-lg text-on-surface"><Markdown text={r.summary.text} /></div>
              {r.summary.key_points.length > 0 && (
                <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg bg-surface-container p-3 md:grid-cols-2">
                  {r.summary.key_points.map((k, i) => {
                    const Icon = POINT_ICONS[i % POINT_ICONS.length];
                    return <li key={i} className="flex items-start gap-2.5 text-body-md text-on-surface"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />{k}</li>;
                  })}
                </ul>
              )}
              {Object.entries(r.summary.focus_findings || {}).map(([k, v]) => (
                <div key={k} className="mt-2 rounded-lg bg-surface-container p-3">
                  <div className="text-body-md font-semibold capitalize text-on-surface">{k}</div>
                  <div className="mt-0.5 text-body-md text-on-surface-variant">{v}</div>
                </div>
              ))}
            </>
          ) : <p className="text-body-md text-on-surface-variant">No summary was requested. Ask for “a summary” to get one.</p>}
        </section>

        {/* extracted data */}
        {d && (
          <section>
            <SectionTitle icon={<LayoutGrid className="h-5 w-5 text-secondary" />}>Extracted data</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="Pages crawled" value={String(pages)} />
              <Stat label="HTTP status" value={first ? `${first.status_code}${first.status_code < 300 ? " OK" : ""}` : "–"} tone={first && first.status_code < 300 ? "text-primary" : "text-warn"} />
              <Stat label="Word count" value={`${words.toLocaleString()} words`} />
              <Stat label="External links" value={String(d.external_links.length)} tone="text-tertiary" />
              <Stat label="Contact / emails" value={d.contact.emails.length + d.contact.phones.length ? `${d.contact.emails.length + d.contact.phones.length} found` : "0 found"}
                tone={d.contact.emails.length + d.contact.phones.length ? "text-primary" : "text-on-surface-variant"} />
            </div>
            {d.pages.length > 0 && <PagesTable data={d} all={allPages} onAll={() => setAllPages(true)} />}
          </section>
        )}

        {/* JSON */}
        {doc && (
          <section className="overflow-hidden rounded-lg bg-surface-container-lowest">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-container px-3 py-2">
              <span className="flex items-center gap-2">
                <Braces className="h-4.5 w-4.5 text-primary" />
                <span className="text-headline-sm font-semibold text-on-surface">JSON result</span>
                <span className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-label-code text-primary" title="Parsed and re-serialised by the backend; syntactically valid">Valid JSON ✓</span>
              </span>
              <span className="flex items-center gap-1">
                <SmallBtn onClick={copy} icon={<Copy className="h-3.5 w-3.5" />}>Copy</SmallBtn>
                <SmallBtn onClick={download} icon={<Download className="h-3.5 w-3.5" />}>Download .json</SmallBtn>
                <button type="button" onClick={() => setExpanded(true)} title="Expand" aria-label="Expand JSON" className="rounded bg-surface-container-high p-1.5 text-on-surface-variant hover:text-on-surface">
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
            <div className="max-h-[520px] overflow-auto p-3 font-mono text-code-sm">
              <Highlighted lines={allLines ? lines : lines.slice(0, JSON_PREVIEW_LINES)} numbers query="" />
            </div>
            {lines.length > JSON_PREVIEW_LINES && (
              <button type="button" onClick={() => setAllLines((a) => !a)} className="w-full bg-surface-container px-3 py-2 text-left font-mono text-code-sm text-secondary hover:bg-surface-container-high">
                {allLines ? "Show less" : `Show all ${lines.length.toLocaleString()} lines (${formatBytes(new Blob([text]).size)})`}
              </button>
            )}
          </section>
        )}
      </div>

      {/* follow-ups */}
      <div className="flex flex-wrap gap-2">
        {url && <FollowUp onClick={() => onFollowUp(`Crawl up to ${ws.health?.limits.max_pages ?? 10} pages of ${url}, give me a summary and return the extracted data in JSON format.`)}>Crawl more pages</FollowUp>}
        {url && <FollowUp onClick={() => onFollowUp(`Crawl ${url} and focus on contact details and social profiles. Return them in JSON format.`)}>Only contact details</FollowUp>}
        {d && d.pages.length > 0 && <FollowUp onClick={() => downloadText(pagesCsv(d), `${fname}-pages.csv`, "text/csv")}>Export as CSV</FollowUp>}
      </div>

      {expanded && doc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="JSON result">
          <div className="absolute inset-0 bg-black/70" onClick={() => setExpanded(false)} />
          <div className="relative flex max-h-full w-full max-w-5xl flex-col">
            <button type="button" onClick={() => setExpanded(false)} aria-label="Close" className="absolute -top-1 right-0 z-10 -translate-y-full rounded-lg bg-surface-container-high p-1.5 text-on-surface hover:bg-surface-bright"><X className="h-4 w-4" /></button>
            <JsonViewer value={doc} nodePath={r.json_output ? "json_output" : "data"}
              extra={d ? { label: "Contacts & links", render: () => <ExtractedDataView data={d} /> } : undefined} />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-surface-container p-3">
      <span className="font-mono text-label-code text-on-surface-variant">{label}</span>
      <span className={cx("truncate font-mono text-code-lg font-semibold", tone ?? "text-on-surface")}>{value}</span>
    </div>
  );
}

function PagesTable({ data: d, all, onAll }: { data: ExtractedData; all: boolean; onAll: () => void }) {
  const rows = all ? d.pages : d.pages.slice(0, 5);
  return (
    <div className="mt-2 overflow-x-auto rounded-lg">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-surface-container font-mono text-label-code uppercase text-on-surface-variant">
            <th className="px-3 py-2">URL</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Words</th><th className="px-3 py-2 text-right">Depth</th>
          </tr>
        </thead>
        <tbody className="text-body-md">
          {rows.map((p) => (
            <tr key={p.url} className="bg-surface-container-lowest odd:bg-surface-container-lowest/60">
              <td className="max-w-[260px] truncate px-3 py-2 font-mono text-code-sm"><a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="text-secondary hover:underline">{p.url}</a></td>
              <td className="max-w-[260px] truncate px-3 py-2 text-on-surface" title={p.title}>{p.title || "(untitled)"}</td>
              <td className="px-3 py-2"><span className={cx("rounded px-1.5 py-0.5 font-mono text-label-code", p.status_code < 300 ? "bg-primary/10 text-primary" : "bg-warn/10 text-warn")}>{p.status_code}{p.status_code < 300 ? " OK" : ""}</span></td>
              <td className="px-3 py-2 text-right font-mono text-code-sm text-on-surface-variant">{p.word_count.toLocaleString()}</td>
              <td className="px-3 py-2 text-right font-mono text-code-sm text-on-surface-variant">{p.depth}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!all && d.pages.length > 5 && <button type="button" onClick={onAll} className="mt-1 font-mono text-code-sm text-secondary hover:underline">Show all {d.pages.length} pages</button>}
    </div>
  );
}

function SmallBtn({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1.5 rounded bg-surface-container-high px-2 py-1 font-mono text-code-sm text-on-surface hover:bg-surface-bright">
      {icon}{children}
    </button>
  );
}

function FollowUp({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5 text-body-md text-on-surface transition-colors hover:bg-surface-container-high">
      <Sparkles className="h-3.5 w-3.5 text-secondary" />{children}
    </button>
  );
}
