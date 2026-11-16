"use client";

import Link from "next/link";
import { BookOpen, CirclePlus, Settings, User, Zap } from "lucide-react";
import { API_URL } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { cx } from "../ui/primitives";
import { LogoMark, Wordmark } from "./Logo";
import { NAV, hrefFor, type NavKey } from "./nav";

const API_HOST = API_URL.replace(/^https?:\/\//, "");

export function AppSidebar({ current, onNew }: { current: NavKey; onNew: () => void }) {
  const ws = useWorkspace();
  const running = ws.history.some((t) => t.status === "running" || t.status === "queued");
  const online = !!ws.health && !ws.healthError;

  return (
    <aside className="hidden h-dvh w-[260px] shrink-0 flex-col justify-between overflow-y-auto bg-surface-container-lowest p-3 lg:flex">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 p-1">
          <LogoMark />
          <Wordmark sub="Chat-to-CLI execution" />
        </div>

        <button type="button" onClick={onNew}
          className="glow-primary flex w-full items-center justify-between rounded-lg bg-primary-container px-3 py-2 text-label-md font-medium text-on-primary-container transition-all hover:bg-primary active:scale-[0.99]">
          <span className="flex items-center gap-1"><CirclePlus className="h-4 w-4" />New Task</span>
          <kbd className="rounded bg-on-primary-container/20 px-1.5 py-0.5 text-label-code text-on-primary-container">Alt N</kbd>
        </button>

        <div className="flex flex-col gap-0.5">
          <span className="px-1 font-mono text-label-code uppercase tracking-wider text-on-surface-variant">Navigation</span>
          <nav className="flex flex-col gap-0.5" aria-label="Main">
            {NAV.map((item) => {
              const active = item.key === current;
              return (
                <Link key={item.key} href={hrefFor(item, ws.activeId)} aria-current={active ? "page" : undefined}
                  className={cx("flex items-center justify-between rounded-lg px-2 py-1 transition-colors",
                    active ? "glow-nav bg-surface-container-high font-medium text-primary" : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface")}>
                  <span className="flex items-center gap-2"><item.icon className="h-4.5 w-4.5" /><span className="text-body-md">{item.label}</span></span>
                  <span className="flex items-center gap-1">
                    {item.key === "live" && running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" title="A task is running" />}
                    <kbd className="text-label-code text-on-surface-variant/70">G {item.chord.toUpperCase()}</kbd>
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-0.5 pt-1">
          <span className="px-1 font-mono text-label-code uppercase tracking-wider text-on-surface-variant">Infrastructure</span>
          <div className="flex items-center justify-between rounded-lg bg-surface-container-low px-2 py-1 text-on-surface-variant" title={`Backend API: ${API_URL}`}>
            <span className="flex min-w-0 items-center gap-1">
              <span className={cx("h-2 w-2 shrink-0 rounded-full", online ? "bg-primary" : ws.healthError ? "bg-error" : "animate-pulse bg-outline")} />
              <span className="truncate font-mono text-code-sm">{API_HOST}</span>
            </span>
            <span className={cx("rounded px-1.5 py-0.5 font-mono text-label-code", online ? "bg-surface-container-high text-secondary" : "bg-error-container/30 text-error")}>
              {online ? `${ws.health!.tools.length} tool${ws.health!.tools.length === 1 ? "" : "s"}` : ws.healthError ? "offline" : "…"}
            </span>
          </div>
          <button type="button" onClick={() => ws.setSettingsOpen(true)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 text-left text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface">
            <Settings className="h-4.5 w-4.5" /><span className="text-body-md">Settings</span>
          </button>
          <a href={`${API_URL}/docs`} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 rounded-lg px-2 py-1 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface">
            <BookOpen className="h-4.5 w-4.5" /><span className="text-body-md">API Documentation</span>
          </a>
        </div>
      </div>

      <button type="button" onClick={() => ws.setSettingsOpen(true)} title="Workspace settings"
        className="mt-4 flex flex-col gap-1 rounded-xl bg-surface-container-low p-1 text-left transition-colors hover:bg-surface-container">
        <span className="flex items-center justify-between">
          <span className="flex min-w-0 items-center gap-1">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-primary"><User className="h-4 w-4" /></span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-mono text-code-sm font-medium text-on-surface">Local workspace</span>
              <span className="truncate font-mono text-label-code text-on-surface-variant">
                {ws.health ? (ws.health.llm.enabled ? `${ws.health.llm.provider} · ${ws.health.llm.model}` : "rule-based parser") : "no sign-in required"}
              </span>
            </span>
          </span>
          {ws.health && (
            <span className="rounded-full bg-secondary-container/20 px-1.5 py-0.5 font-mono text-label-code font-semibold uppercase text-secondary">
              {ws.health.llm.enabled ? "LLM" : "Rules"}
            </span>
          )}
        </span>
        <span className="flex items-center justify-between px-0.5 pt-0.5 font-mono text-code-sm text-on-surface-variant">
          <span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-primary" />API latency</span>
          <span className={cx("font-medium", ws.latencyMs != null ? "text-primary" : "text-error")}>{ws.latencyMs != null ? `${ws.latencyMs}ms` : ws.healthError ? "offline" : "…"}</span>
        </span>
      </button>
    </aside>
  );
}
