import type { StageStatus, TaskEvent, TaskPlan, TaskResult, TaskStatus } from "./api";

export const STAGES: { key: string; label: string }[] = [
  { key: "intent", label: "Understanding request" },
  { key: "validate", label: "Validating input & safety checks" },
  { key: "prepare", label: "Selecting tool & preparing CLI arguments" },
  { key: "execute", label: "Running CLI process" },
  { key: "process", label: "Capturing & validating output" },
  { key: "respond", label: "Generating summary & response" },
];

export interface StageView {
  key: string;
  label: string;
  status: StageStatus;
  detail: string | null;
  startedAt?: number;
  endedAt?: number;
}

export interface LogLine { ts: number; level: string; msg: string; kind: string }

export interface TaskView {
  id: string;
  prompt: string;
  status: TaskStatus;
  stages: StageView[];
  plan?: TaskPlan;
  command?: { tool: string; command: string; timeout_s: number };
  process?: { pid: number; exitCode?: number | null; durationMs?: number; timedOut?: boolean; running: boolean; stdoutBytes?: number };
  logs: LogLine[];
  result?: TaskResult;
  startedAt?: number;
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
      v.command = { tool: ev.tool, command: ev.command, timeout_s: ev.timeout_s };
      break;
    case "process":
      v.process = ev.state === "started"
        ? { pid: ev.pid, running: true }
        : { pid: ev.pid, running: false, exitCode: ev.exit_code, durationMs: ev.duration_ms, timedOut: ev.timed_out, stdoutBytes: ev.stdout_bytes };
      break;
    case "log":
      v.logs = [...v.logs, { ts: ev.ts, level: ev.level, msg: ev.msg, kind: ev.kind }];
      break;
    case "result":
      v.result = ev.result;
      break;
    case "done":
      v.status = ev.status;
      v.finished = true;
      break;
  }
  return v;
}

export function replay(id: string, prompt: string, events: TaskEvent[]): TaskView {
  return events.reduce(applyEvent, emptyTask(id, prompt));
}
