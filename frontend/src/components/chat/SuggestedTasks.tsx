"use client";

import { Braces, FileSearch, Globe, Play, ScrollText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const MANDATORY_DEMO =
  "Crawl https://example.com, extract the important information, give me a summary, and return the extracted data in JSON format.";

export interface Template {
  title: string;
  description: string;
  icon: LucideIcon;
  prompt: string;
  /** The part of the prompt to pre-select so the user can type their own URL over it. */
  url: string;
}

export const TEMPLATES: Template[] = [
  {
    title: "Crawl a website",
    description: "Run the full pipeline: crawl, extract, summarise, return JSON.",
    icon: Globe,
    prompt: MANDATORY_DEMO,
    url: "https://example.com",
  },
  {
    title: "Extract website data",
    description: "Headings, links, contact details and social profiles across several pages.",
    icon: FileSearch,
    prompt: "Crawl 5 pages of https://books.toscrape.com and extract the headings, links, contact details and social profiles.",
    url: "https://books.toscrape.com",
  },
  {
    title: "Generate website summary",
    description: "A plain-language overview of what the site is and who it is for.",
    icon: ScrollText,
    prompt: "Summarise https://www.python.org: what the site offers, its main sections and who it is for.",
    url: "https://www.python.org",
  },
  {
    title: "Convert website data into JSON",
    description: "Homepage only, returned as clean structured JSON.",
    icon: Braces,
    prompt: "Crawl only the homepage of https://quotes.toscrape.com and return the extracted data in JSON format.",
    url: "https://quotes.toscrape.com",
  },
];

export function SuggestedTasks({ onPick, onRun, disabled }: {
  onPick: (t: Template) => void;
  onRun: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {TEMPLATES.map((t, i) => (
        <div key={t.title} style={{ animationDelay: `${80 + i * 40}ms` }}
          className="animate-fade-up group relative flex rounded-xl border border-line bg-surface/70 transition-colors hover:border-line-strong hover:bg-surface">
          <button type="button" onClick={() => onPick(t)} className="flex min-w-0 flex-1 items-start gap-3 p-3.5 pr-12 text-left">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-raised text-muted transition-colors group-hover:text-accent">
              <t.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-fg">{t.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-subtle">{t.description}</span>
            </span>
          </button>
          <button type="button" onClick={() => onRun(t.prompt)} disabled={disabled} title="Run this task now" aria-label={`Run "${t.title}" now`}
            className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-md text-subtle opacity-100 transition hover:bg-accent-soft hover:text-accent disabled:opacity-30 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
            <Play className="h-3.5 w-3.5" fill="currentColor" />
          </button>
        </div>
      ))}
    </div>
  );
}
