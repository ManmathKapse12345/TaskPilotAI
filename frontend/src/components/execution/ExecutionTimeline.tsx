"use client";

import { useEffect, useState } from "react";
import type { StageView } from "@/lib/taskState";
import { StageIcon, clockTime, cx, formatMs } from "../ui/primitives";

export function useNow(active: boolean, every = 250) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now() / 1000), every);
    return () => clearInterval(t);
  }, [active, every]);
  return now;
}

/** Vertical stage list driven only by backend events (see displayStages in lib/taskState.ts). */
export function ExecutionTimeline({ stages }: { stages: StageView[] }) {
  const running = stages.some((s) => s.status === "running");
  const now = useNow(running);

  return (
    <ol className="relative">
      {stages.map((s, i) => {
        const last = i === stages.length - 1;
        const dur = s.startedAt != null
          ? s.endedAt != null ? (s.endedAt - s.startedAt) * 1000 : s.status === "running" ? (now - s.startedAt) * 1000 : null
          : null;
        const dim = s.status === "pending" || s.status === "skipped";
        return (
          <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && (
              <span className={cx("absolute left-[9.5px] top-6 bottom-0 w-px",
                s.status === "done" ? "bg-ok/30" : s.status === "failed" ? "bg-bad/30" : "bg-line-strong")} />
            )}
            <StageIcon status={s.status} className="relative z-[1] mt-px bg-surface" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className={cx("text-[13px] font-medium", dim ? "text-subtle" : "text-fg")}>
                  <span className="mr-1.5 font-mono text-[11px] text-subtle">{String(i + 1).padStart(2, "0")}</span>
                  {s.label}
                </span>
                {dur != null && s.status !== "skipped" && (
                  <span className={cx("shrink-0 font-mono text-[11px] tabular-nums", s.status === "running" ? "text-accent" : "text-subtle")}>
                    {formatMs(dur)}
                  </span>
                )}
              </div>
              {s.status === "running" && <div className="shimmer-line mt-1.5 h-px w-full rounded" />}
              {(s.detail || s.startedAt) && (
                <div className={cx("mt-0.5 break-words text-xs leading-relaxed",
                  s.status === "failed" ? "text-bad/90" : s.status === "warning" ? "text-warn/90" : "text-subtle")}>
                  {s.startedAt != null && s.status !== "skipped" && <span className="mr-1.5 font-mono text-[10.5px] text-subtle/80">{clockTime(s.startedAt)}</span>}
                  {s.detail}
                </div>
              )}
              {!s.detail && s.status === "skipped" && <div className="mt-0.5 text-xs text-subtle">Skipped</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
