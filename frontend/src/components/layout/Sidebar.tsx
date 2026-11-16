"use client";

import { useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, History, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Trash2, X } from "lucide-react";
import type { Health, TaskSummaryRow } from "@/lib/api";
import { FINISHED, hostOf } from "@/lib/taskState";
import { IconButton, Kbd, SectionLabel, StatusDot, cx } from "../ui/primitives";
import { LogoMark, Wordmark } from "./Logo";

export interface SidebarProps {
  history: TaskSummaryRow[];
  historyLoaded: boolean;
  saved: string[];
  activeId: string | null;
  health: Health | null;
  healthError: boolean;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onMobileClose: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSave: (id: string) => void;
  onOpenSettings: () => void;
}

function groupOf(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000;
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "Previous 7 days";
  return "Older";
}

function title(t: TaskSummaryRow) {
  return t.url ? hostOf(t.url) : t.prompt;
}

export function Sidebar(p: SidebarProps) {
  const [query, setQuery] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? p.history.filter((t) => t.prompt.toLowerCase().includes(q) || (t.url ?? "").toLowerCase().includes(q)) : p.history;
  }, [p.history, query]);

  const savedRows = filtered.filter((t) => p.saved.includes(t.id));
  const groups = useMemo(() => {
    const out: [string, TaskSummaryRow[]][] = [];
    for (const t of filtered) {
      const g = groupOf(t.created_at);
      const bucket = out.find(([k]) => k === g);
      if (bucket) bucket[1].push(t); else out.push([g, [t]]);
    }
    return out;
  }, [filtered]);

  const expandAnd = (fn?: () => void) => () => { if (p.collapsed) p.onToggleCollapse(); fn?.(); };
  const rail = p.collapsed;

  return (
    <>
      <div onClick={p.onMobileClose}
        className={cx("fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] transition-opacity md:hidden", p.mobileOpen ? "opacity-100" : "pointer-events-none opacity-0")} />

      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-line bg-panel transition-[transform,width] duration-200 ease-out",
          "md:static md:translate-x-0",
          p.mobileOpen ? "translate-x-0" : "-translate-x-full",
          rail ? "md:w-[60px]" : "md:w-[268px]",
        )}>
        {/* brand */}
        <div className={cx("flex h-14 items-center gap-2.5 px-3.5", rail && "md:justify-center md:px-0")}>
          <LogoMark />
          <div className={cx("flex min-w-0 flex-1 items-center justify-between", rail && "md:hidden")}>
            <Wordmark />
            <span className="hidden md:contents">
              <IconButton label="Collapse sidebar" onClick={p.onToggleCollapse}><PanelLeftClose className="h-4 w-4" /></IconButton>
            </span>
            <IconButton label="Close menu" onClick={p.onMobileClose} className="md:hidden"><X className="h-4 w-4" /></IconButton>
          </div>
        </div>

        {/* actions */}
        <div className={cx("space-y-1.5 px-3", rail && "md:px-2")}>
          <button onClick={p.onNew}
            className={cx("group flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-raised px-2.5 text-sm font-medium text-fg transition-colors hover:border-line-strong hover:bg-overlay",
              rail && "md:justify-center md:px-0")}
            title="New task">
            <Plus className="h-4 w-4 text-accent" />
            <span className={cx("flex-1 text-left", rail && "md:hidden")}>New task</span>
            {!rail && <span className="hidden lg:block"><Kbd>Alt N</Kbd></span>}
          </button>
          {rail ? (
            <div className="hidden flex-col items-center gap-1 pt-1 md:flex">
              <IconButton label="Search history" onClick={expandAnd(() => setTimeout(() => document.getElementById("history-search")?.focus(), 220))}><Search className="h-4 w-4" /></IconButton>
              <IconButton label="Saved results" onClick={expandAnd()}><Bookmark className="h-4 w-4" /></IconButton>
              <IconButton label="History" onClick={expandAnd()}><History className="h-4 w-4" /></IconButton>
            </div>
          ) : null}
          <label className={cx("flex h-8 items-center gap-2 rounded-lg px-2.5 text-subtle transition-colors",
            searchFocus ? "bg-raised ring-1 ring-line-strong" : "hover:bg-raised/60", rail && "md:hidden")}>
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input id="history-search" value={query} onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchFocus(true)} onBlur={() => setSearchFocus(false)}
              placeholder="Search tasks" className="min-w-0 flex-1 bg-transparent text-[13px] text-fg placeholder:text-subtle focus:outline-none" />
            {query && <button onClick={() => setQuery("")} aria-label="Clear search" className="hover:text-fg"><X className="h-3.5 w-3.5" /></button>}
          </label>
        </div>

        {/* lists */}
        <nav className={cx("mt-3 flex-1 overflow-y-auto px-2 pb-3", rail && "md:invisible")}>
          {savedRows.length > 0 && (
            <div className="mb-3">
              <SectionLabel className="flex items-center gap-1.5 px-2 py-1.5"><BookmarkCheck className="h-3 w-3" /> Saved results</SectionLabel>
              {savedRows.map((t) => <Row key={`s-${t.id}`} t={t} {...p} isSaved />)}
            </div>
          )}

          {!p.historyLoaded && (
            <div className="space-y-1.5 px-2 pt-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-8 animate-pulse rounded-md bg-raised/60" />)}
            </div>
          )}
          {p.historyLoaded && p.history.length === 0 && (
            <div className="mx-2 mt-2 rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs leading-relaxed text-subtle">
              Your task history will appear here. Every run is stored with its full execution log.
            </div>
          )}
          {p.historyLoaded && p.history.length > 0 && filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-subtle">No tasks match “{query}”.</div>
          )}
          {groups.map(([g, rows]) => (
            <div key={g} className="mb-3">
              <SectionLabel className="px-2 py-1.5">{g}</SectionLabel>
              {rows.map((t) => <Row key={t.id} t={t} {...p} isSaved={p.saved.includes(t.id)} />)}
            </div>
          ))}
        </nav>

        {/* footer */}
        <div className={cx("border-t border-line p-2", rail && "md:flex md:flex-col md:items-center md:gap-1")}>
          {rail && (
            <span className="hidden md:contents">
              <IconButton label="Expand sidebar" onClick={p.onToggleCollapse}><PanelLeftOpen className="h-4 w-4" /></IconButton>
            </span>
          )}
          <button onClick={p.onOpenSettings} title="Settings & workspace"
            className={cx("flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-raised", rail && "md:w-auto md:justify-center")}>
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#2b2e3d] to-[#1d1f29] text-[11px] font-semibold text-fg ring-1 ring-line-strong">
              LW
              <span className={cx("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-panel",
                p.healthError ? "bg-bad" : p.health ? "bg-ok" : "bg-subtle")} />
            </span>
            <span className={cx("min-w-0 flex-1", rail && "md:hidden")}>
              <span className="block truncate text-[13px] font-medium text-fg">Local workspace</span>
              <span className="block truncate text-[11px] text-subtle">
                {p.healthError ? "Backend unreachable" : p.health ? (p.health.llm.enabled ? `AI: ${p.health.llm.provider} · ${p.health.llm.model}` : "AI: rule-based mode") : "Connecting…"}
              </span>
            </span>
            <Settings className={cx("h-4 w-4 shrink-0 text-subtle", rail && "md:hidden")} />
          </button>
        </div>
      </aside>
    </>
  );
}

