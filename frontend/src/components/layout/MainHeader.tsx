"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Search, Settings, SquareTerminal, User } from "lucide-react";
import { hostOf } from "@/lib/taskState";
import { useWorkspace } from "@/lib/workspace";
import { cx, shortId } from "../ui/primitives";
import type { NavItem } from "./nav";

/** Desktop header (lg+) and compact mobile header, both sticky inside the scrolling main column. */
export function MainHeader({ nav }: { nav: NavItem }) {
  const ws = useWorkspace();
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const active = ws.activeId;
  const url = active ? ws.tasks[active]?.plan?.url ?? ws.history.find((t) => t.id === active)?.url : null;
  const online = !!ws.health && !ws.healthError;

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/history?q=${encodeURIComponent(q.trim())}` : "/history");
    inputRef.current?.blur();
  };

  return (
    <header className="sticky top-0 z-40 bg-surface-container-lowest/80 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      {/* desktop */}
      <div className="hidden h-14 items-center justify-between gap-3 px-8 lg:flex">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 items-center gap-1 truncate font-mono text-code-sm text-on-surface-variant">
            {active ? (
              <>
                <Link href={`/live?id=${active}`} className="font-medium text-on-surface hover:text-primary">{shortId(active)}</Link>
                {url && <><span>/</span><span className="truncate">{hostOf(url)}</span></>}
              </>
            ) : <span className="text-on-surface">{nav.title}</span>}
          </div>
          <button type="button" onClick={() => ws.setSettingsOpen(true)} title="Backend connection details"
            className="hidden items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 xl:flex">
            <span className={cx("h-2 w-2 rounded-full", online ? "bg-primary" : ws.healthError ? "bg-error" : "animate-pulse bg-outline")} />
            <span className={cx("font-mono text-code-sm font-medium", online ? "text-primary" : ws.healthError ? "text-error" : "text-on-surface-variant")}>
              {online ? "Backend Online" : ws.healthError ? "Backend Offline" : "Connecting…"}
            </span>
            {ws.latencyMs != null && <span className="font-mono text-label-code text-on-surface-variant">{ws.latencyMs}ms</span>}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <form onSubmit={search} role="search"
            className="flex w-64 items-center gap-1 rounded-lg bg-surface-container-low px-2 py-1.5 text-on-surface-variant focus-within:ring-1 focus-within:ring-primary/40">
            <Search className="h-4 w-4 shrink-0" />
            <input ref={inputRef} id="global-search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tasks"
              placeholder="Search tasks, URLs, IDs…"
              className="w-full border-0 bg-transparent text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant" />
            <kbd className="rounded bg-surface-container-high px-1.5 py-0.5 text-label-code text-on-surface-variant">/</kbd>
          </form>
          <Link href={active ? `/live?id=${active}` : "/live"} title="Live CLI Execution" aria-label="Live CLI Execution"
            className="flex items-center justify-center rounded-lg bg-surface-container-low p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface">
            <SquareTerminal className="h-4.5 w-4.5" />
          </Link>
          <button type="button" onClick={() => ws.setSettingsOpen(true)} aria-label="Settings" title="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary transition-transform hover:scale-105">
            <User className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* mobile / tablet */}
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:hidden">
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-label-code uppercase tracking-wider text-primary">TaskPilot AI</span>
          <span className="truncate text-headline-sm font-semibold tracking-tight text-on-surface">{nav.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span title={online ? "Backend online" : "Backend offline"}
            className={cx("flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-1 font-mono text-label-code", online ? "text-primary" : "text-error")}>
            <span className={cx("h-1.5 w-1.5 rounded-full", online ? "bg-primary" : ws.healthError ? "bg-error" : "animate-pulse bg-outline")} />
            {online ? (ws.latencyMs != null ? `${ws.latencyMs}ms` : "online") : ws.healthError ? "offline" : "…"}
          </span>
          <button type="button" onClick={() => ws.setSettingsOpen(true)} aria-label="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-on-primary">
            <Settings className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
