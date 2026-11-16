import { Fragment, type ReactNode } from "react";

/** Breadcrumb + H1 + status pill on the left, utility controls on the right (Stitch "Top Global Action Strip"). */
export function PageHeading({ crumbs, title, badge, actions }: { crumbs: ReactNode[]; title: ReactNode; badge?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-3 pb-1 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-code-sm text-on-surface-variant">
          {crumbs.map((c, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="text-outline-variant">/</span>}
              <span className={i === crumbs.length - 1 ? "font-medium text-primary" : undefined}>{c}</span>
            </Fragment>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-headline-lg font-semibold tracking-tight text-on-surface">{title}</h1>
          {badge}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-1 self-start lg:self-auto">{actions}</div>}
    </div>
  );
}

export function LivePill({ tone = "primary", ping, children }: { tone?: "primary" | "error" | "outline" | "secondary"; ping?: boolean; children: ReactNode }) {
  const dot = { primary: "bg-primary", error: "bg-error", outline: "bg-outline", secondary: "bg-secondary" }[tone];
  return (
    <span className="flex items-center gap-1 rounded-full bg-surface-container-low px-2.5 py-0.5">
      <span className="relative flex h-2 w-2">
        {ping && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dot}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      {children}
    </span>
  );
}

/** Segmented pill group (Stitch "Config | Live Graph | Audit Trail"). */
export function Segmented<T extends string>({ items, value, onChange, className }: {
  items: { key: T; label: ReactNode }[]; value: T; onChange: (k: T) => void; className?: string;
}) {
  return (
    <div role="tablist" className={`flex items-center gap-0.5 overflow-x-auto rounded-lg bg-surface-container-lowest p-1 no-scrollbar ${className ?? ""}`}>
      {items.map((it) => (
        <button key={it.key} type="button" role="tab" aria-selected={value === it.key} onClick={() => onChange(it.key)}
          className={value === it.key
            ? "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded bg-surface-container px-3 py-1.5 text-label-md font-medium text-on-surface shadow-sm"
            : "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-label-md font-medium text-on-surface-variant transition-colors hover:text-on-surface"}>
          {it.label}
        </button>
      ))}
    </div>
  );
}
