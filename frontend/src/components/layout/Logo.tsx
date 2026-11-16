import { cx } from "../ui/primitives";

/** TaskPilot mark: a prompt chevron flowing into an execution path. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cx("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-white/10 bg-[#1b1d27] shadow-[inset_0_1px_0_#ffffff14]", className)}>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 7l4.5 5L5 17" stroke="#ececf1" strokeWidth="2.2" />
        <path d="M12.5 17h3.5a3 3 0 0 0 3-3V8" stroke="#8b9bff" strokeWidth="2.2" />
        <circle cx="19" cy="6.2" r="1.6" fill="#8b9bff" />
      </svg>
    </span>
  );
}

export function Wordmark() {
  return (
    <div className="min-w-0 leading-tight">
      <div className="truncate text-[13px] font-semibold tracking-tight text-fg">TaskPilot</div>
      <div className="truncate text-[11px] text-subtle">Chat-to-CLI execution</div>
    </div>
  );
}
