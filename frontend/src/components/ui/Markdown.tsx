import { Fragment, type ReactNode } from "react";
import { cx } from "./primitives";

/** Small, safe Markdown subset: paragraphs, bullets, headings, **bold**, *italic*, `code`. Raw HTML is never rendered. */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const inline = (s: string, key: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={key + i} className="font-semibold text-fg">{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={key + i} className="rounded bg-raised px-1 py-0.5 font-mono text-[0.85em] text-accent">{part.slice(1, -1)}</code>;
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={key + i}>{part.slice(1, -1)}</em>;
      return <Fragment key={key + i}>{part}</Fragment>;
    });

  return (
    <div className={cx("space-y-3 leading-relaxed", className)}>
      {text.split(/\n{2,}/).map((block, bi) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={bi} className="space-y-1.5">
              {lines.map((l, li) => (
                <li key={li} className="flex gap-2.5"><span className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-subtle" />
                  <span>{inline(l.replace(/^\s*[-*•]\s+/, ""), `${bi}-${li}-`)}</span></li>
              ))}
            </ul>
          );
        }
        if (/^#{1,4}\s/.test(block)) return <h4 key={bi} className="font-semibold text-fg">{inline(block.replace(/^#{1,4}\s/, ""), `${bi}-`)}</h4>;
        return <p key={bi}>{lines.map((l, li) => <Fragment key={li}>{li > 0 && <br />}{inline(l, `${bi}-${li}-`)}</Fragment>)}</p>;
      })}
    </div>
  );
}
