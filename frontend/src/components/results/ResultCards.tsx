"use client";

import { useMemo, useState } from "react";
import { AtSign, BrainCircuit, ExternalLink, FileText, Globe, KeyRound, ListFilter, Phone, Share2, Sparkles } from "lucide-react";
import type { ExtractedData, Summary } from "@/lib/api";
import { Markdown } from "../ui/Markdown";
import { cx, formatBytes, formatMs } from "../ui/primitives";

function CardHead({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1">{icon}<span className="font-mono text-label-code font-semibold uppercase tracking-wider text-on-surface-variant">{title}</span></div>
      {right}
    </div>
  );
}

/** Stitch "Target Infrastructure" card — website metadata the crawler extracted. */
export function TargetCard({ data: d }: { data: ExtractedData }) {
  const w = d.website;
  const url = w.final_url || w.url;
  const first = d.pages[0];
  const st = d.crawl_stats;
  const rows: [string, string | undefined, string?][] = [
    ["title", w.title],
    ["site name", w.site_name && w.site_name !== w.title ? w.site_name : undefined],
    ["description", w.description],
    ["structured data", w.structured_data_types.join(", ") || undefined, "text-primary"],
    ["keywords", w.keywords.slice(0, 8).join(", ") || undefined],
  ];
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 shadow-sm">
      <CardHead icon={<Globe className="h-4.5 w-4.5 text-secondary" />} title="Target Website"
        right={first && (
          <span className={cx("flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-label-code", first.status_code < 300 ? "bg-primary/10 text-primary" : "bg-warn/10 text-warn")}>
            <span className={cx("h-1.5 w-1.5 rounded-full", first.status_code < 300 ? "bg-primary" : "bg-warn")} />
            {first.status_code}{first.status_code < 300 ? " OK" : ""}
          </span>
        )} />
      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-container p-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-surface-container-high">
            <span className="font-mono text-label-code font-bold uppercase text-secondary">{(w.site_name || w.title || url.replace(/^https?:\/\/(www\.)?/, "")).slice(0, 2)}</span>
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-mono text-code-sm font-medium text-on-surface">{url}</span>
            <span className="truncate text-body-sm text-on-surface-variant">{w.title || "(no title)"}</span>
          </div>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer nofollow" aria-label="Open website"
          className="rounded-lg bg-surface-container-high p-1.5 text-on-surface-variant transition-colors hover:text-on-surface">
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {([["Language", w.language || "–", "text-on-surface"], ["Downloaded", formatBytes(st.bytes_downloaded), "text-secondary"], ["Crawl time", formatMs(st.duration_ms), "text-primary"]] as const).map(([k, v, c]) => (
          <div key={k} className="flex flex-col rounded-lg bg-surface-container p-2">
            <span className="font-mono text-label-code uppercase text-on-surface-variant">{k}</span>
            <span className={cx("mt-0.5 truncate font-mono text-code-sm font-semibold", c)}>{v}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-0.5 rounded-lg bg-surface-container p-2 font-mono text-code-sm">
        {rows.filter(([, v]) => v).map(([k, v, c]) => (
          <div key={k} className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-label-code uppercase text-on-surface-variant/80">{k}</span>
            <span className={cx("ml-2 truncate", c ?? "text-on-surface")} title={v}>{v}</span>
          </div>
        ))}
        {rows.every(([, v]) => !v) && <span className="text-on-surface-variant">No page metadata found.</span>}
      </div>
    </section>
  );
}

const POINT_ICONS = [KeyRound, Globe, Sparkles, FileText];

/** Stitch "AI Executive Synthesis" — the summary generated only from content the CLI captured. */
export function SummaryCard({ summary: s, data }: { summary: Summary | null | undefined; data?: ExtractedData }) {
  const c = data?.contact;
  return (
    <section className="relative flex flex-col gap-3 overflow-hidden rounded-xl bg-surface-container-low p-4 shadow-sm">
      <div className="pointer-events-none absolute -bottom-10 -right-10 h-44 w-44 rounded-full bg-secondary/5 blur-3xl" />
      <CardHead icon={<BrainCircuit className="h-4.5 w-4.5 text-primary" />} title="AI Executive Synthesis"
        right={s && (
          <span className="flex items-center gap-1.5 rounded-full bg-surface-container-high px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="font-mono text-label-code text-on-surface">{s.generated_by}{s.site_type ? ` · ${s.site_type}` : ""}</span>
          </span>
        )} />
      {s ? (
        <>
          <div className="text-body-md text-on-surface"><Markdown text={s.text} /></div>
          {s.key_points.length > 0 && (
            <div className="flex flex-col gap-1 font-mono text-code-sm">
              {s.key_points.map((k, i) => {
                const Icon = POINT_ICONS[i % POINT_ICONS.length];
                return (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-surface-container p-2">
                    <Icon className={cx("mt-0.5 h-4 w-4 shrink-0", ["text-primary", "text-secondary", "text-tertiary", "text-primary"][i % 4])} />
                    <span className="text-on-surface-variant">{k}</span>
                  </div>
                );
              })}
            </div>
          )}
          {Object.entries(s.focus_findings || {}).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-surface-container p-2">
              <div className="font-mono text-code-sm font-medium capitalize text-on-surface">{k}</div>
              <div className="text-body-sm text-on-surface-variant">{v}</div>
            </div>
          ))}
        </>
      ) : (
        <p className="text-body-sm text-on-surface-variant">No summary was requested for this task. Ask for “a summary” in the directive to get one.</p>
      )}
      {c && (c.emails.length > 0 || c.phones.length > 0 || c.social_profiles.length > 0) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {c.emails.slice(0, 3).map((e) => <ContactChip key={e} icon={AtSign} href={`mailto:${e}`}>{e}</ContactChip>)}
          {c.phones.slice(0, 2).map((p) => <ContactChip key={p} icon={Phone}>{p}</ContactChip>)}
          {c.social_profiles.slice(0, 4).map((sp) => <ContactChip key={sp.url} icon={Share2} href={sp.url}>{sp.platform}</ContactChip>)}
        </div>
      )}
    </section>
  );
}

