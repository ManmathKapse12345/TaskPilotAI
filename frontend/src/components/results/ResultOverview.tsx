"use client";

import type { ReactNode } from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import type { TaskView } from "@/lib/taskState";
import { SectionLabel, StatusBadge, cx, formatBytes, formatMs } from "../ui/primitives";

type Tab = "overview" | "summary" | "data" | "json" | "logs";

function Metric({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0 bg-surface px-4 py-3", className)}>
      <div className="text-[11px] text-subtle">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold tracking-tight text-fg tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-subtle">{sub}</div>}
    </div>
  );
}

/** Only metrics the backend actually returned are shown. */
export function ResultOverview({ task, onNavigate }: { task: TaskView; onNavigate: (t: Tab) => void }) {
  const r = task.result!;
  const d = r.data!;
  const st = d.crawl_stats;
  const ex = r.execution;

  const items: [string, number][] = [
    ["pages", d.pages.length],
    ["emails", d.contact.emails.length],
    ["phones", d.contact.phones.length],
    ["social", d.contact.social_profiles.length],
    ["internal links", d.navigation_links.length],
    ["external links", d.external_links.length],
    ["images", d.images.length],
  ];
  const total = items.reduce((n, [, v]) => n + v, 0);
  const url = d.website.final_url || d.website.url;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionLabel>Website</SectionLabel>
          <a href={url} target="_blank" rel="noopener noreferrer nofollow"
            className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[15px] font-medium text-fg hover:text-accent">
            <span className="truncate">{url}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          </a>
          {d.website.title && <div className="mt-0.5 truncate text-[13px] text-muted">{d.website.title}</div>}
        </div>
        <StatusBadge status={r.status} />
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        <Metric label="Pages crawled" value={st.pages_crawled}
          sub={[st.pages_failed > 0 && `${st.pages_failed} failed`, st.pages_skipped_robots > 0 && `${st.pages_skipped_robots} robots-skipped`].filter(Boolean).join(" · ") || "no failures"} />
        <Metric label="Execution time" value={formatMs(ex?.duration_ms ?? st.duration_ms)} sub={st.duration_ms != null ? `crawl ${formatMs(st.duration_ms)} inside CLI` : undefined} />
        <Metric label="Extracted items" value={total} sub={items.filter(([, v]) => v > 0).slice(0, 3).map(([k, v]) => `${v} ${v === 1 ? k.replace(/s$/, "") : k}`).join(" · ")} />
        <Metric label="Exit code" value={<span className={ex?.exit_code === 0 ? "text-ok" : "text-warn"}>{ex?.exit_code ?? "–"}</span>} sub={ex?.exit_meaning} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
        <div className="min-w-0">
          <SectionLabel className="mb-2">Extracted items</SectionLabel>
          <div className="space-y-1.5">
            {items.map(([k, v]) => (
              <div key={k} className="flex items-center gap-3 text-[13px]">
                <span className="w-28 shrink-0 capitalize text-muted">{k}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                  <span className="block h-full rounded-full bg-accent/70" style={{ width: total ? `${Math.max(v ? 3 : 0, (v / Math.max(...items.map((i) => i[1]))) * 100)}%` : 0 }} />
                </span>
                <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-fg">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0 space-y-1.5 text-[13px]">
          <SectionLabel className="mb-2">Execution</SectionLabel>
          {([
            ["Tool", ex?.tool],
            ["PID", ex?.pid],
            ["stdout", ex ? formatBytes(ex.stdout_bytes) : undefined],
            ["stderr lines", ex?.stderr_lines],
            ["Downloaded", formatBytes(st.bytes_downloaded)],
            ["Summary by", r.summary?.generated_by],
          ] as [string, ReactNode][]).filter(([, v]) => v != null && v !== "").map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><span className="text-subtle">{k}</span><span className="truncate font-mono text-xs text-muted">{v}</span></div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        {r.summary && <NavLink onClick={() => onNavigate("summary")}>Read summary</NavLink>}
        <NavLink onClick={() => onNavigate("data")}>Browse extracted data</NavLink>
        {r.json_output && <NavLink onClick={() => onNavigate("json")}>Open JSON</NavLink>}
        <NavLink onClick={() => onNavigate("logs")}>View logs</NavLink>
      </div>
    </div>
  );
}

function NavLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-fg">
      {children}<ChevronRight className="h-3 w-3" />
    </button>
  );
}
