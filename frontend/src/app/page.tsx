"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnswerMessage, ErrorMessage, UserMessage } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import type { Template } from "@/components/chat/SuggestedTasks";
import { WelcomeScreen } from "@/components/chat/WelcomeScreen";
import { ExecutionPanel } from "@/components/execution/ExecutionPanel";
import { Header } from "@/components/layout/Header";
import { SettingsDialog } from "@/components/layout/SettingsDialog";
import { Sidebar } from "@/components/layout/Sidebar";
import { useToast } from "@/components/ui/Toast";
import { api, type Health, type TaskEvent, type TaskSummaryRow } from "@/lib/api";
import { usePrefs, useSaved } from "@/lib/prefs";
import { FINISHED, applyEvent, emptyTask, hostOf, replay, type TaskView } from "@/lib/taskState";

type Entry =
  | { kind: "user"; key: string; text: string }
  | { kind: "task"; key: string; taskId: string }
  | { kind: "error"; key: string; title: string; text: string; retry?: string };

function describeError(err: unknown): { title: string; text: string } {
  const msg = (err as Error)?.message ?? String(err);
  if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return { title: "Backend unreachable", text: "TaskPilot could not reach the API. Check that the backend is running on the configured URL, then try again." };
  }
  if (/^429/.test(msg) || /too many|busy/i.test(msg)) return { title: "Backend is busy", text: msg };
  return { title: "Request rejected", text: msg };
}

