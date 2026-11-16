import { cx } from "../ui/primitives";

/** TaskPilot mark: a prompt chevron flowing into an execution path. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cx("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-high shadow-[0_0_12px_-2px_rgba(16,185,129,0.3)]", className)}>
      <svg viewBox="0 0 24 24" className="size-4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 7l4.5 5L5 17" stroke="#dae2fd" strokeWidth="2.2" />
        <path d="M12.5 17h3.5a3 3 0 0 0 3-3V8" stroke="#4edea3" strokeWidth="2.2" />
        <circle cx="19" cy="6.2" r="1.6" fill="#4edea3" />
      </svg>
    </span>
  );
}

export function Wordmark({ sub }: { sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center gap-1">
        <span className="truncate text-headline-sm font-semibold tracking-tight text-on-surface">TaskPilot</span>
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-label-code uppercase text-primary">AI</span>
      </div>
      {sub && <span className="truncate font-mono text-code-sm text-on-surface-variant">{sub}</span>}
    </div>
  );
}
