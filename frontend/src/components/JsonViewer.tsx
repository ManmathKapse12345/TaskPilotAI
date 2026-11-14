"use client";

import { useMemo, useState } from "react";
import { Button } from "./ui";

/** Syntax-highlighted JSON with copy + download. Built from React nodes (no innerHTML). */
export function JsonViewer({ value, filename }: { value: unknown; filename: string }) {
  const text = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const [copied, setCopied] = useState(false);

  const tokens = useMemo(() => {
    const re = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;
    const out: { t: string; c: string }[] = [];
    let last = 0;
    for (const m of text.matchAll(re)) {
      if (m.index! > last) out.push({ t: text.slice(last, m.index), c: "text-slate-500" });
      const tok = m[0];
      const c = tok.startsWith('"') ? (m[2] ? "text-sky-300" : "text-emerald-300") : /true|false/.test(tok) ? "text-violet-300" : tok === "null" ? "text-slate-500" : "text-amber-300";
      out.push({ t: tok, c });
      last = m.index! + tok.length;
    }
    out.push({ t: text.slice(last), c: "text-slate-500" });
    return out;
  }, [text]);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5">
        <span className="font-mono text-xs text-slate-400">{filename} · valid JSON · {(text.length / 1024).toFixed(1)} KB</span>
        <div className="flex gap-1.5">
          <Button onClick={copy}>{copied ? "Copied ✓" : "Copy"}</Button>
          <Button onClick={download}>Download</Button>
        </div>
      </div>
      <pre className="max-h-[28rem] overflow-auto p-3 font-mono text-xs leading-relaxed">
        {tokens.map((tk, i) => <span key={i} className={tk.c}>{tk.t}</span>)}
      </pre>
    </div>
  );
}