export default function Home() {
  const toast = useToast();
  const [prefs, setPrefs] = usePrefs();
  const { saved, toggle: toggleSaved, remove: unsave, clear: clearSaved } = useSaved();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [tasks, setTasks] = useState<Record<string, TaskView>>({});
  const [history, setHistory] = useState<TaskSummaryRow[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const streams = useRef<Record<string, EventSource>>({});
  const lastSeq = useRef<Record<string, number>>({});
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ---------- data ---------- */

  const refreshHistory = useCallback(() => {
    api.list().then((rows) => { setHistory(rows); setHistoryLoaded(true); }).catch(() => setHistoryLoaded(true));
  }, []);

  const pingHealth = useCallback(() => {
    api.health().then((h) => { setHealth(h); setHealthError(false); }).catch(() => setHealthError(true));
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
        if (ev.status === "failed") toast({ tone: "error", title: "Task failed", body: "See the execution panel for the reason." });
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

  /* ---------- actions ---------- */

  const submit = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || submitting) return;
    setSubmitting(true);
    setInput("");
    setEntries((e) => [...e, { kind: "user", key: crypto.randomUUID(), text: message }]);
    try {
      const { task_id } = await api.submit(message);
      setTasks((prev) => ({ ...prev, [task_id]: emptyTask(task_id, message) }));
      setEntries((e) => [...e, { kind: "task", key: task_id, taskId: task_id }]);
      setActiveId(task_id);
      subscribe(task_id);
      refreshHistory();
    } catch (err) {
      const { title, text: body } = describeError(err);
      setEntries((e) => [...e, { kind: "error", key: crypto.randomUUID(), title, text: body, retry: message }]);
      if (err instanceof TypeError) setHealthError(true);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, subscribe, refreshHistory]);

  const openTask = useCallback(async (id: string) => {
    setMobileOpen(false);
    try {
      const d = await api.get(id);
      const running = !FINISHED.includes(d.status);
      setTasks((prev) => ({ ...prev, [id]: running ? emptyTask(id, d.prompt) : replay(id, d.prompt, d.events) }));
      setEntries([{ kind: "user", key: `u-${id}`, text: d.prompt }, { kind: "task", key: id, taskId: id }]);
      setActiveId(id);
      if (running) subscribe(id);
      requestAnimationFrame(() => scroller.current?.scrollTo({ top: 0 }));
    } catch (err) {
      toast({ tone: "error", title: "Could not open task", body: describeError(err).text });
    }
  }, [subscribe, toast]);

  const deleteTask = useCallback(async (id: string) => {
    try {
      await api.remove(id);
      unsave(id);
      if (activeId === id) { setEntries([]); setActiveId(null); }
      refreshHistory();
      toast({ tone: "success", title: "Task deleted" });
    } catch (err) {
      toast({ tone: "error", title: "Could not delete task", body: (err as Error).message });
    }
  }, [activeId, refreshHistory, toast, unsave]);

  const toggleSave = useCallback((id: string) => {
    const was = saved.includes(id);
    toggleSaved(id);
    toast({ tone: "success", title: was ? "Removed from saved results" : "Saved to your results" });
  }, [saved, toggleSaved, toast]);

  const newTask = useCallback(() => {
    setEntries([]); setActiveId(null); setMobileOpen(false); setInput("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const pickTemplate = useCallback((t: Template) => {
    setInput(t.prompt);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const i = t.prompt.indexOf(t.url);
      if (i >= 0) el.setSelectionRange(i, i + t.url.length); // type to replace the URL
    });
  }, []);

  /* ---------- keyboard ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, [contenteditable]");
      if (e.altKey && e.key.toLowerCase() === "n") { e.preventDefault(); newTask(); }
      else if (e.key === "/" && !typing) { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newTask]);

  /* ---------- auto-scroll ---------- */

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [entries.length]);

  const active = activeId ? tasks[activeId] : undefined;
  const activeRunning = !!active && !active.finished;
  const activeSig = active ? `${active.logs.length}-${active.stages.map((s) => s.status).join()}-${active.finished}` : "";
  useEffect(() => {
    const el = scroller.current;
    if (!el || !prefs.autoScroll || !activeSig) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 240;
    if (near || activeRunning) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [activeSig, activeRunning, prefs.autoScroll]);

  /* ---------- render ---------- */

  const disabledReason = healthError ? "Backend offline" : null;
  const composerProps = { value: input, onChange: setInput, onSubmit: () => submit(input), submitting, disabledReason, inputRef };
  const title = active ? (active.plan?.url ? hostOf(active.plan.url) : active.prompt.slice(0, 60)) : entries.length ? "Conversation" : "New task";

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-fg">
      <Sidebar
        history={history} historyLoaded={historyLoaded} saved={saved} activeId={activeId}
        health={health} healthError={healthError}
        collapsed={prefs.sidebarCollapsed} mobileOpen={mobileOpen}
        onToggleCollapse={() => setPrefs({ sidebarCollapsed: !prefs.sidebarCollapsed })}
        onMobileClose={() => setMobileOpen(false)}
        onNew={newTask} onOpen={openTask} onDelete={deleteTask} onToggleSave={toggleSave}
        onOpenSettings={() => { setSettingsOpen(true); setMobileOpen(false); }}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <Header title={title} status={active?.status} health={health} healthError={healthError}
          sidebarCollapsed={prefs.sidebarCollapsed} onMenu={() => setMobileOpen(true)}
          onExpandSidebar={() => setPrefs({ sidebarCollapsed: false })} onNew={newTask} onSettings={() => setSettingsOpen(true)} />

        <div ref={scroller} className="flex-1 overflow-y-auto overflow-x-hidden">
          {entries.length === 0 ? (
            <WelcomeScreen health={health} busy={submitting || healthError} onPick={pickTemplate} onRun={submit}
              composer={<ChatInput {...composerProps} variant="hero" autoFocus />} />
          ) : (
            <div className="mx-auto w-full max-w-[920px] space-y-6 px-3 py-6 sm:px-6">
              {entries.map((e) => {
                if (e.kind === "user") return <UserMessage key={e.key} text={e.text} />;
                if (e.kind === "error") return <ErrorMessage key={e.key} title={e.title} body={e.text} onRetry={e.retry ? () => submit(e.retry!) : undefined} />;
                const t = tasks[e.taskId];
                if (!t) return null;
                if (t.finished && t.result?.status === "answered") {
                  return <AnswerMessage key={e.key} text={t.result.message ?? ""}
                    meta={<>No CLI execution needed · intent <span className="font-mono">{t.result.plan?.intent}</span> · parsed by {t.result.plan?.interpreted_by === "llm" ? "LLM" : "rules"}</>} />;
                }
                return (
                  <ExecutionPanel key={e.key} task={t} saved={saved.includes(t.id)} defaultExpanded={prefs.expandExecution}
                    onCancel={() => api.cancel(t.id).then(() => undefined)}
                    onRetry={() => submit(t.prompt)}
                    onToggleSave={() => toggleSave(t.id)} />
                );
              })}
            </div>
          )}
        </div>

        {entries.length > 0 && (
          <div className="shrink-0 bg-gradient-to-t from-canvas via-canvas to-canvas/0 px-3 pb-3 pt-2 sm:px-6 sm:pb-4">
            <div className="mx-auto max-w-[920px]">
              <ChatInput {...composerProps} />
              <p className="mt-2 text-center text-[11px] text-subtle">Only approved CLI tools run. Results come from real process output, never from the model alone.</p>
            </div>
          </div>
        )}
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)}
        health={health} healthError={healthError} onRecheck={() => { pingHealth(); toast({ tone: "info", title: "Checking backend…" }); }}
        prefs={prefs} setPrefs={setPrefs} savedCount={saved.length}
        onClearSaved={() => { clearSaved(); toast({ tone: "success", title: "Saved results cleared" }); }} />
    </div>
  );
}
