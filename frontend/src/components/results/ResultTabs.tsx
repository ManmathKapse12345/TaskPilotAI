"use client";

import { useState } from "react";
import { Braces, Database, LayoutGrid, ScrollText, TerminalSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TaskView } from "@/lib/taskState";
import { ExecutionLogs, buildLogRows } from "../execution/ExecutionLogs";
import { cx } from "../ui/primitives";
import { ExtractedDataView } from "./ExtractedDataView";
import { JsonViewer } from "./JsonViewer";
import { ResultOverview } from "./ResultOverview";
import { SummaryView } from "./SummaryView";

type Tab = "overview" | "summary" | "data" | "json" | "logs";

export function ResultTabs({ task }: { task: TaskView }) {
  const r = task.result!;
  const [tab, setTab] = useState<Tab>("overview");
  const logCount = buildLogRows(task).length;

  const tabs: { key: Tab; label: string; icon: LucideIcon; show: boolean; count?: number }[] = [
    { key: "overview", label: "Overview", icon: LayoutGrid, show: !!r.data },
    { key: "summary", label: "Summary", icon: ScrollText, show: !!r.summary },
    { key: "data", label: "Extracted Data", icon: Database, show: !!r.data },
    { key: "json", label: "JSON Output", icon: Braces, show: !!r.json_output },
    { key: "logs", label: "Execution Logs", icon: TerminalSquare, show: true, count: logCount },
  ];
  const visible = tabs.filter((t) => t.show);
  const current = visible.some((t) => t.key === tab) ? tab : visible[0].key;

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div role="tablist" aria-label="Result views" className="flex gap-1 overflow-x-auto border-b border-line bg-panel/60 px-1.5">
        {visible.map((t) => (
          <button key={t.key} role="tab" aria-selected={current === t.key} onClick={() => setTab(t.key)}
            className={cx("relative flex shrink-0 items-center gap-1.5 px-2.5 py-2.5 text-[13px] font-medium transition-colors",
              current === t.key ? "text-fg" : "text-subtle hover:text-muted")}>
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.count != null && <span className="rounded bg-raised px-1 font-mono text-[10px] text-subtle">{t.count}</span>}
            {current === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="bg-surface p-4">
        {current === "overview" && <ResultOverview task={task} onNavigate={setTab} />}
        {current === "summary" && r.summary && <SummaryView summary={r.summary} />}
        {current === "data" && r.data && <ExtractedDataView data={r.data} />}
        {current === "json" && r.json_output && <JsonViewer value={r.json_output} filename={`taskpilot-${task.id.slice(0, 8)}.json`} />}
        {current === "logs" && <ExecutionLogs task={task} />}
      </div>
    </div>
  );
}
