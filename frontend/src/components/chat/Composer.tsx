"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Braces, Globe, Home, Layers, Loader2, ShieldAlert, ShieldCheck, Square, Terminal } from "lucide-react";
import { MAX_MESSAGE, composeDirective, type Output, type Scope } from "@/lib/directive";
import { detectUrl } from "@/lib/templates";
import { useWorkspace } from "@/lib/workspace";
import { cx } from "../ui/primitives";

export const COMPOSER_ID = "chat-input";

/** Docked chat composer (Stitch "Docked Message Composer"). Option chips add plain sentences to the message. */
export function Composer({ busyTaskId, onSend }: { busyTaskId: string | null; onSend: (message: string) => void }) {
  const ws = useWorkspace();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [scope, setScope] = useState<Scope>("auto");
  const [output, setOutput] = useState<Output>("auto");
  const text = ws.draft;
  const message = useMemo(() => composeDirective({ url: "", directive: text, maxPages: null, scope, output }), [text, scope, output]);
  const target = useMemo(() => detectUrl(text), [text]);
  const busy = !!busyTaskId;
  const offline = ws.healthError;
  const canSend = !busy && !offline && !ws.submitting && text.trim().length > 0 && message.length <= MAX_MESSAGE;
  const tool = ws.health?.tools[0];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  const send = () => {
    if (!canSend) return;
    onSend(message);
    setScope("auto");
    setOutput("auto");
  };

  const chip = (active: boolean) => cx("flex items-center gap-1.5 rounded px-2 py-1 font-mono text-code-sm transition-colors",
    active ? "bg-primary/15 text-primary" : "bg-surface-container text-on-surface-variant hover:text-on-surface");

  return (
    <div className="sticky bottom-0 z-20 bg-linear-to-t from-surface from-85% to-surface/0 pb-3 pt-8">
      <div className="mx-auto w-full max-w-[880px]">
        <div className="mb-1.5 flex items-center justify-between px-1 font-mono text-code-sm">
          {busy ? (
            <>
              <span className="flex items-center gap-1.5 text-secondary"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />Task in progress</span>
              <button type="button" onClick={() => ws.cancel(busyTaskId!)} className="flex items-center gap-1 text-error hover:underline"><Square className="h-3 w-3" fill="currentColor" />Stop current task</button>
            </>
          ) : (
            <>
              <span className={cx("flex items-center gap-1.5", offline ? "text-error" : "text-on-surface-variant")}>
                <span className={cx("h-1.5 w-1.5 rounded-full", offline ? "bg-error" : ws.health ? "bg-primary" : "animate-pulse bg-outline")} />
                {offline ? "Server unreachable, start the backend to send tasks" : ws.health ? "Ready" : "Connecting…"}
              </span>
              <span className="hidden text-on-surface-variant sm:inline">Shift + Enter for a new line</span>
            </>
          )}
        </div>

        <div className="rounded-xl bg-surface-container-low shadow-xl ring-1 ring-line focus-within:ring-primary/40">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
            {target ? (
              <span className={cx("flex items-center gap-1.5 rounded px-2 py-1 font-mono text-code-sm", target.risky ? "bg-warn/10 text-warn" : "bg-secondary/10 text-secondary")}
                title={target.risky ? "Private or local addresses are blocked by the backend" : `Detected website: ${target.url}`}>
                {target.risky ? <ShieldAlert className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                {target.risky ? `${target.host} · will be blocked` : target.host}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded px-2 py-1 font-mono text-code-sm text-on-surface-variant"><Globe className="h-3.5 w-3.5" />no website yet</span>
            )}
            {tool && <span className="flex items-center gap-1.5 rounded px-2 py-1 font-mono text-code-sm text-on-surface-variant" title="Approved CLI tool the backend will run"><Terminal className="h-3.5 w-3.5" />CLI: {tool}</span>}
            <span className="ml-auto flex flex-wrap gap-1.5">
              <button type="button" className={chip(scope === "homepage")} aria-pressed={scope === "homepage"} onClick={() => setScope(scope === "homepage" ? "auto" : "homepage")}><Home className="h-3.5 w-3.5" />Homepage only</button>
              <button type="button" className={chip(scope === "deep")} aria-pressed={scope === "deep"} onClick={() => setScope(scope === "deep" ? "auto" : "deep")}><Layers className="h-3.5 w-3.5" />Deep crawl</button>
              <button type="button" className={chip(output === "both")} aria-pressed={output === "both"} onClick={() => setOutput(output === "both" ? "auto" : "both")}><Braces className="h-3.5 w-3.5" />Summary + JSON</button>
            </span>
          </div>

          <textarea id={COMPOSER_ID} ref={ref} rows={2} value={text} disabled={busy}
            onChange={(e) => ws.setDraft(e.target.value.slice(0, MAX_MESSAGE))}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            aria-label="Describe a task"
            placeholder={busy ? "Working… you can stop the task above to send a new prompt" : "e.g. Summarise https://www.python.org and return the data as JSON"}
            className="block w-full resize-none bg-transparent px-4 pt-3 text-body-lg text-on-surface outline-none placeholder:text-on-surface-variant/60 disabled:cursor-not-allowed" />

          <div className="flex items-end justify-between gap-2 px-3 pb-3">
            <p className="min-w-0 flex-1 truncate font-mono text-label-code text-on-surface-variant" title={message !== text.trim() ? message : undefined}>
              {message !== text.trim() && text.trim() ? <>Sends: <span className="text-on-surface">{message}</span></> : null}
            </p>
            <button type="button" onClick={send} disabled={!canSend}
              className="glow-primary flex shrink-0 items-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-body-md font-semibold text-on-primary-container transition-all hover:bg-primary active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none">
              {ws.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />}
              {ws.thread.length ? "Send" : "Run Task"}
            </button>
          </div>
        </div>

        <p className="mt-2 flex items-center justify-center gap-1.5 text-center font-mono text-label-code text-on-surface-variant">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />Safe by default: public websites only · robots.txt respected · approved tools only
        </p>
      </div>
    </div>
  );
}
