"use client";

import { Menu, PanelLeftOpen, Plus, Settings2 } from "lucide-react";
import type { Health, TaskStatus } from "@/lib/api";
import { IconButton, StatusBadge, cx } from "../ui/primitives";

export function Header({ title, status, health, healthError, sidebarCollapsed, onMenu, onExpandSidebar, onNew, onSettings }: {
  title: string;
  status?: TaskStatus;
  health: Health | null;
  healthError: boolean;
  sidebarCollapsed: boolean;
  onMenu: () => void;
  onExpandSidebar: () => void;
  onNew: () => void;
  onSettings: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-canvas/80 px-3 backdrop-blur sm:px-4">
      <IconButton label="Open menu" onClick={onMenu} className="md:hidden"><Menu className="h-4 w-4" /></IconButton>
      {sidebarCollapsed && (
        <span className="hidden md:contents">
          <IconButton label="Expand sidebar" onClick={onExpandSidebar}><PanelLeftOpen className="h-4 w-4" /></IconButton>
        </span>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <h1 className="truncate text-sm font-medium text-fg">{title}</h1>
        {status && <StatusBadge status={status} className="hidden sm:inline-flex" />}
      </div>

      <button onClick={onSettings}
        className="hidden items-center gap-2 rounded-full border border-line px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-line-strong hover:text-fg sm:flex"
        title="Backend connection details">
        <span className={cx("h-1.5 w-1.5 rounded-full", healthError ? "bg-bad" : health ? "bg-ok" : "bg-subtle animate-pulse")} />
        {healthError ? "Backend offline" : health ? (
          <>Backend online<span className="text-subtle">·</span><span className="font-mono">{health.tools.length} tool{health.tools.length === 1 ? "" : "s"}</span></>
        ) : "Connecting…"}
      </button>
      <IconButton label="Settings" onClick={onSettings} className="sm:hidden"><Settings2 className="h-4 w-4" /></IconButton>
      <IconButton label="New task" onClick={onNew} className="md:hidden"><Plus className="h-4 w-4" /></IconButton>
    </header>
  );
}
