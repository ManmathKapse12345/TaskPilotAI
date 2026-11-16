"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, ChevronRight, FileText, Globe, Link2, Mail, Phone, Share2 } from "lucide-react";
import type { ExtractedData, ExtractedPage } from "@/lib/api";
import { Chip, SectionLabel, cx } from "../ui/primitives";

function Card({ title, icon, children, className }: { title: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0 rounded-xl border border-line bg-surface-container/30", className)}>
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5 text-body-md font-medium text-on-surface">
        <span className="text-outline">{icon}</span>{title}
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

function NotFound({ what }: { what: string }) {
  return <span className="text-body-md text-outline">No {what} found on the crawled pages</span>;
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow"
      className="inline-flex max-w-full items-center gap-1 truncate text-body-md text-on-surface-variant hover:text-primary">
      <span className="truncate">{children}</span><ArrowUpRight className="h-3 w-3 shrink-0 opacity-60" />
    </a>
  );
}

export function ExtractedDataView({ data: d }: { data: ExtractedData }) {
  const w = d.website;
  const c = d.contact;
  const errors = d.crawl_stats.errors;
  const [allLinks, setAllLinks] = useState(false);
  const nav = allLinks ? d.navigation_links : d.navigation_links.slice(0, 16);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Website" icon={<Globe className="h-4 w-4" />}>
          <dl className="space-y-3 text-body-md">
            <Field label="Title">{w.title}</Field>
            {w.site_name && w.site_name !== w.title && <Field label="Site name">{w.site_name}</Field>}
            <Field label="Description">{w.description}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Language">{w.language}</Field>
              <Field label="Structured data">{w.structured_data_types.join(", ")}</Field>
            </div>
            {w.keywords.length > 0 && (
              <div>
                <dt className="mb-1 text-body-sm text-outline">Keywords</dt>
                <dd className="flex flex-wrap gap-1">{w.keywords.slice(0, 16).map((k) => <Chip key={k}>{k}</Chip>)}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card title="Contact" icon={<Mail className="h-4 w-4" />}>
          <div className="space-y-3.5">
            <div>
              <SectionLabel className="mb-1.5 flex items-center gap-1.5"><Mail className="h-3 w-3" /> Emails</SectionLabel>
              {c.emails.length ? <ul className="space-y-1">{c.emails.map((e) => <li key={e}><a href={`mailto:${e}`} className="break-all font-mono text-[12.5px] text-on-surface-variant hover:text-primary">{e}</a></li>)}</ul> : <NotFound what="emails" />}
            </div>
            <div>
              <SectionLabel className="mb-1.5 flex items-center gap-1.5"><Phone className="h-3 w-3" /> Phones</SectionLabel>
              {c.phones.length ? <ul className="space-y-1">{c.phones.map((p) => <li key={p} className="font-mono text-[12.5px] text-on-surface-variant">{p}</li>)}</ul> : <NotFound what="phone numbers" />}
            </div>
            <div>
              <SectionLabel className="mb-1.5 flex items-center gap-1.5"><Share2 className="h-3 w-3" /> Social profiles</SectionLabel>
              {c.social_profiles.length ? (
                <ul className="space-y-1">{c.social_profiles.map((s) => (
                  <li key={s.url} className="flex min-w-0 items-center gap-2"><span className="w-16 shrink-0 text-[12px] capitalize text-outline">{s.platform}</span><ExtLink href={s.url}>{s.url.replace(/^https?:\/\//, "")}</ExtLink></li>
                ))}</ul>
              ) : <NotFound what="social profiles" />}
            </div>
          </div>
        </Card>
      </div>

      <Card title={`Pages (${d.pages.length})`} icon={<FileText className="h-4 w-4" />}>
        {d.pages.length === 0 ? <NotFound what="pages" /> : (
          <div className="-m-3.5 divide-y divide-line">
            {d.pages.map((p) => <PageRow key={p.url} page={p} />)}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Internal links (${d.navigation_links.length})`} icon={<Link2 className="h-4 w-4" />}>
          {d.navigation_links.length === 0 ? <NotFound what="internal links" /> : (
            <>
              <ul className="space-y-1">{nav.map((l) => (
                <li key={l.url} className="flex min-w-0 items-baseline gap-2">
                  <span className="w-32 shrink-0 truncate text-body-md text-on-surface" title={l.text}>{l.text || "(no text)"}</span>
                  <ExtLink href={l.url}>{l.url.replace(/^https?:\/\/[^/]+/, "") || "/"}</ExtLink>
                </li>
              ))}</ul>
              {d.navigation_links.length > 16 && (
                <button onClick={() => setAllLinks((a) => !a)} className="mt-2 text-xs font-medium text-primary hover:text-primary-container">
                  {allLinks ? "Show fewer" : `Show all ${d.navigation_links.length}`}
                </button>
              )}
            </>
          )}
        </Card>
        <Card title={`External links (${d.external_links.length})`} icon={<ArrowUpRight className="h-4 w-4" />}>
          {d.external_links.length === 0 ? <NotFound what="external links" /> : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">{d.external_links.map((l) => (
              <li key={l.url} className="min-w-0"><ExtLink href={l.url}>{l.text || l.url}</ExtLink></li>
            ))}</ul>
          )}
        </Card>
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl border border-warn/25 bg-warn/[0.05] p-3.5">
          <div className="mb-2 flex items-center gap-2 text-body-md font-medium text-warn"><AlertTriangle className="h-4 w-4" /> {errors.length} page{errors.length === 1 ? "" : "s"} could not be crawled</div>
          <ul className="space-y-1 font-mono text-[11.5px] text-on-surface-variant">{errors.map((e, i) => <li key={i} className="break-all">{e.url} <span className="text-outline">— {e.error}</span></li>)}</ul>
        </div>
      )}
      {d.crawl_stats.skipped_by_robots.length > 0 && (
        <p className="text-xs text-outline">Skipped because robots.txt disallows them: {d.crawl_stats.skipped_by_robots.join(", ")}</p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const empty = children == null || children === "";
  return (
    <div className="min-w-0">
      <dt className="text-body-sm text-outline">{label}</dt>
      <dd className={cx("mt-0.5 break-words", empty ? "text-outline" : "text-on-surface")}>{empty ? "Not found" : children}</dd>
    </div>
  );
}

function PageRow({ page: p }: { page: ExtractedPage }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.02]">
        <ChevronRight className={cx("h-3.5 w-3.5 shrink-0 text-outline transition-transform", open && "rotate-90")} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body-md font-medium text-on-surface">{p.title || "(untitled page)"}</span>
          <span className="block truncate font-mono text-body-sm text-outline">{p.url}</span>
        </span>
        <span className="hidden shrink-0 gap-3 font-mono text-body-sm text-outline sm:flex">
          <span className={p.status_code < 300 ? "text-primary/80" : "text-warn"}>{p.status_code}</span>
          <span>{p.word_count.toLocaleString()} words</span>
          <span>depth {p.depth}</span>
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line bg-black/20 px-3.5 py-3 pl-10 text-body-md">
          <div className="flex gap-3 font-mono text-body-sm text-outline sm:hidden">
            <span>HTTP {p.status_code}</span><span>{p.word_count} words</span><span>depth {p.depth}</span>
          </div>
          {p.description && <p className="text-on-surface-variant">{p.description}</p>}
          {p.headings.length > 0 && (
            <div>
              <SectionLabel className="mb-1.5">Headings</SectionLabel>
              <ul className="space-y-0.5">
                {p.headings.slice(0, 16).map((h, i) => (
                  <li key={i} className="flex gap-2 text-on-surface-variant" style={{ paddingLeft: (h.level - 1) * 14 }}>
                    <span className="w-5 shrink-0 font-mono text-[10.5px] leading-5 text-outline">H{h.level}</span>{h.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.content_preview && (
            <div>
              <SectionLabel className="mb-1.5">Content preview</SectionLabel>
              <p className="border-l-2 border-line-strong pl-3 leading-relaxed text-outline">{p.content_preview.slice(0, 420)}{p.content_preview.length > 420 && "…"}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
