"use client";

import { Fragment, type ReactNode } from "react";
import type { StageStatus, TaskStatus } from "@/lib/api";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const STATUS_STYLE: Record<TaskStatus, { label: string; cls: string; dot: string }> = {
  queued: { label: "Queued", cls: "bg-slate-500/15 text-slate-300 ring-slate-500/30", dot: "bg-slate-400" },
  running: { label: "Running", cls: "bg-sky-500/15 text-sky-300 ring-sky-500/30", dot: "bg-sky-400 animate-pulse" },
  completed: { label: "Completed", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30", dot: "bg-emerald-400" },
  partial: { label: "Partial result", cls: "bg-amber-500/15 text-amber-300 ring-amber-500/30", dot: "bg-amber-400" },
  failed: { label: "Failed", cls: "bg-rose-500/15 text-rose-300 ring-rose-500/30", dot: "bg-rose-400" },
  cancelled: { label: "Cancelled", cls: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30", dot: "bg-zinc-400" },
  answered: { label: "Answered", cls: "bg-violet-500/15 text-violet-300 ring-violet-500/30", dot: "bg-violet-400" },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.queued;
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1", s.cls)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function StatusDot({ status }: { status: TaskStatus }) {
  return <span className={cx("h-2 w-2 shrink-0 rounded-full", (STATUS_STYLE[status] ?? STATUS_STYLE.queued).dot)} />;
}

export function StageIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case "running":
      return <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />;
    case "done":
      return (
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-emerald-400" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    case "failed":
      return (
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-rose-400" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.7 7.3a1 1 0 00-1.4 1.4L8.6 10l-1.3 1.3a1 1 0 101.4 1.4L10 11.4l1.3 1.3a1 1 0 001.4-1.4L11.4 10l1.3-1.3a1 1 0 00-1.4-1.4L10 8.6 8.7 7.3z" clipRule="evenodd" />
        </svg>
      );
    case "warning":
      return (
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-amber-400" fill="currentColor">
          <path fillRule="evenodd" d="M8.3 2.9a2 2 0 013.4 0l6 10.6A2 2 0 0116 16.5H4a2 2 0 01-1.7-3L8.3 2.9zM10 7a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1zm0 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      );
    case "skipped":
      return <span className="h-4 w-4 rounded-full border-2 border-dashed border-slate-600" />;
    default:
      return <span className="h-4 w-4 rounded-full border-2 border-slate-600" />;
  }
}

/** Tiny, safe Markdown subset: paragraphs, bullets, **bold**, *italic*, `code`. No raw HTML is ever rendered. */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const inline = (s: string, key: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={key + i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={key + i} className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[0.85em] text-sky-300">{part.slice(1, -1)}</code>;
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={key + i}>{part.slice(1, -1)}</em>;
      return <Fragment key={key + i}>{part}</Fragment>;
    });

  const blocks = text.split(/\n{2,}/);
  return (
    <div className={cx("space-y-3 leading-relaxed", className)}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={bi} className="list-disc space-y-1 pl-5">
              {lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*•]\s+/, ""), `${bi}-${li}-`)}</li>)}
            </ul>
          );
        }
        if (/^#{1,4}\s/.test(block)) {
          return <h4 key={bi} className="font-semibold text-white">{inline(block.replace(/^#{1,4}\s/, ""), `${bi}-`)}</h4>;
        }
        return <p key={bi}>{lines.map((l, li) => <Fragment key={li}>{li > 0 && <br />}{inline(l, `${bi}-${li}-`)}</Fragment>)}</p>;
      })}
    </div>
  );
}

export function Button({ children, onClick, variant = "ghost", disabled, title, className }: {
  children: ReactNode; onClick?: () => void; variant?: "ghost" | "primary" | "danger"; disabled?: boolean; title?: string; className?: string;
}) {
  const styles = {
    ghost: "bg-slate-800/70 text-slate-200 hover:bg-slate-700 ring-1 ring-slate-700",
    primary: "bg-indigo-500 text-white hover:bg-indigo-400",
    danger: "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 ring-1 ring-rose-500/30",
  }[variant];
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={cx("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40", styles, className)}>
      {children}
    </button>
  );
}

export function formatMs(ms?: number | null) {
  if (ms == null) return "–";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}
