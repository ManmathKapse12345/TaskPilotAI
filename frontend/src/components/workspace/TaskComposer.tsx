"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { BrainCircuit, Code, Eraser, Lock, Play, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { MAX_MESSAGE, composeDirective, normalizeUrl, type Output, type Scope } from "@/lib/directive";
import { detectUrl } from "@/lib/templates";
import { useWorkspace } from "@/lib/workspace";
import { COMPOSER_ID } from "../layout/AppShell";
import { Switch } from "../layout/SettingsDialog";
import { ErrorState, SuccessState, cx } from "../ui/primitives";
import { BlueprintGrid } from "./BlueprintGrid";

const INSERTS: { label: string; text: string; tone: string }[] = [
  { label: "@summary", text: "give me a summary", tone: "text-primary" },
  { label: "@json", text: "return the extracted data in JSON format", tone: "text-secondary" },
  { label: "@contacts", text: "focus on contact details and social profiles", tone: "text-tertiary" },
];

const GUARDS: [string, string][] = [
  ["Approved tools only", "Allow-listed CLI binaries"],
  ["Public URLs only", "SSRF guard blocks private hosts"],
  ["robots.txt respected", "Disallowed paths are skipped"],
  ["Shell disabled", "argv exec, hard timeout"],
];

export function TaskComposer() {
  const ws = useWorkspace();
  const router = useRouter();
  const limits = ws.health?.limits;
  const directiveRef = useRef<HTMLTextAreaElement>(null);

  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState<number | null>(null);
  const [scope, setScope] = useState<Scope>("auto");
  const [output, setOutput] = useState<Output>("auto");
  const [error, setError] = useState<{ title: string; text: string } | null>(null);
  const [accepted, setAccepted] = useState<string | null>(null);

  const directive = ws.draft;
  const message = useMemo(() => composeDirective({ url, directive, maxPages, scope, output }), [url, directive, maxPages, scope, output]);
  const target = useMemo(() => detectUrl(url ? normalizeUrl(url) : directive), [url, directive]);
  const composed = message !== directive.trim();
  const runningCount = ws.history.filter((t) => t.status === "running" || t.status === "queued").length;
  const offline = ws.healthError;
  const canSend = message.trim().length > 0 && message.length <= MAX_MESSAGE && !ws.submitting && !offline;

  const dispatch = async () => {
    if (!canSend) return;
    setError(null);
    setAccepted(null);
    try {
      const id = await ws.submit(message);
      ws.setDraft("");
      setUrl("");
      if (ws.prefs.expandExecution) router.push(`/live?id=${id}`);
      else setAccepted(id);
    } catch (e) {
      setError({ title: (e as Error & { title?: string }).title ?? "Request rejected", text: (e as Error).message });
    }
  };

  const reset = () => { ws.setDraft(""); setUrl(""); setMaxPages(null); setScope("auto"); setOutput("auto"); setError(null); setAccepted(null); };

  const insert = (text: string) => {
    const el = directiveRef.current;
    const start = el?.selectionStart ?? directive.length;
    const before = directive.slice(0, start);
    const sep = before && !/[\s,]$/.test(before) ? ", " : "";
    const next = before + sep + text + directive.slice(el?.selectionEnd ?? start);
    ws.setDraft(next);
    requestAnimationFrame(() => { el?.focus(); const p = start + sep.length + text.length; el?.setSelectionRange(p, p); });
  };

  const [caretPos, setCaretPos] = useState(0);
  const caret = caretOf(directive, caretPos);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <BlueprintGrid onPick={(t) => {
        ws.setDraft(t.prompt);
        setUrl("");
        requestAnimationFrame(() => {
          const el = document.getElementById(COMPOSER_ID) as HTMLTextAreaElement | null;
          if (!el) return;
          el.focus();
          const i = t.prompt.indexOf(t.url);
          if (i >= 0) el.setSelectionRange(i, i + t.url.length); // type to replace the URL
        });
      }} />

      {/* Directive box */}
      <section className="flex flex-col rounded-xl bg-surface-container-low p-3 shadow-md">
        <div className="mb-3 flex flex-col gap-0.5">
          <label htmlFor="target-url" className="flex items-center justify-between gap-2 font-mono text-label-code uppercase tracking-wider text-on-surface-variant">
            <span>Target URL <span className="normal-case tracking-normal text-outline">(optional)</span></span>
            <span className="flex items-center gap-1 font-mono text-code-sm normal-case tracking-normal text-secondary">
              <Lock className="h-3 w-3" /> SSRF guard · public hosts only
            </span>
          </label>
          <div className="flex items-center gap-1 rounded-lg bg-surface-container-lowest px-3 py-2 focus-within:ring-1 focus-within:ring-primary/40">
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-label-code font-bold uppercase text-primary">
              {/^http:\/\//i.test(url) ? "HTTP" : "HTTPS"}
            </span>
            <input id="target-url" type="url" inputMode="url" autoComplete="off" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); directiveRef.current?.focus(); } }}
              className="w-full min-w-0 bg-transparent font-mono text-code-lg text-on-surface outline-none placeholder:text-on-surface-variant/40" />
            {target && (
              <span className={cx("hidden shrink-0 items-center gap-1 rounded bg-surface-container px-2 py-0.5 font-mono text-label-code sm:flex",
                target.risky ? "text-warn" : "text-primary")}
                title={target.risky ? "Private or local addresses are blocked by the backend's SSRF guard" : `Detected target: ${target.url}`}>
                <span className={cx("h-1.5 w-1.5 rounded-full", target.risky ? "bg-warn" : "bg-primary")} />
                {target.risky ? "will be blocked" : target.host}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={COMPOSER_ID} className="flex items-center gap-1 font-mono text-label-code uppercase tracking-wider text-on-surface-variant">
              <BrainCircuit className="h-3.5 w-3.5 text-primary" /> Natural-language directive
            </label>
            <div className="flex items-center gap-1 font-mono text-label-code">
              <span className="hidden text-on-surface-variant sm:inline">Insert:</span>
              {INSERTS.map((t) => (
                <button key={t.label} type="button" onClick={() => insert(t.text)} title={`Insert "${t.text}"`}
                  className={cx("rounded bg-surface-container-high px-1.5 py-0.5 transition-colors hover:bg-surface-bright", t.tone)}>{t.label}</button>
              ))}
            </div>
          </div>
          <div className="relative rounded-lg bg-surface-container-lowest p-3 focus-within:ring-1 focus-within:ring-primary/40">
            <textarea id={COMPOSER_ID} ref={directiveRef} rows={4} value={directive}
              onChange={(e) => ws.setDraft(e.target.value.slice(0, MAX_MESSAGE))}
              onSelect={(e) => setCaretPos(e.currentTarget.selectionStart)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); dispatch(); } }}
              placeholder="Describe the task, e.g. Crawl https://example.com, extract the important information, give me a summary and return the data as JSON."
              className="w-full resize-y bg-transparent font-mono text-code-lg leading-relaxed text-on-surface outline-none placeholder:text-on-surface-variant/40" />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-code-sm text-on-surface-variant">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className={cx("flex items-center gap-1", message.length > MAX_MESSAGE ? "text-error" : "text-primary")}>
                  <Sparkles className="h-3.5 w-3.5" /> {message.length.toLocaleString()} / {MAX_MESSAGE.toLocaleString()} chars
                </span>
                <span className="text-outline-variant">•</span>
                <span className="truncate">Parser: {ws.health ? (ws.health.llm.enabled ? `${ws.health.llm.provider} · ${ws.health.llm.model}` : "rule-based") : "…"}</span>
              </div>
              <span className="text-label-code text-on-surface-variant/70">Line {caret.line}, Col {caret.col}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Execution parameters */}
      <section className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-3 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <SlidersHorizontal className="h-4.5 w-4.5 text-secondary" />
            <h2 className="text-headline-sm font-semibold text-on-surface">Execution Parameters</h2>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-label-code uppercase text-primary">Backend-enforced limits</span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Tile label="Max pages" value={maxPages == null ? "Auto" : `${maxPages} Pages`} valueClass="text-secondary">
            <input type="range" min={1} max={limits?.max_pages ?? 20} value={maxPages ?? Math.min(5, limits?.max_pages ?? 5)}
              onChange={(e) => setMaxPages(Number(e.target.value))} disabled={scope === "homepage"} aria-label="Maximum pages"
              className="h-1.5 w-full cursor-pointer accent-secondary disabled:opacity-40" />
            <div className="flex justify-between font-mono text-label-code text-on-surface-variant/60">
              {maxPages == null ? <span>backend default</span> : <button type="button" onClick={() => setMaxPages(null)} className="text-secondary hover:underline">reset to auto</button>}
              <span>{limits?.max_pages ?? "–"} max</span>
            </div>
          </Tile>

          <Tile label="Crawl scope" value={`depth ≤ ${limits?.max_depth ?? "–"}`} valueClass="text-primary">
            <Select value={scope} onChange={(v) => setScope(v as Scope)} label="Crawl scope"
              options={[["auto", "Auto (from directive)"], ["homepage", "Homepage only"], ["standard", "Standard crawl"], ["deep", "Deep crawl (entire site)"]]} />
            <span className="truncate font-mono text-label-code text-on-surface-variant">Depth chosen by intent engine</span>
          </Tile>

          <Tile label="Concurrency" value={limits ? `${runningCount} / ${limits.max_concurrent_tasks}` : "–"} valueClass="text-primary">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: limits ? `${Math.min(100, (runningCount / limits.max_concurrent_tasks) * 100)}%` : 0 }} />
            </div>
            <div className="flex justify-between font-mono text-label-code text-on-surface-variant/60">
              <span>tasks running</span><span>{limits ? `${limits.cli_timeout_s}s timeout` : "–"}</span>
            </div>
          </Tile>

          <Tile label="Output format" value={<Code className="h-3.5 w-3.5 text-tertiary" />}>
            <Select value={output} onChange={(v) => setOutput(v as Output)} label="Output format"
              options={[["auto", "Auto (from directive)"], ["both", "Summary + JSON"], ["json", "Structured JSON"], ["summary", "AI summary"]]} />
            <span className="truncate font-mono text-label-code text-on-surface-variant">Adds an instruction to the message</span>
          </Tile>
        </div>

        <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2 xl:grid-cols-4">
          {GUARDS.map(([title, hint]) => (
            <div key={title} className="flex items-center justify-between rounded-lg bg-surface-container-lowest p-2" title="Always enforced by the backend">
              <div className="flex min-w-0 flex-col pr-2">
                <span className="truncate text-body-md font-medium text-on-surface">{title}</span>
                <span className="truncate font-mono text-label-code text-on-surface-variant">{hint}</span>
              </div>
              <Switch checked disabled label={`${title} (always on)`} />
            </div>
          ))}
        </div>
      </section>

      {composed && message && (
        <div className="rounded-xl bg-surface-container-lowest px-3 py-2">
          <div className="mb-0.5 font-mono text-label-code uppercase tracking-wider text-on-surface-variant">Message sent to the backend</div>
          <p className="break-words font-mono text-code-sm text-on-surface">{message}</p>
        </div>
      )}

      {error && <ErrorState title={error.title} onRetry={dispatch}>{error.text}</ErrorState>}
      {accepted && (
        <SuccessState title="Task accepted by the backend">
          Task <button type="button" onClick={() => router.push(`/live?id=${accepted}`)} className="font-mono text-primary hover:underline">{accepted.slice(0, 8)}</button> is running. Open Live CLI Execution to follow it.
        </SuccessState>
      )}

      {/* Action footer */}
      <div className="flex flex-col items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3 shadow-sm sm:flex-row">
        <div className="flex items-center gap-2 font-mono text-code-sm text-on-surface-variant">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          <span>{offline ? <span className="text-error">Backend offline — dispatch disabled</span> : <>Intent, URL and limits are <strong className="text-on-surface">re-validated server-side</strong></>}</span>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button type="button" onClick={reset}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-container px-3 py-2 text-label-md font-medium text-on-surface shadow-sm transition-colors hover:bg-surface-bright sm:flex-initial">
            <Eraser className="h-4 w-4 text-secondary" /> Reset
          </button>
          <button type="button" onClick={dispatch} disabled={!canSend}
            className="glow-primary-lg flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary-container px-6 py-2 text-label-md font-medium text-on-primary-container transition-all hover:bg-primary active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none sm:flex-initial">
            <Play className="h-4 w-4" fill="currentColor" />
            {ws.submitting ? "Dispatching…" : "Dispatch Agent Task"}
            <kbd className="ml-1 hidden rounded bg-on-primary-container/20 px-1.5 py-0.5 text-label-code text-on-primary-container sm:inline">Ctrl ↵</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, valueClass, children }: { label: string; value: React.ReactNode; valueClass?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-1 rounded-lg bg-surface-container p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-label-code uppercase text-on-surface-variant">{label}</span>
        <span className={cx("font-mono text-code-lg font-bold", valueClass)}>{value}</span>
      </div>
      {children}
    </div>
  );
}

function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: [string, string][]; label: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
      className="cursor-pointer rounded border-0 bg-surface-container-lowest p-1.5 font-mono text-code-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/40">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

/** Line/column of the caret in the directive textarea. */
function caretOf(text: string, pos: number) {
  const before = text.slice(0, Math.min(pos, text.length)).split("\n");
  return { line: before.length, col: before[before.length - 1].length + 1 };
}
