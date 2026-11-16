import type { StageStatus, TaskEvent, TaskPlan, TaskResult, TaskStatus } from "./api";

/** The six stages the backend reports (see backend/app/orchestrator/task_runner.py). */
export const STAGES: { key: string; label: string }[] = [
  { key: "intent", label: "Understanding request" },
  { key: "validate", label: "Validating inputs" },
  { key: "prepare", label: "Preparing execution" },
  { key: "execute", label: "Running CLI process" },
  { key: "process", label: "Processing results" },
  { key: "respond", label: "Generating response" },
];

export const FINISHED: TaskStatus[] = ["completed", "partial", "failed", "cancelled", "answered"];

export interface StageView {
  key: string;
  label: string;
  status: StageStatus;
  detail: string | null;
  startedAt?: number;
  endedAt?: number;
}

export interface LogLine { ts: number; level: string; msg: string; kind: string; stream: string }

export interface ProcessView {
  pid: number;
  running: boolean;
  startedTs: number;
  exitedTs?: number;
  exitCode?: number | null;
  durationMs?: number;
  timedOut?: boolean;
  cancelled?: boolean;
  stdoutBytes?: number;
}

export interface TaskView {
  id: string;
  prompt: string;
  status: TaskStatus;
  stages: StageView[];
  plan?: TaskPlan;
  command?: { tool: string; command: string; timeout_s: number; ts: number };
  process?: ProcessView;
  logs: LogLine[];
  result?: TaskResult;
  startedAt?: number;
  endedAt?: number;
  finished: boolean;
}

export function emptyTask(id: string, prompt: string): TaskView {
  return {
    id, prompt, status: "queued", logs: [], finished: false,
    stages: STAGES.map((s) => ({ ...s, status: "pending" as StageStatus, detail: null })),
  };
}

export function applyEvent(view: TaskView, ev: TaskEvent): TaskView {
  const v: TaskView = { ...view };
  switch (ev.type) {
    case "task":
      v.startedAt = ev.ts;
      v.status = "running";
      if (ev.prompt) v.prompt = ev.prompt;
      break;
    case "stage":
      v.status = v.finished ? v.status : "running";
      v.stages = v.stages.map((s) =>
        s.key === ev.stage
          ? {
              ...s, status: ev.status, detail: ev.detail ?? s.detail,
              startedAt: ev.status === "running" ? ev.ts : s.startedAt,
              endedAt: ev.status !== "running" ? ev.ts : undefined,
            }
          : s,
      );
      break;
    case "plan":
      v.plan = ev.plan;
      break;
    case "command":
      v.command = { tool: ev.tool, command: ev.command, timeout_s: ev.timeout_s, ts: ev.ts };
      break;
    case "process":
      v.process = ev.state === "started"
        ? { pid: ev.pid, running: true, startedTs: ev.ts }
        : {
            pid: ev.pid, running: false, startedTs: v.process?.startedTs ?? ev.ts, exitedTs: ev.ts,
            exitCode: ev.exit_code, durationMs: ev.duration_ms, timedOut: ev.timed_out,
            cancelled: ev.cancelled, stdoutBytes: ev.stdout_bytes,
          };
      break;
    case "log":
      v.logs = [...v.logs, { ts: ev.ts, level: ev.level, msg: ev.msg, kind: ev.kind, stream: ev.stream }];
      break;
    case "result":
      v.result = ev.result;
      break;
    case "done":
      v.status = ev.status;
      v.finished = true;
      v.endedAt = ev.ts;
      break;
  }
  return v;
}

export function replay(id: string, prompt: string, events: TaskEvent[]): TaskView {
  return events.reduce(applyEvent, emptyTask(id, prompt));
}

/**
 * The seven stages shown in the UI. Stages 1-3 and 6-7 are the backend's own stages.
 * The backend's single "execute" stage is split in two using the real process events:
 *   Launching CLI    = execute stage started -> process "started" event (PID assigned)
 *   Crawling website = process "started"     -> process "exited" event (exit code known)
 * Nothing here is simulated: a stage only advances when its event has arrived.
 */
export function displayStages(t: TaskView): StageView[] {
  const by = Object.fromEntries(t.stages.map((s) => [s.key, s]));
  const exec = by.execute;
  const p = t.process;
  const pages = t.logs.filter((l) => l.kind === "page").length;

  let launch: StageView = { key: "launch", label: "Launching CLI", status: "pending", detail: null };
  let crawl: StageView = { key: "crawl", label: "Crawling website", status: "pending", detail: null };

  if (exec.status === "skipped") {
    launch = { ...launch, status: "skipped", detail: exec.detail };
    crawl = { ...crawl, status: "skipped" };
  } else if (exec.status !== "pending") {
    if (p) {
      launch = {
        ...launch, status: "done", startedAt: exec.startedAt, endedAt: p.startedTs,
        detail: `${t.command?.tool ?? "CLI"} started as PID ${p.pid}`,
      };
      if (p.running) {
        crawl = { ...crawl, status: "running", startedAt: p.startedTs, detail: `${pages} page${pages === 1 ? "" : "s"} fetched so far` };
      } else {
        const code = p.exitCode;
        const status: StageStatus = p.cancelled || p.timedOut || (code !== 0 && code !== 1) ? "failed" : code === 1 ? "warning" : "done";
        const why = p.cancelled ? "cancelled by user, process killed"
          : p.timedOut ? "timed out, process killed"
          : exec.detail ?? `exit code ${code}`;
        crawl = { ...crawl, status, startedAt: p.startedTs, endedAt: p.exitedTs, detail: `${pages} page${pages === 1 ? "" : "s"} · ${why}` };
      }
    } else if (exec.status === "running") {
      launch = { ...launch, status: "running", startedAt: exec.startedAt, detail: exec.detail };
    } else if (exec.status === "failed") {
      // Failed before a PID existed (spawn error, or cancelled while waiting for a worker).
      launch = { ...launch, status: "failed", startedAt: exec.startedAt, endedAt: exec.endedAt, detail: exec.detail };
      crawl = { ...crawl, status: "skipped" };
    }
  }

  return [by.intent, by.validate, by.prepare, launch, crawl, by.process, by.respond];
}

export function hostOf(url?: string | null): string {
  if (!url) return "";
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}
