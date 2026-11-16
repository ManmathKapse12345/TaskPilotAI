"use client";

import { TaskGate } from "../layout/TaskGate";
import { ControlStrip } from "./ControlStrip";
import { IntentCard } from "./IntentCard";
import { PagesCard } from "./PagesCard";
import { PipelineCard } from "./PipelineCard";
import { TerminalPanel } from "./TerminalPanel";
import { SuccessState } from "../ui/primitives";

/** Screen 2 — Live CLI Execution (Stitch: "Synapse - Live CLI Execution"). */
export function LiveView() {
  return (
    <TaskGate emptyTitle="No execution to show" emptyText="Dispatch a task from the Agent Workspace and its live CLI output will stream here.">
      {(task) => {
        const r = task.result;
        const failed = task.finished && r && (r.status === "failed" || r.status === "cancelled");
        return (
          <div className="flex w-full flex-col gap-4">
            <ControlStrip task={task} />
            {failed && (
              <SuccessState tone="failure" title={r.status === "cancelled" ? "Task cancelled" : "Task failed"}>
                {r.error ?? r.message}
                {r.execution?.exit_meaning && <span className="mt-1 block font-mono text-code-sm">exit code {r.execution.exit_code ?? "–"}: {r.execution.exit_meaning}</span>}
              </SuccessState>
            )}
            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
              <div className="flex min-w-0 flex-col gap-3 xl:col-span-5">
                <IntentCard task={task} />
                <PipelineCard task={task} />
                {task.plan?.intent === "website_crawl" && <PagesCard task={task} />}
              </div>
              <TerminalPanel task={task} className="min-w-0 xl:col-span-7" />
            </div>
          </div>
        );
      }}
    </TaskGate>
  );
}
