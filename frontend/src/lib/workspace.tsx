"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import { api, type Health, type TaskEvent, type TaskSummaryRow } from "./api";
import { usePrefs, useSaved, type Prefs } from "./prefs";
import { FINISHED, applyEvent, emptyTask, replay, type TaskView } from "./taskState";
import { describeError } from "./templates";

/**
 * App-wide execution state. Lives in the root layout so SSE streams keep running while the user
 * moves between Workspace, Live CLI, Results and History. Everything shown comes from the backend:
 * task views are built only from recorded/streamed events (see lib/taskState.ts).
 */
export interface Workspace {
  health: Health | null;
  healthError: boolean;
  /** Round-trip time of the last /api/health request, measured in the browser. */
  latencyMs: number | null;
  pingHealth: () => void;

  history: TaskSummaryRow[];
  historyLoaded: boolean;
  historyError: string | null;
  refreshHistory: () => void;

  tasks: Record<string, TaskView>;
  loadErrors: Record<string, string>;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  /** Loads a stored task (replaying its events) or re-subscribes if it is still running. */
  ensureTask: (id: string, force?: boolean) => void;

  /** Sends a natural-language directive to POST /api/chat. Resolves to the new task id; rejects with a described error. */
  submit: (message: string) => Promise<string>;
  submitting: boolean;
  cancel: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;

  saved: string[];
  toggleSave: (id: string) => void;
  clearSaved: () => void;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;

  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  draft: string;
  setDraft: (v: string) => void;
}

const Ctx = createContext<Workspace | null>(null);

