"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Copy, Download } from "lucide-react";
import { Button, cx, formatBytes } from "../ui/primitives";
import { useToast } from "../ui/Toast";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** Collapsible tree + raw syntax-highlighted JSON. Built from React nodes; no innerHTML. */
export function JsonViewer({ value, filename }: { value: unknown; filename: string }) {
  const toast = useToast();
  const text = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const [mode, setMode] = useState<"tree" | "raw">("tree");
  // generation counter: bumping it remounts the tree with a new default depth
  const [tree, setTree] = useState({ gen: 0, depth: 2 });

  const copy = () => navigator.clipboard.writeText(text).then(
    () => toast({ tone: "success", title: "JSON copied", body: formatBytes(new Blob([text]).size) }),
    () => toast({ tone: "error", title: "Clipboard unavailable" }));
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ tone: "success", title: "Download started", body: filename });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#09090c]">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-2.5 py-2">
        <div className="flex rounded-lg border border-line bg-raised p-0.5">
          {(["tree", "raw"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={cx("rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors", mode === m ? "bg-overlay text-fg" : "text-subtle hover:text-muted")}>
              {m}
            </button>
          ))}
        </div>
        {mode === "tree" && (
          <>
            <Button variant="ghost" icon={<ChevronsUpDown className="h-3.5 w-3.5" />} onClick={() => setTree((t) => ({ gen: t.gen + 1, depth: 99 }))}>Expand all</Button>
            <Button variant="ghost" icon={<ChevronsDownUp className="h-3.5 w-3.5" />} onClick={() => setTree((t) => ({ gen: t.gen + 1, depth: 1 }))}>Collapse</Button>
          </>
        )}
        <span className="ml-auto hidden font-mono text-[11px] text-subtle sm:inline">{filename} · {formatBytes(new Blob([text]).size)}</span>
        <Button icon={<Copy className="h-3.5 w-3.5" />} onClick={copy}>Copy</Button>
        <Button icon={<Download className="h-3.5 w-3.5" />} onClick={download}>Download</Button>
      </div>
      <div className="max-h-[32rem] overflow-auto p-3 font-mono text-[12px] leading-[1.65]">
        {mode === "tree"
          ? <Node key={tree.gen} value={value as Json} depth={0} openDepth={tree.depth} last />
          : <Raw text={text} />}
      </div>
    </div>
  );
}

function Scalar({ v }: { v: Json }) {
  if (v === null) return <span className="text-subtle">null</span>;
  if (typeof v === "string") return <span className="whitespace-pre-wrap break-all text-[#9be3b4]">&quot;{v}&quot;</span>;
  if (typeof v === "number") return <span className="text-[#f5c47a]">{v}</span>;
  return <span className="text-[#c4a7ff]">{String(v)}</span>;
}

function Node({ name, value, depth, openDepth, last }: { name?: string; value: Json; depth: number; openDepth: number; last: boolean }) {
  const isObj = value !== null && typeof value === "object";
  const [open, setOpen] = useState(depth < openDepth);
  const key = name != null && <><span className="text-[#9db0ff]">&quot;{name}&quot;</span><span className="text-subtle">: </span></>;
  const comma = last ? null : <span className="text-subtle">,</span>;

  if (!isObj) return <div className="pl-4">{key}<Scalar v={value} />{comma}</div>;

  const arr = Array.isArray(value);
  const entries: [string | undefined, Json][] = arr ? (value as Json[]).map((v) => [undefined, v]) : Object.entries(value as Record<string, Json>);
  const [o, c] = arr ? ["[", "]"] : ["{", "}"];

  if (entries.length === 0) return <div className="pl-4">{key}<span className="text-subtle">{o}{c}</span>{comma}</div>;

  return (
    <div className={depth === 0 ? "" : "pl-4"}>
      <button onClick={() => setOpen((x) => !x)} className="-ml-4 inline-flex items-baseline text-left hover:bg-white/[0.03]" aria-expanded={open}>
        <ChevronRight className={cx("mr-0.5 h-3 w-3 self-center text-subtle transition-transform", open && "rotate-90")} />
        {key}<span className="text-subtle">{o}</span>
        {!open && <span className="mx-1 rounded bg-raised px-1 text-[10.5px] text-subtle">{entries.length} {arr ? "items" : "keys"}</span>}
        {!open && <span className="text-subtle">{c}</span>}
        {!open && comma}
      </button>
      {open && (
        <>
          <div className="border-l border-line/60">
            {entries.map(([k, v], i) => (
              <Node key={k ?? i} name={k} value={v} depth={depth + 1} openDepth={openDepth} last={i === entries.length - 1} />
            ))}
          </div>
          <div><span className="text-subtle">{c}</span>{comma}</div>
        </>
      )}
    </div>
  );
}

function Raw({ text }: { text: string }) {
  const tokens = useMemo(() => {
    const re = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;
    const out: { t: string; c: string }[] = [];
    let last = 0;
    for (const m of text.matchAll(re)) {
      if (m.index! > last) out.push({ t: text.slice(last, m.index), c: "text-subtle" });
      const tok = m[0];
      const c = tok.startsWith('"') ? (m[2] ? "text-[#9db0ff]" : "text-[#9be3b4]") : /true|false/.test(tok) ? "text-[#c4a7ff]" : tok === "null" ? "text-subtle" : "text-[#f5c47a]";
      out.push({ t: tok, c });
      last = m.index! + tok.length;
    }
    out.push({ t: text.slice(last), c: "text-subtle" });
    return out;
  }, [text]);
  return <pre className="w-max min-w-full">{tokens.map((tk, i) => <span key={i} className={tk.c}>{tk.t}</span>)}</pre>;
}