function ContactChip({ icon: Icon, href, children }: { icon: typeof AtSign; href?: string; children: React.ReactNode }) {
  const cls = "flex max-w-full items-center gap-1 rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-label-code text-on-surface";
  const inner = <><Icon className="h-3 w-3 shrink-0 text-secondary" /><span className="truncate">{children}</span></>;
  return href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={cx(cls, "hover:text-primary")}>{inner}</a> : <span className={cls}>{inner}</span>;
}

const PAGE_SIZE = 6;

/** Stitch "Extracted Endpoints" table, listing the crawled pages. Selecting a row shows that page in the JSON viewer. */
export function PagesTable({ data: d, selected, onSelect }: { data: ExtractedData; selected: number | null; onSelect: (i: number | null) => void }) {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return d.pages.map((p, i) => ({ p, i })).filter(({ p }) => !q || p.url.toLowerCase().includes(q) || p.title.toLowerCase().includes(q) || String(p.status_code).includes(q));
  }, [d.pages, filter]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const cur = Math.min(page, pages - 1);
  const shown = rows.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE);

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 shadow-sm">
      <CardHead icon={<FileText className="h-4.5 w-4.5 text-secondary" />} title={`Extracted Pages (${d.pages.length} total)`}
        right={<span className="font-mono text-label-code text-on-surface-variant">Click a row to inspect</span>} />
      <label className="flex items-center gap-1 rounded-lg bg-surface-container px-3 py-1.5 text-on-surface-variant focus-within:ring-1 focus-within:ring-primary/40">
        <ListFilter className="h-4 w-4" />
        <input value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }} placeholder="Filter by path, title or status…" aria-label="Filter pages"
          className="w-full border-0 bg-transparent font-mono text-code-sm text-on-surface outline-none placeholder:text-on-surface-variant" />
      </label>
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface-container font-mono text-label-code uppercase text-on-surface-variant">
              <th className="rounded-l px-3 py-2">Depth</th>
              <th className="px-3 py-2">Path</th>
              <th className="px-2 py-2 text-center">Status</th>
              <th className="px-2 py-2 text-right">Words</th>
              <th className="rounded-r px-3 py-2 text-right">Headings</th>
            </tr>
          </thead>
          <tbody className="font-mono text-code-sm">
            {shown.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-on-surface-variant">{d.pages.length ? "No pages match this filter." : "No pages were captured."}</td></tr>
            )}
            {shown.map(({ p, i }) => {
              const active = selected === i;
              const path = p.url.replace(/^https?:\/\/[^/]+/, "") || "/";
              return (
                <tr key={p.url} onClick={() => onSelect(active ? null : i)} aria-selected={active}
                  className={cx("group cursor-pointer text-on-surface transition-colors", active ? "bg-surface-container-high hover:bg-surface-bright" : "hover:bg-surface-container")}>
                  <td className="px-3 py-2">
                    <span className={cx("rounded px-1.5 py-0.5 font-mono text-label-code font-bold", p.depth === 0 ? "bg-primary/20 text-primary" : "bg-secondary/20 text-secondary")}>D{p.depth}</span>
                  </td>
                  <td className={cx("max-w-[220px] truncate px-3 py-2 font-medium", active ? "text-primary" : "group-hover:text-secondary")} title={p.url}>{path}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={cx("rounded px-1.5 font-mono text-label-code", p.status_code < 300 ? "bg-primary/10 text-primary" : "bg-warn/10 text-warn")}>{p.status_code}</span>
                  </td>
                  <td className="px-2 py-2 text-right text-on-surface-variant">{p.word_count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-on-surface-variant">{p.headings.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between pt-1 font-mono text-code-sm text-on-surface-variant">
        <span>Page {cur + 1} of {pages}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPage(cur - 1)} disabled={cur === 0} className="rounded bg-surface-container px-2 py-1 text-on-surface hover:bg-surface-container-high disabled:opacity-40">Prev</button>
          <button type="button" onClick={() => setPage(cur + 1)} disabled={cur >= pages - 1} className="rounded bg-surface-container px-2 py-1 text-on-surface hover:bg-surface-container-high disabled:opacity-40">Next</button>
        </div>
      </div>
    </section>
  );
}