export function useWorkspace() {
  const ws = useContext(Ctx);
  if (!ws) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ws;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [prefs, setPrefs] = usePrefs();
  const { saved, toggle: toggleSaved, remove: unsave, clear: clearSaved } = useSaved();

  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [history, setHistory] = useState<TaskSummaryRow[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Record<string, TaskView>>({});
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const streams = useRef<Record<string, EventSource>>({});
  const lastSeq = useRef<Record<string, number>>({});
  const loading = useRef<Set<string>>(new Set());
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  /* ---------- data ---------- */

  const refreshHistory = useCallback(() => {
    api.list()
      .then((rows) => { setHistory(rows); setHistoryLoaded(true); setHistoryError(null); })
      .catch((err) => { setHistoryLoaded(true); setHistoryError(describeError(err).text); });
  }, []);

  const pingHealth = useCallback(() => {
    const t0 = performance.now();
    api.health()
      .then((h) => { setHealth(h); setHealthError(false); setLatencyMs(Math.round(performance.now() - t0)); })
      .catch(() => { setHealthError(true); setLatencyMs(null); });
  }, []);

  useEffect(() => {
    pingHealth();
    refreshHistory();
    const t = setInterval(pingHealth, 15000);
    const open = streams.current;
    return () => { clearInterval(t); Object.values(open).forEach((es) => es.close()); };
  }, [pingHealth, refreshHistory]);

  /** Fallback when the live stream drops: load the stored task and replay its recorded events. */
  const recover = useCallback(async (id: string) => {
    try {
      const d = await api.get(id);
      if (FINISHED.includes(d.status)) {
        setTasks((prev) => ({ ...prev, [id]: replay(id, d.prompt, d.events) }));
        refreshHistory();
      }
    } catch { /* backend down; health indicator already shows it */ }
  }, [refreshHistory]);

  const subscribe = useCallback((id: string) => {
    streams.current[id]?.close();
    lastSeq.current[id] = -1;
    const es = new EventSource(api.eventsUrl(id));
    streams.current[id] = es;
    es.onmessage = (msg) => {
      let ev: TaskEvent;
      try { ev = JSON.parse(msg.data) as TaskEvent; } catch { return; }
      // The server replays from the start on reconnect, so drop events that were already applied.
      if (typeof ev.seq === "number") {
        if (ev.seq <= lastSeq.current[id]) return;
        lastSeq.current[id] = ev.seq;
      }
      setTasks((prev) => ({ ...prev, [id]: applyEvent(prev[id] ?? emptyTask(id, ""), ev) }));
      if (ev.type === "done") {
        es.close();
        delete streams.current[id];
        refreshHistory();
        if (ev.status === "failed") toast({ tone: "error", title: "Task failed", body: "Open Live CLI Execution for the reason." });
        else if (ev.status === "partial") toast({ tone: "info", title: "Partial result", body: "Some pages could not be crawled." });
        else if (ev.status === "completed") toast({ tone: "success", title: "Task completed", body: "Verified output from the CLI is ready." });
      }
    };
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        delete streams.current[id];
        recover(id);
      }
    };
  }, [refreshHistory, recover, toast]);

  const ensureTask = useCallback((id: string, force = false) => {
    if (!force && (tasksRef.current[id] || streams.current[id])) return;
    if (loading.current.has(id)) return;
    loading.current.add(id);
    setLoadErrors((e) => { if (!(id in e)) return e; const n = { ...e }; delete n[id]; return n; });
    api.get(id)
      .then((d) => {
        const running = !FINISHED.includes(d.status);
        setTasks((prev) => ({ ...prev, [id]: running ? emptyTask(id, d.prompt) : replay(id, d.prompt, d.events) }));
        if (running) subscribe(id);
      })
      .catch((err) => setLoadErrors((e) => ({ ...e, [id]: describeError(err).text })))
      .finally(() => loading.current.delete(id));
  }, [subscribe]);

  /* ---------- actions ---------- */

  const submit = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message) throw new Error("Describe a task first.");
    setSubmitting(true);
    try {
      const { task_id } = await api.submit(message);
      setTasks((prev) => ({ ...prev, [task_id]: emptyTask(task_id, message) }));
      setActiveId(task_id);
      subscribe(task_id);
      refreshHistory();
      return task_id;
    } catch (err) {
      if (err instanceof TypeError) setHealthError(true);
      const { title, text: body } = describeError(err);
      throw Object.assign(new Error(body), { title });
    } finally {
      setSubmitting(false);
    }
  }, [subscribe, refreshHistory]);

  const cancel = useCallback(async (id: string) => {
    try {
      await api.cancel(id);
      toast({ tone: "info", title: "Cancellation requested", body: "The CLI process is being terminated." });
    } catch (e) {
      toast({ tone: "error", title: "Could not cancel", body: (e as Error).message });
    }
  }, [toast]);

  const remove = useCallback(async (id: string) => {
    try {
      await api.remove(id);
      unsave(id);
      setTasks((prev) => { const n = { ...prev }; delete n[id]; return n; });
      setActiveId((a) => (a === id ? null : a));
      refreshHistory();
      toast({ tone: "success", title: "Task deleted" });
    } catch (err) {
      toast({ tone: "error", title: "Could not delete task", body: (err as Error).message });
    }
  }, [refreshHistory, toast, unsave]);

  const toggleSave = useCallback((id: string) => {
    const was = saved.includes(id);
    toggleSaved(id);
    toast({ tone: "success", title: was ? "Removed from saved results" : "Saved to your results" });
  }, [saved, toggleSaved, toast]);

  const value = useMemo<Workspace>(() => ({
    health, healthError, latencyMs, pingHealth,
    history, historyLoaded, historyError, refreshHistory,
    tasks, loadErrors, activeId, setActiveId, ensureTask,
    submit, submitting, cancel, remove,
    saved, toggleSave, clearSaved, prefs, setPrefs,
    settingsOpen, setSettingsOpen, draft, setDraft,
  }), [health, healthError, latencyMs, pingHealth, history, historyLoaded, historyError, refreshHistory, tasks, loadErrors, activeId,
    ensureTask, submit, submitting, cancel, remove, saved, toggleSave, clearSaved, prefs, setPrefs, settingsOpen, draft]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Resolves which task a page shows: the `?id=` in the URL, else the active task, else the newest in history.
 * Loads it from the backend when it is not in memory yet.
 */
export function useSelectedTask(paramId: string | null, fallbackToLatest = true) {
  const ws = useWorkspace();
  const id = paramId || ws.activeId || (fallbackToLatest ? ws.history[0]?.id ?? null : null);
  const { ensureTask, setActiveId } = ws;

  useEffect(() => {
    if (!id) return;
    ensureTask(id);
    if (paramId) setActiveId(paramId);
  }, [id, paramId, ensureTask, setActiveId]);

  return {
    id,
    task: id ? ws.tasks[id] : undefined,
    error: id ? ws.loadErrors[id] : undefined,
    /** true while we still don't know which task to show (history not loaded yet). */
    resolving: !id && !ws.historyLoaded,
  };
}
