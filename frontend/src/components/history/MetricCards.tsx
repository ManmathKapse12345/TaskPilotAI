"use client";

import { Activity, Cpu, Layers, Timer } from "lucide-react";
import type { TaskSummaryRow } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { cx, formatMs } from "../ui/primitives";

const DAY = 86_400_000;

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function Card({ icon, title, badge, value, sub, children }: { icon: React.ReactNode; title: string; badge?: React.ReactNode; value: React.ReactNode; sub: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-surface-container-low p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-label-code uppercase tracking-wider text-on-surface-variant">{icon}{title}</span>
        {badge}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-headline-xl font-semibold tracking-tight text-on-surface tabular-nums">{value}</div>
          <div className="mt-0.5 truncate font-mono text-code-sm text-on-surface-variant">{sub}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Stitch "Cluster Telemetry Metric Cards", computed from the stored task history (GET /api/tasks). */
export function MetricCards({ rows }: { rows: TaskSummaryRow[] }) {
  const { health } = useWorkspace();
  // eslint-disable-next-line react-hooks/purity -- relative time buckets; re-evaluated on each history refresh
  const now = Date.now();

  // tasks per day, last 7 days (oldest -> newest)
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const start = new Date(now - (6 - i) * DAY); start.setHours(0, 0, 0, 0);
    const end = start.getTime() + DAY;
    return rows.filter((t) => { const c = new Date(t.created_at).getTime(); return c >= start.getTime() && c < end; }).length;
  });
  const week = perDay.reduce((a, b) => a + b, 0);
  const maxDay = Math.max(1, ...perDay);
  const pts = perDay.map((v, i) => `${(i / 6) * 100},${32 - (v / maxDay) * 28}`);

  const cli = rows.filter((t) => ["completed", "partial", "failed"].includes(t.status)); // user-cancelled runs are not failures
  const ok = cli.filter((t) => t.status === "completed").length;
  const partial = cli.filter((t) => t.status === "partial").length;
  const rate = cli.length ? ((ok + partial) / cli.length) * 100 : null;
  const C = 2 * Math.PI * 14;

  const durs = rows.map((t) => t.duration_ms).filter((d): d is number => d != null).sort((a, b) => a - b);
  const p50 = percentile(durs, 50);
  const p95 = percentile(durs, 95);
  const recent = rows.filter((t) => t.duration_ms != null).slice(0, 5).reverse();
  const maxRecent = Math.max(1, ...recent.map((t) => t.duration_ms!));

  const running = rows.filter((t) => t.status === "running" || t.status === "queued").length;
  const slots = health?.limits.max_concurrent_tasks ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card icon={<Layers className="h-3.5 w-3.5 text-primary" />} title="Total Tasks"
        badge={<span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-label-code font-semibold text-primary">{week} this week</span>}
        value={rows.length.toLocaleString()} sub="most recent tasks">
        <svg className="h-9 w-24 text-primary" fill="none" preserveAspectRatio="none" viewBox="0 0 100 36" aria-label="Tasks per day, last 7 days">
          <defs><linearGradient id="tp-spark" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.3" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
          <path d={`M${pts.join(" L")} L100,36 L0,36 Z`} fill="url(#tp-spark)" />
          <path d={`M${pts.join(" L")}`} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </Card>

      <Card icon={<Activity className="h-3.5 w-3.5 text-secondary" />} title="Success rate"
        badge={<span className="rounded-full bg-secondary-container/20 px-1.5 py-0.5 font-mono text-label-code text-secondary">{partial} partial</span>}
        value={rate == null ? "–" : `${rate.toFixed(1)}%`} sub={`${ok + partial} of ${cli.length} website tasks succeeded`}>
        <div className="relative flex h-12 w-12 items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden>
            <circle className="text-surface-container-high" cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" />
            <circle className="text-secondary" cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - (rate ?? 0) / 100)} />
          </svg>
          <span className="absolute font-mono text-label-code font-semibold text-on-surface">{rate == null ? "–" : `${Math.round(rate)}%`}</span>
        </div>
      </Card>

      <Card icon={<Timer className="h-3.5 w-3.5 text-tertiary" />} title="Typical run time"
        badge={<span className="rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-label-code text-on-surface-variant" title="95% of tasks finish faster than this">slowest: {formatMs(p95)}</span>}
        value={formatMs(p50)} sub={`median of ${durs.length} runs`}>
        <div className="flex h-9 items-end gap-1" aria-label="Last five runtimes">
          {recent.map((t) => (
            <span key={t.id} title={formatMs(t.duration_ms)}
              className={cx("w-2 rounded-t", t.duration_ms === maxRecent ? "bg-tertiary" : "bg-surface-container-high")}
              style={{ height: `${Math.max(12, (t.duration_ms! / maxRecent) * 100)}%` }} />
          ))}
        </div>
      </Card>

      <Card icon={<Cpu className="h-3.5 w-3.5 text-primary" />} title="Running now"
        badge={<span className={cx("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-label-code", running ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary")}>
          <span className={cx("h-1.5 w-1.5 rounded-full", running ? "animate-pulse bg-secondary" : "bg-primary")} />{running ? "Busy" : "Idle"}</span>}
        value={slots ? `${running} / ${slots}` : String(running)} sub={slots ? <>Slots in use: <span className="font-medium text-primary">{Math.round((running / slots) * 100)}%</span></> : "backend limits unavailable"}>
        {slots > 0 && (
          <div className="grid grid-cols-4 gap-1" aria-hidden>
            {Array.from({ length: Math.min(slots, 16) }, (_, i) => <span key={i} className={cx("h-2.5 w-2.5 rounded", i < running ? "bg-secondary" : "bg-primary/30")} />)}
          </div>
        )}
      </Card>
    </div>
  );
}
