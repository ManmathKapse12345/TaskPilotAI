"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TaskCard } from "@/components/TaskCard";
import { api, type Health, type TaskEvent, type TaskSummaryRow } from "@/lib/api";
import { applyEvent, emptyTask, replay, type TaskView } from "@/lib/taskState";

type Entry = { kind: "user"; key: string; text: string } | { kind: "task"; key: string; taskId: string } | { kind: "error"; key: string; text: string };

const EXAMPLES = [
  "Crawl https://example.com, extract the important information, give me a summary, and return the extracted data in JSON format.",
  "Crawl 5 pages of https://quotes.toscrape.com and summarise what the site offers, with JSON output.",
  "Analyse only the homepage of https://www.python.org and find contact details and social links.",
  "Summarise http://localhost:8080/admin",
];

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tasks, setTasks] = useState<Record<string, TaskView>>({});
  const [history, setHistory] = useState<TaskSummaryRow[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const streams = useRef<Record<string, EventSource>>({});
  const lastSeq = useRef<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshHistory = useCallback(() => {
    api.list().then(setHistory).catch(() => {});
  }, []);

  useEffect(() => {
    const ping = () => api.health().then((h) => { setHealth(h); setHealthError(false); }).catch(() => setHealthError(true));
    ping();
    refreshHistory();
    const t = setInterval(ping, 15000);
    const open = streams.current;
    return () => { clearInterval(t); Object.values(open).forEach((es) => es.close()); };
  }, [refreshHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length, tasks]);

  const subscribe = useCallback((id: string) => {
    streams.current[id]?.close();
    lastSeq.current[id] = -1;
    const es = new EventSource(api.eventsUrl(id));
    streams.current[id] = es;
    es.onmessage = (msg) => {
      const ev = JSON.parse(msg.data) as TaskEvent;
      // The server replays from the start on reconnect - drop events we've already applied.
      if (typeof ev.seq === "number") {
        if (ev.seq <= lastSeq.current[id]) return;
        lastSeq.current[id] = ev.seq;
      }
      setTasks((prev) => ({ ...prev, [id]: applyEvent(prev[id] ?? emptyTask(id, ""), ev) }));
      if (ev.type === "done") {
        es.close();
        delete streams.current[id];
        refreshHistory();
      }
    };
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) delete streams.current[id];
    };
  }, [refreshHistory]);

  const submit = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || submitting) return;
    setSubmitting(true);
    setInput("");
    const userKey = crypto.randomUUID();
    setEntries((e) => [...e, { kind: "user", key: userKey, text: message }]);
    try {
      const { task_id } = await api.submit(message);
      setTasks((prev) => ({ ...prev, [task_id]: emptyTask(task_id, message) }));
      setEntries((e) => [...e, { kind: "task", key: task_id, taskId: task_id }]);
      setActiveId(task_id);
      subscribe(task_id);
      refreshHistory();
    } catch (err) {
      setEntries((e) => [...e, { kind: "error", key: crypto.randomUUID(), text: `Could not reach the TaskPilot backend: ${(err as Error).message}` }]);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, subscribe, refreshHistory]);

  const openTask = useCallback(async (id: string) => {
    setSidebarOpen(false);
    try {
      const d = await api.get(id);
      const running = !["completed", "partial", "failed", "cancelled", "answered"].includes(d.status);
      setTasks((prev) => ({ ...prev, [id]: running ? emptyTask(id, d.prompt) : replay(id, d.prompt, d.events) }));
      setEntries([{ kind: "user", key: `u-${id}`, text: d.prompt }, { kind: "task", key: id, taskId: id }]);
      setActiveId(id);
      if (running) subscribe(id);
    } catch (err) {
      setEntries([{ kind: "error", key: crypto.randomUUID(), text: `Could not load task: ${(err as Error).message}` }]);
    }
  }, [subscribe]);

  const deleteTask = useCallback(async (id: string) => {
    try {
      await api.remove(id);
      if (activeId === id) setEntries([]);
      refreshHistory();
    } catch (err) {
      alert((err as Error).message);
    }
  }, [activeId, refreshHistory]);

  const newTask = () => { setEntries([]); setActiveId(null); setSidebarOpen(false); };

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-950 text-slate-200">
      <Sidebar history={history} activeId={activeId} health={health} healthError={healthError}
        onNew={newTask} onOpen={openTask} onDelete={deleteTask} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3 md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-md px-2 py-1 text-slate-300 ring-1 ring-slate-700">☰</button>
          <span className="text-sm font-semibold">TaskPilot AI</span>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6">
            {entries.length === 0 && (
              <div className="pt-[8vh] text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-2xl font-bold text-white shadow-lg shadow-indigo-500/20">T</div>
                <h1 className="text-2xl font-semibold text-white">What should I execute?</h1>
                <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
                  Describe a task in plain English. TaskPilot interprets it, runs an approved CLI tool on the backend,
                  streams the live execution and returns a verified summary and JSON.
                </p>
                <div className="mx-auto mt-8 grid max-w-3xl gap-2 text-left sm:grid-cols-2">
                  {EXAMPLES.map((ex, i) => (
                    <button key={ex} onClick={() => submit(ex)}
                      className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-300 transition hover:border-indigo-500/50 hover:bg-slate-900">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {i === 3 ? "Security edge case" : i === 0 ? "Mandatory demo" : "Example"}
                      </span>
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {entries.map((e) =>
              e.kind === "user" ? (
                <div key={e.key} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-indigo-500/90 px-4 py-2.5 text-sm text-white">{e.text}</div>
                </div>
              ) : e.kind === "error" ? (
                <div key={e.key} className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{e.text}</div>
              ) : tasks[e.taskId] ? (
                <TaskCard key={e.key} task={tasks[e.taskId]}
                  onCancel={() => api.cancel(e.taskId).catch(() => {})}
                  onRetry={() => submit(tasks[e.taskId].prompt)} />
              ) : null,
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-slate-800 bg-slate-950/80 px-4 py-3 backdrop-blur">
          <form className="mx-auto flex max-w-4xl items-end gap-2" onSubmit={(ev) => { ev.preventDefault(); submit(input); }}>
            <textarea value={input} onChange={(ev) => setInput(ev.target.value)} rows={1} maxLength={2000}
              onKeyDown={(ev) => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); submit(input); } }}
              placeholder="e.g. Crawl https://example.com, summarise it and return JSON…"
              className="max-h-40 min-h-[44px] flex-1 resize-y rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none" />
            <button type="submit" disabled={!input.trim() || submitting}
              className="h-[44px] rounded-xl bg-indigo-500 px-5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-40">
              {submitting ? "…" : "Run"}
            </button>
          </form>
          <p className="mx-auto mt-1.5 max-w-4xl text-[11px] text-slate-600">
            Only approved CLI tools run · public URLs only · robots.txt respected · Enter to run, Shift+Enter for a new line
          </p>
        </div>
      </main>
    </div>
  );
}
