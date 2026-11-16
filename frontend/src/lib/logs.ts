import type { TaskView } from "./taskState";

export type Stream = "system" | "stderr" | "stdout";
export type Level = "info" | "warning" | "error" | "success" | "page" | "debug";
export interface LogRow { ts: number; stream: Stream; level: Level; tag: string; msg: string; order: number }

function fmtMs(ms?: number) {
  if (ms == null) return "–";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
function fmtBytes(n: number) {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;
}

/** Merges the real execution events into one ordered log: system (process lifecycle), stderr (CLI progress), stdout (result). */
export function buildLogRows(t: TaskView): LogRow[] {
  const rows: LogRow[] = [];
  let order = 0;
  if (t.command) rows.push({ ts: t.command.ts, stream: "system", level: "info", tag: "EXEC", msg: `$ ${t.command.command}`, order: order++ });
  if (t.process) rows.push({ ts: t.process.startedTs, stream: "system", level: "success", tag: "CLI_INIT", msg: `process started · pid ${t.process.pid}`, order: order++ });
  for (const l of t.logs) {
    const level: Level = l.kind === "page" ? "page" : (["warning", "error", "debug"].includes(l.level) ? l.level : "info") as Level;
    const tag = (l.kind && l.kind !== "log" && l.kind !== "raw" ? l.kind : level === "warning" ? "warn" : level).toUpperCase();
    rows.push({ ts: l.ts, stream: l.stream === "stdout" ? "stdout" : "stderr", level, tag, msg: l.msg, order: order++ });
  }
  const p = t.process;
  if (p && !p.running && p.exitedTs) {
    const code = p.exitCode;
    const msg = p.cancelled ? `process killed (cancelled by user) after ${fmtMs(p.durationMs)}`
      : p.timedOut ? `process killed (timeout) after ${fmtMs(p.durationMs)}`
      : `process exited with code ${code} in ${fmtMs(p.durationMs)}`;
    rows.push({ ts: p.exitedTs, stream: "system", level: code === 0 ? "success" : code === 1 ? "warning" : "error", tag: "EXIT", msg, order: order++ });
    if (p.stdoutBytes) rows.push({ ts: p.exitedTs, stream: "stdout", level: "info", tag: "STDOUT", msg: `${fmtBytes(p.stdoutBytes)} JSON document captured (see Results & Schema)`, order: order++ });
  }
  return rows.sort((a, b) => a.ts - b.ts || a.order - b.order);
}

export interface PageHit { n: number; status: number | null; ms: number | null; title: string; ts: number }

/** Pages fetched so far, parsed from the crawler's `page` log events ("ok 200 in 123ms: Title"). */
export function pageHits(t: TaskView): PageHit[] {
  return t.logs.filter((l) => l.kind === "page").map((l, i) => {
    const m = l.msg.match(/^\w+\s+(\d{3})\s+in\s+(\d+)ms:\s*(.*)$/);
    return { n: i, status: m ? Number(m[1]) : null, ms: m ? Number(m[2]) : null, title: m ? m[3] : l.msg, ts: l.ts };
  });
}

export function logsAsText(rows: LogRow[], clock: (ts: number) => string) {
  return rows.map((r) => `[${clock(r.ts)}] [${r.stream}] [${r.tag}] ${r.msg}`).join("\n");
}

export function downloadText(text: string, filename: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
