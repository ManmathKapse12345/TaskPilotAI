"use client";

import { Fragment, type ReactNode } from "react";
import { Bot } from "lucide-react";
import type { ExtractedData } from "@/lib/api";
import type { TaskView } from "@/lib/taskState";
import { cx } from "../ui/primitives";

// a URL never ends with sentence punctuation ("…example.com, extract…")
const URL_SPLIT = /(https?:\/\/[^\s<>"'`]*[^\s<>"'`.,;:!?)\]])/g;

/** Renders text with URLs as monospace chips (Stitch user-bubble style). */
export function WithUrls({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_SPLIT).map((part, i) =>
        /^https?:\/\//.test(part)
          ? <code key={i} className="mx-0.5 break-all rounded bg-surface-container-lowest px-1.5 py-0.5 font-mono text-code-lg text-primary">{part}</code>
          : <Fragment key={i}>{part}</Fragment>)}
    </>
  );
}

export function UserBubble({ text, ts }: { text: string; ts?: number }) {
  return (
    <div className="animate-fade-up flex flex-col items-end gap-1">
      <span className="font-mono text-label-code text-on-surface-variant">
        You{ts ? <span className="ml-1 text-on-surface-variant/60">· {new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> : null}
      </span>
      <div className="max-w-[min(85%,720px)] whitespace-pre-wrap break-words rounded-xl rounded-tr-sm bg-surface-container-high px-4 py-3 text-body-lg text-on-surface">
        <WithUrls text={text} />
      </div>
    </div>
  );
}

export function AgentHeader({ right }: { right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot className="h-4 w-4" /></span>
        <span className="text-body-md font-semibold text-on-surface">TaskPilot Agent</span>
      </span>
      {right}
    </div>
  );
}

/** Small monospace evidence chip (tool, exit code, PID…). */
export function Evidence({ children, tone = "neutral", title }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "bad" | "info"; title?: string }) {
  const cls = {
    neutral: "bg-surface-container-lowest text-on-surface-variant",
    ok: "bg-primary/10 text-primary",
    warn: "bg-warn/10 text-warn",
    bad: "bg-error-container/30 text-error",
    info: "bg-secondary/10 text-secondary",
  }[tone];
  return <span title={title} className={cx("inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-code-sm", cls)}>{children}</span>;
}

export function SectionTitle({ icon, children, right }: { icon: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-headline-sm font-semibold text-on-surface">{icon}{children}</h3>
      {right}
    </div>
  );
}

export type Failure = "blocked" | "unreachable" | "timeout" | "failed" | "cancelled";

/** Classifies a finished, unsuccessful task from the real result/process data. */
export function failureKind(t: TaskView): Failure {
  const r = t.result;
  if (r?.status === "cancelled" || t.process?.cancelled) return "cancelled";
  if (t.process?.timedOut || r?.execution?.timed_out) return "timeout";
  const why = `${r?.error ?? ""} ${r?.message ?? ""}`;
  // DNS / connection problems are reported by the URL validator too, but they are not a safety block.
  if (/resolve host|dns|unreachable|connection (refused|error|failed)|name or service not known|getaddrinfo/i.test(why)) return "unreachable";
  if (!t.command && /unsafe|not allowed|private|loopback|internal|blocked|robots|scheme/i.test(why)) return "blocked";
  return "failed";
}

export function pagesCsv(d: ExtractedData) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["url", "title", "status_code", "depth", "word_count", "headings", "description"];
  return [head.join(","), ...d.pages.map((p) => [p.url, p.title, p.status_code, p.depth, p.word_count, p.headings.length, p.description].map(esc).join(","))].join("\n");
}

export function taskDurationMs(t: TaskView) {
  return t.startedAt && t.endedAt ? (t.endedAt - t.startedAt) * 1000 : t.result?.execution?.duration_ms ?? null;
}
