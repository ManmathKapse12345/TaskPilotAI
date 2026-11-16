"use client";

import { TEMPLATES, type Template } from "@/lib/templates";
import { cx } from "../ui/primitives";

const TONE: Record<Template["tone"], string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  tertiary: "text-tertiary",
  outline: "text-outline",
};

/** "Task Blueprints": each fills the directive box with a ready prompt (URL pre-selected for overtyping). */
export function BlueprintGrid({ onPick }: { onPick: (t: Template) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-label-code uppercase tracking-wider text-on-surface-variant">Task Blueprints</span>
        <span className="font-mono text-code-sm text-secondary">{TEMPLATES.length} templates</span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {TEMPLATES.map((t, i) => (
          <button key={t.title} type="button" onClick={() => onPick(t)} title={t.prompt}
            className={cx("group flex flex-col rounded-xl bg-surface-container-low p-2 text-left shadow-sm transition-all hover:bg-surface-container",
              i > 0 && "opacity-80 hover:opacity-100")}>
            <span className="mb-1 flex w-full items-center justify-between">
              <t.icon className={cx("h-4.5 w-4.5 transition-transform group-hover:scale-110", TONE[t.tone])} />
              <span className={cx("rounded px-1.5 font-mono text-label-code", i === 0 ? "bg-primary/10 text-primary" : "bg-surface-container-high text-on-surface-variant")}>{t.tag}</span>
            </span>
            <span className="truncate text-body-md font-medium text-on-surface">{t.title}</span>
            <span className="truncate font-mono text-code-sm text-on-surface-variant">{t.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
