"use client";

import { useEffect, useMemo, type RefObject } from "react";
import { ArrowUp, Globe, Link2, Loader2, ShieldAlert } from "lucide-react";
import { Kbd, cx } from "../ui/primitives";

const MAX = 2000;
const URL_RE = /https?:\/\/[^\s<>"'`]+|(?<![@\w.-])(?:[a-z0-9-]+\.)+[a-z]{2,24}(?:\/[^\s<>"'`]*)?/i;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1\]?|169\.254\.)|\.(local|internal)$/i;

/** First URL in the text, for the "target" hint. The backend re-validates everything; this is only a preview. */
export function detectUrl(text: string): { url: string; host: string; risky: boolean } | null {
  const m = text.match(URL_RE);
  if (!m) return null;
  const url = m[0].replace(/[.,;:!?)\]}]+$/, "");
  const host = url.replace(/^https?:\/\//i, "").split(/[/:?#]/)[0].toLowerCase();
  if (!host.includes(".") && host !== "localhost") return null;
  return { url, host, risky: PRIVATE_HOST.test(host) };
}

export function ChatInput({ value, onChange, onSubmit, submitting, disabledReason, inputRef, variant = "dock", autoFocus }: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  disabledReason?: string | null;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  variant?: "hero" | "dock";
  autoFocus?: boolean;
}) {
  const target = useMemo(() => detectUrl(value), [value]);
  const canSend = value.trim().length > 0 && !submitting && !disabledReason;

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, variant === "hero" ? 240 : 200)}px`;
  }, [value, inputRef, variant]);

  // Desktop only: on touch devices autofocus would pop the keyboard and scroll the hero away.
  useEffect(() => {
    if (autoFocus && window.matchMedia("(min-width: 768px) and (pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus, inputRef]);

  const insertUrl = () => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const before = value.slice(0, start);
    const ins = `${before && !/\s$/.test(before) ? " " : ""}https://`;
    const next = before + ins + value.slice(el.selectionEnd ?? start);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + ins.length, start + ins.length); });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (canSend) onSubmit(); }}
      className={cx("group relative rounded-2xl border bg-surface transition-[border-color,box-shadow]",
        "border-line-strong focus-within:border-accent/50 focus-within:shadow-[0_0_0_4px_#8b9bff14]",
        variant === "hero" ? "shadow-2xl shadow-black/30" : "shadow-lg shadow-black/20")}>
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (canSend) onSubmit(); }
        }}
        rows={variant === "hero" ? 3 : 1}
        aria-label="Describe a task"
        placeholder={variant === "hero" ? "Describe a task, e.g. Crawl https://example.com, summarise it and return the data as JSON" : "Describe another task…"}
        className={cx("block w-full resize-none bg-transparent px-4 text-[15px] leading-relaxed text-fg placeholder:text-subtle focus:outline-none",
          variant === "hero" ? "min-h-[92px] pt-4" : "min-h-[52px] pt-3.5")}
      />
      <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
        <button type="button" onClick={insertUrl} title="Insert a URL"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-muted transition-colors hover:bg-raised hover:text-fg">
          <Link2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">URL</span>
        </button>

        {target && (
          <span title={target.risky ? "Private or local addresses are blocked by the backend's SSRF guard" : `Detected target: ${target.url}`}
            className={cx("inline-flex min-w-0 items-center gap-1.5 truncate rounded-md px-2 py-1 text-[11px] font-medium",
              target.risky ? "bg-warn/10 text-warn" : "bg-accent-soft text-accent")}>
            {target.risky ? <ShieldAlert className="h-3 w-3 shrink-0" /> : <Globe className="h-3 w-3 shrink-0" />}
            <span className="truncate">{target.risky ? `${target.host} · will be blocked` : target.host}</span>
          </span>
        )}

        <div className="ml-auto flex items-center gap-2.5">
          {disabledReason ? (
            <span className="hidden text-[11px] text-bad sm:inline">{disabledReason}</span>
          ) : value.length > MAX * 0.8 ? (
            <span className={cx("font-mono text-[11px]", value.length >= MAX ? "text-bad" : "text-subtle")}>{value.length}/{MAX}</span>
          ) : (
            <span className="hidden items-center gap-1 text-[11px] text-subtle md:flex"><Kbd>Enter</Kbd> run <Kbd>Shift Enter</Kbd> new line</span>
          )}
          <button type="submit" disabled={!canSend} aria-label="Run task"
            className={cx("flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
              canSend ? "bg-accent text-[#0c0d10] hover:bg-[#a3b0ff]" : "bg-raised text-subtle")}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />}
          </button>
        </div>
      </div>
    </form>
  );
}
