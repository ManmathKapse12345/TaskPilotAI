"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { API_URL } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { Dialog } from "../ui/Dialog";
import { Button, SectionLabel, cx } from "../ui/primitives";
import { useToast } from "../ui/Toast";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-body-md">
      <span className="text-on-surface-variant">{label}</span>
      <span className="min-w-0 truncate text-right text-on-surface">{children}</span>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span>
        <span className="block text-body-md text-on-surface">{label}</span>
        <span className="block text-body-sm text-on-surface-variant">{hint}</span>
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange?.(!checked)}
      className={cx("relative mt-0.5 h-4 w-8 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed",
        checked ? "bg-primary-container" : "bg-surface-container-highest", disabled && "opacity-60")}>
      <span className={cx("absolute left-px top-px h-3.5 w-3.5 rounded-full transition-transform", checked ? "translate-x-4 bg-on-primary" : "translate-x-0 bg-outline")} />
    </button>
  );
}

export function SettingsDialog() {
  const ws = useWorkspace();
  const toast = useToast();
  const { health, healthError, prefs, setPrefs } = ws;

  return (
    <Dialog open={ws.settingsOpen} onClose={() => ws.setSettingsOpen(false)} title="Settings" description="Workspace connection and display preferences">
      <SectionLabel className="mb-1">Workspace</SectionLabel>
      <div className="mb-5 divide-y divide-line">
        <Row label="Profile">Local workspace <span className="text-on-surface-variant">(no sign-in required)</span></Row>
        <Row label="Backend API"><span className="font-mono text-code-sm">{API_URL}</span></Row>
        <Row label="Status">
          <span className={cx("inline-flex items-center gap-1.5", healthError ? "text-error" : health ? "text-primary" : "text-on-surface-variant")}>
            <span className={cx("h-1.5 w-1.5 rounded-full", healthError ? "bg-error" : health ? "bg-primary" : "bg-outline")} />
            {healthError ? "Unreachable" : health ? `Online${ws.latencyMs != null ? ` · ${ws.latencyMs}ms` : ""}` : "Checking…"}
          </span>
        </Row>
        {health && (
          <>
            <Row label="AI layer">{health.llm.enabled ? `${health.llm.provider} · ${health.llm.model}` : "Rule-based parser + extractive summaries"}</Row>
            <Row label="Approved CLI tools"><span className="font-mono text-code-sm">{health.tools.join(", ")}</span></Row>
            <Row label="Limits">{health.limits.max_pages} pages · depth {health.limits.max_depth} · {health.limits.cli_timeout_s}s · {health.limits.max_concurrent_tasks} parallel</Row>
          </>
        )}
      </div>
      <Button icon={<RefreshCw className="h-3.5 w-3.5" />} className="mb-6"
        onClick={() => { ws.pingHealth(); toast({ tone: "info", title: "Checking backend…" }); }}>
        Re-check connection
      </Button>

      <SectionLabel className="mb-1">Preferences</SectionLabel>
      <div className="mb-5 divide-y divide-line">
        <Toggle label="Follow live output" hint="Keep the terminal scrolled to the newest line while a task runs." checked={prefs.autoScroll} onChange={(v) => setPrefs({ autoScroll: v })} />
      </div>

      <SectionLabel className="mb-1">Saved results</SectionLabel>
      <div className="flex items-center justify-between gap-4 py-2 text-body-md">
        <span className="text-on-surface-variant">{ws.saved.length} saved in this browser</span>
        <Button variant="danger" onClick={() => { ws.clearSaved(); toast({ tone: "success", title: "Saved results cleared" }); }} disabled={!ws.saved.length}>Clear saved</Button>
      </div>
    </Dialog>
  );
}
