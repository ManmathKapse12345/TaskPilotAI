"use client";

import type { ReactNode } from "react";
import { ArrowRight, ShieldCheck, Terminal } from "lucide-react";
import type { Health } from "@/lib/api";
import { SectionLabel } from "../ui/primitives";
import { MANDATORY_DEMO, SuggestedTasks, type Template } from "./SuggestedTasks";

const PIPELINE = ["Understand", "Validate", "Run CLI", "Verify", "Respond"];

export function WelcomeScreen({ composer, health, onPick, onRun, busy }: {
  composer: ReactNode;
  health: Health | null;
  onPick: (t: Template) => void;
  onRun: (prompt: string) => void;
  busy: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col px-4 pb-10 pt-[min(12vh,96px)] sm:px-6">
      <div className="animate-fade-up">
        <div className="mb-5 flex flex-wrap items-center gap-1.5 text-[11px] text-subtle">
          {PIPELINE.map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="rounded-md border border-line bg-surface px-2 py-0.5 text-muted">{s}</span>
              {i < PIPELINE.length - 1 && <ArrowRight className="h-3 w-3" />}
            </span>
          ))}
        </div>
        <h2 className="text-[28px] font-semibold leading-[1.15] tracking-tight text-fg sm:text-[34px]">
          Turn your instructions into real execution.
        </h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          Describe a task. Let your AI agent execute it, monitor progress, and return verified results.
        </p>
      </div>

      <div className="animate-fade-up mt-7" style={{ animationDelay: "40ms" }}>{composer}</div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <button onClick={() => onRun(MANDATORY_DEMO)} disabled={busy}
          className="inline-flex items-center gap-1.5 font-medium text-accent transition-colors hover:text-[#a3b0ff] disabled:opacity-40">
          <Terminal className="h-3.5 w-3.5" /> Run the BuildSprint demo
        </button>
        <button onClick={() => onRun("Summarise http://localhost:8080/admin")} disabled={busy}
          className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-fg disabled:opacity-40">
          <ShieldCheck className="h-3.5 w-3.5" /> Try a blocked request
        </button>
      </div>

      <SectionLabel className="mb-2.5 mt-10">Start from a template</SectionLabel>
      <SuggestedTasks onPick={onPick} onRun={onRun} disabled={busy} />

      <p className="mt-8 text-[11px] leading-relaxed text-subtle">
        {health
          ? <>Approved tool: <span className="font-mono text-muted">{health.tools.join(", ")}</span> · up to {health.limits.max_pages} pages, depth {health.limits.max_depth} · {health.limits.cli_timeout_s}s hard timeout · public URLs only · robots.txt respected</>
          : "Only approved CLI tools run · public URLs only · robots.txt respected"}
      </p>
    </div>
  );
}
