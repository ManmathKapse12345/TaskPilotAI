"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { LivePill, PageHeading, Segmented } from "../layout/PageHeading";
import { CapacityCard, EngineCard, RecentExecutions } from "./EngineCards";
import { TaskComposer } from "./TaskComposer";

/** Screen 1 — Agent Workspace (Stitch: "Synapse - Agent Workspace"). */
export function WorkspaceView() {
  const ws = useWorkspace();
  const router = useRouter();
  const online = !!ws.health && !ws.healthError;

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeading
        crumbs={["workspace", "agent", "new task"]}
        title="Autonomous Agent Orchestrator"
        badge={
          <span className="hidden sm:flex">
            <LivePill tone={online ? "primary" : ws.healthError ? "error" : "outline"} ping={online}>
              <span className={`font-mono text-code-sm font-medium ${online ? "text-primary" : ws.healthError ? "text-error" : "text-on-surface-variant"}`}>
                {online ? `${ws.health!.tools.length} tool${ws.health!.tools.length === 1 ? "" : "s"} ready` : ws.healthError ? "Backend offline" : "Connecting…"}
              </span>
              {online && <><span className="font-mono text-label-code text-outline-variant">•</span>
                <span className="font-mono text-label-code text-on-surface-variant">{ws.health!.llm.enabled ? ws.health!.llm.provider : "rules"}</span></>}
            </LivePill>
          </span>
        }
        actions={
          <>
            <Segmented value="compose" onChange={(k) => k !== "compose" && router.push(ws.activeId ? `/${k}?id=${ws.activeId}` : `/${k}`)}
              items={[{ key: "compose", label: "Compose" }, { key: "live", label: "Live CLI" }, { key: "results", label: "Results" }]} />
            <Link href="/history" aria-label="Task history" title="Task history"
              className="rounded-lg bg-surface-container-low p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface">
              <History className="h-4.5 w-4.5" />
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8"><TaskComposer /></div>
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <EngineCard />
          <CapacityCard />
          <RecentExecutions />
        </div>
      </div>
    </div>
  );
}
