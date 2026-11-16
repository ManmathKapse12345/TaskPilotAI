"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { API_URL, type Health } from "@/lib/api";
import type { Prefs } from "@/lib/prefs";
import { Dialog } from "../ui/Dialog";
import { Button, SectionLabel, cx } from "../ui/primitives";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-[13px]">
      <span className="text-subtle">{label}</span>
      <span className="min-w-0 truncate text-right text-fg">{children}</span>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2.5">
      <span>
        <span className="block text-[13px] text-fg">{label}</span>
        <span className="block text-xs text-subtle">{hint}</span>
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cx("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-overlay ring-1 ring-line-strong")}>
        <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
      </button>
    </label>
  );
}

export function SettingsDialog({ open, onClose, health, healthError, onRecheck, prefs, setPrefs, savedCount, onClearSaved }: {
  open: boolean; onClose: () => void;
  health: Health | null; healthError: boolean; onRecheck: () => void;
  prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void;
  savedCount: number; onClearSaved: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Settings" description="Workspace connection and display preferences">
      <SectionLabel className="mb-1">Workspace</SectionLabel>
      <div className="mb-5 divide-y divide-line">
        <Row label="Profile">Local workspace <span className="text-subtle">(no sign-in required)</span></Row>
        <Row label="Backend API"><span className="font-mono text-xs">{API_URL}</span></Row>
        <Row label="Status">
          <span className={cx("inline-flex items-center gap-1.5", healthError ? "text-bad" : health ? "text-ok" : "text-subtle")}>
            <span className={cx("h-1.5 w-1.5 rounded-full", healthError ? "bg-bad" : health ? "bg-ok" : "bg-subtle")} />
            {healthError ? "Unreachable" : health ? "Online" : "Checking…"}
          </span>
        </Row>
        {health && (
          <>
            <Row label="AI layer">{health.llm.enabled ? `${health.llm.provider} · ${health.llm.model}` : "Rule-based parser + extractive summaries"}</Row>
            <Row label="Approved CLI tools"><span className="font-mono text-xs">{health.tools.join(", ")}</span></Row>
            <Row label="Limits">{health.limits.max_pages} pages · depth {health.limits.max_depth} · {health.limits.cli_timeout_s}s · {health.limits.max_concurrent_tasks} parallel</Row>
          </>
        )}
      </div>
      <Button icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRecheck} className="mb-6">Re-check connection</Button>

      <SectionLabel className="mb-1">Preferences</SectionLabel>
      <div className="mb-5 divide-y divide-line">
        <Toggle label="Follow live output" hint="Scroll to the newest activity while a task runs." checked={prefs.autoScroll} onChange={(v) => setPrefs({ autoScroll: v })} />
        <Toggle label="Expand execution details" hint="Show the pipeline, command and logs for new tasks." checked={prefs.expandExecution} onChange={(v) => setPrefs({ expandExecution: v })} />
        <Toggle label="Compact sidebar" hint="Collapse the sidebar to an icon rail on desktop." checked={prefs.sidebarCollapsed} onChange={(v) => setPrefs({ sidebarCollapsed: v })} />
      </div>

      <SectionLabel className="mb-1">Saved results</SectionLabel>
      <div className="flex items-center justify-between gap-4 py-2 text-[13px]">
        <span className="text-muted">{savedCount} saved in this browser</span>
        <Button variant="danger" onClick={onClearSaved} disabled={!savedCount}>Clear saved</Button>
      </div>
    </Dialog>
  );
}
