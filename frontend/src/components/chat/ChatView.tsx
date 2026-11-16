"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import type { Template } from "@/lib/templates";
import type { TaskView } from "@/lib/taskState";
import { useWorkspace, type ThreadItem } from "@/lib/workspace";
import { Markdown } from "../ui/Markdown";
import { cx, formatMs } from "../ui/primitives";
import { AgentHeader, UserBubble, taskDurationMs } from "./bits";
import { COMPOSER_ID, Composer } from "./Composer";
import { FailureCard } from "./FailureCard";
import { ResultCard } from "./ResultCard";
import { RunCard } from "./RunCard";
import { Welcome } from "./Welcome";

/** The chat: each task is the user's message plus the agent's live run / result / error reply. */
export function ChatView() {
  const ws = useWorkspace();
  const router = useRouter();
  const param = useSearchParams().get("task");
  const { thread, openThread } = ws;
  const lastLen = useRef(0);
  const handledParam = useRef<string | null>(null);

  // Deep link (/?task=<id>): show that stored task as the conversation. Only reacts when the URL
  // changes, so "New chat" (which clears the thread before the URL updates) doesn't reopen it.
  useEffect(() => {
    if (param === handledParam.current) return;
    handledParam.current = param;
    if (param && !thread.some((t) => t.kind === "task" && t.id === param)) openThread(param);
  }, [param, thread, openThread]);

  const focusComposer = (selectUrl?: string) => requestAnimationFrame(() => {
    const el = document.getElementById(COMPOSER_ID) as HTMLTextAreaElement | null;
    if (!el) return;
    el.focus();
    if (selectUrl) { const i = el.value.indexOf(selectUrl); if (i >= 0) el.setSelectionRange(i, i + selectUrl.length); }
  });

  const send = useCallback(async (message: string) => {
    ws.setDraft("");
    const id = await ws.send(message);
    if (id) router.replace(`/?task=${id}`, { scroll: false });
  }, [ws, router]);

  const fill = (text: string, selectUrl?: string) => { ws.setDraft(text); focusComposer(selectUrl); };

  // Follow the conversation: scroll to the bottom on new messages, and while a run streams if already near the bottom.
  const busy = thread.map((t) => (t.kind === "task" ? ws.tasks[t.id] : undefined)).find((t) => t && !t.finished);
  const sig = `${thread.length}-${busy?.logs.length ?? 0}-${thread.map((t) => (t.kind === "task" ? ws.tasks[t.id]?.status : "e")).join()}`;
  useEffect(() => {
    const el = document.getElementById("main-scroll");
    if (!el) return;
    const grew = thread.length > lastLen.current;
    lastLen.current = thread.length;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 320;
    if (grew || (near && ws.prefs.autoScroll)) el.scrollTo({ top: el.scrollHeight, behavior: grew ? "smooth" : "auto" });
  }, [sig, thread.length, ws.prefs.autoScroll]);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1">
        {thread.length === 0 ? (
          <Welcome onPick={(t: Template) => fill(t.prompt, t.url)} onRun={send} />
        ) : (
          <div className="mx-auto flex w-full max-w-[880px] flex-col gap-8 pb-4 pt-2">
            {thread.map((item) => <Entry key={item.kind === "task" ? item.id : item.key} item={item} onSend={send} onFill={fill} />)}
          </div>
        )}
      </div>
      <Composer busyTaskId={busy?.id ?? null} onSend={send} />
    </div>
  );
}

function Entry({ item, onSend, onFill }: { item: ThreadItem; onSend: (m: string) => void; onFill: (t: string, sel?: string) => void }) {
  const ws = useWorkspace();
  if (item.kind === "error") {
    return (
      <div className="flex flex-col gap-4">
        <UserBubble text={item.prompt} />
        <div>
          <AgentHeader />
          <div className="flex items-start gap-3 rounded-xl border-l-4 border-error bg-surface-container-low p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
            <div className="min-w-0">
              <div className="text-headline-sm font-semibold text-on-surface">{item.title}</div>
              <p className="mt-0.5 break-words text-body-md text-on-surface-variant">{item.text}</p>
              <button type="button" onClick={() => onSend(item.prompt)} disabled={ws.submitting || ws.healthError}
                className="mt-3 flex items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-1.5 text-body-md text-on-surface hover:bg-surface-bright disabled:opacity-40">
                <RotateCw className="h-4 w-4 text-secondary" />Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const task = ws.tasks[item.id];
  const err = ws.loadErrors[item.id];
  if (!task) {
    return err ? (
      <div className="rounded-xl border-l-4 border-error bg-surface-container-low p-4 text-body-md text-on-surface-variant">
        <span className="font-semibold text-on-surface">Could not load this task.</span> {err}
        <button type="button" onClick={() => ws.ensureTask(item.id, true)} className="ml-2 text-secondary hover:underline">Retry</button>
      </div>
    ) : <div className="h-40 animate-pulse rounded-xl bg-surface-container-low" aria-label="Loading task" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <UserBubble text={task.prompt} ts={task.startedAt} />
      <div className="animate-fade-up">
        <AgentHeader right={<AgentStatus task={task} />} />
        <Reply task={task} onSend={onSend} onFill={onFill} />
      </div>
    </div>
  );
}

function AgentStatus({ task }: { task: TaskView }) {
  if (!task.finished) return <span className="font-mono text-code-sm text-secondary">working…</span>;
  const d = taskDurationMs(task);
  const ok = task.status === "completed" || task.status === "answered";
  return (
    <span className={cx("font-mono text-code-sm", ok ? "text-primary" : task.status === "partial" ? "text-warn" : task.status === "cancelled" ? "text-on-surface-variant" : "text-error")}>
      {task.status === "answered" ? "answered" : task.status}{d != null && task.status !== "answered" ? ` in ${formatMs(d)}` : ""}
    </span>
  );
}

function Reply({ task, onSend, onFill }: { task: TaskView; onSend: (m: string) => void; onFill: (t: string, sel?: string) => void }) {
  if (!task.finished) return <RunCard task={task} />;
  const r = task.result;
  if (r?.status === "answered") {
    return <div className="rounded-xl bg-surface-container-low p-4 text-body-lg text-on-surface"><Markdown text={r.message ?? ""} /></div>;
  }
  if ((r?.status === "completed" || r?.status === "partial") && (r.data || r.json_output || r.summary)) {
    return <ResultCard task={task} onFollowUp={(t) => onFill(t)} />;
  }
  return <FailureCard task={task} onRetry={() => onSend(task.prompt)} onTryPublic={() => onFill("Crawl https://example.com, give me a summary and return the extracted data in JSON format.", "https://example.com")} />;
}
