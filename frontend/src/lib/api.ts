export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export type StageStatus = "pending" | "running" | "done" | "failed" | "skipped" | "warning";
export type TaskStatus = "queued" | "running" | "completed" | "partial" | "failed" | "cancelled" | "answered";

export interface TaskPlan {
  intent: "website_crawl" | "help" | "unsupported";
  url: string | null;
  max_pages: number;
  max_depth: number;
  wants_summary: boolean;
  wants_json: boolean;
  focus: string[];
  steps: string[];
  reply: string | null;
  interpreted_by: "llm" | "rules";
}

export interface Execution {
  tool: string;
  command: string;
  pid: number | null;
  exit_code: number | null;
  exit_meaning: string;
  duration_ms: number;
  timed_out: boolean;
  stderr_lines: number;
  stdout_bytes: number;
}

export interface Summary {
  text: string;
  key_points: string[];
  site_type: string;
  focus_findings: Record<string, string>;
  generated_by: string;
}

export interface ExtractedPage {
  url: string;
  title: string;
  description: string;
  depth: number;
  status_code: number;
  word_count: number;
  headings: { level: number; text: string }[];
  content_preview: string;
}

export interface ExtractedData {
  website: {
    url: string; final_url: string; title: string; description: string; site_name: string;
    language: string; keywords: string[]; structured_data_types: string[];
  };
  contact: { emails: string[]; phones: string[]; social_profiles: { platform: string; url: string }[] };
  pages: ExtractedPage[];
  navigation_links: { text: string; url: string }[];
  external_links: { text: string; url: string }[];
  images: { src: string; alt: string }[];
  crawl_stats: {
    pages_crawled: number; pages_failed: number; pages_skipped_robots: number; bytes_downloaded: number;
    duration_ms: number | null; errors: { url: string; error: string }[]; skipped_by_robots: string[];
  };
}

export interface TaskResult {
  status: TaskStatus;
  message: string | null;
  error?: string | null;
  plan?: TaskPlan;
  summary?: Summary | null;
  data?: ExtractedData;
  json_output?: Record<string, unknown>;
  execution?: Execution;
}

export type TaskEvent =
  | { seq: number; ts: number; type: "task"; task_id: string; prompt: string }
  | { seq: number; ts: number; type: "stage"; stage: string; label: string; status: StageStatus; detail: string | null }
  | { seq: number; ts: number; type: "plan"; plan: TaskPlan }
  | { seq: number; ts: number; type: "command"; tool: string; command: string; argv: string[]; timeout_s: number }
  | { seq: number; ts: number; type: "process"; state: "started" | "exited"; pid: number; exit_code?: number | null; duration_ms?: number; timed_out?: boolean; cancelled?: boolean; stdout_bytes?: number }
  | { seq: number; ts: number; type: "log"; level: string; msg: string; kind: string; stream: string }
  | { seq: number; ts: number; type: "result"; result: TaskResult }
  | { seq: number; ts: number; type: "done"; status: TaskStatus };

export interface TaskSummaryRow {
  id: string; created_at: string; prompt: string; status: TaskStatus; intent: string | null;
  url: string | null; duration_ms: number | null; exit_code: number | null;
}

export interface TaskDetail extends TaskSummaryRow {
  events: TaskEvent[];
  result: TaskResult | null;
}

export interface Health {
  status: string;
  llm: { provider: string; model: string | null; enabled: boolean };
  tools: string[];
  limits: { max_pages: number; max_depth: number; cli_timeout_s: number; max_concurrent_tasks: number };
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => fetch(`${API_URL}/api/health`).then((r) => json<Health>(r)),
  submit: (message: string) =>
    fetch(`${API_URL}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) })
      .then((r) => json<{ task_id: string; status: string }>(r)),
  cancel: (id: string) => fetch(`${API_URL}/api/tasks/${id}/cancel`, { method: "POST" }).then((r) => json<unknown>(r)),
  list: () => fetch(`${API_URL}/api/tasks?limit=50`).then((r) => json<TaskSummaryRow[]>(r)),
  get: (id: string) => fetch(`${API_URL}/api/tasks/${id}`).then((r) => json<TaskDetail>(r)),
  remove: (id: string) => fetch(`${API_URL}/api/tasks/${id}`, { method: "DELETE" }).then((r) => json<unknown>(r)),
  eventsUrl: (id: string) => `${API_URL}/api/tasks/${id}/events`,
};
