"use client";

import { Brain, FileJson, Globe, Layers, Target } from "lucide-react";
import type { TaskView } from "@/lib/taskState";
import { Markdown } from "../ui/Markdown";
import { cx } from "../ui/primitives";

/** Stitch "Agent Intent & Strategy": the plan the intent engine produced (or its direct answer). */
export function IntentCard({ task }: { task: TaskView }) {
  const p = task.plan;
  const answered = task.result?.status === "answered";
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-tertiary">
          <Brain className="h-4.5 w-4.5" />
          <h2 className="text-headline-sm font-semibold tracking-tight text-on-surface">Agent Intent & Strategy</h2>
        </div>
        {p && (
          <span className="rounded bg-tertiary-container/30 px-2 py-0.5 font-mono text-label-code uppercase tracking-wider text-tertiary">
            {p.interpreted_by === "llm" ? "LLM parsed" : "Rule parsed"}
          </span>
        )}
      </div>

      <p className="whitespace-pre-wrap break-words font-mono text-code-sm text-on-surface-variant">&ldquo;{task.prompt}&rdquo;</p>

      {!p && !task.finished && (
        <div className="space-y-1.5 pt-1" aria-label="Interpreting request">
          <div className="h-3 w-48 animate-pulse rounded bg-surface-container" />
          <div className="h-3 w-72 max-w-full animate-pulse rounded bg-surface-container" />
        </div>
      )}

      {answered && task.result?.message && (
        <div className="rounded-lg bg-surface-container p-3 text-body-md text-on-surface">
          <Markdown text={task.result.message} />
          <p className="mt-2 font-mono text-label-code uppercase text-on-surface-variant">No CLI execution was needed for this request</p>
        </div>
      )}

      {p && p.intent === "website_crawl" && (
        <>
          {p.steps.length > 0 && (
            <ol className="space-y-0.5 text-body-sm text-on-surface-variant">
              {p.steps.map((s, i) => (
                <li key={i} className="flex gap-2"><span className="font-mono text-code-sm text-primary">{String(i + 1).padStart(2, "0")}</span>{s}</li>
              ))}
            </ol>
          )}
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <Pill icon={Globe} tone="text-secondary">TARGET: {p.url ?? "–"}</Pill>
            <Pill icon={Layers} tone="text-primary">≤ {p.max_pages} PAGE{p.max_pages === 1 ? "" : "S"} · DEPTH {p.max_depth}</Pill>
            <Pill icon={FileJson} tone="text-on-surface-variant">{[p.wants_summary && "SUMMARY", p.wants_json && "JSON"].filter(Boolean).join(" + ") || "DATA"}</Pill>
            {p.focus.length > 0 && <Pill icon={Target} tone="text-tertiary">FOCUS: {p.focus.join(", ").toUpperCase()}</Pill>}
          </div>
        </>
      )}
    </section>
  );
}

function Pill({ icon: Icon, tone, children }: { icon: typeof Globe; tone: string; children: React.ReactNode }) {
  return (
    <span className={cx("flex max-w-full items-center gap-1 rounded bg-surface-container-high px-2 py-1 font-mono text-label-code", tone)}>
      <Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{children}</span>
    </span>
  );
}
