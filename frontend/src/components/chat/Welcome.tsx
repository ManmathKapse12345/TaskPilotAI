"use client";

import { ArrowRight } from "lucide-react";
import { TEMPLATES, type Template } from "@/lib/templates";
import { useWorkspace } from "@/lib/workspace";
import { cx } from "../ui/primitives";
import { WithUrls } from "./bits";

const STEPS = [
  ["01", "Describe your task", "Give a URL and say what you need, in plain English.", "bg-tertiary-container/30 text-tertiary"],
  ["02", "Watch it run live", "The backend runs a real CLI crawler; you see every step.", "bg-secondary/15 text-secondary"],
  ["03", "Get summary + JSON", "A readable summary plus structured, valid JSON.", "bg-primary/15 text-primary"],
] as const;

const TONE: Record<Template["tone"], string> = { primary: "text-primary", secondary: "text-secondary", tertiary: "text-tertiary", outline: "text-outline" };

/** Stitch "New Chat" empty state. */
export function Welcome({ onPick, onRun }: { onPick: (t: Template) => void; onRun: (prompt: string) => void }) {
  const ws = useWorkspace();
  const tool = ws.health?.tools[0] ?? "site-crawler";
  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-[880px] flex-col items-center pt-6 text-center sm:pt-10">
      <span className="flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1 font-mono text-label-code uppercase tracking-wider text-on-surface-variant">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />Website crawler &amp; CLI runner
      </span>
      <h1 className="mt-4 text-[28px] font-semibold leading-tight tracking-tight text-on-surface sm:text-headline-xl">What should I do for you?</h1>
      <p className="mt-3 max-w-xl text-body-lg text-on-surface-variant">
        Give me a website and tell me what you need. I&apos;ll crawl it with a real command-line tool and reply with a summary and data.
      </p>

      <ol className="mt-8 grid w-full grid-cols-1 gap-3 rounded-xl bg-surface-container-low p-4 text-left md:grid-cols-3">
        {STEPS.map(([n, title, text, cls]) => (
          <li key={n} className="flex items-start gap-3">
            <span className={cx("flex h-7 w-8 shrink-0 items-center justify-center rounded font-mono text-code-sm font-semibold", cls)}>{n}</span>
            <span><span className="block text-body-lg font-medium text-on-surface">{title}</span><span className="block text-body-sm text-on-surface-variant">{text}</span></span>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid w-full grid-cols-1 gap-3 text-left md:grid-cols-2">
        {TEMPLATES.map((t, i) => (
          <div key={t.title} className="group relative flex flex-col rounded-xl bg-surface-container-low transition-colors hover:bg-surface-container">
            <button type="button" onClick={() => onPick(t)} className="flex flex-1 flex-col gap-2 p-4 pb-10 text-left">
              <span className="flex items-center justify-between gap-2">
                <span className={cx("flex items-center gap-1.5 truncate font-mono text-code-sm", TONE[t.tone])}><t.icon className="h-4 w-4 shrink-0" />{t.url}</span>
                <span className={cx("shrink-0 rounded px-1.5 py-0.5 font-mono text-label-code", i === 0 ? "bg-primary/10 text-primary" : "text-on-surface-variant")}>{i === 0 ? "Quickstart" : t.tag}</span>
              </span>
              <span className="line-clamp-2 text-body-md text-on-surface"><WithUrls text={t.prompt} /></span>
            </button>
            <span className="pointer-events-none absolute bottom-3 left-4 font-mono text-label-code text-on-surface-variant">CLI :: {tool}</span>
            <button type="button" onClick={() => onRun(t.prompt)} disabled={ws.submitting || ws.healthError} title="Run this example now" aria-label={`Run "${t.title}" now`}
              className="absolute bottom-2 right-2 rounded-lg p-1.5 text-primary transition-colors hover:bg-primary/10 disabled:opacity-40">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
