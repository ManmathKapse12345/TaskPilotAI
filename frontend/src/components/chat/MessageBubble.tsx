"use client";

import type { ReactNode } from "react";
import { AlertCircle, Copy, RotateCw } from "lucide-react";
import { LogoMark } from "../layout/Logo";
import { Markdown } from "../ui/Markdown";
import { Button, cx } from "../ui/primitives";
import { useToast } from "../ui/Toast";

export function UserMessage({ text }: { text: string }) {
  const toast = useToast();
  return (
    <div className="animate-fade-up group flex justify-end">
      <div className="flex max-w-[min(85%,640px)] flex-col items-end gap-1">
        <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-line bg-raised px-4 py-2.5 text-[14px] leading-relaxed text-fg">
          {text}
        </div>
        <button onClick={() => navigator.clipboard.writeText(text).then(() => toast({ tone: "success", title: "Prompt copied" }), () => toast({ tone: "error", title: "Clipboard unavailable" }))}
          className="flex items-center gap-1 rounded px-1 text-[11px] text-subtle opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 focus:opacity-100">
          <Copy className="h-3 w-3" /> Copy
        </button>
      </div>
    </div>
  );
}

export function AssistantMessage({ children, meta, tone = "default" }: { children: ReactNode; meta?: ReactNode; tone?: "default" | "error" }) {
  return (
    <div className="animate-fade-up flex gap-3">
      <LogoMark className="mt-0.5 h-7 w-7 rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className={cx("rounded-2xl rounded-tl-md border px-4 py-3 text-[14px] leading-relaxed",
          tone === "error" ? "border-bad/25 bg-bad/[0.06] text-fg" : "border-line bg-surface text-muted")}>
          {children}
        </div>
        {meta && <div className="mt-1.5 px-1 text-[11px] text-subtle">{meta}</div>}
      </div>
    </div>
  );
}

export function AnswerMessage({ text, meta }: { text: string; meta?: ReactNode }) {
  return <AssistantMessage meta={meta}><Markdown text={text} /></AssistantMessage>;
}

export function ErrorMessage({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <AssistantMessage tone="error">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-fg">{title}</div>
          <div className="mt-0.5 break-words text-[13px] text-muted">{body}</div>
          {onRetry && <Button className="mt-3" icon={<RotateCw className="h-3.5 w-3.5" />} onClick={onRetry}>Try again</Button>}
        </div>
      </div>
    </AssistantMessage>
  );
}
