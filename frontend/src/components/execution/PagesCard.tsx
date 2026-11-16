"use client";

import { FileStack } from "lucide-react";
import { pageHits } from "@/lib/logs";
import type { TaskView } from "@/lib/taskState";
import { cx } from "../ui/primitives";

/** Stitch "Worker Pool Nodes" grid, showing the pages the CLI process actually fetched (from its `page` log events). */
export function PagesCard({ task }: { task: TaskView }) {
  const hits = pageHits(task);
  const errors = task.logs.filter((l) => l.level === "error").length;
  const running = !!task.process?.running;

  return (
    <section className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <FileStack className="h-4.5 w-4.5 text-secondary" />
          <h2 className="text-headline-sm font-semibold tracking-tight text-on-surface">Fetched Pages</h2>
        </div>
        <span className={cx("font-mono text-label-code", errors ? "text-warn" : "text-primary")}>
          {hits.length} OK{errors ? ` · ${errors} ERR` : ""}
        </span>
      </div>
      {hits.length === 0 ? (
        <p className="rounded bg-surface-container p-3 font-mono text-code-sm text-on-surface-variant">
          {running ? "Waiting for the first page…" : task.process ? "The CLI reported no fetched pages." : "Pages appear here as the CLI process fetches them."}
        </p>
      ) : (
        <div className="grid max-h-[360px] grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
          {hits.map((h) => (
            <div key={h.n} className="flex min-w-0 flex-col gap-1 rounded bg-surface-container p-2">
              <div className="flex items-center justify-between font-mono text-label-code">
                <span className="font-semibold text-on-surface">P-{h.n + 1}</span>
                <span className={cx("font-medium", h.status != null && h.status < 300 ? "text-primary" : "text-warn")}>{h.status ?? "–"}{h.status != null && h.status < 300 ? " OK" : ""}</span>
              </div>
              <span className="truncate font-mono text-code-sm text-on-surface-variant" title={h.title}>{h.title || "(untitled)"}</span>
              <div className="flex items-center justify-between font-mono text-label-code text-on-surface-variant">
                <span>fetch</span>
                <span className="text-secondary">{h.ms != null ? `${h.ms}ms` : "–"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
