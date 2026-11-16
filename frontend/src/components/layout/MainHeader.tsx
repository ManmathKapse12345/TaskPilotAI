"use client";

import { Menu, Plus, ShieldCheck, User } from "lucide-react";
import { hostOf } from "@/lib/taskState";
import { useWorkspace } from "@/lib/workspace";
import { cx, shortId } from "../ui/primitives";

/** Top bar: menu (mobile), conversation title + task id, server status, settings. */
export function MainHeader({ current, onMenu, onNew }: { current: "chat" | "history"; onMenu: () => void; onNew: () => void }) {
  const ws = useWorkspace();
  const first = ws.thread.find((t) => t.kind === "task");
  const firstId = first?.kind === "task" ? first.id : null;
  const url = firstId ? ws.tasks[firstId]?.plan?.url ?? ws.history.find((t) => t.id === firstId)?.url : null;
  const title = current === "history" ? "All tasks" : url ? hostOf(url) : ws.thread.length ? "Chat" : "New chat";
  const online = !!ws.health && !ws.healthError;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 bg-surface-container-lowest/80 px-3 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button type="button" onClick={onMenu} aria-label="Open menu" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container lg:hidden"><Menu className="h-5 w-5" /></button>
        <span className="truncate text-body-lg font-semibold text-on-surface">{title}</span>
        {current === "chat" && firstId && <span className="hidden rounded bg-surface-container px-2 py-0.5 font-mono text-code-sm text-on-surface-variant sm:inline">{shortId(firstId)}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={cx("hidden items-center gap-1.5 rounded-full bg-surface-container-low px-2.5 py-1 font-mono text-code-sm md:flex", online ? "text-primary" : "text-error")}>
          <ShieldCheck className="h-3.5 w-3.5" />{online ? "Safe mode · public sites only" : ws.healthError ? "Server offline" : "Connecting…"}
        </span>
        <button type="button" onClick={onNew} aria-label="New chat" title="New chat" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container lg:hidden"><Plus className="h-5 w-5" /></button>
        <button type="button" onClick={() => ws.setSettingsOpen(true)} aria-label="Settings" title="Settings"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary transition-transform hover:scale-105">
          <User className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
