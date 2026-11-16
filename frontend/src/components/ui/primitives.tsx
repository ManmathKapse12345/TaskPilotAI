"use client";

import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2, RotateCw, XCircle } from "lucide-react";
import type { TaskStatus } from "@/lib/api";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary-container text-on-primary-container hover:bg-primary glow-primary active:scale-[0.98]",
  secondary: "bg-surface-container text-on-surface hover:bg-surface-container-high",
  quiet: "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
  ghost: "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
  danger: "bg-error-container/30 text-error hover:bg-error-container/50 active:scale-95",
};
const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 gap-1.5",
  md: "h-8 px-3 gap-1.5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, className, children, type = "button", ...rest }, ref,
) {
  return (
    <button ref={ref} type={type}
      className={cx("inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg text-label-md font-medium transition-all",
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
      className={cx("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-40", className)}
      {...rest}>
      {children}
    </button>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cx("rounded bg-surface-container-high px-1.5 py-0.5 text-label-code text-on-surface-variant", className)}>{children}</kbd>;
}

export function Chip({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "secondary" | "tertiary"; className?: string }) {
  const tones = {
    neutral: "bg-surface-container-high text-on-surface-variant",
    accent: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    tertiary: "bg-tertiary-container/30 text-tertiary",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-label-code", tones[tone], className)}>
      {children}
    </span>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("font-mono text-label-code uppercase tracking-wider text-on-surface-variant", className)}>{children}</div>;
}

/** Stitch card: tonal surface, no border, 8px radius. */
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cx("flex flex-col rounded-xl bg-surface-container-low p-3 shadow-md", className)} {...rest}>{children}</section>;
}

export function CardTitle({ icon, children, right, className }: { icon?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-center justify-between gap-2", className)}>
      <div className="flex min-w-0 items-center gap-1.5">
        {icon}
        <h2 className="truncate text-headline-sm font-semibold tracking-tight text-on-surface">{children}</h2>
      </div>
      {right}
    </div>
  );
}

/* ---------- Status ---------- */

export const STATUS_META: Record<TaskStatus, { label: string; text: string; bg: string; dot: string }> = {
  queued: { label: "Queued", text: "text-on-surface-variant", bg: "bg-surface-container-high", dot: "bg-outline" },
  running: { label: "Running", text: "text-secondary", bg: "bg-secondary-container/20", dot: "bg-secondary animate-pulse" },
  completed: { label: "Completed", text: "text-primary", bg: "bg-primary/10", dot: "bg-primary" },
  partial: { label: "Partial", text: "text-warn", bg: "bg-warn/10", dot: "bg-warn" },
  failed: { label: "Failed", text: "text-error", bg: "bg-error-container/30", dot: "bg-error" },
  cancelled: { label: "Cancelled", text: "text-on-surface-variant", bg: "bg-surface-container-high", dot: "bg-outline" },
  answered: { label: "Answered", text: "text-tertiary", bg: "bg-tertiary-container/20", dot: "bg-tertiary" },
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const s = STATUS_META[status] ?? STATUS_META.queued;
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-label-code font-semibold uppercase tracking-wide", s.bg, s.text, className)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function StatusDot({ status, className }: { status: TaskStatus; className?: string }) {
  return <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", (STATUS_META[status] ?? STATUS_META.queued).dot, className)} />;
}

/* ---------- States ---------- */

export function EmptyState({ icon, title, children, action, className }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center justify-center rounded-xl bg-surface-container-low px-6 py-12 text-center", className)}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-high text-primary">{icon}</div>
      <div className="text-headline-sm font-semibold text-on-surface">{title}</div>
      {children && <div className="mt-1 max-w-md text-body-sm text-on-surface-variant">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cx("flex items-center justify-center gap-2 rounded-xl bg-surface-container-low px-6 py-12 font-mono text-code-sm text-on-surface-variant", className)}>
      <Loader2 className="h-4 w-4 animate-spin text-primary" /> {label}
    </div>
  );
}

export function ErrorState({ title, children, onRetry, className }: { title: string; children?: ReactNode; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cx("flex items-start gap-3 rounded-xl bg-error-container/20 p-3", className)}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
      <div className="min-w-0 flex-1">
        <div className="text-body-md font-semibold text-error">{title}</div>
        {children && <div className="mt-0.5 break-words text-body-sm text-on-surface-variant">{children}</div>}
        {onRetry && <Button size="sm" className="mt-2" icon={<RotateCw className="h-3.5 w-3.5" />} onClick={onRetry}>Try again</Button>}
      </div>
    </div>
  );
}

export function SuccessState({ title, children, tone = "success" }: { title: string; children?: ReactNode; tone?: "success" | "failure" }) {
  const Icon = tone === "success" ? CheckCircle2 : XCircle;
  return (
    <div className={cx("flex items-start gap-3 rounded-xl p-3", tone === "success" ? "bg-primary/[0.06]" : "bg-error-container/20")}>
      <Icon className={cx("mt-0.5 h-4 w-4 shrink-0", tone === "success" ? "text-primary" : "text-error")} />
      <div className="min-w-0 flex-1">
        <div className="text-body-md font-semibold text-on-surface">{title}</div>
        {children && <div className="mt-0.5 break-words text-body-sm text-on-surface-variant">{children}</div>}
      </div>
    </div>
  );
}

/* ---------- Formatting ---------- */

export function formatMs(ms?: number | null) {
  if (ms == null) return "–";
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** mm:ss.cc stopwatch, as used in the live telemetry strip. */
export function formatClock(ms?: number | null) {
  if (ms == null) return "--:--.--";
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60_000);
  const s = Math.floor((t % 60_000) / 1000);
  const cs = Math.floor((t % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function formatBytes(n?: number | null) {
  if (n == null) return "–";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function clockTime(tsSeconds: number, ms = false) {
  const d = new Date(tsSeconds * 1000);
  const base = d.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return ms ? `${base}.${String(d.getMilliseconds()).padStart(3, "0")}` : base;
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 45) return "Just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  if (s < 172_800) return "Yesterday";
  return `${Math.round(s / 86_400)}d ago`;
}

export function shortId(id: string) {
  return `tp-${id.replace(/-/g, "").slice(0, 6)}`;
}
