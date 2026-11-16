"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, Check, CircleDashed, Loader2, X } from "lucide-react";
import type { StageStatus, TaskStatus } from "@/lib/api";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-[#0c0d10] hover:bg-[#a3b0ff] font-semibold shadow-[0_0_0_1px_#ffffff14_inset]",
  secondary: "bg-raised text-fg border border-line hover:border-line-strong hover:bg-overlay",
  ghost: "text-muted hover:text-fg hover:bg-raised",
  danger: "bg-bad/10 text-bad border border-bad/25 hover:bg-bad/15",
};
const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "sm", icon, className, children, type = "button", ...rest }, ref,
) {
  return (
    <button ref={ref} type={type}
      className={cx("inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-40", VARIANTS[variant], SIZES[size], className)}
      {...rest}>
      {icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={cx("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-raised hover:text-fg disabled:opacity-40", className)}
      {...rest}>
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-raised px-1.5 py-px font-mono text-[10px] text-subtle">{children}</kbd>;
}

export function Chip({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent"; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium",
      tone === "accent" ? "bg-accent-soft text-accent" : "border border-line bg-raised text-muted", className)}>
      {children}
    </span>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("text-[11px] font-medium uppercase tracking-[0.08em] text-subtle", className)}>{children}</div>;
}

/* ---------- Status ---------- */

export const STATUS_META: Record<TaskStatus, { label: string; text: string; bg: string; dot: string }> = {
  queued: { label: "Queued", text: "text-muted", bg: "bg-white/5", dot: "bg-subtle" },
  running: { label: "Running", text: "text-accent", bg: "bg-accent-soft", dot: "bg-accent animate-pulse" },
  completed: { label: "Completed", text: "text-ok", bg: "bg-ok/10", dot: "bg-ok" },
  partial: { label: "Partial", text: "text-warn", bg: "bg-warn/10", dot: "bg-warn" },
  failed: { label: "Failed", text: "text-bad", bg: "bg-bad/10", dot: "bg-bad" },
  cancelled: { label: "Cancelled", text: "text-muted", bg: "bg-white/5", dot: "bg-subtle" },
  answered: { label: "Answered", text: "text-muted", bg: "bg-white/5", dot: "bg-muted" },
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const s = STATUS_META[status] ?? STATUS_META.queued;
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", s.bg, s.text, className)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function StatusDot({ status }: { status: TaskStatus }) {
  return <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", (STATUS_META[status] ?? STATUS_META.queued).dot)} />;
}

export function StageIcon({ status, className }: { status: StageStatus; className?: string }) {
  const base = cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-full", className);
  switch (status) {
    case "running":
      return <span className={cx(base, "bg-accent-soft text-accent")}><Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} /></span>;
    case "done":
      return <span className={cx(base, "bg-ok/15 text-ok")}><Check className="h-3 w-3" strokeWidth={3} /></span>;
    case "failed":
      return <span className={cx(base, "bg-bad/15 text-bad")}><X className="h-3 w-3" strokeWidth={3} /></span>;
    case "warning":
      return <span className={cx(base, "bg-warn/15 text-warn")}><AlertTriangle className="h-3 w-3" strokeWidth={2.5} /></span>;
    case "skipped":
      return <span className={cx(base, "text-subtle")}><CircleDashed className="h-4 w-4" /></span>;
    default:
      return <span className={cx(base, "border border-line-strong")} />;
  }
}

/* ---------- Formatting ---------- */

export function formatMs(ms?: number | null) {
  if (ms == null) return "–";
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function formatBytes(n?: number | null) {
  if (n == null) return "–";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function clockTime(tsSeconds: number) {
  return new Date(tsSeconds * 1000).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-raised text-subtle">{icon}</div>
      <div className="text-sm font-medium text-fg">{title}</div>
      {children && <div className="mt-1 max-w-sm text-xs leading-relaxed text-subtle">{children}</div>}
    </div>
  );
}
