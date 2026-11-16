import { Sparkles } from "lucide-react";
import type { Summary } from "@/lib/api";
import { Markdown } from "../ui/Markdown";
import { Chip, SectionLabel } from "../ui/primitives";

export function SummaryView({ summary: s }: { summary: Summary }) {
  const findings = Object.entries(s.focus_findings || {});
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone="accent"><Sparkles className="h-3 w-3" /> {s.generated_by}</Chip>
        {s.site_type && <Chip>{s.site_type}</Chip>}
        <span className="text-[11px] text-subtle">Written only from content captured by the CLI</span>
      </div>

      <div className="max-w-[68ch] text-[14.5px] text-[#cfcfd8]">
        <Markdown text={s.text} />
      </div>

      {s.key_points.length > 0 && (
        <div>
          <SectionLabel className="mb-2.5">Key points</SectionLabel>
          <ol className="grid gap-2 sm:grid-cols-2">
            {s.key_points.map((k, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-line bg-raised/40 px-3 py-2.5 text-[13px] leading-relaxed text-muted">
                <span className="font-mono text-[11px] leading-[1.6rem] text-accent">{String(i + 1).padStart(2, "0")}</span>
                <span>{k}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {findings.length > 0 && (
        <div>
          <SectionLabel className="mb-2.5">What you asked about</SectionLabel>
          <dl className="space-y-2">
            {findings.map(([k, v]) => (
              <div key={k} className="rounded-lg border border-line px-3.5 py-2.5">
                <dt className="text-xs font-medium capitalize text-accent">{k}</dt>
                <dd className="mt-0.5 text-[13px] leading-relaxed text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
