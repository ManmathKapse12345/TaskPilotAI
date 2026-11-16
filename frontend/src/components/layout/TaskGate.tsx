"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import type { TaskView } from "@/lib/taskState";
import { useSelectedTask, useWorkspace } from "@/lib/workspace";
import { EmptyState, ErrorState, LoadingState } from "../ui/primitives";

/**
 * Resolves the task for /live and /results (`?id=`, else the active task, else the newest one)
 * and renders loading / empty / error states before handing a TaskView to the screen.
 */
export function TaskGate({ children, emptyTitle, emptyText }: { children: (task: TaskView) => ReactNode; emptyTitle: string; emptyText: string }) {
  const params = useSearchParams();
  const ws = useWorkspace();
  const { id, task, error, resolving } = useSelectedTask(params.get("id"));

  if (resolving) return <LoadingState label="Loading task history…" />;
  if (!id) {
    return (
      <EmptyState icon={<Inbox className="h-5 w-5" />} title={emptyTitle}
        action={<Link href="/" className="glow-primary inline-flex items-center rounded-lg bg-primary-container px-3 py-2 text-label-md font-medium text-on-primary-container hover:bg-primary">Open Agent Workspace</Link>}>
        {ws.historyError ? ws.historyError : emptyText}
      </EmptyState>
    );
  }
  if (error) return <ErrorState title="Could not load this task" onRetry={() => ws.ensureTask(id, true)}>{error}</ErrorState>;
  if (!task) return <LoadingState label={`Loading task ${id.slice(0, 8)}…`} />;
  return <>{children(task)}</>;
}
