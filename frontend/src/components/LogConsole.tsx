"use client";

import { useEffect, useRef } from "react";
import type { LogLine } from "@/lib/taskState";
import { cx } from "./ui";

const LEVEL_COLOR: Record<string, string> = {
  error: "text-rose-400", warning: "text-amber-300", info: "text-slate-300",
};

/** Terminal-style view of the CLI's stderr progress stream. */
export function LogConsole({ logs, tall }: { logs: LogLine[]; tall?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [logs.length]);
  return (
    <div ref={ref} className={cx("overflow-auto rounded-md bg-black/60 p-3 font-mono text-[11px] leading-5 ring-1 ring-slate-800", tall ? "max-h-96" : "max-h-48")}>
      {logs.length === 0 && <div className="text-slate-600">waiting for CLI output…</div>}
      {logs.map((l, i) => (
        <div key={i} className="flex gap-2">
          <span className="shrink-0 text-slate-600">{new Date(l.ts * 1000).toLocaleTimeString([], { hour12: false })}</span>
          <span className={cx("w-12 shrink-0", l.kind === "page" ? "text-emerald-400" : LEVEL_COLOR[l.level] ?? "text-slate-400")}>
            {l.kind === "page" ? "PAGE" : l.level.toUpperCase()}
          </span>
          <span className={cx("break-all", LEVEL_COLOR[l.level] ?? "text-slate-300")}>{l.msg}</span>
        </div>
      ))}
    </div>
  );
}