function Row({ t, activeId, onOpen, onDelete, onToggleSave, isSaved }: SidebarProps & { t: TaskSummaryRow; isSaved: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const active = activeId === t.id;
  const canDelete = FINISHED.includes(t.status);
  return (
    <div className={cx("group relative flex items-center rounded-md transition-colors", active ? "bg-overlay" : "hover:bg-raised")}
      onMouseLeave={() => setConfirming(false)}>
      <button onClick={() => onOpen(t.id)} title={t.prompt}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-[7px] text-left">
        <StatusDot status={t.status} />
        <span className={cx("min-w-0 flex-1 truncate text-[13px]", active ? "text-fg" : "text-muted group-hover:text-fg")}>{title(t)}</span>
      </button>
      <div className={cx("flex shrink-0 items-center pr-1", confirming ? "flex" : "hidden group-focus-within:flex group-hover:flex", isSaved && !confirming && "flex")}>
        {confirming ? (
          <button onClick={() => { setConfirming(false); onDelete(t.id); }}
            className="rounded px-1.5 py-0.5 text-[11px] font-medium text-bad hover:bg-bad/10">Delete?</button>
        ) : (
          <>
            <button onClick={() => onToggleSave(t.id)} aria-label={isSaved ? "Remove from saved" : "Save result"} title={isSaved ? "Remove from saved" : "Save result"}
              className={cx("rounded p-1 hover:bg-overlay", isSaved ? "text-accent" : "text-subtle hover:text-fg")}>
              {isSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            </button>
            {canDelete && (
              <button onClick={() => setConfirming(true)} aria-label="Delete task" title="Delete task"
                className="hidden rounded p-1 text-subtle hover:bg-overlay hover:text-bad group-hover:block">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
